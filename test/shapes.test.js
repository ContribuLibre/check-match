import {describe, expect, test} from "bun:test";
import {branchReach, duoGeometry, gaugeGeometry, starGeometry, starGradients} from "../www/js/render/shapes.js";

const reach = tip => Math.hypot(tip.x, tip.y);

describe("star", () => {
	test("has exactly one sector per criterion, whatever the count", () => {
		for (const count of [3, 5, 8, 13]) {
			const star = starGeometry(new Array(count).fill(0.5));
			expect(star.branches).toBe(count);
			expect(star.sectors).toHaveLength(count);
			// Each sector is a spike: centre, left edge, tip, right edge.
			expect(star.sectors[0].track).toHaveLength(4);
			expect(star.wide).toBeCloseTo((2 * Math.PI) / count, 6);
		}
	});

	test("sectors tile the full circle without gaps", () => {
		const star = starGeometry([1, 1, 1, 1]);
		const directions = star.sectors.map(sector => sector.direction);
		for (let index = 1; index < directions.length; index++) {
			expect(directions[index] - directions[index - 1]).toBeCloseTo(star.wide, 6);
		}
	});

	test("branch length grows with the score", () => {
		const star = starGeometry([0, 0.5, 1]);
		expect(star.sectors[0].reach).toBeLessThan(star.sectors[1].reach);
		expect(star.sectors[1].reach).toBeLessThan(star.sectors[2].reach);
	});

	test("a zero answer keeps a quarter of the reach, and loses its tip", () => {
		const star = starGeometry([0, 1, 1], {size: 100});
		expect(branchReach(0)).toBeCloseTo(0.25, 6);
		expect(star.sectors[0].reach).toBeCloseTo(12.5, 3);
		// Truncated triangle: centre + two edges, no tip.
		expect(star.sectors[0].fill).toHaveLength(3);
		expect(star.sectors[1].fill).toHaveLength(4);
	});

	test("an unanswered branch has no fill at all, so it reads as absent", () => {
		const star = starGeometry([null, 1, 1]);
		expect(star.sectors[0].answered).toBe(false);
		expect(star.sectors[1].answered).toBe(true);
		// The track is always there: the criterion exists even unanswered.
		expect(star.sectors[0].trackPoints).toBeTruthy();
	});

	test("the first sector points up, so shapes stay comparable", () => {
		const [first] = starGeometry([1, 1, 1]).sectors;
		expect(first.tip.x).toBeCloseTo(0, 3);
		expect(first.tip.y).toBeLessThan(0); // SVG y grows downwards
	});

	test("a full answer reaches the outer radius", () => {
		const star = starGeometry([1, 1, 1], {size: 100});
		expect(reach(star.sectors[0].tip)).toBeCloseTo(50, 3);
		expect(branchReach(1)).toBe(1);
	});

	test("gradients run along their own sector", () => {
		const gradients = starGradients(4);
		expect(gradients).toHaveLength(4);
		// First sector points up: the gradient runs bottom-to-top.
		expect(gradients[0].y1).toBeCloseTo(1, 6);
		expect(gradients[0].y2).toBeCloseTo(0, 6);
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
