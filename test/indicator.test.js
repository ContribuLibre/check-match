import {describe, expect, test} from "bun:test";
import {defineAnswerModel, defineCriterion, defineScale} from "../www/js/core/criteria.js";
import {indicatorSvg} from "../www/js/render/indicator.js";

const scale = defineScale({id: "s", levels: ["low", "mid", "high"]});
const criterion = (id, color) => defineCriterion({id, label: id, scale, color});
const model = (count, extra = {}) => defineAnswerModel({
	id: `m${count}`,
	criteria: Array.from({length: count}, (_, index) => criterion(`c${index}`, "#112233")),
	...extra,
});

const count = (svg, needle) => svg.split(needle).length - 1;

describe("shape selection", () => {
	test("follows the criteria count", () => {
		expect(indicatorSvg(model(1), {c0: 1})).toContain("indicator-fill");
		expect(indicatorSvg(model(2), {c0: 1, c1: 1})).toContain("indicator-first");
		expect(indicatorSvg(model(5), {c0: 1})).toContain("indicator-shape");
	});

	test("honours an explicit display override", () => {
		const forced = model(2, {display: "star"});
		expect(indicatorSvg(forced, {c0: 1, c1: 1})).toContain("indicator-axis");
	});

	test("honours the duo mode", () => {
		const amplitude = model(2, {duoMode: "amplitude"});
		expect(indicatorSvg(amplitude, {c0: 1, c1: 2})).toContain("<ellipse");
		expect(indicatorSvg(model(2), {c0: 1, c1: 2})).toContain("indicator-second");
	});
});

describe("star rendering", () => {
	test("draws one axis per criterion and one tip per answered criterion", () => {
		const svg = indicatorSvg(model(5), {c0: 2, c1: 1});
		expect(count(svg, "indicator-axis")).toBe(5);
		expect(count(svg, "indicator-tip")).toBe(2);
	});

	test("tips carry their criterion id, so they can be targeted", () => {
		expect(indicatorSvg(model(3), {c1: 2})).toContain('data-criterion="c1"');
	});
});

describe("unanswered questions", () => {
	test("never render a filled shape", () => {
		expect(indicatorSvg(model(5), {})).not.toContain("indicator-tip");
		expect(indicatorSvg(model(1), {})).not.toContain("indicator-fill");
		// A balanced yin/yang would wrongly read as "answered, equal on both".
		expect(indicatorSvg(model(2), {})).not.toContain("indicator-first");
		expect(indicatorSvg(model(2, {duoMode: "amplitude"}), {})).not.toContain("<ellipse");
	});
});

describe("accessibility and safety", () => {
	test("labels every indicator with its readable answer", () => {
		const svg = indicatorSvg(model(2), {c0: 2, c1: 0});
		expect(svg).toContain('aria-label="c0: high, c1: low"');
	});

	test("shows unanswered criteria as a dash rather than a zero", () => {
		expect(indicatorSvg(model(2), {c0: 0})).toContain('aria-label="c0: low, c1: —"');
	});

	test("escapes text coming from checklist definitions", () => {
		const nasty = defineAnswerModel({
			id: "nasty",
			criteria: [defineCriterion({id: "x", label: '</svg><script>"&', scale})],
		});
		const svg = indicatorSvg(nasty, {x: 1});
		expect(svg).not.toContain("<script>");
		expect(svg).toContain("&lt;/svg&gt;");
	});
});
