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
	test("accept plain string levels and index them", () => {
		expect(level3.levels).toEqual([
			{value: 0, label: "none"},
			{value: 1, label: "some"},
			{value: 2, label: "much"},
		]);
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
