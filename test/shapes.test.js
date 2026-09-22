import {describe, expect, test} from "bun:test";
import {duoGeometry, gaugeGeometry, starAxes, starGeometry} from "../www/js/render/shapes.js";

const reach = tip => Math.hypot(tip.x, tip.y);

describe("star", () => {
	test("has exactly one branch per criterion, whatever the count", () => {
		for (const count of [3, 5, 8, 13]) {
			const star = starGeometry(new Array(count).fill(0.5));
			expect(star.branches).toBe(count);
			expect(star.tips).toHaveLength(count);
			expect(star.valleys).toHaveLength(count);
			// Outline alternates tip, valley, tip, valley...
			expect(star.outline).toHaveLength(count * 2);
			expect(star.path.startsWith("M ")).toBe(true);
			expect(star.path.endsWith("Z")).toBe(true);
		}
	});

	test("branch length grows with the value", () => {
		const star = starGeometry([0, 0.5, 1]);
		expect(reach(star.tips[0])).toBeLessThan(reach(star.tips[1]));
		expect(reach(star.tips[1])).toBeLessThan(reach(star.tips[2]));
	});

	test("a branch answered at zero stays visible", () => {
		const star = starGeometry([0, 1, 1]);
		expect(reach(star.tips[0])).toBeGreaterThan(star.hollow);
	});

	test("an unanswered branch collapses into the hollow, so it reads as absent", () => {
		const star = starGeometry([null, 1, 1]);
		expect(star.tips[0].answered).toBe(false);
		expect(reach(star.tips[0])).toBeCloseTo(star.hollow, 3);
	});

	test("the first branch points up, so shapes stay comparable", () => {
		const [first] = starGeometry([1, 1, 1]).tips;
		expect(first.x).toBeCloseTo(0, 3);
		expect(first.y).toBeLessThan(0); // SVG y grows downwards
	});

	test("a full answer reaches the outer radius", () => {
		const star = starGeometry([1, 1, 1], {size: 100});
		expect(reach(star.tips[0])).toBeCloseTo(50, 3);
	});

	test("axes match the branches", () => {
		const axes = starAxes(6, {size: 100});
		expect(axes).toHaveLength(6);
		expect(Math.hypot(axes[0].to.x, axes[0].to.y)).toBeCloseTo(50, 3);
	});

	test("refuses an empty star", () => {
		expect(() => starGeometry([])).toThrow();
	});
});

describe("gauge", () => {
	test("fills from the bottom", () => {
		const empty = gaugeGeometry(0, {size: 100});
		const half = gaugeGeometry(0.5, {size: 100});
		const full = gaugeGeometry(1, {size: 100});

		expect(empty.fill.height).toBe(0);
		expect(half.fill.height).toBeCloseTo(50, 3);
		expect(full.fill.height).toBeCloseTo(100, 3);
		// Higher value => fill starts higher up the track.
		expect(half.fill.y).toBeLessThan(empty.fill.y);
		expect(full.fill.y).toBeLessThan(half.fill.y);
	});

	test("an unanswered gauge is empty but flagged", () => {
		const gauge = gaugeGeometry(null);
		expect(gauge.answered).toBe(false);
		expect(gauge.fill.height).toBe(0);
	});
});

describe("duo", () => {
	test("amplitude maps the first criterion to the vertical axis, the second to the horizontal", () => {
		const tall = duoGeometry(1, 0, {size: 100, mode: "amplitude"});
		const wide = duoGeometry(0, 1, {size: 100, mode: "amplitude"});
		expect(tall.ellipse.ry).toBeGreaterThan(tall.ellipse.rx);
		expect(wide.ellipse.rx).toBeGreaterThan(wide.ellipse.ry);
	});

	test("amplitude keeps a visible footprint at zero", () => {
		const none = duoGeometry(0, 0, {size: 100, mode: "amplitude"});
		expect(none.ellipse.rx).toBeGreaterThan(0);
		expect(none.ellipse.ry).toBeGreaterThan(0);
	});

	test("yin/yang balances at the middle when both criteria match", () => {
		expect(duoGeometry(0.7, 0.7).share).toBeCloseTo(0.5, 3);
		expect(duoGeometry(1, 0).share).toBeCloseTo(1, 3);
		expect(duoGeometry(0, 1).share).toBeCloseTo(0, 3);
	});

	test("yin/yang carries overall intensity in the disc radius", () => {
		expect(duoGeometry(1, 1).radius).toBeGreaterThan(duoGeometry(0.2, 0.2).radius);
	});

	test("yin/yang halves are closed paths", () => {
		const duo = duoGeometry(0.5, 0.5);
		expect(duo.firstHalf.endsWith("Z")).toBe(true);
		expect(duo.secondHalf.endsWith("Z")).toBe(true);
		expect(duo.eyes).toHaveLength(2);
	});
});
