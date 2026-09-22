import {describe, expect, test} from "bun:test";
import {defineAnswerModel, defineCriterion, defineScale} from "../www/js/core/criteria.js";
import {indicatorSvg, starDefs} from "../www/js/render/indicator.js";

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
		expect(indicatorSvg(model(5), {c0: 1})).toContain("indicator-track");
	});

	test("honours an explicit display override", () => {
		const forced = model(2, {display: "star"});
		expect(indicatorSvg(forced, {c0: 1, c1: 1})).toContain("indicator-sector");
	});

	test("honours the duo mode", () => {
		const amplitude = model(2, {duoMode: "amplitude"});
		expect(indicatorSvg(amplitude, {c0: 1, c1: 2})).toContain("<ellipse");
		expect(indicatorSvg(model(2), {c0: 1, c1: 2})).toContain("indicator-second");
	});
});

describe("star rendering", () => {
	test("draws one track per criterion and one fill per answered criterion", () => {
		const svg = indicatorSvg(model(5), {c0: 2, c1: 1});
		expect(count(svg, "indicator-track")).toBe(5);
		expect(count(svg, "indicator-sector")).toBe(5);
		expect(count(svg, "indicator-fill")).toBe(2);
	});

	test("fills carry their criterion id, so they can be targeted", () => {
		expect(indicatorSvg(model(3), {c1: 2})).toContain('data-criterion="c1"');
	});

	test("ships its gradients inline, one per criterion", () => {
		const svg = indicatorSvg(model(3), {c0: 1});
		expect(count(svg, "<linearGradient")).toBe(3);
		expect(svg).toContain('id="cm-grad-m3-c0"');
	});

	test("can defer its gradients to a shared defs block", () => {
		const svg = indicatorSvg(model(3), {c0: 1}, {defs: "external"});
		expect(svg).not.toContain("<linearGradient");
		expect(svg).toContain("url(#cm-grad-m3-c0)");
		// The shared block carries the very same ids.
		expect(starDefs(model(3))).toContain('id="cm-grad-m3-c0"');
	});
});

describe("unanswered questions", () => {
	test("never render a filled shape", () => {
		expect(indicatorSvg(model(5), {})).not.toContain("indicator-fill");
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
