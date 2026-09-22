// Checklist definition.
//
// A checklist is a *view*: an ordered set of questions, each one carrying a
// canonical id and an answer model. It owns no answers — those live in the store,
// keyed by question id — which is what lets two checklists overlap partially and
// still read each other's answers.
//
// The answer model cascades checklist -> section -> item, because within one
// checklist some items legitimately need more criteria than others (an item that
// also asks "do I need other people's cooperation for this?" has three criteria
// where its neighbours have two).

import {canonicalQuestionId} from "./canonical-id.js";

/**
 * @param {object} definition
 * @param {string} definition.id
 * @param {string} [definition.lang]        language of the labels, baked into derived ids
 * @param {object} definition.answerModel   default model for every question
 * @param {object} [definition.aliases]     old question id -> current one
 * @param {Array}  definition.sections      [{label, roles?, answerModel?, items}]
 */
export function defineChecklist({
	id,
	label = id,
	lang = "en",
	answerModel,
	aliases = {},
	sections = [],
}) {
	if (!id) throw new TypeError("A checklist needs an id.");
	if (!answerModel) throw new TypeError(`Checklist "${id}" needs a default answer model.`);

	const questions = [];
	const byId = new Map();

	for (const section of sections) {
		const roles = section.roles && section.roles.length ? section.roles : [null];
		for (const item of section.items || []) {
			const itemDefinition = typeof item === "string" ? {label: item} : item;
			const model = itemDefinition.answerModel || section.answerModel || answerModel;
			const itemRoles = itemDefinition.roles && itemDefinition.roles.length
				? itemDefinition.roles
				: roles;

			for (const role of itemRoles) {
				const questionId = canonicalQuestionId(
					{id: itemDefinition.id, label: itemDefinition.label, role, lang: itemDefinition.lang},
					{lang, aliases},
				);
				if (byId.has(questionId)) {
					throw new TypeError(
						`Checklist "${id}" asks "${questionId}" twice — give one of them an explicit id.`,
					);
				}
				const question = Object.freeze({
					questionId,
					label: itemDefinition.label,
					hint: itemDefinition.hint || null,
					role: role || null,
					section: section.label,
					answerModel: model,
				});
				questions.push(question);
				byId.set(questionId, question);
			}
		}
	}

	return Object.freeze({
		id, label, lang, answerModel, aliases,
		sections: Object.freeze(sections.map(section => Object.freeze({
			label: section.label,
			roles: Object.freeze([...(section.roles || [])]),
		}))),
		questions: Object.freeze(questions),
		get(questionId) {
			return byId.get(questionId) || null;
		},
		has(questionId) {
			return byId.has(questionId);
		},
		questionIds() {
			return [...byId.keys()];
		},
	});
}

/** Questions asked by both checklists — the comparable surface between them. */
export function sharedQuestions(a, b) {
	const other = new Set(b.questionIds());
	return a.questionIds().filter(questionId => other.has(questionId));
}

/**
 * How much of a checklist a person has already answered.
 * Counts questions, not criteria: a partially-filled question counts as answered.
 */
export function completion(checklist, snapshot = {}) {
	const total = checklist.questions.length;
	const answered = checklist.questions
		.filter(question => snapshot[question.questionId]).length;
	return {answered, total, ratio: total ? answered / total : 0};
}
