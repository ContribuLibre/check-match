import {describe, expect, test} from "bun:test";
import {
	answerVector,
	defaultDisplay,
	defineAnswerModel,
	defineCriterion,
	defineScale,
	isAnswered,
	normalizeValue,
	sanitizeValues,
} from "../www/js/core/criteria.js";

const level3 = defineScale({id: "l3", levels: ["none", "some", "much"]});
const level5 = defineScale({id: "l5", levels: ["0", "1", "2", "3", "4"]});

describe("scales", () => {
	test("accept plain string levels, indexing them and spreading scores evenly", () => {
		expect(level3.levels).toEqual([
			{value: 0, label: "none", hint: "", score: 0},
			{value: 1, label: "some", hint: "", score: 0.5},
			{value: 2, label: "much", hint: "", score: 1},
		]);
	});

	test("accept the authoring form {short, long, score}", () => {
		const uneven = defineScale({
			id: "acceptance",
			minColor: "#E00",
			maxColor: "#6F0",
			levels: [
				{short: "never", long: "just don't", score: 0},
				{short: "tolerate", long: "once a month", score: 0.25},
				{short: "ok", long: "", score: 0.5},
				{short: "always", long: "love it", score: 1},
			],
		});
		expect(uneven.levels[1]).toEqual({value: 1, label: "tolerate", hint: "once a month", score: 0.25});
		expect(uneven.minColor).toBe("#E00");
		expect(uneven.maxColor).toBe("#6F0");
	});

	test("keep uneven scores instead of spreading indexes evenly", () => {
		// The gap between "ok" and "sometimes" is not the gap between
		// "never" and "warning"; an even spread would flatten that.
		const acceptance = defineScale({
			id: "a",
			levels: [{short: "never", score: 0}, {short: "warning", score: 0.1},
				{short: "ok", score: 0.5}, {short: "always", score: 1}],
		});
		expect(normalizeValue(acceptance, 1)).toBe(0.1);
		expect(normalizeValue(acceptance, 2)).toBe(0.5);
		// An even spread would have put level 1 at 0.333.
		expect(normalizeValue(acceptance, 1)).not.toBeCloseTo(1 / 3, 3);
	});

	test("reject a score outside 0..1", () => {
		expect(() => defineScale({id: "bad", levels: [{short: "a", score: 0}, {short: "b", score: 2}]}))
			.toThrow(/outside 0\.\.1/);
	});

	test("need at least two levels", () => {
		expect(() => defineScale({id: "broken", levels: ["only"]})).toThrow();
	});

	test("normalize to 0..1 whatever their length", () => {
		expect(normalizeValue(level3, 0)).toBe(0);
		expect(normalizeValue(level3, 2)).toBe(1);
		expect(normalizeValue(level5, 2)).toBe(0.5);
		expect(normalizeValue(level3, 1)).toBe(normalizeValue(level5, 2));
	});

	test("carry a gradient, defaulting when none is given", () => {
		expect(level3.minColor).toBeTruthy();
		expect(level3.maxColor).toBeTruthy();
	});

	test("treat unanswered as null, not as zero", () => {
		expect(normalizeValue(level3, null)).toBeNull();
		expect(normalizeValue(level3, undefined)).toBeNull();
	});

	test("clamp out-of-range values", () => {
		expect(normalizeValue(level3, 99)).toBe(1);
		expect(normalizeValue(level3, -5)).toBe(0);
	});
});

describe("answer models", () => {
	const experience = defineCriterion({id: "experience", scale: level3, color: "#123456"});
	const fear = defineCriterion({id: "fear", scale: level5, color: "#654321"});
	const disgust = defineCriterion({id: "disgust", scale: level5});

	test("pick their shape from the criteria count", () => {
		expect(defaultDisplay(1)).toBe("gauge");
		expect(defaultDisplay(2)).toBe("duo");
		expect(defaultDisplay(3)).toBe("star");
		expect(defaultDisplay(8)).toBe("star");
		expect(defineAnswerModel({id: "one", criteria: [experience]}).display).toBe("gauge");
		expect(defineAnswerModel({id: "two", criteria: [experience, fear]}).display).toBe("duo");
	});

	test("accept an explicit override", () => {
		const model = defineAnswerModel({id: "forced", criteria: [experience, fear], display: "star"});
		expect(model.display).toBe("star");
	});

	test("reject duplicated criteria", () => {
		expect(() => defineAnswerModel({id: "dup", criteria: [experience, experience]})).toThrow();
	});

	test("a criterion inherits its scale colour when given none", () => {
		expect(disgust.color).toBe(level5.color);
		expect(experience.color).toBe("#123456");
	});

	describe("values", () => {
		const model = defineAnswerModel({id: "m", criteria: [experience, fear, disgust]});

		test("project to an ordered 0..1 vector, null where unanswered", () => {
			expect(answerVector(model, {experience: 2, fear: 0})).toEqual([1, 0, null]);
		});

		test("drop criteria the model no longer knows about", () => {
			// A checklist that lost a criterion must still read its old answers.
			expect(sanitizeValues(model, {experience: 1, removed: 3})).toEqual({experience: 1});
		});

		test("clamp and round rather than reject", () => {
			expect(sanitizeValues(model, {experience: 99, fear: -2, disgust: 1.4}))
				.toEqual({experience: 2, fear: 0, disgust: 1});
		});

		test("tell an untouched question from an all-zero one", () => {
			expect(isAnswered(model, {})).toBe(false);
			expect(isAnswered(model, {experience: 0})).toBe(true);
		});
	});
});
