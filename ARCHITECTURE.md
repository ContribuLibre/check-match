# check-match — architecture

Static pages, plain ES modules, no build step and no runtime dependency.
`www/` can be uploaded as-is to any static host. Bun is used for tests and for a
local preview server only — never to produce the shipped files.

```
bun test              # 78 tests, no DOM needed
bun run serve         # preview on http://localhost:8080 (PORT= to change)
```

## The three ideas

### 1. An answer belongs to a question, not to a checklist

Every answer is stored against a **canonical question id**
(`www/js/core/canonical-id.js`). Two checklists that ask the same question share
its answer, which is what makes these work:

- **version upgrades** — a v2 checklist reads what was answered in v1;
- **different framings** — a short list and a long one overlap on what they share;
- **translation** — a French and an English wording can be declared to be the
  same question.

Two id shapes exist on purpose:

| shape | example | meaning |
|---|---|---|
| explicit | `kink/bodies/small-chest` | stable, language-neutral — the target form |
| derived | `label:en:small-breasts` | provisional, built from an English label |

Derived ids embed their language, so two translations never collide *by
accident*: they stay separate until an `aliases` entry (or an explicit id) says
they are the same question. Promoting a derived id to an explicit one is a pure
alias addition, so no answer is ever lost.

A role suffix makes a question atomic: `spanking#giving` and `spanking#receiving`
are two questions, not one question with two slots.

### 2. Answers are per person, with a 24h revision window

`www/js/core/answers-store.js`:

- **per person** — each person gets their own bucket; several people answering on
  the same browser never overwrite each other. Naming yourself differently is
  enough to get a separate, intact save.
- **overwrite inside 24h** — re-answering the same question within the window
  updates the current revision in place.
- **append past 24h** — beyond it the previous answer is kept and a new revision
  is appended, so tastes can be followed over time.
- **the latest revision** is what is displayed, and what will feed matching.
- an identical answer never creates a revision, whatever the delay.

Revisions are kept in chronological order even when recorded out of order, so an
import can replay old answers without clobbering newer ones.

### 3. One item, several criteria, each on its own scale

`www/js/core/criteria.js`. The old list had a single Favorite..No axis shared by
every item. Here an item is qualified by N criteria, each with its own scale,
wording and colour — experience and disgust have no reason to share a
granularity. The answer model cascades **checklist → section → item**, so within
one checklist some items can carry more criteria than their neighbours.

The criteria count picks the shape (`display: "auto"`, overridable):

| criteria | shape | file |
|---|---|---|
| 1 | thermometer gauge | `www/js/render/shapes.js` |
| 2 | yin/yang, or `duoMode: "amplitude"` (1st vertical, 2nd horizontal) | idem |
| 3+ | star, one branch per criterion | idem |

Branch order is stable, so a criterion always sits at the same angle and two
stars compare at a glance. An unanswered criterion collapses into the hollow —
it reads as *absent*, not as a zero. `www/shapes.html` renders every shape at
every value as a visual reference.

All of `shapes.js` is pure geometry returning coordinates and SVG path data: no
DOM, so it is unit-tested directly and can later draw an export just as well.

## Layout

```
www/
  checklist.html        the app
  shapes.html           visual reference for the indicators
  index.html            the legacy single-scale app, still working
  js/core/              canonical-id, criteria, checklist, answers-store, preset-format
  js/render/            shapes (pure), indicator (SVG strings)
  js/app.js             UI wiring
  js/main.js            legacy app
  checklists/           answer models + checklist definitions
  kinkListData/         preset content in the historical text format
test/                   bun tests
```

`preset-format.js` parses the historical `#Category / (Columns) / * Item` text,
so existing presets and forks feed the new question model without re-typing, and
checklists stay comfortable to hand-edit.

## Legacy app

`www/index.html` + `js/main.js` still run the original single-scale list.
`loadPreset(name, definition)` registers a preset shipped with the page — it must
run before `init()`, which `attemptInit()` now guarantees. Once the app is
running, `kinklist.presetManager.addDefault(definition)` does the same at
runtime. Both mark the preset read-only, as befits something the page ships
rather than something the user wrote.

## Not done yet

- **Matching** between people — the store already exposes `latestAll(personId)`,
  the snapshot it will consume.
- **The collective-life checklist** and its criteria (opinion / importance /
  how much cooperation I need) — the models support it, the content is not written.
- **Image export** — the legacy canvas exporter has not been ported to the new
  indicators.
