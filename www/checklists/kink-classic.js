// The historical kinklist content, re-read through the new question model.
//
// The item text still comes from the legacy preset, so nothing was re-typed and
// the existing forks' data stays usable; what changes is that every item now has
// a canonical question id and an eight-criteria answer model.

import legacyPreset from "../kinkListData/en_classic.js";
import {defineChecklist} from "../js/core/checklist.js";
import {parsePresetData} from "../js/core/preset-format.js";
import {kinkAnswerModel} from "./kink-criteria.js";

export default defineChecklist({
	id: "kink-classic",
	label: "Kinklist — classic",
	lang: "en",
	answerModel: kinkAnswerModel,
	sections: parsePresetData(legacyPreset.data),
});
