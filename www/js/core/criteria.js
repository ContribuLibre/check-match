// Multi-criteria answer model.
//
// The old kinklist had exactly one scale (Favorite..No + not entered) shared by
// every item. Here an item is qualified by N criteria, each one graded on its own
// scale: experience and disgust have nothing to do with each other and have no
// reason to share a granularity, a wording or a colour.
//
// The number of criteria drives the display, because a shape that reads well for
// eight axes reads badly for one:
//   1 criterion  -> gauge     (thermometer)
//   2 criteria   -> duo       (yin/yang, or vertical vs horizontal amplitude)
//   3+ criteria  -> star      (one branch per criterion)
// `display` overrides that default when a checklist wants a specific reading.

export const UNANSWERED = null;

/**
 * An ordered scale. `levels[0]` is the low end; the index is the stored value,
 * which keeps stored answers readable and comparable across scales of different
 * lengths once normalized to 0..1.
 */
export function defineScale({id, label = id, levels, color = "#888888"}) {
	if (!id) throw new TypeError("A scale needs an id.");
	if (!Array.isArray(levels) || levels.length < 2) {
		throw new TypeError(`Scale "${id}" needs at least 2 levels.`);
	}
	const normalized = levels.map((level, index) =>
		typeof level === "string" ? {value: index, label: level} : {value: index, ...level});
	return Object.freeze({id, label, color, levels: Object.freeze(normalized)});
}

/** Position of a raw value on its scale, as 0..1 — the form every renderer consumes. */
export function normalizeValue(scale, value) {
	if (value === UNANSWERED || value === undefined) return UNANSWERED;
	const max = scale.levels.length - 1;
	const clamped = Math.min(Math.max(Number(value), 0), max);
	return clamped / max;
}

export function defineCriterion({id, label = id, scale, color, axis = null, optional = true}) {
	if (!id) throw new TypeError("A criterion needs an id.");
	if (!scale || !Array.isArray(scale.levels)) {
		throw new TypeError(`Criterion "${id}" needs a scale.`);
	}
	return Object.freeze({id, label, scale, color: color || scale.color, axis, optional});
}

/**
 * @param {object} model
 * @param {string} model.id
 * @param {Array}  model.criteria  ordered; the order is the branch order of the star
 * @param {string} [model.display] 'auto' | 'gauge' | 'duo' | 'star'
 */
export function defineAnswerModel({id, label = id, criteria, display = "auto", duoMode = "yinyang"}) {
	if (!id) throw new TypeError("An answer model needs an id.");
	if (!Array.isArray(criteria) || !criteria.length) {
		throw new TypeError(`Answer model "${id}" needs at least one criterion.`);
	}
	const seen = new Set();
	for (const criterion of criteria) {
		if (seen.has(criterion.id)) {
			throw new TypeError(`Answer model "${id}" repeats criterion "${criterion.id}".`);
		}
		seen.add(criterion.id);
	}
	return Object.freeze({
		id,
		label,
		criteria: Object.freeze([...criteria]),
		display: display === "auto" ? defaultDisplay(criteria.length) : display,
		// 'yinyang' reads as a balance, 'amplitude' puts the first criterion on the
		// vertical axis and the second on the horizontal one.
		duoMode,
	});
}

export function defaultDisplay(criteriaCount) {
	if (criteriaCount <= 1) return "gauge";
	if (criteriaCount === 2) return "duo";
	return "star";
}

export function getCriterion(model, criterionId) {
	return model.criteria.find(criterion => criterion.id === criterionId) || null;
}

/**
 * Keep only values the model knows about, clamped to their scale.
 * Unknown criteria are dropped rather than throwing: a checklist that loses a
 * criterion in a new version must still be able to read its old answers.
 */
export function sanitizeValues(model, values = {}) {
	const clean = {};
	for (const criterion of model.criteria) {
		const raw = values[criterion.id];
		if (raw === UNANSWERED || raw === undefined) continue;
		const max = criterion.scale.levels.length - 1;
		const value = Math.round(Number(raw));
		if (!Number.isFinite(value)) continue;
		clean[criterion.id] = Math.min(Math.max(value, 0), max);
	}
	return clean;
}

/** Ordered 0..1 vector (null where unanswered) — the renderer-facing projection. */
export function answerVector(model, values = {}) {
	return model.criteria.map(criterion =>
		normalizeValue(criterion.scale, values[criterion.id]));
}

export function isAnswered(model, values = {}) {
	return model.criteria.some(criterion =>
		values[criterion.id] !== UNANSWERED && values[criterion.id] !== undefined);
}
