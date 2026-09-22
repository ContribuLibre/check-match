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

/**
 * Star with one branch per criterion — the shape for 3+ criteria.
 *
 * Each branch points at a fixed angle (so a given criterion always sits at the
 * same place and shapes stay comparable at a glance) and its length encodes the
 * value. Unanswered criteria collapse to the hollow radius: the branch is simply
 * absent instead of reading as a zero.
 *
 * @param {Array<number|null>} values normalized 0..1, one per criterion
 */
export function starGeometry(values, {
	size = 100,
	hollowRatio = 0.28, // radius of the valleys between branches
	minRatio = 0.3,     // length of a branch answered at 0 — never zero, or it vanishes
	rotation = -Math.PI / 2, // first branch points up
} = {}) {
	const branches = values.length;
	if (branches < 1) throw new TypeError("A star needs at least one branch.");
	const radius = size / 2;
	const hollow = radius * hollowRatio;
	const step = TAU / branches;

	const tips = values.map((value, index) => {
		const angle = rotation + index * step;
		const answered = value !== null && value !== undefined;
		const reach = answered
			? radius * (minRatio + (1 - minRatio) * value)
			: hollow;
		return {
			...point(Math.cos(angle) * reach, Math.sin(angle) * reach),
			angle,
			reach: round(reach),
			index,
			answered,
		};
	});

	// Valleys sit halfway between two consecutive branches.
	const valleys = values.map((_, index) => {
		const angle = rotation + (index + 0.5) * step;
		return {...point(Math.cos(angle) * hollow, Math.sin(angle) * hollow), angle, index};
	});

	const outline = [];
	for (let index = 0; index < branches; index++) {
		outline.push(tips[index], valleys[index]);
	}
	const path = `M ${outline.map(p => `${p.x} ${p.y}`).join(" L ")} Z`;

	return {branches, radius, hollow, tips, valleys, outline, path};
}

/** Axis guides for the star: one spoke per criterion, drawn under the shape. */
export function starAxes(branches, {size = 100, rotation = -Math.PI / 2} = {}) {
	const radius = size / 2;
	const step = TAU / branches;
	return Array.from({length: branches}, (_, index) => {
		const angle = rotation + index * step;
		return {
			index,
			angle,
			from: point(0, 0),
			to: point(Math.cos(angle) * radius, Math.sin(angle) * radius),
			label: point(Math.cos(angle) * radius * 1.18, Math.sin(angle) * radius * 1.18),
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
