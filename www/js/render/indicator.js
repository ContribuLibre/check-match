// Answer indicator: turns (answer model + values) into an SVG string.
//
// A string rather than DOM nodes, so the same call works for the page, for a
// static export and for tests. Shape choice follows the model's `display`, which
// itself defaults to the criteria count (1 gauge, 2 duo, 3+ star).

import {answerVector, isAnswered} from "../core/criteria.js";
import {duoGeometry, gaugeGeometry, starGeometry, starGradients} from "./shapes.js";

const escapeXml = text => String(text).replace(/[&<>"']/g, character => ({
	"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[character]));

const EMPTY_STROKE = "#c9c9c9";

function wrap(body, {size, padding, title}) {
	const extent = size / 2 + padding;
	return `<svg class="indicator" viewBox="${-extent} ${-extent} ${extent * 2} ${extent * 2}"`
		+ ` role="img" aria-label="${escapeXml(title)}">${body}</svg>`;
}

function describe(model, values) {
	return model.criteria.map(criterion => {
		const value = values[criterion.id];
		const level = value === null || value === undefined
			? "—"
			: criterion.scale.levels[value]?.label ?? value;
		return `${criterion.label}: ${level}`;
	}).join(", ");
}

/** Stable per-model gradient ids: identical across every star of one model. */
const gradientId = (model, criterion) => `cm-grad-${model.id}-${criterion.id}`;

/**
 * The <defs> a star needs. Emitted inline by default so one SVG stands alone;
 * pass `defs: "external"` and inject `starDefs(model)` once in the page when
 * rendering hundreds of stars, to avoid repeating them in every item.
 */
export function starDefs(model) {
	const gradients = starGradients(model.criteria.length);
	return `<defs>${model.criteria.map((criterion, index) => {
		const {x1, y1, x2, y2} = gradients[index];
		return `<linearGradient id="${escapeXml(gradientId(model, criterion))}"`
			+ ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`
			+ `<stop offset="0%" stop-color="${escapeXml(criterion.minColor)}"/>`
			+ `<stop offset="100%" stop-color="${escapeXml(criterion.maxColor)}"/>`
			+ `</linearGradient>`;
	}).join("")}</defs>`;
}

function renderStar(model, values, {size, padding, defs}) {
	const vector = answerVector(model, values);
	const {sectors} = starGeometry(vector, {size});
	const stroke = size * 0.008;

	const tracks = sectors.map((sector, index) => {
		const criterion = model.criteria[index];
		// Gradient, then a white veil over it: the empty slot stays legible as
		// "this criterion exists, here is its direction" without competing with
		// the answer drawn on top.
		// The veil follows the page background rather than being hard-coded white,
		// so the pale slot stays pale on a dark theme instead of glaring.
		return `<polygon class="indicator-track" points="${sector.trackPoints}"`
			+ ` fill="url(#${escapeXml(gradientId(model, criterion))})"/>`
			+ `<polygon points="${sector.trackPoints}" fill="var(--indicator-veil, #ffffff)"`
			+ ` fill-opacity="var(--indicator-veil-opacity, 0.8)"/>`;
	}).join("");

	const fills = sectors.map((sector, index) => {
		if (!sector.answered) return "";
		const criterion = model.criteria[index];
		return `<polygon class="indicator-fill" data-criterion="${escapeXml(criterion.id)}"`
			+ ` points="${sector.fillPoints}" fill="${escapeXml(criterion.maxColor)}"/>`;
	}).join("");

	const outlines = sectors.map(sector =>
		`<polygon class="indicator-sector" points="${sector.trackPoints}" fill="none"`
		+ ` stroke="var(--indicator-stroke, #000000)" stroke-width="${stroke}"/>`).join("");

	const body = (defs === "external" ? "" : starDefs(model)) + tracks + fills + outlines;
	return wrap(body, {size, padding, title: describe(model, values)});
}

function renderGauge(model, values, {size, padding}) {
	const [value] = answerVector(model, values);
	const {track, fill} = gaugeGeometry(value, {size});
	const criterion = model.criteria[0];

	const body = `<rect class="indicator-track" x="${track.x}" y="${track.y}"`
		+ ` width="${track.width}" height="${track.height}" rx="${track.radius}"`
		+ ` fill="none" stroke="${EMPTY_STROKE}" stroke-width="1"/>`
		+ (fill.height > 0
			? `<rect class="indicator-fill" data-criterion="${escapeXml(criterion.id)}"`
				+ ` x="${fill.x}" y="${fill.y}" width="${fill.width}" height="${fill.height}"`
				+ ` rx="${fill.radius}" fill="${criterion.color}"/>`
			: "");

	return wrap(body, {size, padding, title: describe(model, values)});
}

function renderDuo(model, values, {size, padding, mode}) {
	const [first, second] = answerVector(model, values);
	const [firstCriterion, secondCriterion] = model.criteria;
	const geometry = duoGeometry(first, second, {size, mode: mode || model.duoMode || "yinyang"});
	const outline = `<circle cx="0" cy="0" r="${size / 2}" fill="none"`
		+ ` stroke="${EMPTY_STROKE}" stroke-width="0.5"/>`;

	// An untouched question shows the empty outline only: drawing a balanced
	// yin/yang here would read as "answered, and equal on both criteria".
	if (!geometry.answered) return wrap(outline, {size, padding, title: describe(model, values)});

	if (geometry.mode === "amplitude") {
		const {ellipse} = geometry;
		const body = outline
			+ `<ellipse class="indicator-shape" cx="0" cy="0" rx="${ellipse.rx}" ry="${ellipse.ry}"`
			+ ` fill="${firstCriterion.color}" fill-opacity="0.45"`
			+ ` stroke="${secondCriterion.color}" stroke-width="1.5"/>`;
		return wrap(body, {size, padding, title: describe(model, values)});
	}

	const body = outline
		+ `<path class="indicator-first" data-criterion="${escapeXml(firstCriterion.id)}"`
		+ ` d="${geometry.firstHalf}" fill="${firstCriterion.color}"/>`
		+ `<path class="indicator-second" data-criterion="${escapeXml(secondCriterion.id)}"`
		+ ` d="${geometry.secondHalf}" fill="${secondCriterion.color}"/>`
		+ geometry.eyes.map((eye, index) => {
			const color = index === 0 ? secondCriterion.color : firstCriterion.color;
			return `<circle cx="${eye.x}" cy="${eye.y}" r="${eye.radius}" fill="${color}"/>`;
		}).join("");

	return wrap(body, {size, padding, title: describe(model, values)});
}

/**
 * @param {object} model   answer model
 * @param {object} values  criterionId -> raw level (missing = unanswered)
 */
export function indicatorSvg(model, values = {}, {size = 100, padding = 6, mode, defs} = {}) {
	const options = {size, padding, mode, defs};
	if (model.display === "gauge") return renderGauge(model, values, options);
	if (model.display === "duo") return renderDuo(model, values, options);
	return renderStar(model, values, options);
}
