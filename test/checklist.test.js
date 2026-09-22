import {describe, expect, test} from "bun:test";
import {completion, defineChecklist, sharedQuestions} from "../www/js/core/checklist.js";
import {defineAnswerModel, defineCriterion, defineScale} from "../www/js/core/criteria.js";
import {formatPresetData, parsePresetData} from "../www/js/core/preset-format.js";

const scale = defineScale({id: "s", levels: ["no", "meh", "yes"]});
const opinion = defineCriterion({id: "opinion", scale});
const importance = defineCriterion({id: "importance", scale});
const autonomy = defineCriterion({id: "autonomy", scale});

const twoCriteria = defineAnswerModel({id: "two", criteria: [opinion, importance]});
const threeCriteria = defineAnswerModel({id: "three", criteria: [opinion, importance, autonomy]});

describe("defineChecklist", () => {
	const checklist = defineChecklist({
		id: "demo",
		answerModel: twoCriteria,
		sections: [
			{label: "Chores", items: ["Dishes", "Laundry"]},
			{label: "Space", roles: ["Self", "Others"], items: ["Silence"]},
		],
	});

	test("expands roles into separate atomic questions", () => {
		expect(checklist.questions).toHaveLength(4);
		expect(checklist.questionIds()).toEqual([
			"label:en:dishes",
			"label:en:laundry",
			"label:en:silence#self",
			"label:en:silence#others",
		]);
	});

	test("carries the section and role on each question", () => {
		const question = checklist.get("label:en:silence#others");
		expect(question.section).toBe("Space");
		expect(question.role).toBe("Others");
		expect(question.label).toBe("Silence");
	});

	test("refuses to ask the same question twice", () => {
		expect(() => defineChecklist({
			id: "dup",
			answerModel: twoCriteria,
			sections: [{label: "A", items: ["Same"]}, {label: "B", items: ["Same"]}],
		})).toThrow();
	});
});

describe("answer model cascade", () => {
	const checklist = defineChecklist({
		id: "cascade",
		answerModel: twoCriteria,
		sections: [
			{label: "Plain", items: ["Dishes"]},
			{label: "Heavier", answerModel: threeCriteria, items: ["Budget"]},
			{
				label: "Mixed",
				items: [
					{label: "Noise"},
					{label: "Guests", answerModel: threeCriteria},
				],
			},
		],
	});

	test("an item can need more criteria than its neighbours", () => {
		expect(checklist.get("label:en:dishes").answerModel.id).toBe("two");
		expect(checklist.get("label:en:budget").answerModel.id).toBe("three");
		expect(checklist.get("label:en:noise").answerModel.id).toBe("two");
		expect(checklist.get("label:en:guests").answerModel.id).toBe("three");
	});

	test("the shape follows the criteria count per item", () => {
		expect(checklist.get("label:en:dishes").answerModel.display).toBe("duo");
		expect(checklist.get("label:en:guests").answerModel.display).toBe("star");
	});
});

describe("comparing checklists", () => {
	const v1 = defineChecklist({
		id: "v1",
		answerModel: twoCriteria,
		sections: [{label: "A", items: [
			{id: "home/dishes", label: "Dishes"},
			{id: "home/laundry", label: "Laundry"},
		]}],
	});

	// A different framing: fewer questions, one new one, same canonical ids.
	const other = defineChecklist({
		id: "flatshare",
		answerModel: threeCriteria,
		sections: [{label: "Daily", items: [
			{id: "home/dishes", label: "Washing up"},
			{id: "home/bins", label: "Bins"},
		]}],
	});

	test("overlap on canonical ids, not on wording", () => {
		expect(sharedQuestions(v1, other)).toEqual(["home/dishes"]);
	});

	test("an alias folds a renamed question onto the old one, keeping its answer", () => {
		const v2 = defineChecklist({
			id: "v2",
			answerModel: twoCriteria,
			aliases: {"home/washing-up": "home/dishes"},
			sections: [{label: "A", items: [{id: "home/washing-up", label: "Washing up"}]}],
		});
		expect(v2.questionIds()).toEqual(["home/dishes"]);
		expect(sharedQuestions(v1, v2)).toEqual(["home/dishes"]);
	});

	test("completion counts answered questions of this checklist only", () => {
		const snapshot = {
			"home/dishes": {values: {opinion: 1}},
			"somewhere/else": {values: {opinion: 2}},
		};
		expect(completion(v1, snapshot)).toEqual({answered: 1, total: 2, ratio: 0.5});
		expect(completion(v1, {}).ratio).toBe(0);
	});
});

describe("legacy text format", () => {
	const text = "#Bodies\n(General)\n* Skinny\n* Chubby\n\n#Clothing\n(Self, Partner)\n* Latex\n";

	test("parses categories, columns and items", () => {
		expect(parsePresetData(text)).toEqual([
			{label: "Bodies", roles: [], items: [{label: "Skinny"}, {label: "Chubby"}]},
			{label: "Clothing", roles: ["Self", "Partner"], items: [{label: "Latex"}]},
		]);
	});

	test("drops a lone column, so it matches a role-less question", () => {
		const [bodies] = parsePresetData(text);
		expect(bodies.roles).toEqual([]);
		const checklist = defineChecklist({id: "x", answerModel: twoCriteria, sections: parsePresetData(text)});
		expect(checklist.has("label:en:skinny")).toBe(true);
		expect(checklist.has("label:en:latex#self")).toBe(true);
	});

	test("round-trips back to editable text", () => {
		expect(parsePresetData(formatPresetData(parsePresetData(text))))
			.toEqual(parsePresetData(text));
	});

	test("points at the offending line", () => {
		expect(() => parsePresetData("* orphan item")).toThrow(/before any #category/);
		expect(() => parsePresetData("#Cat\nnonsense")).toThrow(/Line 2/);
	});
});
