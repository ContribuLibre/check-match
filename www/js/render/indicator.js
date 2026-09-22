// Answer indicator: turns (answer model + values) into an SVG string.
//
// A string rather than DOM nodes, so the same call works for the page, for a
// static export and for tests. Shape choice follows the model's `display`, which
// itself defaults to the criteria count (1 gauge, 2 duo, 3+ star).

import {answerVector, isAnswered} from "../core/criteria.js";
import {duoGeometry, gaugeGeometry, starAxes, starGeometry} from "./shapes.js";

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

function renderStar(model, values, {size, padding}) {
	const vector = answerVector(model, values);
	const {path, tips} = starGeometry(vector, {size});
	const axes = starAxes(vector.length, {size});

	const guides = axes.map(axis =>
		`<line class="indicator-axis" x1="0" y1="0" x2="${axis.to.x}" y2="${axis.to.y}"`
		+ ` stroke="${EMPTY_STROKE}" stroke-width="0.5"/>`).join("");

	const shape = `<path class="indicator-shape" d="${path}" fill="currentColor"`
		+ ` fill-opacity="0.35" stroke="currentColor" stroke-width="1.5"`
		+ ` stroke-linejoin="round"/>`;

	const points = tips.map((tip, index) => {
		const criterion = model.criteria[index];
		if (!tip.answered) return "";
		return `<circle class="indicator-tip" data-criterion="${escapeXml(criterion.id)}"`
			+ ` cx="${tip.x}" cy="${tip.y}" r="${size * 0.045}" fill="${criterion.color}"/>`;
	}).join("");

	return wrap(guides + shape + points, {size, padding, title: describe(model, values)});
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
export function indicatorSvg(model, values = {}, {size = 100, padding = 6, mode} = {}) {
	const options = {size, padding, mode};
	if (!isAnswered(model, values) && model.display === "star") {
		// Keep the empty star readable as "nothing answered yet" rather than "all zero".
		return renderStar(model, {}, options);
	}
	if (model.display === "gauge") return renderGauge(model, values, options);
	if (model.display === "duo") return renderDuo(model, values, options);
	return renderStar(model, values, options);
}
