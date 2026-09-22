import {describe, expect, test} from "bun:test";
import {
	canonicalQuestionId,
	deriveQuestionId,
	isDerivedId,
	resolveAlias,
	slugify,
	splitQuestionId,
	withRole,
} from "../www/js/core/canonical-id.js";

describe("slugify", () => {
	test("strips diacritics so accented wordings stay stable", () => {
		expect(slugify("Rôle à définir")).toBe("role-a-definir");
		expect(slugify("Œuf, naïveté")).toBe("uf-naivete");
	});

	test("collapses punctuation and trims separators", () => {
		expect(slugify("  Cross-dressing / costume!  ")).toBe("cross-dressing-costume");
	});
});

describe("derived ids", () => {
	test("carry their language so translations do not collide silently", () => {
		expect(deriveQuestionId("Small breasts", "en")).toBe("label:en:small-breasts");
		expect(deriveQuestionId("Petits seins", "fr")).toBe("label:fr:petits-seins");
		expect(deriveQuestionId("Small breasts", "en")).not.toBe(deriveQuestionId("Petits seins", "fr"));
	});

	test("are flagged as provisional", () => {
		expect(isDerivedId(deriveQuestionId("Anything", "en"))).toBe(true);
		expect(isDerivedId("kink/bodies/small-breasts")).toBe(false);
	});
});

describe("roles", () => {
	test("make a question atomic", () => {
		const giving = canonicalQuestionId({label: "Spanking", role: "Giving"});
		const receiving = canonicalQuestionId({label: "Spanking", role: "Receiving"});
		expect(giving).toBe("label:en:spanking#giving");
		expect(giving).not.toBe(receiving);
	});

	test("replace an existing role instead of stacking", () => {
		expect(withRole("a/b#giving", "receiving")).toBe("a/b#receiving");
		expect(splitQuestionId("a/b#giving")).toEqual({base: "a/b", role: "giving"});
		expect(splitQuestionId("a/b")).toEqual({base: "a/b", role: null});
	});
});

describe("aliases", () => {
	const aliases = {
		"label:en:small-breasts": "kink/bodies/small-chest",
		"label:fr:petits-seins": "kink/bodies/small-chest",
	};

	test("merge two languages onto one canonical question", () => {
		const en = canonicalQuestionId({label: "Small breasts", lang: "en"}, {aliases});
		const fr = canonicalQuestionId({label: "Petits seins", lang: "fr"}, {aliases});
		expect(en).toBe("kink/bodies/small-chest");
		expect(fr).toBe(en);
	});

	test("keep the role of the question being migrated", () => {
		const id = canonicalQuestionId({label: "Small breasts", role: "self"}, {aliases});
		expect(id).toBe("kink/bodies/small-chest#self");
	});

	test("follow chains", () => {
		expect(resolveAlias("a", {a: "b", b: "c"})).toBe("c");
	});

	test("survive a cycle instead of hanging", () => {
		expect(resolveAlias("a", {a: "b", b: "a"})).toBe("a");
	});
});

describe("explicit ids", () => {
	test("win over the label and get normalized", () => {
		const id = canonicalQuestionId({id: "Kink/Bodies/Small Breasts", label: "ignored"});
		expect(id).toBe("kink/bodies/small-breasts");
	});

	test("reject an unusable question", () => {
		expect(() => canonicalQuestionId({label: "!!!"})).toThrow();
		expect(() => canonicalQuestionId(null)).toThrow();
	});
});
