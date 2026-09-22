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
	acceptance,
	excitment,
	kinkAnswerModel,
	kinkExcitmentAcceptance,
	kinkExcitmentOnly,
} from "./kink-criteria.js";

const sections = parsePresetData(legacyPreset.data);

const variant = (id, label, answerModel) => defineChecklist({
	id, label, lang: "en", answerModel, sections,
});

/** Same two criteria as the yin/yang variant, read as vertical vs horizontal reach. */
const excitmentAcceptanceAmplitude = defineAnswerModel({
	id: "kink-2-amplitude",
	label: "Excitment (vertical) vs acceptance (horizontal)",
	criteria: [excitment, acceptance],
	duoMode: "amplitude",
});

export default [
	variant("kink-classic", "Kinklist — 8 criteria (star)", kinkAnswerModel),
	variant("kink-duo", "Kinklist — excitment vs acceptance (yin/yang)", kinkExcitmentAcceptance),
	variant("kink-amplitude", "Kinklist — excitment vs acceptance (amplitude)", excitmentAcceptanceAmplitude),
	variant("kink-quick", "Kinklist — excitment only (gauge)", kinkExcitmentOnly),
];
