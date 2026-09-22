// Answer storage.
//
// Three rules drive this design:
//
// 1. Answers are keyed by canonical question id, never by checklist and position.
//    Two checklists sharing a question share its answer, which is what makes
//    version upgrades and cross-framing comparison work at all.
//
// 2. Each person gets their own bucket. Several people answering on the same
//    browser never overwrite each other; naming yourself differently is enough
//    to get a separate, intact save.
//
// 3. Overwriting only happens within one person + one question + a 24h window.
//    Past that window the previous answer is kept and a new revision is appended,
//    so tastes can be followed over time. The most recent revision is what gets
//    displayed and what will feed matching.

import {slugify} from "./canonical-id.js";

export const DEFAULT_REVISION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** localStorage-shaped object kept in memory — used by tests and as a fallback. */
export function createMemoryStorage(seed = {}) {
	const map = new Map(Object.entries(seed));
	return {
		getItem: key => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => void map.set(key, String(value)),
		removeItem: key => void map.delete(key),
		key: index => [...map.keys()][index] ?? null,
		get length() {
			return map.size;
		},
	};
}

function sameValues(a = {}, b = {}) {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) if (a[key] !== b[key]) return false;
	return true;
}

export function createAnswersStore({
	storage,
	namespace = "cm",
	now = () => Date.now(),
	revisionWindowMs = DEFAULT_REVISION_WINDOW_MS,
} = {}) {
	const backend = storage || createMemoryStorage();
	const peopleKey = `${namespace}:people`;
	const answersKey = personId => `${namespace}:answers:${personId}`;

	function read(key, fallback) {
		try {
			const raw = backend.getItem(key);
			if (raw === null || raw === undefined) return fallback;
			const parsed = JSON.parse(raw);
			return parsed === null ? fallback : parsed;
		} catch {
			// Corrupted entry: fall back rather than take the whole app down.
			return fallback;
		}
	}

	function write(key, value) {
		backend.setItem(key, JSON.stringify(value));
	}

	// --- people -------------------------------------------------------------

	function listPeople() {
		const people = read(peopleKey, []);
		return Array.isArray(people) ? people : [];
	}

	function personIdFor(name) {
		return slugify(String(name));
	}

	/** Idempotent: the same name is the same person, and keeps their answers. */
	function addPerson(name) {
		const id = personIdFor(name);
		if (!id) throw new TypeError(`"${name}" is not a usable person name.`);
		const people = listPeople();
		const existing = people.find(person => person.id === id);
		if (existing) return existing;
		const person = {id, name: String(name).trim(), createdAt: now()};
		write(peopleKey, [...people, person]);
		return person;
	}

	function getPerson(id) {
		return listPeople().find(person => person.id === id) || null;
	}

	function removePerson(id) {
		write(peopleKey, listPeople().filter(person => person.id !== id));
		backend.removeItem(answersKey(id));
	}

	// --- answers ------------------------------------------------------------

	function readAnswers(personId) {
		const answers = read(answersKey(personId), {});
		return answers && typeof answers === "object" ? answers : {};
	}

	/** Every revision of one question, oldest first. */
	function history(personId, questionId) {
		const revisions = readAnswers(personId)[questionId];
		return Array.isArray(revisions) ? revisions : [];
	}

	/** The revision that is displayed, and the one matching will use. */
	function latest(personId, questionId) {
		const revisions = history(personId, questionId);
		return revisions.length ? revisions[revisions.length - 1] : null;
	}

	/**
	 * Record an answer, applying the overwrite-vs-append rule.
	 * @returns {{revision: object, appended: boolean, unchanged: boolean}}
	 */
	function record(personId, questionId, values, {at = now()} = {}) {
		if (!personId) throw new TypeError("record needs a person id.");
		if (!questionId) throw new TypeError("record needs a question id.");

		const answers = readAnswers(personId);
		const revisions = Array.isArray(answers[questionId]) ? [...answers[questionId]] : [];

		// Locate the revision this answer follows chronologically, rather than
		// assuming it follows the last one: an import replays older answers, and
		// those must never clobber a revision that is already more recent.
		let previousIndex = -1;
		for (let index = 0; index < revisions.length; index++) {
			if (revisions[index].at <= at) previousIndex = index;
		}
		const previous = previousIndex >= 0 ? revisions[previousIndex] : null;

		// Re-submitting an identical answer is not a new revision, whatever the delay.
		if (previous && sameValues(previous.values, values)) {
			return {revision: previous, appended: false, unchanged: true};
		}

		const withinWindow = previous && at - previous.at < revisionWindowMs;
		const revision = withinWindow
			? {at, since: previous.since ?? previous.at, values: {...values}}
			: {at, since: at, values: {...values}};

		if (withinWindow) revisions[previousIndex] = revision;
		else revisions.splice(previousIndex + 1, 0, revision);

		answers[questionId] = revisions;
		write(answersKey(personId), answers);
		return {revision, appended: !withinWindow, unchanged: false};
	}

	/** questionId -> latest revision. The snapshot matching will consume. */
	function latestAll(personId) {
		const answers = readAnswers(personId);
		const snapshot = {};
		for (const [questionId, revisions] of Object.entries(answers)) {
			if (Array.isArray(revisions) && revisions.length) {
				snapshot[questionId] = revisions[revisions.length - 1];
			}
		}
		return snapshot;
	}

	function answeredQuestionIds(personId) {
		return Object.keys(latestAll(personId));
	}

	function forget(personId, questionId) {
		const answers = readAnswers(personId);
		delete answers[questionId];
		write(answersKey(personId), answers);
	}

	// --- portability --------------------------------------------------------

	function exportPerson(personId) {
		return {
			version: 1,
			person: getPerson(personId),
			answers: readAnswers(personId),
		};
	}

	/** Merge an export back in, revision by revision, keeping both timelines. */
	function importPerson(payload) {
		if (!payload || !payload.person) throw new TypeError("Nothing to import.");
		const person = addPerson(payload.person.name || payload.person.id);
		for (const [questionId, revisions] of Object.entries(payload.answers || {})) {
			if (!Array.isArray(revisions)) continue;
			for (const revision of revisions) {
				record(person.id, questionId, revision.values || {}, {at: revision.at});
			}
		}
		return person;
	}

	return {
		listPeople, addPerson, getPerson, removePerson,
		record, latest, history, latestAll, answeredQuestionIds, forget,
		exportPerson, importPerson,
		revisionWindowMs,
	};
}
