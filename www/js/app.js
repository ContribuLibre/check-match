// Checklist UI.
//
// Plain modules, no build step, no dependency: the page is served as static files.
// The app owns no answer state of its own — it reads and writes the store, and
// re-renders from it, so what you see is always what is persisted.

import {createAnswersStore} from "./core/answers-store.js";
import {completion} from "./core/checklist.js";
import {getCriterion, sanitizeValues} from "./core/criteria.js";
import {indicatorSvg} from "./render/indicator.js";

const html = (strings, ...values) =>
	strings.reduce((out, chunk, index) => out + chunk + (values[index] ?? ""), "");

const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({
	"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[character]));

const formatDate = timestamp => new Date(timestamp).toLocaleString();

export function startApp({checklists, root = document, storage = globalThis.localStorage}) {
	const store = createAnswersStore({storage});
	const elements = {
		person: root.querySelector("[data-person]"),
		addPerson: root.querySelector("[data-add-person]"),
		checklist: root.querySelector("[data-checklist]"),
		progress: root.querySelector("[data-progress]"),
		questions: root.querySelector("[data-questions]"),
		editor: root.querySelector("[data-editor]"),
	};

	const state = {
		personId: null,
		checklist: checklists[0],
		openQuestionId: null,
	};

	// --- people -------------------------------------------------------------

	function ensurePerson() {
		const people = store.listPeople();
		if (!people.length) return null;
		if (!state.personId || !people.some(person => person.id === state.personId)) {
			state.personId = people[0].id;
		}
		return state.personId;
	}

	function renderPeople() {
		const people = store.listPeople();
		elements.person.innerHTML = people
			.map(person => html`<option value="${escapeHtml(person.id)}"${
				person.id === state.personId ? " selected" : ""}>${escapeHtml(person.name)}</option>`)
			.join("") || html`<option value="">— nobody yet —</option>`;
	}

	function renderChecklists() {
		elements.checklist.innerHTML = checklists
			.map(list => html`<option value="${escapeHtml(list.id)}"${
				list.id === state.checklist.id ? " selected" : ""}>${escapeHtml(list.label)}</option>`)
			.join("");
	}

	// --- questions ----------------------------------------------------------

	function valuesOf(questionId) {
		const revision = state.personId ? store.latest(state.personId, questionId) : null;
		return revision ? revision.values : {};
	}

	function renderQuestion(question) {
		const values = valuesOf(question.questionId);
		const role = question.role
			? html`<span class="role">${escapeHtml(question.role)}</span>`
			: "";
		return html`
			<li class="question${state.openQuestionId === question.questionId ? " open" : ""}"
			    data-question="${escapeHtml(question.questionId)}">
				<button class="question-summary" type="button">
					<span class="indicator-slot">${indicatorSvg(question.answerModel, values, {size: 44})}</span>
					<span class="question-label">${escapeHtml(question.label)}${role}</span>
				</button>
			</li>`;
	}

	function renderQuestions() {
		const bySection = new Map();
		for (const question of state.checklist.questions) {
			if (!bySection.has(question.section)) bySection.set(question.section, []);
			bySection.get(question.section).push(question);
		}

		elements.questions.innerHTML = [...bySection.entries()].map(([section, questions]) => html`
			<section class="category">
				<h2>${escapeHtml(section)}</h2>
				<ul class="questions">${questions.map(renderQuestion).join("")}</ul>
			</section>`).join("");
	}

	function renderProgress() {
		const snapshot = state.personId ? store.latestAll(state.personId) : {};
		const {answered, total} = completion(state.checklist, snapshot);
		const percent = total ? Math.round((answered / total) * 100) : 0;
		elements.progress.textContent = `${answered} / ${total} answered (${percent}%)`;
	}

	// --- editor -------------------------------------------------------------

	function renderEditor() {
		const question = state.openQuestionId ? state.checklist.get(state.openQuestionId) : null;
		if (!question || !state.personId) {
			elements.editor.hidden = true;
			elements.editor.innerHTML = "";
			return;
		}

		const values = valuesOf(question.questionId);
		const history = store.history(state.personId, question.questionId);

		const criteria = question.answerModel.criteria.map(criterion => {
			const current = values[criterion.id];
			const levels = criterion.scale.levels.map(level => html`
				<button type="button" class="level${current === level.value ? " selected" : ""}"
				        data-criterion="${escapeHtml(criterion.id)}" data-level="${level.value}"
				        style="--criterion-color: ${escapeHtml(criterion.color)}">
					${escapeHtml(level.label)}
				</button>`).join("");
			return html`
				<div class="criterion">
					<div class="criterion-name" style="--criterion-color: ${escapeHtml(criterion.color)}">
						${escapeHtml(criterion.label)}
						<button type="button" class="clear" data-clear="${escapeHtml(criterion.id)}"
						        title="Clear this criterion">×</button>
					</div>
					<div class="levels">${levels}</div>
				</div>`;
		}).join("");

		// More than one revision means the 24h window was crossed at least once.
		const revisions = history.length > 1 ? html`
			<div class="history">
				<h4>History (${history.length} revisions)</h4>
				<ol>${history.slice().reverse().map((revision, index) => html`
					<li${index === 0 ? ' class="current"' : ""}>
						<time datetime="${new Date(revision.at).toISOString()}">${formatDate(revision.at)}</time>
						<span>${escapeHtml(summarize(question.answerModel, revision.values))}</span>
					</li>`).join("")}
				</ol>
			</div>` : "";

		elements.editor.hidden = false;
		elements.editor.innerHTML = html`
			<header class="editor-header">
				<span class="indicator-slot large">${indicatorSvg(question.answerModel, values, {size: 120})}</span>
				<div>
					<h3>${escapeHtml(question.label)}${question.role ? ` — ${escapeHtml(question.role)}` : ""}</h3>
					<code class="question-id">${escapeHtml(question.questionId)}</code>
				</div>
				<button type="button" class="close" data-close>×</button>
			</header>
			<div class="criteria">${criteria}</div>
			${revisions}`;
	}

	function summarize(model, values) {
		const parts = model.criteria
			.filter(criterion => values[criterion.id] !== undefined && values[criterion.id] !== null)
			.map(criterion => `${criterion.label}: ${criterion.scale.levels[values[criterion.id]].label}`);
		return parts.length ? parts.join(", ") : "cleared";
	}

	// --- writes -------------------------------------------------------------

	function setCriterion(criterionId, level) {
		const question = state.checklist.get(state.openQuestionId);
		if (!question || !state.personId) return;
		const criterion = getCriterion(question.answerModel, criterionId);
		if (!criterion) return;

		const values = {...valuesOf(question.questionId)};
		// Clicking the selected level again clears it, as the old list did.
		if (values[criterionId] === level) delete values[criterionId];
		else values[criterionId] = level;

		store.record(state.personId, question.questionId,
			sanitizeValues(question.answerModel, values));
		render();
	}

	function clearCriterion(criterionId) {
		const question = state.checklist.get(state.openQuestionId);
		if (!question || !state.personId) return;
		const values = {...valuesOf(question.questionId)};
		delete values[criterionId];
		store.record(state.personId, question.questionId,
			sanitizeValues(question.answerModel, values));
		render();
	}

	// --- wiring -------------------------------------------------------------

	function render() {
		ensurePerson();
		renderPeople();
		renderChecklists();
		renderProgress();
		renderQuestions();
		renderEditor();
	}

	elements.addPerson.addEventListener("click", () => {
		const name = prompt("Name for this set of answers:");
		if (!name || !name.trim()) return;
		try {
			state.personId = store.addPerson(name).id;
			render();
		} catch (error) {
			alert(error.message);
		}
	});

	elements.person.addEventListener("change", event => {
		state.personId = event.target.value;
		state.openQuestionId = null;
		render();
	});

	elements.checklist.addEventListener("change", event => {
		state.checklist = checklists.find(list => list.id === event.target.value) || checklists[0];
		state.openQuestionId = null;
		render();
	});

	elements.questions.addEventListener("click", event => {
		const item = event.target.closest("[data-question]");
		if (!item) return;
		if (!state.personId) {
			alert("Create someone first: answers are stored per person.");
			return;
		}
		const questionId = item.dataset.question;
		state.openQuestionId = state.openQuestionId === questionId ? null : questionId;
		render();
	});

	elements.editor.addEventListener("click", event => {
		if (event.target.closest("[data-close]")) {
			state.openQuestionId = null;
			render();
			return;
		}
		const clear = event.target.closest("[data-clear]");
		if (clear) return clearCriterion(clear.dataset.clear);
		const level = event.target.closest("[data-level]");
		if (level) setCriterion(level.dataset.criterion, Number(level.dataset.level));
	});

	render();
	return {store, state, render};
}
