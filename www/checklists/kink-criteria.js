// The eight-criteria kink model.
//
// Each criterion gets its own scale: "how much experience" and "how much disgust"
// do not share a granularity, a wording or a colour, and collapsing them into one
// Favorite..No axis is exactly what the old single-scale list could not express.
//
// Criterion order is branch order on the star, and it is deliberately stable:
// a given criterion always sits at the same angle, so two stars can be compared
// at a glance without reading the labels.

import {defineAnswerModel, defineCriterion, defineScale} from "../js/core/criteria.js";

export const experience = defineCriterion({
	id: "experience",
	label: "Experience",
	color: "#4C8DFF",
	scale: defineScale({
		id: "experience",
		color: "#4C8DFF",
		levels: ["Never", "Curious", "Tried once", "Practised", "Core practice"],
	}),
});

export const arousal = defineCriterion({
	id: "arousal",
	label: "Arousal",
	color: "#FF4F81",
	scale: defineScale({
		id: "arousal",
		color: "#FF4F81",
		levels: ["None", "Mild", "Strong", "Intense"],
	}),
});

export const tolerance = defineCriterion({
	id: "tolerance",
	label: "Tolerance",
	color: "#23C552",
	scale: defineScale({
		id: "tolerance",
		color: "#23C552",
		levels: ["Hard limit", "Soft limit", "Acceptable", "Comfortable"],
	}),
});

export const exhibition = defineCriterion({
	id: "exhibition",
	label: "Exhibition",
	color: "#F2A23C",
	scale: defineScale({
		id: "exhibition",
		color: "#F2A23C",
		levels: ["Private only", "Trusted circle", "Small group", "Public"],
	}),
});

export const fear = defineCriterion({
	id: "fear",
	label: "Fear",
	color: "#8A5CF6",
	scale: defineScale({
		id: "fear",
		color: "#8A5CF6",
		levels: ["None", "Slight", "Real", "Blocking"],
	}),
});

export const disgust = defineCriterion({
	id: "disgust",
	label: "Disgust",
	color: "#7A6A5B",
	scale: defineScale({
		id: "disgust",
		color: "#7A6A5B",
		levels: ["None", "Slight", "Strong", "Repulsed"],
	}),
});

export const aftercare = defineCriterion({
	id: "aftercare",
	label: "Aftercare",
	color: "#21C7C7",
	scale: defineScale({
		id: "aftercare",
		color: "#21C7C7",
		levels: ["Not needed", "Light", "Important", "Essential"],
	}),
});

export const explicitness = defineCriterion({
	id: "explicitness",
	label: "Explicit consent",
	color: "#D93636",
	scale: defineScale({
		id: "explicitness",
		color: "#D93636",
		levels: ["Implicit is fine", "Mention it", "Explicit consent", "Negotiated"],
	}),
});

/** Eight criteria -> eight-branch star. */
export const kinkAnswerModel = defineAnswerModel({
	id: "kink-8",
	label: "Kink (8 criteria)",
	criteria: [experience, arousal, tolerance, exhibition, fear, disgust, aftercare, explicitness],
});

/** The reduced model, for lists that only want the gut reaction. */
export const kinkArousalOnly = defineAnswerModel({
	id: "kink-1",
	label: "Arousal only",
	criteria: [arousal],
});

/** Two criteria: the yin/yang reading of wanting something versus being able to take it. */
export const kinkArousalTolerance = defineAnswerModel({
	id: "kink-2",
	label: "Arousal vs tolerance",
	criteria: [arousal, tolerance],
});
