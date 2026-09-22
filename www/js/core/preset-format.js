// Parser for the historical text format:
//
//   #Category
//   (Column, Other column)
//   * Item
//   * Other item
//
// Kept because it is the format every existing preset and every fork is written
// in, and because it stays the most comfortable way to hand-edit a checklist.
// Parsing it into sections is what lets old presets feed the new question model.

const CATEGORY = /^#\s*(.+)$/;
const COLUMNS = /^\((.*)\)$/;
const ITEM = /^\*\s*(.+)$/;

/**
 * @returns {Array<{label: string, roles: string[], items: Array<{label: string}>}>}
 */
export function parsePresetData(text) {
	if (typeof text !== "string") throw new TypeError("parsePresetData expects a string.");
	const sections = [];
	let current = null;

	text.split(/\r?\n/).forEach((rawLine, index) => {
		const line = rawLine.trim();
		if (!line) return;

		const category = CATEGORY.exec(line);
		if (category) {
			current = {label: category[1].trim(), roles: [], items: []};
			sections.push(current);
			return;
		}

		if (!current) {
			throw new SyntaxError(`Line ${index + 1}: "${line}" appears before any #category.`);
		}

		const columns = COLUMNS.exec(line);
		if (columns) {
			current.roles = columns[1].split(",").map(name => name.trim()).filter(Boolean);
			return;
		}

		const item = ITEM.exec(line);
		if (item) {
			current.items.push({label: item[1].trim()});
			return;
		}

		throw new SyntaxError(`Line ${index + 1}: "${line}" is neither #category, (columns) nor * item.`);
	});

	// A lone column carries no distinction worth putting in the question id:
	// it becomes "no role" so that a one-column item and a role-less item match.
	return sections.map(section => ({
		...section,
		roles: section.roles.length > 1 ? section.roles : [],
	}));
}

/** Round-trip the other way, so an edited checklist stays hand-editable. */
export function formatPresetData(sections) {
	return sections.map(section => {
		const lines = [`#${section.label}`];
		if (section.roles && section.roles.length) lines.push(`(${section.roles.join(", ")})`);
		for (const item of section.items || []) {
			lines.push(`* ${typeof item === "string" ? item : item.label}`);
		}
		return lines.join("\n");
	}).join("\n\n") + "\n";
}
