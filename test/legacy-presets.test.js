// Covers the two entry points of the legacy app that load a preset shipped
// with the page. main.js touches the DOM at import time, so it gets the minimum
// stub it needs; the rest of that file is exercised in the browser.

import {beforeAll, describe, expect, test} from "bun:test";

let loadPreset, builtinPresets;

beforeAll(async () => {
	globalThis.document = {
		styleSheets: [{cssRules: [], insertRule: () => 0, deleteRule: () => {}}],
		readyState: "complete",
		querySelector: () => null,
		querySelectorAll: () => [],
		addEventListener: () => {},
		createElement: () => ({style: {}, classList: {add() {}, remove() {}}, setAttribute() {}, appendChild() {}}),
	};
	({loadPreset, builtinPresets} = await import("../www/js/main.js"));
});

describe("loadPreset", () => {
	test("registers a preset under its CSS-safe name", () => {
		const preset = loadPreset("en_classic", {
			name: "en_classic",
			data: "#Bodies\n(General)\n* Skinny\n",
			legend: [["No", "#900"], ["Yes", "#090"]],
		});
		expect(preset.displayName).toBe("en_classic");
		expect(builtinPresets.get(preset.name)).toBe(preset);
	});

	test("falls back to the argument name and the default legend", () => {
		const preset = loadPreset("fallbacks", {data: "#A\n(General)\n* x\n"});
		expect(preset.displayName).toBe("fallbacks");
		expect(preset.legend.length).toBeGreaterThan(0);
		expect(preset.state).toBe("");
	});

	test("rejects a preset with nothing to show", () => {
		// Silent failure here would leave an empty, unexplained list on screen.
		expect(() => loadPreset("empty", {data: "   "})).toThrow(/has no data/);
		expect(() => loadPreset("missing", {})).toThrow(/has no data/);
		expect(() => loadPreset("nothing", null)).toThrow(/has no definition/);
	});

	test("is idempotent: reloading the same preset replaces it, never duplicates", () => {
		const before = builtinPresets.size;
		loadPreset("en_classic", {name: "en_classic", data: "#B\n(General)\n* other\n"});
		expect(builtinPresets.size).toBe(before);
	});
});
