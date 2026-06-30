# Spec — `coach-program-v2`: a configurable, mastery-based, closed-loop coach program

**PR**: `coach-program-v2` · **Scope**: feature (C7 of the enhancements portfolio) · **ADR**: none by default (flag **ADR-0059** only if Q-B is judged architectural; reserved 0054–0058 are taken)
**Spec version**: V1 (post 4 `/draft-general` cycles + 3 `/enrich` cycles) · **Drafted**: 2026-06-30
**Pre-V0 scan**: **PASS** — `reports/coach-program-v2_{target_exists,baseline,collision}.json`

---

## §0 Context

The coach's program is the payoff of the assessment: `buildCoachProgram(profile, 30, locale)`
turns a `CoachProfile` into a worst-first, time-boxed `PlanItem[]`, previewed in `Coach.svelte`
and run via `buildSession` → `Session.svelte`. It works, but it is **rigid, blind, and generic** in
four ways that the assessment surface (Insights) has already solved next door:

1. **Fixed budget.** The 30-minute budget is **hardcoded** at the single call-site
   (`Coach.svelte:184`), and again in `Session.svelte:32` (`const minutes = 30`). Insights has a
   15/30/60 toggle (`insights.min15/30/60`, `Insights.svelte:134`) the coach lacks. A player with
   10 free minutes or a 60-minute session has no lever.
2. **Time-boxed, never mastery-based.** Every step is a fixed `{minutes}` block
   (`program.ts:53–84` via `take()`); there is no notion of "drill this fork pattern *until you can
   do it*". The program ends when the clock runs out, not when the weakness is addressed.
3. **Open loop.** `efficacy.ts` measures per-motif before/after miss-rate
   (`motifEfficacy`, descriptive, honesty-framed) — but it lives only in **Insights**
   (`Insights.svelte:28`), disconnected from the coach. The coach re-diagnoses from scratch each
   run and never tells you whether the thing it told you to drill last time actually moved.
4. **Generic opening routing.** A weak `openingAccuracy` dimension routes to a generic
   `activity:'repertoire', focus:'opening lines'` step (`program.ts:72`) — never a *concrete*
   opening, even though `eco.json` can name the player's most-played line and the `OPENING_BOOK`
   (completed by sibling P4) can steer toward the gap.

This PR makes the program **configurable** (CO5), **mastery-based** (CO16), **closed-loop** (CO10),
and **opening-specific** (CO17) — reusing the patterns that already exist next door, **additively**,
with **no `DB_VERSION` bump**, and with the project's honesty posture intact (efficacy feedback is
**descriptive before/after, never a causal claim** — mirrors `insights.didItMove`).

**Doctrine carried in:** additive-optional (no schema bump); pure cores (`buildCoachProgram` stays
pure — no `Date`/`Math.random`); **do NOT fork `buildStudyPlan`** (AP-COACH-1, Insights stays
byte-identical); **route only to non-empty modes** (AP-COACH-5); bilingual FR/EN parity;
single concern; **code before docs**; no component-test harness → pure-core unit tests + manual.

## §0.5 Arbitrages flagged (defaults applied)

Full user-facing bundle: `reports/coach-program-v2_arbitrages.md`. Spec body already reflects these.

- **Q-A — budget toggle values + scope.** **[default: 15/30/60, drives BOTH preview and the launched
  session]** Mirror Insights' values exactly; pass the chosen budget through to `buildSession` so the
  toggle is not cosmetic (else `Session.svelte:32`'s hardcoded 30 wins). Default stays 30.
- **Q-B — mastery criterion.** **[default: per-step criterion WITH a minutes cap as a safety bound]**
  Advance on mastery OR on the cap, whichever first. `minutes` stays (the cap + back-compat); the
  criterion is a NEW **optional** `PlanItem` field → no consumer breaks.
- **Q-C — closed loop.** **[default: descriptive surface + a SOFT advisory; NO causal claim, NO
  auto-mutation]** Read the existing `motifEfficacy` over stored analyses; show before/after + a soft
  "looks improved — you can move on" only when `enoughData && deltaPct<0`. Never auto-drop a step,
  never write "resolved" to disk.
- **Q-D — opening-specific routing.** **[default: name a concrete opening from analysed games via
  `eco.json`; keep routing book-agnostic; reuse the existing `play-steered` steer]** Upgrade the
  generic `repertoire` step's **`reason`** to name the player's most-played/weakest opening when
  identifiable; do NOT add coach entries to `OPENING_BOOK` (P4 owns it — AP-STEER-5), do NOT
  auto-create a `RepertoireLine`. `focus` stays a stable routing key.

---

## §1 Empirical baseline

Captured 2026-06-30 (`reports/coach-program-v2_{baseline,target_exists,collision}.json`). Anchors, not estimates.

| Fact | Value | Source |
|---|---|---|
| `buildCoachProgram` | pure; `(profile, minutes=30, locale='fr') → PlanItem[]`; `minutes` param **already live** (budget-bounded by `take()`) | `program.ts:42` |
| Coach budget hardcode | `buildCoachProgram(p, 30, getLocale())` | `Coach.svelte:184` |
| Session budget hardcode | `const minutes = 30; // same default budget as Insights` | `Session.svelte:32` |
| Insights toggle | `<select bind:value={minutes}>` 15/30/60; plan `$derived` | `Insights.svelte:21,134–138` |
| Efficacy core | `motifEfficacy(analyses, motifKey, {minMoves=20, splitAt?}) → EfficacyReadout`; `deltaPct<0`=improved; `enoughData` gate | `efficacy.ts:44` |
| Efficacy consumer | Insights only (top-3 leaks), `$derived` — **disconnected from coach** | `Insights.svelte:28` |
| Opening routing today | `openingAccuracy` → generic `repertoire`/`opening lines` + `play-steered`/`openingAccuracy` | `program.ts:72–73` |
| `eco.json` naming | `nameOpening(uci, table)`, `localizedOpeningName`, `ECO_NAME_FR` | `eco.ts:23,124` |
| `OPENING_BOOK` | 14 lines, keyed by **`Dimension`** (not ECO); owned by P4 | `openingBook.ts:30` |
| `PlanItem` | `{ activity, focus, minutes, reason }`; `focus`/`activity` STABLE routing keys; `reason` bilingual | `studyPlan.ts:11` |
| `buildSession` | `PlanItem.activity → SessionStep.kind` 1:1; carries `focus` to `tacticsRouting`/`scenarioForFocus`/`app.steerDimension` | `session.ts:50` |
| Tests | **504 / 69 files green** | `npx vitest run` |
| `svelte-check` | **0 errors / 0 warnings (383 files)** | portfolio §8 |
| `DB_VERSION` | **4** (this PR adds none) | `db.ts:125` |
| Program generator keys | `program.*` (8 keys) in `generators.ts:124–155`, via `gt()` | grep |

**Key correction vs the portfolio shorthand:** the `minutes` parameter on `buildCoachProgram`
**already exists and is already budget-bounded** — CO5 is therefore *wiring a toggle into the two
hardcoded call-sites*, **not** adding a core parameter. The genuinely new core shape is CO16
(mastery criterion field) and CO17 (opening-name enrichment of `reason`).

---

## §2 Scope (single concern)

**One concern: make the coach program configurable (budget), mastery-based (criterion+cap),
closed-loop (descriptive efficacy feedback), and opening-specific (named line) — additively, reusing
Insights/efficacy/eco patterns, without forking `buildStudyPlan` or bumping `DB_VERSION`.**

**In:**
- `src/coach/program.ts` — (CO16) add an **optional** `mastery` field to each `PlanItem` it emits,
  carrying a per-step criterion + a minutes cap; (CO17) enrich the `openingAccuracy` `repertoire`
  step's `reason` with a concrete opening name when the UI supplies one (book-agnostic). Stays pure.
- `src/analysis/studyPlan.ts` — extend the `PlanItem` interface with the **optional** `mastery?` field
  only (a shared type). `buildStudyPlan` itself is **untouched** (omits the field → Insights byte-identical).
- `src/coach/coachLoop.ts` *(new, pure)* — (CO10) `programEfficacy(program, analyses)`: for each
  program step that maps to a measurable motif, return the existing `motifEfficacy` readout +
  a derived **soft advisory** flag (`looksImproved = enoughData && deltaPct < 0`). No causal claim,
  no mutation. (CO17 helper) `namedOpeningForGap(analyses, locale)`: longest-prefix `nameOpening`
  over the player's recent games → `{ key, label }` or `null`.
- `src/ui/Coach.svelte` — (CO5) add the 15/30/60 budget toggle mirroring Insights; pass the chosen
  budget to `buildCoachProgram` AND into `app.activeSession` so `Session.svelte` honours it;
  (CO10) render the descriptive efficacy advisory in the result; (CO16) render the mastery criterion
  on each step; (CO17) pass `namedOpeningForGap(...)` into `buildCoachProgram`.
- `src/ui/Session.svelte` — (CO5/CO16) read the budget from `app.activeSession` instead of the
  hardcoded `30`; surface each step's mastery criterion + cap; advance a step when the criterion is
  met OR the cap elapses.
- `src/i18n/messages/coach.ts` + `generators.ts` — FR/EN keys for the toggle, the mastery badge,
  the efficacy advisory, and the named-opening `reason` variant.
- Tests: `program.test.ts`, new `coachLoop.test.ts`.

**Out (explicitly):**
- **`OPENING_BOOK` contents / `selectOpening`** — owned by **P4** (opening-steering-symmetry). C7 is
  book-agnostic: it consumes `app.steerDimension` (already wired) and names openings via `eco.json`.
  No coach entry is added to the steering book (AP-STEER-5 / AP-CPROG-7).
- **Forking or editing `buildStudyPlan`** (AP-COACH-1). The shared `PlanItem.mastery?` is optional;
  Insights' study plan and its snapshot stay byte-identical.
- **Mutating the stored `CoachProfile`** to mark a weakness "resolved" (AP-CPROG-4). The loop is
  read-only + descriptive. No `coachProfile` field added → no schema concern.
- **Re-running the assessment automatically** from efficacy (CO10 is feedback, not re-diagnosis;
  re-assessment nudges are C1's concern).
- **Auto-creating `RepertoireLine`s** from a diagnosis (a user act). C7 only *names* the opening.
- **C1's persistence/trend** (profile prev→current), **C2's probe v2**, **C6's narrative voice** —
  separate leaves. C7 touches only the program/loop/budget surface.
- Any **`DB_VERSION`** change.

---

## §3 Pre-flight gates

1. `buildCoachProgram`, `motifEfficacy`, `nameOpening`/`localizedOpeningName`, `buildSession`,
   `PlanItem`, the Insights 15/30/60 toggle, and both hardcoded `30`s all present as in §1 (verified).
2. 504 tests green before changes; `svelte-check` 0/0.
3. `buildStudyPlan` callers (Insights, Session fresh-start) compile unchanged after the optional
   `mastery?` field is added (additive). The existing study-plan + session snapshots stay green.
4. No new persisted field on `CoachProfile`/`PlayerModel`/any store → `DB_VERSION` stays 4
   (grep-confirmed: this PR adds no `db.ts` field).
5. P4's `app.steerDimension` → `selectOpening` path is the only opening-steering touchpoint C7 uses;
   C7 adds **no** entry to `OPENING_BOOK` (grep the diff).

---

## §4 Phase A — code (FIRST)

> Ordering is deliberate: pure cores first (`studyPlan` type → `program` → `coachLoop`), then the two
> UI surfaces, then i18n. Docs are **§7 (LAST)**.

### §4.1 Extend the shared `PlanItem` with an optional mastery criterion (`studyPlan.ts`)

`PlanItem` is the shared shape consumed by `buildStudyPlan`, `buildCoachProgram`, and `buildSession`.
Add **one optional field** — purely additive, every existing producer omits it:

```ts
/** Mastery criterion for a coach step (CO16). Optional: study-plan items omit it
 *  (Insights stays time-boxed); coach items carry it. The step is done when the
 *  criterion is met OR `minutes` (the cap) elapses — whichever first. */
export interface MasteryCriterion {
  kind: 'streak' | 'missRate';   // "N correct in a row" | "recent miss-rate below threshold"
  target: number;                // streak: N (e.g. 4); missRate: fraction 0..1 (e.g. 0.2)
  /** Stable routing/measurement key (motif key or 'endgame'); never translated. */
  motifKey?: string;
}

export interface PlanItem {
  activity: 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision' | 'sparring' | 'play-steered';
  focus: string;
  minutes: number;               // for coach steps this is now the SAFETY CAP (Q-B)
  reason: string;
  mastery?: MasteryCriterion;    // NEW — coach-only, additive-optional
}
```

`buildStudyPlan` is **not modified** — it never sets `mastery`, so its output (and snapshot) is
unchanged (AP-COACH-1).

### §4.2 `buildCoachProgram` — attach criteria + opening name (`program.ts`)

Keep the function **pure** and its existing `(profile, minutes, locale)` signature; add **one optional
arg** for the UI-derived opening name (the UI owns the `eco.json` async read; the core stays pure):

```ts
export function buildCoachProgram(
  profile: CoachProfile,
  minutes = 30,
  locale: Locale = 'fr',
  opts: { namedOpening?: { key: string; label: string } } = {},   // NEW, optional
): PlanItem[] { ... }
```

1. **Mastery criteria (CO16).** For each step it already emits, attach a `mastery` criterion whose
   `motifKey` is the step's stable key, and treat the existing `minutes` value as the **cap**:
   - per-motif tactics step (`m.theme`): `mastery: { kind: 'streak', target: 4, motifKey: m.theme }`
     (drill the pattern until 4-in-a-row, cap = the current `take(8)` minutes);
   - endgame step: `{ kind: 'streak', target: 3, motifKey: 'endgame' }`;
   - dimension steps (`endgameConversion`/`timeManagement`/`resilience`): `{ kind: 'missRate',
     target: 0.25, motifKey: <dim-key> }` (advance when recent miss-rate in that area drops below
     25%, cap = the existing minutes). `play-steered` keeps **no** criterion (a full game is its own
     unit — criterion-less by design; AP-CPROG-2).
   *(Targets are conservative defaults; tuneable. The criterion never removes the cap — the budget
   contract from Q-A holds.)*
2. **Opening name (CO17).** In the `openingAccuracy` branch, if `opts.namedOpening` is supplied, emit
   the `repertoire` step with the **named** reason and keep `focus` the SAME stable routing key
   (`'opening lines'`), so `buildSession`/routing are unaffected:
   ```ts
   reason: opts.namedOpening
     ? gt('program.openingAccuracyNamed', locale, { score: d.score, opening: opts.namedOpening.label })
     : gt('program.openingAccuracy', locale, { score: d.score }),
   ```
   The `play-steered` step is unchanged (it already biases via `app.steerDimension`).
   **No** entry is added to `OPENING_BOOK`; the label is display-only (AP-CPROG-7).

Purity preserved: `namedOpening` is data passed in; no `Date`/`Math.random`/`fetch` enters the core.

### §4.3 `coachLoop.ts` — the closed loop, descriptive (NEW, pure)

A new pure module (no `Date`, no `Math.random`, no Svelte/`app` import — mirrors `program.ts`):

```ts
import type { GameAnalysis } from '../analysis/types';
import { motifEfficacy, type EfficacyReadout } from '../analysis/efficacy';
import { nameOpening, type OpeningName } from '../opening/eco';
import { localizedOpeningName } from '../opening/eco';
import type { EcoEntry } from '../opening/eco';
import type { PlanItem } from '../analysis/studyPlan';
import type { Locale } from '../i18n/translate';

export interface StepEfficacy {
  motifKey: string;
  readout: EfficacyReadout;
  /** Soft, descriptive advisory — NOT a causal claim, NOT a verdict (AP-CPROG-4). */
  looksImproved: boolean;   // enoughData && deltaPct < 0
  /** E2 honesty distinction: this motif never occurred in any analysed game (vs merely
   *  thin data). Predicate: readout.early.playerMoves + readout.recent.playerMoves === 0.
   *  Drives "play some games to see if this moves" instead of the ambiguous "too little data". */
  neverMeasured: boolean;
}

/** Descriptive before/after for each program step that maps to a measurable motif.
 *  Reuses motifEfficacy (the SAME read Insights uses). Pure: caller passes analyses. */
export function programEfficacy(program: PlanItem[], analyses: GameAnalysis[]): StepEfficacy[] {
  const out: StepEfficacy[] = [];
  const seen = new Set<string>();
  for (const step of program) {
    const key = step.mastery?.motifKey;
    if (!key || key === 'endgame' || seen.has(key)) continue; // map only measurable motif keys
    seen.add(key);
    const readout = motifEfficacy(analyses, key);
    const neverMeasured = readout.early.playerMoves + readout.recent.playerMoves === 0;
    out.push({
      motifKey: key, readout, neverMeasured,
      looksImproved: readout.enoughData && readout.deltaPct < 0,
    });
  }
  return out;
}

/** CO17 helper: name the player's most-played opening from recent analyses (longest-prefix),
 *  localized. Pure given the eco table; returns null when nothing matches. */
export function namedOpeningForGap(
  analyses: GameAnalysis[],
  ecoTable: EcoEntry[],
  locale: Locale,
): { key: string; label: string } | null {
  // pick the most frequent named line across analyses[].plies→uci (helper detail in §5);
  // key = canonical English name (stable), label = localizedOpeningName(name, locale).
  ...
}
```

`looksImproved` is the **only** loop output that touches advancement, and it is **advisory** — the UI
shows "looks improved, you can move on", the user decides. Nothing is written to the profile.

### §4.4 `Coach.svelte` — toggle, named opening, efficacy advisory

- **Budget toggle (CO5).** Add `let budget = $state(30);` and a `<select bind:value={budget}>` with
  15/30/60 options (mirror `Insights.svelte:134–138`, same `min15/30/60` keys reused or coach-local
  equivalents). The preview becomes `$derived`/recomputed: `buildCoachProgram(p, budget, getLocale(),
  { namedOpening })`.
- **Named opening (CO17).** On reaching the result, load the eco table (`loadEco()`) + analyses
  (`loadAllAnalyses()`, already available in the coach via `runAnalysis`) once, compute
  `namedOpening = namedOpeningForGap(analyses, ecoTable, getLocale())`, pass it into the program.
  When null, the program emits the generic reason (graceful).
- **Efficacy advisory (CO10), inline (E1).** Compute `programEfficacy(programPreview, analyses)` and
  render each step's before/after line **inline on that step** (joined by `mastery.motifKey`), reusing
  the Insights `missRate`/`earlyRecent`/`deltaPts` presentation, + the soft advisory
  (`coach.looksImproved`) when `looksImproved`. A single header above the program carries the **same
  honesty caveat** as Insights (`insights.didItMove`/`didItMoveBody`); the per-step lines carry the
  numbers. Honesty branches (E2): `neverMeasured` → "play some games to see if this moves"
  (`coach.notMeasuredYet`); `!enoughData && !neverMeasured` → the Insights "too little data" line;
  never a fabricated verdict.
- **Empty-analyses guard (E3).** When `programEfficacy(...)` returns `[]` (a ladders-only coach run
  with no analysed games — the `finishWithoutGame` path), render **no** efficacy header or section at
  all (no hollow "Did it move?" block). Likewise `namedOpeningForGap` returns `null` → generic reason.
- **Pass budget to the session (CO5 scope).** In `startCoaching()`, stamp the chosen budget into the
  session so `Session.svelte` honours it:
  ```ts
  app.activeSession = { plan: buildSession(programPreview), current: 0,
                        startedAt: Date.now(), reflection: '', budgetMin: budget }; // budgetMin NEW (in-memory only)
  ```
  *(`app.activeSession` is an in-memory `AppState` field, not persisted — no `DB_VERSION` concern.)*

### §4.5 `Session.svelte` — honour the budget + mastery criterion

- Replace `const minutes = 30;` with `const minutes = $derived(app.activeSession?.budgetMin ?? 30);`
  (back-compat default 30 when launched from Insights' generic session path).
- Render each non-reflection step's mastery criterion + cap (e.g. "4 in a row · ≤8 min") from
  `step` (the criterion flows `PlanItem.mastery → SessionStep` — see §4.6).
- Advancement: the existing `advance()` stays manual ("Done · next"); ADD that the step **auto-eligible
  to advance** when its criterion is met (the trainer surfaces report streak/miss-rate back through
  the existing signal flags), OR when the cap elapses — whichever first. The cap is the hard bound
  (AP-CPROG-3): a step can never block the user past its `minutes` cap.

### §4.6 Carry `mastery` through `buildSession` (`session.ts`)

`buildSession` maps `PlanItem → SessionStep` (line 50). Add the optional field to `SessionStep` and
copy it through (additive; reflection/review steps omit it):

```ts
export interface SessionStep { ...; mastery?: MasteryCriterion; }   // additive
// in the loop:
const base: SessionStep = { ..., mastery: item.mastery };
```

No behavioural change for study-plan-derived sessions (they carry no `mastery`).

### §4.7 i18n keys (`coach.ts` + `generators.ts`)

- `generators.ts` (`program.*`, via `gt()` — pure core reads these):
  - `program.openingAccuracyNamed`: `{ fr: "La précision en ouverture est un point faible (score
    {score}) — travaillez votre {opening}.", en: 'Opening accuracy is a weak spot (score {score}) —
    work on your {opening}.' }`
- `coach.ts` (`coach.*` / reuse `insights.*`, via `t()` — UI chrome):
  - budget toggle: reuse `insights.min15/30/60` (already FR/EN) or add `coach.budgetLabel`.
  - mastery badge: `coach.masteryStreak` (`{n} in a row`), `coach.masteryMissRate` (`miss-rate < {pct}`),
    `coach.masteryCap` (`≤{min} min`).
  - efficacy advisory: reuse `insights.didItMove`/`didItMoveBody`/`missRate`/`earlyRecent`/`deltaPts`;
    add `coach.looksImproved` (`{ fr: 'Semble en progrès — vous pouvez passer à la suite.', en:
    'Looks improved — you can move on.' }`) with the descriptive caveat already carried by the header.
  - never-measured (E2): `coach.notMeasuredYet` (`{ fr: 'Pas encore mesuré — jouez quelques parties
    pour voir si cela bouge.', en: 'Not measured yet — play a few games to see if this moves.' }`).

All new strings FR+EN; `focus`/`activity`/`motifKey` stay English routing keys (never translated).

---

## §5 Phase B — tests

Pure-core unit tests only (no Svelte component harness — portfolio §8). Cores: `program`, `coachLoop`.

**`program.test.ts` (extend):**
1. **Budget is honoured** (already partly covered): `buildCoachProgram(p, 15)` total `minutes` ≤ 15;
   `buildCoachProgram(p, 60)` admits more steps than `…(p, 15)`.
2. **Mastery attached, cap = minutes (CO16):** a weak-motif program has each tactics step with
   `mastery.kind==='streak'`, `mastery.motifKey===<theme>`, and `step.minutes>0` (the cap); the
   `play-steered` step has **no** `mastery` (AP-CPROG-2).
3. **Dimension steps get `missRate` criteria** with the right `motifKey`.
4. **Opening name (CO17):** with `opts.namedOpening={key:'sicilian',label:'Sicilian Defence'}` and a
   weak `openingAccuracy` dim, the `repertoire` step's `reason` contains the label AND its `focus`
   is still the stable `'opening lines'` (routing unchanged). Without `namedOpening`, the generic
   reason is used.
5. **Purity:** identical inputs → deep-equal output (no `Date`/`Math.random`).
6. **Insights byte-identity guard:** a `buildStudyPlan(...)` snapshot/equality test still passes
   (it never emits `mastery`) — proves the shared-type change is inert for Insights (AP-COACH-1).

**`coachLoop.test.ts` (new):**
7. **`programEfficacy` reuses `motifEfficacy`:** for a program with a `mastery.motifKey==='fork'`
   step and analyses where fork miss-rate fell across the split, `looksImproved===true`,
   `readout.deltaPct<0`, `enoughData===true`.
8. **Honesty gate:** with `<minMoves` data, `looksImproved===false` and the readout's `enoughData`
   is false — no fabricated improvement (AP-CPROG-5, ANTI-FABRICATION: empty stays empty).
9. **Never-measured distinction (E2):** a program step whose motif never occurs in any analysis →
   `neverMeasured===true`, `looksImproved===false`; a step with thin-but-present data →
   `neverMeasured===false`, `enoughData===false`. The two are distinguishable.
10. **No causal mutation:** `programEfficacy` takes `(program, analyses)` and returns data only; assert
    it does not require/return a `CoachProfile` (read-only by type).
11. **Empty analyses (E3):** `programEfficacy(program, [])` returns `[]`; `namedOpeningForGap([], table,
    locale)` returns `null` (drives the no-header / generic-reason UI paths).
12. **`namedOpeningForGap`** returns the most-frequent named line's `{key,label}` (label localized
    for `fr` via `ECO_NAME_FR`), and `null` when no game matches a book line (empty=clean).

Expected delta: **+~12 assertions across program.test.ts + new coachLoop.test.ts** → new baseline
**≈ 514 tests / 70 files**.

---

## §6 Phase C — verification

- `npm test` green incl. the new cases; **no prior regression** (504 → ~514).
- `svelte-check` 0 errors / 0 warnings (Coach/Session `.svelte` touched — run it; anchor parity).
- **Insights study-plan snapshot byte-identical** (AP-COACH-1) — the optional `PlanItem.mastery`
  must not change any `buildStudyPlan` output; verify the existing snapshot/equality test passes.
- **`DB_VERSION` still 4** — grep the diff for any `db.ts` schema change (there must be none).
- **Manual/preview:**
  - Run the coach assessment; set the budget toggle to **15** → the program preview shrinks and the
    *launched session* (`Session.svelte`) shows the same 15-min budget (not 30). Set **60** → more steps.
  - A tactics step shows its mastery criterion ("4 in a row · ≤8 min"); meeting it advances early;
    leaving it open past the cap advances on the cap.
  - With analysed games showing a fork miss-rate drop, the result's "Did it move?" section shows the
    before/after + "Looks improved — you can move on", under the descriptive caveat. With sparse data
    it shows "too little data" — never a verdict.
  - With a most-played Sicilian and a weak openingAccuracy, the repertoire step names the Sicilian
    (FR: "Défense sicilienne"); with no identifiable opening, the generic text appears.
- **Honesty audit:** no string anywhere claims the training *caused* the change; the coach mirrors
  `insights.didItMoveBody` verbatim in posture.

---

## §7 Phase Z — docs (LAST)

- **No new ADR by default.** C7 reuses ADR-0045 (coach mode) + ADR-0039 (efficacy/session) +
  ADR-0027 (study-plan/budget) + ADR-0014/0022 (loop). **Flag ADR-0059 ONLY** if PR-time review
  judges the **mastery-criterion step model** (Q-B — "a program step can end on mastery, not just
  minutes") an architectural change to the `PlanItem` contract; reserved 0054–0058 are taken
  (portfolio/F3/F5/F6/play-takeback). Do not pre-spend.
- Inline rationale comments: in `program.ts` note that `minutes` is now the **cap** for coach steps
  (criterion-or-cap, Q-B) and that `opts.namedOpening` is display-only (book-agnostic, P4 owns the
  steering book — AP-CPROG-7); in `coachLoop.ts` carry the honesty caveat (descriptive, not causal —
  mirrors `insights.didItMove`).
- README: the coach feature description gains "configurable budget (15/30/60), mastery-based steps,
  and a descriptive before/after on what you drilled". Keep the honesty framing ("directional, not a
  grade; descriptive, not proof"). ATTRIBUTION unchanged.
- `decisions.md`: append the Q-A…Q-D resolutions (append-only) at session wrap; only allocate
  ADR-0059 if Q-B is ratified as architectural. Do not edit D001–D051 or prior ADRs.

---

## §8 Acceptance criteria

1. **CO5** — Coach has a 15/30/60 budget toggle (mirrors Insights); the chosen budget drives **both**
   the preview and the launched `Session` (no hardcoded `30` remains in either `Coach.svelte` or
   `Session.svelte`). Default 30 (no behaviour change until the user picks).
2. **CO16** — each coach step carries a `mastery` criterion (streak or miss-rate) with `minutes` as a
   **cap**; a step advances on the criterion OR the cap, whichever first; `play-steered` is
   criterion-less (test §5.2, manual §6).
3. **CO10** — the coach result surfaces the existing `motifEfficacy` before/after per measurable step,
   with a soft "looks improved, you can move on" only when `enoughData && deltaPct<0`, under the
   `insights.didItMove` honesty caveat. **No causal claim, no profile mutation** (tests §5.7–§5.9).
4. **CO17** — a weak `openingAccuracy` step's `reason` names a concrete opening derived from the
   player's analysed games (via `eco.json`, FR/EN-localized) when identifiable, generic otherwise;
   `focus` stays the stable routing key; **no** `OPENING_BOOK` entry added (tests §5.4, §3.5).
5. `buildCoachProgram` and `coachLoop` remain **pure** (no `Date`/`Math.random`); `buildStudyPlan` is
   **not forked/modified**; Insights study-plan snapshot **byte-identical** (AP-COACH-1; test §5.6).
6. 504 → ~514 tests green; `svelte-check` 0/0; **`DB_VERSION` still 4** (additive-optional only).
7. Bilingual FR/EN parity for every new user-facing string; routing keys untranslated.
8. **Route only to non-empty modes** (AP-COACH-5): the named-opening upgrade is display-only on an
   already-routed step; the efficacy advisory never invents a step.

---

## §9 Anti-patterns (AP-CPROG-*)

- **AP-CPROG-1 — Cosmetic budget toggle.** A 15/30/60 toggle that only resizes the preview while the
  launched `Session` stays at the hardcoded 30 is a lie. The chosen budget MUST reach `buildSession`
  via `app.activeSession.budgetMin`; `Session.svelte` must read it, not `const minutes = 30`.
- **AP-CPROG-2 — Unbounded mastery / criterion on the wrong step.** A drill-to-criterion step with no
  minutes cap can trap a struggling user indefinitely and breaks the budget contract. Every criterion
  carries a cap (advance on criterion OR cap). A full game (`play-steered`) is its own unit — it gets
  **no** criterion.
- **AP-CPROG-3 — Cap is not the bound.** The `minutes` value on a coach step is the **hard upper
  bound**; the criterion can only end a step *earlier*, never extend it past the cap.
- **AP-CPROG-4 — Causal claim / silent profile mutation.** The closed loop is **descriptive**: it
  shows before/after miss-rate and a soft advisory. It must NOT say the training *caused* the change,
  MUST NOT auto-mark a weakness "resolved", and MUST NOT write to the stored `CoachProfile`. Mirror
  `insights.didItMoveBody` ("Descriptive, not proof").
- **AP-CPROG-5 — Fabricated efficacy.** When `motifEfficacy.enoughData` is false, show "too little
  data" — never a delta, never "looks improved". `looksImproved` is gated on `enoughData && deltaPct<0`.
  Empty stays empty (ANTI-FABRICATION). Distinguish **never-measured** (`neverMeasured` — no game ever
  contained this motif; show "play some games to see if this moves") from **thin data** (some plies,
  not enough) — conflating them misleads the user (E2). When there are **no** analysed games at all,
  render no efficacy section (E3), not an empty header.
- **AP-CPROG-6 — Forking `buildStudyPlan` / breaking Insights byte-identity.** C7 must not call,
  mutate, or duplicate `buildStudyPlan` (AP-COACH-1). The shared `PlanItem.mastery?` is optional and
  omitted by `buildStudyPlan`; verify the Insights snapshot is unchanged.
- **AP-CPROG-7 — Coach coupling into the steering book.** C7 must NOT add coach/repertoire entries to
  `OPENING_BOOK` or branch the book on coach state (that is P4's domain — AP-STEER-5). The opening
  name is derived from `eco.json` (display-only) and the steer reuses the existing `app.steerDimension`
  path. C7 consumes the book; it never edits it.
- **AP-CPROG-8 — Translating a routing key.** `focus`, `activity`, and `mastery.motifKey` are stable
  English routing/measurement keys consumed by `buildSession`/`scenarioForFocus`/`app.steerDimension`/
  `motifEfficacy`. Only `reason` and UI chrome are translated. Translating `focus` to name an opening
  would break routing — name it in `reason` only.
- **AP-CPROG-9 — Impurity creep at the core.** Do not pull `Date`, `Math.random`, `fetch`, or `app`
  into `buildCoachProgram`/`coachLoop`. The eco table + analyses are passed in by the UI boundary.
- **AP-CPROG-10 — Routing to an empty mode.** The named-opening upgrade decorates an already-valid
  `repertoire` step; it must not synthesize a step toward a mode with nothing to do (AP-COACH-5).

---

## §10 Rollback

Pure-additive. To revert: drop `coachLoop.ts` + its test, the `program.ts` `opts.namedOpening` branch
+ the `mastery` attachment, the optional `mastery?` field on `PlanItem`/`SessionStep`, the Coach/Session
toggle + advisory wiring, and the new i18n keys. No schema, no `DB_VERSION`, no `buildStudyPlan` change,
no `OPENING_BOOK` change → nothing to undo in IndexedDB. `buildCoachProgram`'s old 3-arg calls still
compile (the 4th arg is optional). Steering, Insights, and the study plan are untouched.

---

## §11 Follow-up (deferred, not this PR)

- **Persisted mastery progress across sessions** (resume a half-mastered step next time) — needs a
  store field; defer until C1 (profile persistence) lands the additive-field pattern. C7 keeps mastery
  in-session only.
- **Auto re-assessment from efficacy** (when a weakness looks resolved, re-probe just that motif) —
  belongs with C2 (probe v2) / C1 (staleness nudge); C7's loop is descriptive feedback, not re-diagnosis.
- **Seeding a concrete `RepertoireLine` from the named opening** (one-click "add this line") — a
  Trainer/repertoire concern; C7 only names the opening. Revisit once F5 (games store) + repertoire
  UX are in.
- **Per-criterion tuning UI** (let the user pick "until 3 vs 5 in a row") — only if play-testing shows
  the conservative defaults feel wrong; the criterion shape already supports it.
- **Localizing the efficacy advisory beyond reuse** — currently reuses `insights.*`; if the coach
  wants its own voice (C6 narrative), that wording lives in C6, consuming this loop's data.
