// The eight-criteria kink model.
//
// Levels, scores and colours come from the reference model
// (https://codepen.io/1000i100/pen/dydLLZw) and are kept verbatim: the scores are
// deliberately uneven, because the distance between "ok" and "sometimes" is not
// the distance between "never" and "warning". The long texts are what actually
// makes a level unambiguous, so they ride along as hints.
//
// Criterion order is the order of the star's sectors and is deliberately stable:
// a criterion always sits at the same angle, so two stars compare at a glance.

import {defineAnswerModel, defineCriterion, defineScale} from "../js/core/criteria.js";

export const experience = defineCriterion({
	id: "experience",
	label: "Experience",
	scale: defineScale({
		id: "experience",
		minColor: "#04C",
		maxColor: "#FC0",
		levels: [
			{short: "unknown", long: "", score: 0},
			{short: "hear, not tried", long: "", score: 0.1},
			{short: "one time", long: "", score: 0.25},
			{short: "few", long: "only with one partner, without external advices", score: 0.5},
			{short: "good", long: "", score: 0.8},
			{short: "expert", long: "", score: 1},
		],
	}),
});

export const excitment = defineCriterion({
	id: "excitment",
	label: "Excitment",
	scale: defineScale({
		id: "excitment",
		minColor: "#AAA",
		maxColor: "#F60",
		levels: [
			{short: "none", long: "Boring, not my thing... See acceptance to know if i'm ok with it.", score: 0},
			{short: "a little", long: "There is something, but i need to search if i want to find it.", score: 0.2},
			{short: "like", long: "Yes, it's my thing ! Enjoying it !", score: 0.5},
			{short: "love", long: "Oh yea ! Love'it ! I'm already hot !", score: 0.8},
			{short: "total fantasy", long: "I come every time i dream about it", score: 1},
		],
	}),
});

export const disgust = defineCriterion({
	id: "disgust",
	label: "Disgust",
	scale: defineScale({
		id: "disgust",
		minColor: "#848",
		maxColor: "#660",
		levels: [
			{short: "none", long: "no problem with that", score: 0},
			{short: "disinterest", long: "it look like it's not my thing", score: 0.1},
			{short: "repulsed", long: "it look unhealthy", score: 0.33},
			{short: "disgust", long: "noseous feeling", score: 0.66},
			{short: "vommiting", long: "noseous reaction : vomiting, convulsion or blackout", score: 1},
		],
	}),
});

export const exhibition = defineCriterion({
	id: "exhibition",
	label: "Exhibition",
	scale: defineScale({
		id: "exhibition",
		minColor: "#111",
		maxColor: "#F8C",
		levels: [
			{short: "taboo", long: "don't even ask me anything about it", score: 0},
			{short: "secret", long: "nobody must know", score: 0.1},
			{short: "private", long: "you can speak about it without naming me or to your very confident", score: 0.25},
			{short: "community", long: "community speak or practice, public flash exhib, record for strict private use", score: 0.5},
			{short: "shared", long: "public leaks not welcome, but you like to show off while trying to hide your identity, you're ok to wildly share private records", score: 0.66},
			{short: "public", long: "it's ok if your boss or familly see you or your records", score: 0.9},
			{short: "star", long: "you want the world to know you do this !", score: 1},
		],
	}),
});

export const fear = defineCriterion({
	id: "fear",
	label: "Fear",
	scale: defineScale({
		id: "fear",
		minColor: "#8D6",
		maxColor: "#8DF",
		levels: [
			{short: "none", long: "", score: 0},
			{short: "unconfortable", long: "", score: 0.1},
			{short: "scary", long: "", score: 0.25},
			{short: "fear", long: "", score: 0.5},
			{short: "terror", long: "can trigger sideration", score: 0.8},
			{short: "petrificated", long: "or blackout", score: 1},
		],
	}),
});

export const acceptance = defineCriterion({
	id: "acceptance",
	label: "Acceptance",
	scale: defineScale({
		id: "acceptance",
		minColor: "#E00",
		maxColor: "#6F0",
		levels: [
			{short: "never", long: "just don't, never, or you will go to jail", score: 0},
			{short: "warning", long: "may happen by accident, or be allowed once a year, 1/100", score: 0.1},
			{short: "tolerate", long: "if you like, i don't. But it can be ok about once a month or 1/10 times we see ourself, as a punichment for exemple", score: 0.25},
			{short: "ok", long: "don't like or dislike, it's just ok to do it (if it's not the core of what we share)", score: 0.5},
			{short: "sometimes", long: "i usually like it, but not every day, don't rush on it every times it will bore me", score: 0.6},
			{short: "mostly", long: "i really like it, we can do this most time we meet.", score: 0.8},
			{short: "always", long: "love it and always ready for it, we could start now and never stop ?", score: 1},
		],
	}),
});

export const aftercare = defineCriterion({
	id: "aftercare",
	label: "Aftercare",
	scale: defineScale({
		id: "aftercare",
		minColor: "#666",
		maxColor: "#FFD",
		levels: [
			{short: "dislike", long: "Not your job, don't do it", score: 0},
			{short: "indiferent", long: "no need", score: 0.1},
			{short: "optional", long: "it's an optional bonus", score: 0.25},
			{short: "check", long: "i need you to check if i need it and be ok to give some", score: 0.5},
			{short: "need", long: "yep, it's part of the deel, and a requirement for me", score: 0.8},
			{short: "many", long: "prepare yourself for at least as long aftercare as practice", score: 1},
		],
	}),
});

export const explicit = defineCriterion({
	id: "explicit",
	label: "Explicit",
	scale: defineScale({
		id: "explicit",
		minColor: "#EAF",
		maxColor: "#A0C",
		levels: [
			{short: "do it", long: "Don't ask, just do it, it's my job to stop you if i don't want it", score: 0},
			{short: "don't do, i will", long: "Don't ask, don't do, if it match your explicit policies, i will surprise you and do it when i want", score: 0.1},
			{short: "after check", long: "do it then ask me if it's welcome", score: 0.2},
			{short: "first time", long: "ask me the first time, if it's once ok, it will be every time as long i don't stop you", score: 0.33},
			{short: "by session", long: "ask me for the session, if ok, i don't need more check until session end. If it's a no, don't try again today, if I don't know, you can ask me only once during session to check if it's became ok or not.", score: 0.5},
			{short: "ask", long: "ask me every time you may want to do it. If i say you yes many times, and never no, you can ask outside a game if it's ok to do less check or not.", score: 0.66},
			{short: "always ask", long: "if you miss it one time, you trigger trauma (and dragons) so ask every time, for ever, even if i tell you it's ok. If I choose by myself (with no suggestion) to show you and updated version of this item with a less explicite rule, then only you can apply it.", score: 0.8},
			{short: "in advance", long: "ask me in advance, with no agenda about it. Don't wait for the answer. If it's a yes, i will come to say it when it's my time, and it's a one time yes exept if i say it's not and how to ask next time. If i don't talk about it, you can refresh the question at least one month later of if we share twice more time together since you ask me first time.", score: 0.9},
			{short: "don't ask, i will", long: "Don't ask, don't do, i will ask you if i want it.", score: 1},
		],
	}),
});

/** Eight criteria -> eight-sector star. Order matches the reference model. */
export const kinkAnswerModel = defineAnswerModel({
	id: "kink-8",
	label: "Kink (8 criteria)",
	criteria: [experience, excitment, disgust, exhibition, fear, acceptance, aftercare, explicit],
});

/** The reduced model, for lists that only want the gut reaction. */
export const kinkExcitmentOnly = defineAnswerModel({
	id: "kink-1",
	label: "Excitment only",
	criteria: [excitment],
});

/** Two criteria: wanting something versus being willing to take it. */
export const kinkExcitmentAcceptance = defineAnswerModel({
	id: "kink-2",
	label: "Excitment vs acceptance",
	criteria: [excitment, acceptance],
});
