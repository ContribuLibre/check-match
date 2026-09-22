// The checklists offered by the page.
//
// The three kink variants deliberately share the same items, so they produce the
// same canonical question ids. Answering "Arousal" in the quick variant fills the
// same question in the full one: that is the cross-checklist behaviour in action,
// and the shortest way to see it working.

import {defineChecklist} from "../js/core/checklist.js";
import {defineAnswerModel} from "../js/core/criteria.js";
import {parsePresetData} from "../js/core/preset-format.js";
import legacyPreset from "../kinkListData/en_classic.js";
import {
	arousal,
	kinkAnswerModel,
	kinkArousalOnly,
	kinkArousalTolerance,
	tolerance,
} from "./kink-criteria.js";

const sections = parsePresetData(legacyPreset.data);

const variant = (id, label, answerModel) => defineChecklist({
	id, label, lang: "en", answerModel, sections,
});

/** Same two criteria as the yin/yang variant, read as vertical vs horizontal reach. */
const arousalToleranceAmplitude = defineAnswerModel({
	id: "kink-2-amplitude",
	label: "Arousal (vertical) vs tolerance (horizontal)",
	criteria: [arousal, tolerance],
	duoMode: "amplitude",
});

export default [
	variant("kink-classic", "Kinklist — 8 criteria (star)", kinkAnswerModel),
	variant("kink-duo", "Kinklist — arousal vs tolerance (yin/yang)", kinkArousalTolerance),
	variant("kink-amplitude", "Kinklist — arousal vs tolerance (amplitude)", arousalToleranceAmplitude),
	variant("kink-quick", "Kinklist — arousal only (gauge)", kinkArousalOnly),
];
