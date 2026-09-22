// Canonical question identity.
//
// An answer is stored against a question id, never against a checklist position.
// That is what lets two different checklists (a new version, a different framing,
// another language) share the answers of the questions they have in common.
//
// Two id shapes exist on purpose:
//
//   kink/bodies/small-breasts   explicit, language-neutral, the stable form
//   label:en:small-breasts      derived from an English label, the provisional form
//
// Derived ids carry their language, so the English and French wordings of the same
// question do NOT collide into one id by accident: they stay distinct until an
// alias (or an explicit id) states they are the same question. Promoting a derived
// id to an explicit one is a pure alias addition, so no answer is ever lost.
//
// A role suffix (`#giving`) makes a question atomic: "spanking, as the giver" and
// "spanking, as the receiver" are two questions, not one question with two slots.

const ROLE_SEPARATOR = "#";
const DERIVED_PREFIX = "label";
const MAX_ALIAS_HOPS = 32;

/** Lowercase, accent-free, dash-joined form of any human text. */
export function slugify(text) {
	if (typeof text !== "string") throw new TypeError("slugify expects a string.");
	return text
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "") // ̀-ͯ: combining marks left by the decomposition
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** `label:<lang>:<slug>` — the provisional id of a question that has no explicit one. */
export function deriveQuestionId(label, lang = "en") {
	const slug = slugify(label);
	if (!slug) throw new TypeError(`Label "${label}" slugifies to nothing.`);
	const langSlug = slugify(lang) || "en";
	return `${DERIVED_PREFIX}:${langSlug}:${slug}`;
}

/** True when the id was derived from a label, and so may still move. */
export function isDerivedId(id) {
	return typeof id === "string" && id.startsWith(`${DERIVED_PREFIX}:`);
}

/** Split `base#role` without mangling ids that hold no role. */
export function splitQuestionId(id) {
	const index = id.indexOf(ROLE_SEPARATOR);
	if (index === -1) return {base: id, role: null};
	return {base: id.slice(0, index), role: id.slice(index + 1) || null};
}

export function withRole(id, role) {
	if (role === null || role === undefined || role === "") return id;
	const roleSlug = slugify(String(role));
	if (!roleSlug) return id;
	return `${splitQuestionId(id).base}${ROLE_SEPARATOR}${roleSlug}`;
}

function normalizeExplicitId(id) {
	const {base, role} = splitQuestionId(String(id).trim());
	const segments = base.split("/").map(segment => slugify(segment)).filter(Boolean);
	if (!segments.length) throw new TypeError(`Question id "${id}" normalizes to nothing.`);
	return withRole(segments.join("/"), role);
}

/**
 * Follow an alias chain to its endpoint.
 *
 * An alias may target one precise role (`spanking#giving`) or the question as a
 * whole (`spanking`), in which case it applies to every role of that question.
 *
 * A cyclic table is broken, but it must still be deterministic: every member of a
 * cycle resolves to the same representative, so answers caught in the cycle stay
 * grouped instead of scattering according to where the lookup started.
 */
export function resolveAlias(id, aliases = {}) {
	let current = id;
	const visited = [current];
	const seen = new Set(visited);
	for (let hop = 0; hop < MAX_ALIAS_HOPS; hop++) {
		const {base, role} = splitQuestionId(current);
		const next = aliases[current] ?? (role ? aliases[base] : undefined);
		if (!next || next === current) return current;
		// A role-less alias target keeps the role of the id being resolved.
		const target = withRole(next, splitQuestionId(next).role ? null : role);
		if (seen.has(target)) {
			const cycle = visited.slice(visited.indexOf(target));
			return [...cycle].sort()[0];
		}
		seen.add(target);
		visited.push(target);
		current = target;
	}
	return current;
}

/**
 * The canonical id of one answerable question.
 *
 * @param {object} question
 * @param {string} [question.id]    explicit, stable id — wins over the label
 * @param {string} [question.label] human wording, used only when no explicit id
 * @param {string} [question.role]  role/column making the question atomic
 * @param {string} [lang]           language of the label, kept inside derived ids
 * @param {object} [aliases]        old id -> current id, for checklist evolution
 */
export function canonicalQuestionId(question, {lang = "en", aliases = {}} = {}) {
	if (!question || typeof question !== "object") {
		throw new TypeError("canonicalQuestionId expects a question object.");
	}
	const raw = question.id
		? normalizeExplicitId(question.id)
		: deriveQuestionId(question.label, question.lang || lang);
	return resolveAlias(withRole(raw, question.role), aliases);
}
