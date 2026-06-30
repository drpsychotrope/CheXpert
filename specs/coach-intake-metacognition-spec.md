# Spec — Coach intake & metacognition (C5)

**PR**: `coach-intake-metacognition` · **Scope**: feature (Coach stack) · **ADR**: none by default (note; flag ADR-0059 only if elevated)
**Spec version**: V1 (post `/draft-general` 4 cycles + `/enrich` 3 cycles) · **Drafted**: 2026-06-30
**Pre-V0 scan**: PASS (`reports/coach-intake-metacognition_{target_exists,baseline,collision}.json`)
**Portfolio**: `enhancements-architecture-spec.md` §3 (Coach) — folds **CO3 + CO14 + CO18**, dep: metacog + calibration (both shipped).

---

## §0 Context

The shipped coach (ADR-0045/0048) **infers everything from ~14 puzzles and never asks the user what
they want**. `buildCoachProgram` (`program.ts:42`) targets only *weaknesses*; `CoachProfile.strengths`
is a **display-only checkmark list** (`Coach.svelte:254`, `✔ {s}`) that is computed but never acted on.
Meanwhile the metacognition feature (ADR-0037) already collects rich self-knowledge — confidence
calibration and self-diagnosed miss-causes (`metacog.ts` `calibration()`, closed `SELF_TAGS` incl.
`'rushed'`) — and the coach **ignores all of it** (it is surfaced only in Insights).

**C5 coaches the player, not just the board.** It adds three additive, optional capabilities:

1. **Intake (CO3)** — one short, skippable goal picker before the assessment: *target-rating ·
   fix-blunders · opening-prep · time-trouble* (+ Skip). The goal **softly weights** the program.
2. **Metacognition coaching (CO14)** — one descriptive, sample-gated sentence in the result, derived
   from the **existing** `calibration()` readout (e.g. "your misses cluster on *rushed*"). No new math.
3. **Strength leverage (CO18)** — one optional program step that *uses* a clear strength
   ("your tactics are sharp — play attacking openings"), so strengths stop being a dead checkmark.

**C5 ≠ C7.** C7 (Program v2) owns time-budget / mastery / efficacy / opening→repertoire *routing*.
C5's goal weighting is a deliberately thin **re-ordering pass layered after** `buildCoachProgram`, so
C7 can later supersede it without a rewrite (boundary recorded in `_collision.json` + AP-CINTAKE-6).

Doctrine: additive-optional, **no `DB_VERSION` bump**; honest (directional, sample-labelled, no grade);
bilingual FR/EN parity; pure cores (no `Date`/`Math.random`); Insights study-plan byte-identical (AP-COACH-1).

## §0.5 Arbitrages flagged

See `reports/coach-intake-metacognition_arbitrages.md` for the user-facing bundle. **Defaults APPLIED
to this body (all `a`); ratify or override.** Diminishing returns: cycles 1–2 produced all decisions;
cycle 3 hardened wording; cycle 4 skipped (0 critical defects).

- **Q-A — intake content/shape** — a closed 4-option goal picker + Skip, stored `CoachProfile.goal?`
  **[default a]** vs infer-only (b, defeats the feature) vs free-text (c, unparseable).
- **Q-B — how the goal steers** — **soft** weighting (re-order + ≤1 goal step) over weakness-first
  **[default a]** vs hard override (b, dishonest, collides with C7) vs cosmetic (c).
- **Q-C — metacog surface** — **one** descriptive sentence from the existing readout, gated by
  `metacogEnabled` + sample floor **[default a]** vs duplicate the full Insights table (b, DEFER) vs
  always-show (c, violates floor).
- **Q-D — strength leverage** — **one** optional leverage step when a clear strength exists + budget
  remains **[default a]** vs a full strengths program (b, dilutes) vs keep display-only (c, unaddressed).

## §1 Empirical baseline

Captured 2026-06-30 (`reports/coach-intake-metacognition_baseline.json`). Anchors, not estimates:

| Reused symbol | Location | Shape relied on |
|---|---|---|
| `calibration` | `metacog/metacog.ts:130` | `(attempts, {minReported?,locale?}) → {byConfidence,reportedAttempts,selfTags,readout}`; **pure** |
| `CalibrationReadout` | `metacog/metacog.ts:58` | `{sentence, verdict, topCause:{tag,pct}\|null}` — descriptive, bilingual |
| `SELF_TAGS` / `SelfTag` | `metacog/metacog.ts:14` | closed taxonomy incl. `'rushed'` |
| `buildCoachProgram` | `coach/program.ts:42` | `(profile, minutes=30, locale='fr') → PlanItem[]` — **3-arg, locale present** |
| `scenarioForFocus` | `coach/program.ts:19` | `(focus) → IMBALANCE_LIBRARY id` (reused for leverage) |
| `buildCoachProfile` | `coach/diagnostic.ts:45` | `({puzzleRating,probes,gameDimensions,assessedAt,locale}) → CoachProfile` |
| `CoachProfile` | `coach/types.ts:24` | `{…, strengths[], weaknesses[]}` — extend additively with `goal?` |
| `allAttempts` | `store/attemptsRepo.ts:25` | `() → Promise<PuzzleAttemptRecord[]>` (Insights casts to `MetacogAttempt[]`) |
| `PuzzleAttemptRecord` | `store/db.ts:47` | already has `confidence?` + `selfTag?` |
| `settings.metacogEnabled` | `store/db.ts:89` | opt-in gate (default false) |
| `Coach.svelte` wizard | `ui/Coach.svelte` | `Step` machine; `commit()` reload-then-write (I-1); `result` renders strengths/weaknesses |
| additive-field precedent | `db.ts:67-68` | `coachProfile?`/`coachProfilePrev?` — optional, `?? default`, **no `DB_VERSION` bump** |
| i18n catalogue | `i18n/messages/{coach,generators}.ts` | `{fr,en}` pairs; `gt` (cores) / `t` (UI); `metacog.verdict*`, `selfTag.*` already bilingual |

Goal taxonomy: `target-rating · fix-blunders · opening-prep · time-trouble` (closed union).
Test baseline: **504 tests / 69 files green, `svelte-check` 0/0, `DB_VERSION` 4** (portfolio §8).

## §2 Scope

**In:**
1. `src/coach/types.ts` — `export type CoachGoal`; `CoachProfile.goal?: CoachGoal` (additive-optional).
2. `src/coach/program.ts` — `GOAL_PLAN` table; `applyGoalWeighting(plan, goal, profile, minutes)`
   (total, idempotent, re-order + ≤1 goal step); `leverageStepFor(profile, minutes)` (≤1 strength
   step, reuses `scenarioForFocus`); thread an optional `goal` into the program build path.
3. `src/coach/coaching.ts` (new, pure) — `metacogCoachLine(calibration, locale): string | null`
   (one descriptive sentence from the existing readout; null below floor / no data).
4. `src/ui/Coach.svelte` — new `goals` step before `ladders`; load `allAttempts()` for the result;
   render the metacog line + tagged leverage/goal steps; persist `goal`; pre-select from `coachProfilePrev.goal`.
5. i18n: new `{fr,en}` keys — intake UI in `coach.ts`; new program reasons + the coaching sentence in `generators.ts`.
6. Tests for the pure cores (`program` goal-weighting/leverage, `coaching` line).

**Out / deferred (§11):** time-budget/mastery/efficacy routing (**C7**); a metacog one-liner after a
coached session (**C7**/session-result PR — E7 DEFER); goal-tuned puzzle difficulty (**REJECT** —
would bias the measurement); a numeric calibration score (**REJECT** — AP-META-1).

## §3 Pre-flight gates (re-verify at exec time)

- [ ] `git status` clean on a fresh `coach-intake-metacognition` branch off `main`.
- [ ] `npm test` green **before** any edit (lock the 504 baseline).
- [ ] `buildCoachProgram` still `(profile, minutes=30, locale='fr')` (`program.ts:42`) — append `goal`, don't reorder.
- [ ] `CoachProfile` shape unchanged except the additive `goal?` (`types.ts:24`); `Step` union as captured (`Coach.svelte:20`).
- [ ] `calibration()` signature + `CalibrationReadout` shape unchanged (`metacog.ts:130/58`).
- [ ] `settings.metacogEnabled` still the opt-in gate (`db.ts:89`); `allAttempts()` still `() → PuzzleAttemptRecord[]`.
- [ ] `DB_VERSION === 4` (`db.ts:125`) and unchanged — confirms additive-no-bump still valid.
- [ ] **Insights byte-identity gate**: `buildStudyPlan` untouched; the Insights calibration block unchanged (C5 only reads).
- [ ] Grep no exhaustive `switch`/`satisfies never` keyed on `CoachProfile`/goal (adding `goal?` must not break a switch).

## §4 Phase A — code change (ordered; CODE FIRST)

**A1 · `src/coach/types.ts`** — additive:
```ts
/** Closed coaching-goal taxonomy (mirrors SELF_TAGS discipline). 'target-rating' = no reweight. */
export type CoachGoal = 'target-rating' | 'fix-blunders' | 'opening-prep' | 'time-trouble';
// in CoachProfile:
//   goal?: CoachGoal;   // chosen at intake; absent on legacy profiles & when skipped (read ?? undefined)
```
Optional → old `coachProfile` records read `goal === undefined` → today's behaviour. **No `DB_VERSION` bump.**

**A2 · `src/coach/coaching.ts`** (new; pure — no Date, no random, no engine):
- `export function metacogCoachLine(cal: Calibration, locale: Locale): string | null`
  - if `!cal.readout` (below `minReported` floor / no reported attempts) → `return null` (**anti-fabrication**: no data ⇒ no line).
  - else compose ONE coach-voiced sentence from the **existing** readout: the descriptive verdict
    (`metacog.verdict*`) + the top self-tag cause when present (`cal.readout.topCause`, label via
    `selfTag.*`). E.g. FR "Tu rates surtout quand tu te sens *sûr* — ralentis sur celles-là." /
    EN "You miss most when you feel *sure* — slow down on those." All via `gt(locale)`.
  - **Never** emits a number/grade (AP-CINTAKE-3). Pure mapping over the readout — trivially unit-testable.

**A3 · `src/coach/program.ts`** — additive, layered AFTER the existing builder:
- `export const GOAL_PLAN: Record<CoachGoal, { floatFocus?: string; ensure?: PlanItem }>` — one table
  row per goal (the single source of truth — E6):
  - `time-trouble` → `floatFocus: 'time'` (lift the `focus:'time'` tactics step to the top).
  - `opening-prep` → `ensure`: a `repertoire`+`play-steered` pair if not already present.
  - `fix-blunders` → `floatFocus: <weakest motif>`; the metacog line (A2) is the primary lever (surfaced by the UI).
  - `target-rating` → `{}` (no reweight — today's weakness-first plan).
- `export function applyGoalWeighting(plan: PlanItem[], goal: CoachGoal | undefined, profile: CoachProfile, minutes: number, locale: Locale): PlanItem[]`
  - **Total & idempotent (E4):** `goal === undefined` or an unknown value → `return plan` unchanged.
    Re-ordering is a stable sort by goal-affinity; `ensure` appends only if absent AND budget remains;
    invariant `out.length >= plan.length` and the weakness-step **set** is preserved (asserted in tests).
- `export function leverageStepFor(profile: CoachProfile, minutes: number, used: number, locale: Locale): PlanItem | null`
  - if `profile.strengths` empty OR no budget → `null`. Else map the **top** strength to ONE step,
    reusing `scenarioForFocus` (E5): strong tactics → `play-steered`/`sparring` (attacking) ; strong
    endgame → `endgames` maintenance ; etc. `reason` via a new `program.leverage*` key, tagged `kind:'leverage'`.
- `buildCoachProgram(profile, minutes=30, locale='fr', goal?: CoachGoal)` — **append** the 4th optional
  arg. After building the weakness-first plan and the existing maintenance fallback: (1) append
  `leverageStepFor(...)` if non-null & budget remains (Q-D), then (2) `return applyGoalWeighting(plan, goal, profile, minutes, locale)` (Q-B). Legacy 3-arg callers (`goal` undefined) get **byte-identical** output (E4 guard).
- Goal-added & leverage steps carry an additive tag (`item.kind?: 'leverage' | 'goal'`) so the UI can label them (E3); the existing `PlanItem` fields are untouched.

**A4 · `src/coach/diagnostic.ts`** — no change to scoring. (strengths/weaknesses already computed.)

**A5 · `src/ui/Coach.svelte`** — wire the three surfaces:
- **`goals` step** (new, before `ladders`): add `'goals'` to the `Step` union; `intro`'s start button
  → `goals`. Render the 4 closed options + a **Skip / just assess me** button. Store `let goal =
  $state<CoachGoal | undefined>(app.model?.coachProfile?.coachProfilePrev?.goal ?? app.model?.coachProfilePrev?.goal)`
  i.e. **pre-select from `coachProfilePrev.goal`** on re-run (E1; user can change). Skip → `goal = undefined`.
  Both paths proceed to `startLadders()`.
- **result step**: after `commit`, load `const attempts = (await allAttempts()) as MetacogAttempt[]`
  and, **only if** `app.settings?.metacogEnabled`, compute `metacogCoachLine(calibration(attempts,
  {locale:getLocale()}), getLocale())`; render the sentence when non-null. If `goal === 'fix-blunders'`
  AND `!metacogEnabled` → render a one-time gentle hint ("enable confidence check-ins to coach this")
  instead (E2) — never silently drop the goal's main lever.
- `programPreview = buildCoachProgram(p, 30, getLocale(), goal)`; render leverage/goal steps with a
  small tag (e.g. `coach.tagLeverage` / `coach.tagGoal`) via the existing `programItemMeta` row (E3).
- **persist** `goal` into the profile in `commit()`: set `p.goal = goal` before the reload-then-write
  (preserve the existing I-1 `loadPlayerModel` → set `coachProfilePrev`/`coachProfile` flow).

**A6 · i18n** — add `{fr,en}` for every new string:
- `coach.ts`: `coach.goalsTitle`, `coach.goalsIntro`, the 4 `coach.goal.*` labels, `coach.goalSkip`,
  `coach.tagLeverage`, `coach.tagGoal`, `coach.metacogOffHint`.
- `generators.ts`: `program.leverageTactics`/`program.leverageEndgame`/… (leverage reasons),
  `program.goalStep*` (any goal-ensured step reason), and `coaching.line*` fragments composed by
  `metacogCoachLine` (verdict + cause phrasing). Reuse existing `metacog.verdict*` / `selfTag.*`.

## §5 Phase B — tests

- `src/coach/coaching.test.ts` — `metacogCoachLine`: (i) `readout === null` → `null` (anti-fabrication);
  (ii) verdict-only readout (no `topCause`) → a sentence without a cause clause; (iii) with `topCause`
  → includes the self-tag label; (iv) **no digit** in the output (regex assert, AP-CINTAKE-3);
  (v) FR vs EN differ (parity).
- `src/coach/program.test.ts` (extend) — (i) `applyGoalWeighting(plan, undefined, …)` returns the
  **same** plan (byte-identical legacy path, E4); (ii) unknown goal → unchanged; (iii) `time-trouble`
  floats the `focus:'time'` step to index 0; (iv) `opening-prep` ensures a `repertoire`+`play-steered`
  pair without duplicating an existing one; (v) invariant `out.length >= in.length` and weakness-step
  set preserved; (vi) `leverageStepFor` → `null` when `strengths` empty, ≤1 step otherwise, reusing a
  valid `scenarioForFocus` id; (vii) leverage/goal steps carry the `kind` tag and survive `buildSession`.
- No UI unit tests (repo norm — no component harness). Cores stay pure (inject `locale`; no `Date`/`Math.random`).

## §6 Phase C — verification (acceptance gates)

- [ ] `npm test` — 504 prior + new `coach/coaching.*` & extended `program.*`, all green; **no prior test regressed**.
- [ ] `npm run check` — `svelte-check` 0 errors (the `goal?` field + `kind?` tag + new `Step` type-check).
- [ ] `npm run build` — production build green.
- [ ] **Insights byte-identity**: re-run the existing Insights snapshot/test — study plan AND the
      calibration block unchanged (C5 only reads; `buildStudyPlan` untouched — AP-COACH-1).
- [ ] **Bilingual parity**: every new key present in both `fr` and `en` (grep the two maps; no key in one only).
- [ ] Manual smoke: Home → coaching → **goals** step (pick *time-trouble*) → ladders → skip game →
      result shows the `focus:'time'` step first (goal weighting) + (if metacog on & enough data) one
      descriptive calibration sentence + (if a strength) one tagged leverage step → Start session resumes the program.
- [ ] Re-run from Settings → the goal picker **pre-selects** the last goal (E1); changing it re-weights.
- [ ] metacog OFF + goal *fix-blunders* → the gentle enable-hint shows (E2), no fabricated calibration line.

## §7 Phase Z — docs (LAST)

- **`decisions.md`** — append a **note under ADR-0045/ADR-0037** (NOT a new ADR by default): C5 adds an
  optional `coachProfile.goal?` (additive, no `DB_VERSION` bump — cross-link the `conceptSeen?` precedent),
  a soft goal-weighting pass layered after `buildCoachProgram` (explicitly thinner than, and supersedable
  by, C7's routing), a strength-leverage step (strengths now acted on, not just displayed), and the reuse
  of the existing `calibration()` readout as one descriptive coach line (honest, sample-gated — cross-link
  AP-META-1 / AP-CHESS-13/24). Record Q-A..Q-D = a. **Flag ADR-0059 only if review elevates goal-weighting
  to architectural** (first free number; 0054-0058 reserved). Append-only; do not amend prior ADRs.
- **`README.md`** — one line under "Coach": the assessment now asks an optional goal, coaches your
  confidence/error patterns, and plays to your strengths. Keep the honesty note (directional, not a grade).

## §8 Acceptance criteria

1. The intake goal is optional and skippable; a skipped run behaves exactly like today's coach. ✅ = `goal === undefined` ⇒ byte-identical program.
2. A chosen goal **re-orders / augments** the weakness-first program without replacing it. ✅ = weakness steps still present; goal step floated/added.
3. The result shows **one** descriptive calibration sentence **iff** metacog is enabled AND data ≥ floor; otherwise nothing (or, for `fix-blunders`, the enable-hint). ✅ = no line on thin/opted-out data (anti-fabrication).
4. When a clear strength exists and budget remains, the program includes **one** tagged leverage step. ✅ = strengths acted on, capped at 1.
5. The goal persists and **pre-selects** on re-run (`coachProfilePrev.goal`). ✅ = round-trips through IndexedDB; picker defaulted.
6. All §6 gates pass; no prior test/behaviour regressed; **Insights output byte-identical**; bilingual parity held; `DB_VERSION` still 4.
7. No number/letter grade anywhere in the coaching surfaces (honesty).

## §9 Anti-patterns

- **AP-CINTAKE-1 — Goal hard-override.** The goal MUST only re-order/augment a weakness-first plan
  (`applyGoalWeighting` layered AFTER the builder). It must never become the *only* content — that
  would ignore measured weaknesses (dishonest) and pre-empt C7's routing.
- **AP-CINTAKE-2 — Scattered goal logic / open taxonomy.** `CoachGoal` is a **closed** union and goal
  behaviour lives in the single `GOAL_PLAN` table (mirrors `SELF_TAGS`). No ad-hoc `if goal==='…'` strewn across the UI.
- **AP-CINTAKE-3 — Grading the player.** The metacog line is **descriptive** (verdict word + cause),
  never a score/letter/percentage-as-grade (AP-META-1 / AP-COACH-2). Tests assert no digit in the line.
- **AP-CINTAKE-4 — Fabricated coaching.** Below the sample floor or with metacog off ⇒ **no** calibration
  line (empty = CLEAN). Never synthesize "you're well-calibrated" on thin/absent data.
- **AP-CINTAKE-5 — Non-total weighting.** `applyGoalWeighting` MUST be total and idempotent: unknown/
  `undefined`/legacy goal ⇒ plan returned unchanged; never drops/duplicates a weakness step (`out.length >= in.length`, set preserved).
- **AP-CINTAKE-6 — Stealing C7's remit.** C5 does NOT add time-budget/mastery/efficacy/opening-repertoire
  *routing*. Goal weighting is a thin re-ordering pass that C7 can supersede. Goal-tuned puzzle
  *difficulty* is out (REJECT — it would bias the diagnostic measurement).
- **AP-CINTAKE-7 — `DB_VERSION` bump / new store.** `goal?` is additive-optional on the existing
  `coachProfile`; the coaching line is **derived** (not stored). Reads existing `puzzleAttempts`. No
  migration, no bump (mirrors `conceptSeen?`/`coachProfile?`).
- **AP-CINTAKE-8 — Perturbing Insights.** C5 only READS attempts/calibration and does NOT touch
  `buildStudyPlan` or the Insights calibration block — output stays byte-identical (AP-COACH-1).
- **AP-CINTAKE-9 — `Date`/`Math.random` in a core.** `coaching.ts` and the new `program.ts` helpers
  stay pure; the UI owns `Date.now`/locale and injects them (mirrors `diagnostic.ts`/`program.ts`).

## §10 Rollback

Single branch `coach-intake-metacognition`. New code is inert until wired.
1. Revert `Coach.svelte` edits (A5) first → restores the pre-C5 wizard; the new helpers go dormant.
2. `git checkout -- src/coach/program.ts src/coach/types.ts` → drops `goal?`, `applyGoalWeighting`,
   `leverageStepFor`, `GOAL_PLAN` (3-arg `buildCoachProgram` restored).
3. Delete `src/coach/coaching.ts` + its test; revert the i18n key additions.
4. `npm test && npm run check` must return to the 504-green / 0-error baseline.
No migration ran (no `DB_VERSION` bump) → a stored `goal` on any dev profile is simply ignored by
reverted code. No persisted-data rollback needed.

## §11 Follow-up

- **C7 (Program v2)** refines goal weighting into proper mastery/efficacy/time-budget routing;
  C5's `applyGoalWeighting` is the thin precursor it supersedes.
- Metacog one-liner after a **coached session** (E7 DEFER) — closes the loop in C7 / a session-result PR.
- A 5th goal (e.g. *endgame-focus*) = a one-line `GOAL_PLAN` row (E6 extensibility paid forward).
- Surface the goal in the Settings "re-run" entry copy (minor) once C5 lands.
