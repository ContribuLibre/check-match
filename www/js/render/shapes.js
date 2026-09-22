// Pure geometry for the answer indicators.
//
// No DOM here: every function returns coordinates and SVG path data. That keeps
// the shapes unit-testable, and lets the same code draw in the page, in an export,
// or in a comparison view later.
//
// Convention: values are 0..1 or null (unanswered), and shapes are drawn in a
// square viewBox centred on (0,0) with a radius of `size / 2`.

const TAU = Math.PI * 2;

const round = value => Math.round(value * 1000) / 1000;
const point = (x, y) => ({x: round(x), y: round(y)});

const polar = (angle, reach) => point(Math.cos(angle) * reach, Math.sin(angle) * reach);
const polygon = points => points.map(p => `${p.x},${p.y}`).join(" ");

/** Length of a branch for a given score: never zero, or an answer would vanish. */
export const branchReach = score => MIN_BRANCH + score * (1 - MIN_BRANCH);
const MIN_BRANCH = 0.25;

/**
 * Star with one sector per criterion — the shape for 3+ criteria.
 *
 * Each criterion owns an angular sector and is drawn as a spike: centre, the
 * sector's left edge at half reach, the tip at full reach, the right edge at
 * half reach. Sectors sit at fixed angles, so a criterion is always in the same
 * place and two stars compare at a glance.
 *
 * Every branch carries two shapes:
 *   `track` — the sector at full size, drawn as a pale gradient: the empty slot;
 *   `fill`  — the same sector scaled to the answer, drawn solid.
 *
 * Three states, three readings:
 *   unanswered   -> no fill at all, only the pale track;
 *   answered 0   -> a truncated triangle (no tip), so "the lowest level" still
 *                   shows as an answer rather than as nothing;
 *   answered > 0 -> a spike whose length grows with the score.
 *
 * @param {Array<number|null>} values scores 0..1, one per criterion
 */
export function starGeometry(values, {size = 100, rotation = -Math.PI / 2} = {}) {
	const branches = values.length;
	if (branches < 1) throw new TypeError("A star needs at least one branch.");
	const radius = size / 2;
	const wide = TAU / branches;

	const sectors = values.map((value, index) => {
		const direction = rotation + wide * index;
		const answered = value !== null && value !== undefined;
		const score = answered ? Math.min(Math.max(value, 0), 1) : 0;
		const reach = branchReach(score) * radius;

		const track = [
			point(0, 0),
			polar(direction - wide / 2, radius / 2),
			polar(direction, radius),
			polar(direction + wide / 2, radius / 2),
		];
		// A zero answer loses its tip: it must not read like a small positive one.
		const fill = score === 0
			? [point(0, 0), polar(direction - wide / 2, reach / 2), polar(direction + wide / 2, reach / 2)]
			: [
				point(0, 0),
				polar(direction - wide / 2, reach / 2),
				polar(direction, reach),
				polar(direction + wide / 2, reach / 2),
			];

		return {
			index, direction, answered, score,
			reach: round(reach),
			tip: polar(direction, reach),
			track, fill,
			trackPoints: polygon(track),
			fillPoints: polygon(fill),
		};
	});

	return {branches, radius, wide, sectors};
}

/**
 * Gradient geometry for each sector, in objectBoundingBox units.
 * The gradient runs along the sector's own direction, so every criterion reads
 * from its own low colour at the centre to its high colour at the tip.
 */
export function starGradients(branches, {rotation = -Math.PI / 2} = {}) {
	const wide = TAU / branches;
	return Array.from({length: branches}, (_, index) => {
		const direction = rotation + wide * index;
		const spike = polar(direction, 1);
		return {
			index,
			x1: Math.max(0, -spike.x),
			y1: Math.max(0, -spike.y),
			x2: Math.max(0, spike.x),
			y2: Math.max(0, spike.y),
		};
	});
}

/**
 * Thermometer — the shape for a single criterion.
 * Fills from the bottom, so "more" always reads as "higher".
 */
export function gaugeGeometry(value, {size = 100, thickness = 0.42} = {}) {
	const width = size * thickness;
	const height = size;
	const answered = value !== null && value !== undefined;
	const filled = answered ? height * value : 0;
	const radius = width / 2;
	return {
		answered,
		track: {x: round(-width / 2), y: round(-height / 2), width: round(width), height: round(height), radius: round(radius)},
		fill: {
			x: round(-width / 2),
			y: round(height / 2 - filled),
			width: round(width),
			height: round(filled),
			radius: round(radius),
		},
		level: round(height / 2 - filled),
	};
}

/**
 * Two criteria.
 *
 * 'yinyang'   — the S boundary shifts towards the weaker criterion, so the two
 *               areas read as a balance; the disc radius carries overall intensity.
 * 'amplitude' — first criterion on the vertical axis, second on the horizontal one,
 *               giving a flat/tall ellipse that reads the two magnitudes directly.
 */
export function duoGeometry(first, second, {size = 100, mode = "yinyang"} = {}) {
	const radius = size / 2;
	const firstAnswered = first !== null && first !== undefined;
	const secondAnswered = second !== null && second !== undefined;
	const a = firstAnswered ? first : 0;
	const b = secondAnswered ? second : 0;

	if (mode === "amplitude") {
		return {
			mode,
			answered: firstAnswered || secondAnswered,
			radius,
			ellipse: {
				cx: 0,
				cy: 0,
				ry: round(radius * (0.12 + 0.88 * a)), // vertical  = first criterion
				rx: round(radius * (0.12 + 0.88 * b)), // horizontal = second criterion
			},
		};
	}

	// Balance point: 0.5 when both are equal, drifting towards the weaker side.
	const total = a + b;
	const share = total === 0 ? 0.5 : a / total;
	const intensity = Math.max(a, b);
	const discRadius = radius * (0.35 + 0.65 * intensity);

	const firstArc = discRadius * share;
	const secondArc = discRadius - firstArc;
	const top = -discRadius;
	const middle = top + 2 * firstArc;

	// Boundary: down the first arc bulging right, then the second bulging left.
	const boundary = `M 0 ${round(top)}`
		+ ` A ${round(firstArc)} ${round(firstArc)} 0 0 1 0 ${round(middle)}`
		+ ` A ${round(secondArc)} ${round(secondArc)} 0 0 0 0 ${round(discRadius)}`;

	return {
		mode,
		answered: firstAnswered || secondAnswered,
		radius: round(discRadius),
		share: round(share),
		intensity: round(intensity),
		boundary,
		// Left half = boundary closed by the outer arc going counter-clockwise.
		firstHalf: `${boundary} A ${round(discRadius)} ${round(discRadius)} 0 0 1 0 ${round(top)} Z`,
		secondHalf: `${boundary} A ${round(discRadius)} ${round(discRadius)} 0 0 0 0 ${round(top)} Z`,
		eyes: [
			{...point(0, top + firstArc), radius: round(firstArc * 0.3)},
			{...point(0, discRadius - secondArc), radius: round(secondArc * 0.3)},
		],
	};
}
