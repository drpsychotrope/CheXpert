# Spec — Trainer integrity & retention (feature **T3**)

**PR name**: `trainer-integrity-retention` · **Type**: feature (measurement integrity + retention + a metacognitive signal) · **Spec version**: **V1**
**Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles, 6 FOLD applied), defaults applied
**Parent**: `specs/enhancements-architecture-spec.md` §3 (Trainer **T3**) · **Folds**: **TR5** (`usedHint` + grade clamp + progressive hints), **TR8** (streak / daily-goal / last-trained) + a move-time/impulsivity signal
**Dependency (contract; builds first)**: `specs/attempt-recording-weakness-spec.md` (**F3**) — attempts (incl. ms) are recorded there; T3 consumes the recorded attempt stream for the impulsivity signal and adds `usedHint?` to the same record.
**ADR**: none (feature PR — not architectural). Reserved 0054–0057 are taken (portfolio/F3/F5/F6); if review deems the grade-clamp policy architectural, flag **ADR-0058** (see §7).
**Empirical artifacts**: `reports/trainer-integrity-retention_{target_exists,baseline,collision}.json`

---

## §0 Context

Three Trainer gaps share one PR because they all hang off the **same solve→`finish()` seam** in `src/ui/Tactics.svelte` and the **same recorded attempt** (`PuzzleAttemptRecord`), and all three are about *honest measurement of a training session*:

1. **Hints corrupt the measurement (TR5).** `hint()` (`Tactics.svelte:288-296`) reveals the **from-square** of the next expected user move (`trainer.expectedMove()`, message `tactics.hint` "a strong piece moves from {sq}"). The hint is **not recorded** — `PuzzleAttemptRecord` has no `usedHint` field. The player then plays the revealed move and `finish(true)` grades a **clean win**: full Glicko gain (`gradeAttempt`, `:227`) **and** an FSRS `Good`/`Easy` (`resultToGrade(solved, ms)`, `:267`). A hinted solve is indistinguishable from an unaided one, inflating both the puzzle rating and the SRS schedule. The hint is also all-or-nothing (one tier: the from-square).

2. **Retention is component-memory only (TR8).** `solvedThisSession`/`attemptedThisSession` (`Tactics.svelte:27-28`) are component `$state`, reset every mount. `PlayerModel` has **no** daily goal, **no** streak, **no** last-trained timestamp — the app cannot say "you've trained 4 days in a row" or "3/10 toward today's goal", the single strongest retention lever in a no-backend PWA (the only existing re-engagement signal is `app.dueReview`, the Review badge).

3. **Move-time is recorded but never reflected back (impulsivity).** `ms` is on every attempt (`Tactics.svelte:238`) but its **only** consumer is `resultToGrade` for the FSRS grade. The player never sees their average solve time, and — critically — the **fast-and-wrong** (impulsive) vs **slow-and-right** pattern is invisible, even though the metacognition taxonomy already names it: `rushed` is one of the closed `SELF_TAGS` (`metacog.ts:17`). Surfacing this is a metacognitive nudge ("you miss fast — slow down"), not a grade.

**This PR closes all three with one coherent move on the trainer solve path**: track `usedHint`, clamp a hinted solve's reward, make hints **progressive** (less reveal earlier), persist a **day-based streak + daily goal + last-trained** on `PlayerModel`, and surface an **impulsivity readout** in Insights' existing metacog section.

> **Pre-V0 corrections (verified, head `9296aff`)** — see `reports/..._target_exists.json`:
> - `hint()` calls `trainer.expectedMove()` (`TacticalTrainer.ts:38`), **not** `revealSolution` (no such symbol exists in the trainer; F4's `Calculate.revealSolution` is a different surface).
> - `gradeAttempt` lives in **`src/trainer/TacticalTrainer.ts:93`** (it wraps Glicko via `rating/glicko2`), not in `glicko2.ts` directly.
> - `streak` already exists as a **component-local in-drill** counter in `Vision.svelte` (consecutive correct vision answers) — **unrelated** to a training-day streak. The new persisted field is named **`dailyStreak`** to avoid the collision.

---

## §0.5 Arbitrages (recommended defaults — applied to this V1)

| # | Question | Options | **Default applied (V1)** | Rationale |
|---|---|---|---|---|
| **Q-A** | Hint tiers — how many, how much reveal? | (a) keep 1 (from-square) · (b) **3 progressive** (motif/piece → target square → full move) · (c) 2 | **(b) 3 tiers** | Tier 1 = the puzzle's motif/piece type (least reveal), tier 2 = the target (to-)square, tier 3 = the full move. Escalating reveal lets a player nudge themselves with the smallest hint that unblocks them. **Any tier taken sets `usedHint` and caps the grade** (Q-B) — the integrity rule is tier-independent; only the *teaching value* escalates. |
| **Q-B** | Grade-clamp severity for a hinted solve | (a) FSRS ≤ Hard + **skip Glicko gain** · (b) ≤ Good + dampen Glicko 50% · (c) treat as miss | **(a) ≤ Hard + skip Glicko gain** | A hint means the player did not independently retrieve the move, so it should not *raise* the puzzle rating (skip the player's Glicko **gain** — keep the rating flat) and should resurface soon in Review (FSRS ≤ `Hard`). Not a full miss (c) — they did execute the move and shouldn't be *penalised* into a rating drop or an `Again`. Composes with the existing first-exposure clamp as `min()`. |
| **Q-C** | Streak / goal / last-trained — additive on `PlayerModel`, schema impact? | (a) additive optional, **bump `schemaRev` only** · (b) bump `DB_VERSION` | **(a) additive, `schemaRev` only** | Three new optional fields (`dailyStreak?`, `dailyGoal?`, `lastTrainedAt?`) mirror `conceptSeen?`/`visionStats?`/`coachProfile?` exactly. Per the migration policy (`db.ts:121-124`): additive ⇒ bump `PlayerModel.schemaRev` (1→2) + backfill in the load path; **NO `DB_VERSION` bump**. |
| **Q-D** | Impulsivity-signal placement | (a) Insights only · (b) inline only · (c) **Insights metacog section + a gentle inline nudge** | **(c)** | The aggregate readout (avg time, fast-wrong vs slow-right) lives in Insights' existing metacog section (locale-following, descriptive-honesty pattern, gated by `metacogEnabled`). A *gentle* inline nudge fires in Tactics only on a **fast miss** ("missed in {n}s — slow down?"), self-dismissing, never blocking the loop. |
| **Q-E** | Daily-goal default + unit | (a) **10 puzzles, configurable** · (b) 5 minutes · (c) 20 puzzles | **(a) 10 puzzles, configurable** | Puzzle-count is the unit the trainer already counts (`attemptedThisSession`) and is unambiguous offline (minutes need wall-clock session tracking the app doesn't keep). Default 10; user-settable (a number input in Settings). `dailyGoal` is optional on `PlayerModel`; absent reads as the default 10. |

> **Refiner note (diminishing returns).** Cycle 1 surfaced Q-A/Q-B (load-bearing: tiers + clamp policy) and the F3 co-edit collision on `finish()`. Cycle 2 surfaced Q-C (schema impact: `schemaRev` vs `DB_VERSION`) and Q-D (placement). Cycle 3 surfaced Q-E (goal unit) + the **streak-rollover edge cases** (midnight boundary, multi-session same day, gap of >1 day) — genuine but smaller, folded into §4 B/§5. Cycle 4 produced no new arbitrage, only wording tightening on §4.2/§9 → **stop, returns < 10%**.

---

## §1 Baseline (measured 2026-06-30, head `9296aff`)

- **Green bar**: **504 tests / 69 files** passing, **svelte-check 383 files 0 errors / 0 warnings**, build green (`reports/..._baseline.json`). T3 must not regress this.
- `DB_VERSION = 4`; `PlayerModel.schemaRev = 1`; latest ADR **0053**.
- **Hint**: `hint()` reveals the from-square; `usedHint` not tracked; a hinted first-attempt solve grades a **clean** win (full Glicko gain + FSRS `Good`/`Easy`). One tier.
- **Retention**: session counters are component-local; no streak / daily goal / last-trained on `PlayerModel`. `app.dueReview` is the only persisted re-engagement count.
- **Move-time**: `ms` recorded per attempt; consumed **only** by `resultToGrade`. No avg, no fast-wrong/slow-right surface.
- **AP-COACH-1 (study-plan byte-identity)**: `buildStudyPlan` consumes `leaks` + the weakest radar dimension — **never** attempt `ms` or any retention field. T3 cannot perturb the study plan (its impulsivity readout is a *new* section, not an input).
- **No Svelte component-test harness** (0 `*.svelte.test.ts`). Verify via pure-core unit tests + static wiring-presence + manual/preview.

---

## §2 Scope (single concern)

> **Single concern**: *honest measurement of a trainer solve + the retention/metacognition reflections that hang off the same recorded attempt.* All three folds (hint integrity, retention, impulsivity) read/write the **same** `finish()` seam and the **same** `PuzzleAttemptRecord` — they are one surface, not three features.

**IN**
1. **`usedHint` tracking + grade clamp.** Track that the player took a hint on this attempt; record `usedHint?: true` on the attempt; on a hinted solve cap the FSRS grade to ≤ `Hard` **and** skip the player's Glicko **gain** (rating stays flat; the puzzle's own rating is also left unmoved). (Q-B)
2. **Progressive hints (3 tiers).** Replace the single-tier hint with escalating reveal: tier 1 motif/piece, tier 2 target square, tier 3 full move. **Any** tier taken sets `usedHint` and triggers the clamp. (Q-A)
3. **Day-based retention on `PlayerModel`** (additive optional, `schemaRev` 1→2, no `DB_VERSION` bump): `dailyStreak?`, `dailyGoal?` (default 10), `lastTrainedAt?`. Increment the streak on the first solve of a new calendar day; reset on a >1-day gap; surface "N-day streak" + "k/goal today" in the trainer. (Q-C, Q-E)
4. **Impulsivity / move-time signal** (descriptive, honest): a pure readout over attempts `{solved, ms}` — average solve time + the fast-and-wrong vs slow-and-right split — in Insights' metacog section, plus a gentle inline "fast miss" nudge in Tactics. (Q-D)

**OUT** (explicitly)
- Self-tag → action / FSRS clamp on a self-diagnosed cause (TR3) → **T1**.
- Weakness-steered selection, mode toggle, theme picker, provenance UI, exhaustion message (TR2/TR4/TR9/TR10) → **F3 / T2**.
- "Show solution + why" on a miss (TR1) → **T1** (T3 reveals via the *hint* path during solving, not a post-miss explanation).
- Surfacing FSRS `stability` as a mastery score, decay-weighting `weaknessCounters`, multi-day calendar/notifications → **deferred** (§11).
- Touching `buildStudyPlan` or its inputs (AP-COACH-1).
- `DB_VERSION` / destructive schema change → not needed (additive; see §3).

---

## §3 Pre-flight (gates before code)

- [ ] **Dependency present.** F3 (`attempt-recording-weakness`) is built/merged first (portfolio §8 order). T3 rebases on it. The one co-edited function is `Tactics.svelte` `finish()` (F3 leaves it ~as-is; T3 threads `usedHint` through it) — review on merge.
- [ ] **No `DB_VERSION` bump.** New fields are **all** additive-optional: `usedHint?` on `PuzzleAttemptRecord`; `dailyStreak?`, `dailyGoal?`, `lastTrainedAt?` on `PlayerModel`. Legacy records read them as `undefined` (→ defaults). Bump **`PlayerModel.schemaRev` 1→2** and backfill in the load path (`playerModel.ts`); keep `DB_VERSION = 4` (precedent ADR-0035/0037/0040/0043/0053; `db.ts:121-124`).
- [ ] **Name collision avoided.** The persisted streak is **`dailyStreak`**, never the bare `streak` (which is Vision's in-drill counter).
- [ ] **Pure cores extracted.** Streak rollover, grade clamp, and the impulsivity readout live in pure modules — **no `Date.now`, no `Math.random`**; `now` and a day-key function are injected (portfolio note: this logic *is* unit-testable).
- [ ] **AP-COACH-1 path proven.** No edit to `studyPlan.ts` or its callers; no retention field or `ms`-aggregate is routed into `buildStudyPlan`. Re-run `studyPlan` determinism test as a guard.
- [ ] **Clamp composition proven.** The hint clamp composes with the existing first-exposure clamp (`fsrs.ts:85`, `Easy→Good` on `State.New`) as a single `min()` — a hint can only *lower* the effective grade, never raise it.
- [ ] **Bilingual check.** Every new user-facing string (3 hint tiers, streak/goal lines, impulsivity readout, inline nudge, Settings goal label) ships **FR + EN** via the catalogue (ADR-0053). The Insights readout is descriptive (a fact sentence), never a grade (AP-META-1).

---

## §4 Phase A — CODE FIRST

> Order: pure cores → schema fields → hint integrity wire-up → retention wire-up → impulsivity wire-up → i18n. **Code before docs.**

### A1 — Pure cores (new)

**`src/trainer/hintGrade.ts`** — the clamp policy, pure:
```ts
// PURE. No Date, no Math.random. A hinted solve must not raise the player's
// rating and must resurface soon. Composes with the FSRS first-exposure clamp
// (fsrs.ts:85) as min(): a hint only ever LOWERS the effective grade.
import { Grade } from '../srs/fsrs';
/** Cap a solve's FSRS grade when a hint was used (≤ Hard). Returns the grade unchanged
 *  when no hint was used or it is already ≤ the cap. (Q-B) */
export function clampGradeForHint(grade: Grade, usedHint: boolean): Grade;
/** Should the player's Glicko GAIN be applied for this attempt? False on a hinted SOLVE
 *  (rating stays flat — neither raised nor dropped). A hinted MISS is unaffected (a miss
 *  already lowers the rating, which is honest). (Q-B) */
export function applyGlickoGain(solved: boolean, usedHint: boolean): boolean;
```

**`src/trainer/retention.ts`** — day-based streak/goal, pure:
```ts
// PURE. Caller injects `now` (ms) and the streak is computed from the stored
// lastTrainedAt + dailyStreak. Day boundary = LOCAL calendar day via an injected
// dayKey(ms)->string (default: local YYYY-MM-DD) so tests are deterministic.
export interface RetentionState { dailyStreak: number; lastTrainedAt: number; }
export interface RetentionUpdate { dailyStreak: number; lastTrainedAt: number; isNewDay: boolean; }
/** Fold one training event at `now` into the streak:
 *   - same calendar day as lastTrainedAt → streak unchanged, isNewDay=false
 *   - exactly the next day → streak+1, isNewDay=true
 *   - a gap of >1 day (or no prior) → streak=1, isNewDay=true
 *  Deterministic; dayKey injectable for tests. */
export function rollStreak(prev: RetentionState | undefined, now: number, dayKey?: (ms: number) => string): RetentionUpdate;
/** Daily progress label inputs: solved-today count vs goal (default 10). Pure;
 *  the count is supplied by the caller (attempts with playedAt on today's dayKey). */
export function goalProgress(solvedToday: number, goal: number): { done: number; goal: number; met: boolean };
```

**`src/metacog/impulsivity.ts`** (or a sibling export in `metacog.ts`) — descriptive move-time readout, pure:
```ts
// PURE. No Date, no Math.random. Descriptive, NOT a grade (AP-META-1). Splits attempts
// into fast/slow by a threshold (default = the grader's own DEFAULT_GRADE_THRESHOLDS.fastMs
// from fsrs.ts — IMPORT it, do not re-declare, so "fast" means what the grader means /enrich#6)
// and reports the fast-and-wrong vs slow-and-right pattern + average solve time.
export interface ImpulsivityAttempt { solved: boolean; ms: number; }
export interface ImpulsivityReadout {
  n: number; avgMs: number;
  fastWrong: number; fastTotal: number;   // misses among fast attempts
  slowRight: number; slowTotal: number;   // solves among slow attempts
  /** Descriptive sentence key + values for i18n (e.g. "You miss fast: {pct}% of your
   *  quick attempts are wrong."); null below the sample-size floor. */
  readout: { kind: 'impulsive' | 'deliberate' | 'mixed'; fastMissPct: number; avgSec: number } | null;
}
export function impulsivity(attempts: ImpulsivityAttempt[], opts?: { fastMs?: number; minN?: number }): ImpulsivityReadout;
```
- Sample-size floor `minN` (default **10**) mirrors `calibration`'s `minReported`; below it `readout = null` (no claim on thin data — anti-fabrication).

### A2 — Schema fields (additive optional)
- `src/store/db.ts`:
  - `PuzzleAttemptRecord` += `usedHint?: boolean;` (absent on legacy → falsy). Append **after** F3's `coachProbe?`.
  - `PlayerModel` += `dailyStreak?: number;` `dailyGoal?: number;` `lastTrainedAt?: number;` (each documented "additive; old records read default; NO `DB_VERSION` bump", mirroring `conceptSeen?`).
- `src/store/playerModel.ts`: in the load/backfill path, bump `schemaRev` 1→2 and default the new fields (`dailyStreak ?? 0`, `dailyGoal ?? 10`, `lastTrainedAt ?? undefined`). No destructive change.

### A3 — Hint integrity wire-up `src/ui/Tactics.svelte`
- Add component state `let usedHint = $state(false);` and `let hintTier = $state(0);`. Reset both in `loadNext()` and `retry()` (alongside the existing `confidence`/`selfTag` resets).
- **Progressive `hint()`** (Q-A): each press advances `hintTier` (1→2→3, capped) and sets `usedHint = true`:
  - tier 1 → motif/piece (derive from `puzzle.themes` / the moved piece on `expectedMove()`), new key `tactics.hintMotif`.
  - tier 2 → target square (`expectedMove().slice(2,4)`), new key `tactics.hintTarget`.
  - tier 3 → full move (existing reveal extended to the whole UCI), new key `tactics.hintMove`.
  - (The current `tactics.hint` from-square message is repurposed/retired; keep the key only if still referenced.)
- **`finish(solved)`** — thread the clamp (the one F3 co-edit point):
  - FSRS grade: `srs.grade = clampGradeForHint(resultToGrade(solved, ms), usedHint)` (compose with the first-exposure clamp inside `gradeCard` → net `min()`).
  - Glicko: only assign `model.puzzleRating = graded.player` (and the puzzle's updated rating) when `applyGlickoGain(solved, usedHint)` is true; on a hinted **solve**, leave `model.puzzleRating` **and** the puzzle row's rating **unchanged** (flat — mirrors F3's AP-COACH-8 "pass unchanged" discipline).
  - Record `usedHint` on the attempt row (`usedHint: usedHint || undefined` so it drops cleanly on structured clone when false).

### A4 — Retention wire-up `src/ui/Tactics.svelte`
- In `finish(solved)`, on a **solve** (or per the streak rule: the first solve of a new day), call `rollStreak(model, now)`; persist `model.dailyStreak`/`model.lastTrainedAt` via the existing atomic model write (it is already part of `recordTacticsAttempt`'s `model` snapshot — fold the fields in before the snapshot, mirroring the `weaknessCounters` fold at `:231-235`).
- Compute `solvedToday` via a **bounded `playedAt` index range** for today's `[startOfDay, now]` (the `playedAt` index already exists, `db.ts:109`) → count solves → `goalProgress(solvedToday, model.dailyGoal ?? 10)`. Prefer the indexed range over a full `allAttempts()` scan so the count is O(today), not O(all attempts) (**/enrich#5 robustness**; AP-TINTEG-11).
- Render the streak + goal line in the trainer header (near the existing `tactics.ratingLine`), e.g. `tactics.streakLine` "{n}-day streak" + `tactics.goalLine` "{done}/{goal} today" — descriptive, no celebration gating the loop.
- **Home** (`src/ui/Home.svelte`): surface the streak line beside the existing `app.dueReview` badge — retention belongs where re-engagement happens. Reuses `app.model.dailyStreak`; one render site, no new logic (**/enrich#2 capability gap**).
- **Settings**: add a number input for the daily goal (`settings.dailyGoal`), wired to `model.dailyGoal` via `app.persistModel`. Default 10.

### A5 — Impulsivity wire-up
- **Insights** `src/ui/Insights.svelte`: extend the `MetacogAttempt[]` load (line 46) to keep `ms` (the runtime rows are `PuzzleAttemptRecord`, which has `ms`; add `ms` to the type used or pass full rows to `impulsivity()`). Add a `$derived` `imp = impulsivity(attemptsWithMs, { locale })` and render a section inside the existing `metacog`-gated block (after calibration, ~line 196): avg solve time + the descriptive `imp.readout` sentence, **showing the denominators** (`fastTotal`/`slowTotal`, e.g. "of your {fastTotal} quick attempts…") so the claim is inspectable, mirroring calibration's `(k/n)` (**/enrich#3 observability**). **Honest framing**: the sentence describes the *attempts* ("your quick attempts miss more often"), never a trait of the *player* — no label noun (**/enrich#8b**; AP-TINTEG-7). A fact sentence, never a grade.
- **Inline nudge** `src/ui/Tactics.svelte`: on a **fast miss** (`!solved && ms <= fastMs`), set a gentle, self-dismissing feedback line (`tactics.fastMiss` "missed in {n}s — slow down?"). Never blocks `loadNext`/`retry`.

### A6 — i18n (FR + EN)
- New keys in `src/i18n/messages/tactics.ts`: `tactics.hintMotif`, `tactics.hintTarget`, `tactics.hintMove`, `tactics.streakLine`, `tactics.goalLine`, `tactics.fastMiss`, plus `tactics.hintedTag` (a small "(hint used)" marker on the solved feedback so the clamp is transparent to the player).
- New keys for Insights impulsivity (`insights.impulsivity*`) + the descriptive sentence variants (`impulsive`/`deliberate`/`mixed`) + Settings goal label (`settings.dailyGoal*`). All FR + EN.

---

## §5 Tests

> No component harness → unit-test the pure cores exhaustively; verify wiring by static presence + manual.

**`src/trainer/hintGrade.test.ts` (new)**
- `clampGradeForHint(Good, false) === Good` (no hint, untouched).
- `clampGradeForHint(Easy, true) === Hard` and `clampGradeForHint(Good, true) === Hard` (capped ≤ Hard).
- `clampGradeForHint(Again, true) === Again` (a miss already ≤ cap; unchanged).
- `applyGlickoGain(true, true) === false` (hinted solve → no gain); `applyGlickoGain(true, false) === true`; `applyGlickoGain(false, true) === false`/n-a (miss handled by the rating-drop path, not the gain).
- **Composition**: clamping then `gradeCard` on a `State.New` card yields ≤ Hard (hint cap dominates the first-exposure `Easy→Good`).

**`src/trainer/retention.test.ts` (new)**
- no prior (`undefined`) → `{ dailyStreak: 1, isNewDay: true }`.
- same calendar day (two events) → streak unchanged, `isNewDay: false` (multi-session same day does not double-count).
- exactly next day → streak + 1, `isNewDay: true`.
- gap > 1 day → reset to 1.
- **midnight boundary**: events at 23:59 and 00:01 next day → +1 (different `dayKey`); deterministic via injected `dayKey`.
- `goalProgress(3, 10) → { done: 3, goal: 10, met: false }`; `goalProgress(10, 10).met === true`.

**`src/metacog/impulsivity.test.ts` (new)**
- empty / below `minN` → `readout: null` (anti-fabrication: no claim on thin data).
- all fast+wrong above `minN` → `kind: 'impulsive'`, `fastMissPct` high.
- all slow+right → `kind: 'deliberate'`.
- mixed → `kind: 'mixed'`; `avgMs` is the true mean (deterministic, no `Date`).

**Schema — extend `src/store/metacog-schema.test.ts` (or a new `t3-schema.test.ts`)**
- `DB_VERSION` stays **4** (additive fields need no bump).
- a round-tripped `PuzzleAttemptRecord` with `usedHint: true` reads back `true`; a legacy row (no `usedHint`) reads falsy.
- a `PlayerModel` with the new fields round-trips; a legacy model (no fields) loads with defaults (`dailyStreak 0`, `dailyGoal 10`) after the load-path backfill; `schemaRev` is 2.

**Regression guards**
- `studyPlan` determinism test stays green (**AP-COACH-1** — retention/impulsivity never feed the plan).
- existing `repos.test.ts` W11 atomic-write test stays green (the retention fold rides the same atomic `model` write).
- existing metacog schema tests stay green (`usedHint?` is additive; doesn't disturb `confidence`/`selfTag`).
- F3 tests (weakness selection, coach-probe recording) stay green (T3 doesn't touch `loadNext` selection or coach recording).

---

## §6 Verification

- [ ] `npm test` green, **count ≥ baseline (504) + new tests**, zero prior failures.
- [ ] `svelte-check` **0 errors / 0 warnings** (across ~383 files).
- [ ] `npm run build` green.
- [ ] **Manual (PWA)**:
  - Take a hint (each tier) then solve → confirm (a) the solved feedback shows the "(hint used)" marker, (b) the puzzle rating is **unchanged** vs before the attempt, (c) the puzzle reappears in Review soon (FSRS ≤ Hard).
  - Solve without a hint → rating moves normally (no regression).
  - Solve on a new calendar day → streak increments; second solve same day → streak unchanged; "k/10 today" advances per solve. The streak line also appears on **Home** beside the Review badge.
  - Insights → metacog section shows avg solve time + the impulsivity sentence (only after ≥ `minN` attempts); below the floor it is absent (not a fabricated "0%").
  - A fast miss in Tactics → the gentle "slow down?" nudge appears and does not block the next puzzle.
- [ ] **AP-COACH-1**: Insights study-plan output unchanged before/after (determinism test + spot-check).
- [ ] **Schema**: `DB_VERSION` still 4; a pre-T3 profile loads with default goal/streak (no data loss); `schemaRev` 2.
- [ ] **i18n parity**: every new string present in **both** FR and EN; readout is descriptive (no letter/number grade).

---

## §7 Docs (LAST)

- **No new ADR by default** (feature PR; not architectural). If review judges the **grade-clamp reward policy** (hinted solve = no Glicko gain, FSRS ≤ Hard) to be an architectural rule worth its own record, append **ADR-0058** "Trainer hint integrity — usedHint clamp policy" to `decisions.md` (reserved 0054–0057 are taken by portfolio/F3/F5/F6). Otherwise record the Q-A..Q-E decisions inline in the PR description only.
- Update `specs/enhancements-architecture-spec.md` **T3** row status → drafted/built as appropriate.
- **README**: T3 adds a *visible* feature (streak + daily goal + progressive hints). Add a brief bilingual note to the trainer section (this is the rare feature PR with a user-facing surface; F3 had none). Keep it short.
- Note the additive `usedHint?` / `dailyStreak?` / `dailyGoal?` / `lastTrainedAt?` fields and the **`schemaRev` 1→2, no `DB_VERSION` bump** in the changelog/decisions.

---

## §8 Acceptance

1. Taking a hint (any tier) sets `usedHint`, records it on the attempt, caps the FSRS grade ≤ Hard, and skips the player's Glicko gain (rating flat; puzzle rating unmoved). An unaided solve is unchanged from baseline.
2. Hints are progressive (motif → target square → full move); each press reveals more; any press triggers the clamp.
3. `PlayerModel` carries a day-based `dailyStreak`, a configurable `dailyGoal` (default 10), and `lastTrainedAt`; the streak increments once per new training day, resets on a >1-day gap, and is surfaced with the daily-goal progress in the trainer.
4. Insights surfaces an honest, descriptive move-time/impulsivity readout (avg time + fast-wrong/slow-right), only above the sample-size floor; a gentle inline nudge fires on a fast miss.
5. Study-plan output byte-identical (AP-COACH-1); green bar preserved; **no `DB_VERSION` bump** (`schemaRev` 1→2 only); all new strings FR + EN.

---

## §9 Anti-patterns (AP-TINTEG-*)

- **AP-TINTEG-1 — Silent hint inflation.** A hinted solve must never grade as a clean win. `usedHint` ⇒ FSRS ≤ Hard **and** no Glicko gain. Never record a hinted solve indistinguishable from an unaided one.
- **AP-TINTEG-2 — Punishing a hint as a miss.** A hint clamp must not *drop* the rating or force `Again`; it withholds the **gain** and resurfaces the card — it does not penalise. (Don't over-correct to Q-B option c.)
- **AP-TINTEG-3 — Clamp that can raise a grade.** Compose the hint clamp with the first-exposure clamp as `min()`; a hint may only lower the effective grade. Never let the hint path bump a grade up.
- **AP-TINTEG-4 — Reusing the bare `streak` name.** The persisted training-day field is `dailyStreak`; never collide with Vision's in-drill `streak`.
- **AP-TINTEG-5 — Streak double-count / drift.** Increment once per **new calendar day** (injected `dayKey`); multi-session same-day does not increment; a >1-day gap resets to 1. No `Date.now` in the core.
- **AP-TINTEG-6 — Schema churn / `DB_VERSION` bump.** All new fields are additive-optional; bump `schemaRev` and backfill, **never** `DB_VERSION`. No new required field, no `source`-union change.
- **AP-TINTEG-7 — Fabricated metacog claim.** The impulsivity readout is `null` below the sample-size floor; never assert "0% impulsive" or a pattern on thin data. Descriptive sentence only — **never a grade** (AP-META-1).
- **AP-TINTEG-8 — Study-plan drift.** Never route a retention field or an `ms`-aggregate into `buildStudyPlan` or its inputs (AP-COACH-1). It reflects the *session*, not the *plan*.
- **AP-TINTEG-9 — Impurity in the cores.** No `Date`/`Math.random` in `hintGrade.ts`, `retention.ts`, `impulsivity.ts`; inject `now`/`dayKey`; deterministic.
- **AP-TINTEG-10 — Blocking the loop.** The inline fast-miss nudge and the streak/goal line are passive; they must never gate `loadNext`/`retry` or interpose a modal.
- **AP-TINTEG-11 — Unbounded daily count.** Compute `solvedToday` via the bounded `playedAt` index range for today, not a full `allAttempts()` scan; the count must stay O(today) as the attempt log grows.

---

## §10 Rollback

- Fully additive and concern-separable. Reverting = (a) restore single-tier `hint()` and drop the `usedHint` thread in `finish()` (grading returns to baseline), (b) remove the `rollStreak`/`goalProgress` calls + the header line + the Settings goal input, (c) remove the impulsivity section + the inline nudge, (d) drop the four optional fields. No migration to undo (no `DB_VERSION` bump); existing `usedHint: true` / `dailyStreak` rows read harmlessly (optional).
- **Per-fold rollback** is possible: hint integrity (A3), retention (A4), and impulsivity (A5) are independent and can be reverted separately. The `schemaRev` 1→2 backfill is idempotent and harmless if any one fold is reverted.

---

## §11 Follow-up

- **T1** — self-tag → action (TR3): FSRS clamp on a self-diagnosed cause; "show solution + why" on a miss (T3 only reveals via the *hint* path during solving).
- **T2** — user-facing mode toggle / theme picker / provenance / exhaustion; *surface* `weaknessCounters` (display) on F3's read.
- **DEFER** — record `hintTier?: 1|2|3` on the attempt (V1 collapses tiers to the `usedHint?` boolean). Additive-later if a "how much did the hint help" consumer appears; no consumer now, so don't add an unused field (/enrich#7).
- **DEFER** — surface FSRS `stability` (`srs/types.ts:20`) as a per-motif **mastery** readout (a real signal, but a display concern; needs its own honest framing).
- **DEFER** — decay/recency weighting of the streak vs `weaknessCounters` (would need per-event timestamps beyond `lastTrainedAt`).
- **DEFER** — calendar/notification re-engagement around the streak (needs a scheduler the local-first PWA doesn't have; the in-app streak line is the offline-honest version).
- **DEFER** — a minutes-based daily-goal option (Q-E b) if the app later tracks wall-clock session time.
