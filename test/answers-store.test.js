import {beforeEach, describe, expect, test} from "bun:test";
import {
	DEFAULT_REVISION_WINDOW_MS,
	createAnswersStore,
	createMemoryStorage,
} from "../www/js/core/answers-store.js";

const HOUR = 60 * 60 * 1000;
const QUESTION = "kink/bodies/small-chest#self";

function storeAt(startTime = 1_000_000) {
	let clock = startTime;
	const store = createAnswersStore({
		storage: createMemoryStorage(),
		now: () => clock,
	});
	return {store, advance: ms => (clock += ms), at: () => clock};
}

describe("people", () => {
	let store;
	beforeEach(() => ({store} = storeAt()));

	test("different names give separate, non-overwriting saves", () => {
		const alex = store.addPerson("Alex");
		const sam = store.addPerson("Sam");
		store.record(alex.id, QUESTION, {excitation: 4});
		store.record(sam.id, QUESTION, {excitation: 0});

		expect(store.latest(alex.id, QUESTION).values).toEqual({excitation: 4});
		expect(store.latest(sam.id, QUESTION).values).toEqual({excitation: 0});
		expect(store.listPeople()).toHaveLength(2);
	});

	test("the same name is the same person and keeps their answers", () => {
		const first = store.addPerson("Alex");
		store.record(first.id, QUESTION, {excitation: 4});
		const again = store.addPerson("Alex");
		expect(again.id).toBe(first.id);
		expect(store.latest(again.id, QUESTION).values).toEqual({excitation: 4});
		expect(store.listPeople()).toHaveLength(1);
	});

	test("removing a person drops their answers only", () => {
		const alex = store.addPerson("Alex");
		const sam = store.addPerson("Sam");
		store.record(alex.id, QUESTION, {excitation: 4});
		store.record(sam.id, QUESTION, {excitation: 1});
		store.removePerson(alex.id);
		expect(store.getPerson(alex.id)).toBeNull();
		expect(store.latest(alex.id, QUESTION)).toBeNull();
		expect(store.latest(sam.id, QUESTION).values).toEqual({excitation: 1});
	});
});

describe("the 24h revision window", () => {
	test("overwrites within the window, keeping one revision", () => {
		const {store, advance} = storeAt();
		const alex = store.addPerson("Alex");
		store.record(alex.id, QUESTION, {excitation: 1});
		advance(23 * HOUR);
		const result = store.record(alex.id, QUESTION, {excitation: 4});

		expect(result.appended).toBe(false);
		expect(store.history(alex.id, QUESTION)).toHaveLength(1);
		expect(store.latest(alex.id, QUESTION).values).toEqual({excitation: 4});
	});

	test("appends past the window, preserving the older answer", () => {
		const {store, advance} = storeAt();
		const alex = store.addPerson("Alex");
		store.record(alex.id, QUESTION, {excitation: 1});
		advance(25 * HOUR);
		const result = store.record(alex.id, QUESTION, {excitation: 4});

		expect(result.appended).toBe(true);
		const history = store.history(alex.id, QUESTION);
		expect(history).toHaveLength(2);
		expect(history[0].values).toEqual({excitation: 1});
		expect(history[1].values).toEqual({excitation: 4});
		expect(store.latest(alex.id, QUESTION).values).toEqual({excitation: 4});
	});

	test("keeps the start of the current revision while overwriting", () => {
		const {store, advance, at} = storeAt();
		const alex = store.addPerson("Alex");
		const start = at();
		store.record(alex.id, QUESTION, {excitation: 1});
		advance(2 * HOUR);
		store.record(alex.id, QUESTION, {excitation: 2});

		const latest = store.latest(alex.id, QUESTION);
		expect(latest.since).toBe(start);
		expect(latest.at).toBe(start + 2 * HOUR);
	});

	test("an identical answer never creates a revision", () => {
		const {store, advance} = storeAt();
		const alex = store.addPerson("Alex");
		store.record(alex.id, QUESTION, {excitation: 1});
		advance(30 * HOUR);
		const result = store.record(alex.id, QUESTION, {excitation: 1});

		expect(result.unchanged).toBe(true);
		expect(store.history(alex.id, QUESTION)).toHaveLength(1);
	});

	test("the window is exactly 24h", () => {
		expect(DEFAULT_REVISION_WINDOW_MS).toBe(24 * HOUR);
	});
});

describe("answers are keyed by question, not by checklist", () => {
	test("two checklists sharing a question share its answer", () => {
		const {store} = storeAt();
		const alex = store.addPerson("Alex");
		// Recorded while filling the v1 checklist...
		store.record(alex.id, "collective/chores/dishes", {opinion: 3, importance: 4});
		// ...read back while filling a differently-framed checklist.
		const snapshot = store.latestAll(alex.id);
		expect(snapshot["collective/chores/dishes"].values).toEqual({opinion: 3, importance: 4});
		expect(store.answeredQuestionIds(alex.id)).toEqual(["collective/chores/dishes"]);
	});
});

describe("portability", () => {
	test("an out-of-order import never clobbers a newer revision", () => {
		const {store, advance} = storeAt();
		const alex = store.addPerson("Alex");
		store.record(alex.id, QUESTION, {excitation: 4}); // recent answer
		const recentAt = store.latest(alex.id, QUESTION).at;

		// Replaying an answer from a week ago, as an import would.
		store.record(alex.id, QUESTION, {excitation: 0}, {at: recentAt - 7 * 24 * HOUR});

		const history = store.history(alex.id, QUESTION);
		expect(history).toHaveLength(2);
		expect(history[0].values).toEqual({excitation: 0}); // older, inserted before
		expect(store.latest(alex.id, QUESTION).values).toEqual({excitation: 4});
		advance(0);
	});

	test("export/import round-trips a person's history", () => {
		const {store, advance} = storeAt();
		const alex = store.addPerson("Alex");
		store.record(alex.id, QUESTION, {excitation: 1});
		advance(30 * HOUR);
		store.record(alex.id, QUESTION, {excitation: 4});

		const payload = store.exportPerson(alex.id);
		const {store: fresh} = storeAt();
		const imported = fresh.importPerson(payload);

		expect(fresh.history(imported.id, QUESTION)).toHaveLength(2);
		expect(fresh.latest(imported.id, QUESTION).values).toEqual({excitation: 4});
	});
});

describe("robustness", () => {
	test("a corrupted entry degrades instead of throwing", () => {
		const storage = createMemoryStorage({"cm:people": "{not json"});
		const store = createAnswersStore({storage});
		expect(store.listPeople()).toEqual([]);
		const alex = store.addPerson("Alex");
		expect(alex.id).toBe("alex");
	});

	test("an unusable name is rejected", () => {
		const {store} = storeAt();
		expect(() => store.addPerson("   ")).toThrow();
	});
});
