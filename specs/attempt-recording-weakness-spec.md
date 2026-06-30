# Spec — Attempt recording + weakness read-back (foundation **F3**)

**PR name**: `attempt-recording-weakness` · **Type**: foundation (recording + selection) · **Spec version**: **V1**
**Drafted**: 2026-06-30 · **Method**: `/draft-general` (4 cycles) → `/enrich` (3 cycles), defaults applied
**ADR (to append)**: **ADR-0055** (ADR-0054 is reserved by `enhancements-architecture-spec.md` for the portfolio cascade)
**Parent**: `specs/enhancements-architecture-spec.md` §2 (F3) · **Folds**: CF1, TR2 · TR3 **deferred** to T1
**Empirical artifacts**: `reports/attempt-recording-weakness_{target_exists,baseline,collision}.json`

---

## §0 Context

The app already has a single, battle-tested persistence path for a solved puzzle —
`attemptsRepo.recordTacticsAttempt` (audit W11): one atomic IndexedDB transaction over
`puzzleAttempts` + `puzzles` + `srsCards` + `playerModel`, grading FSRS with the pure
`fsrs.ts` helpers. **Tactics** and **Review** use it; their `finish`/`grade` also increment
`playerModel.weaknessCounters[theme]` on a miss. **runAnalysis** folds played-game motif tags
into the same counters.

Two gaps were verified empirically (pre-V0 scan):

- **CF1 — coach probes are unrecorded.** `Coach.svelte:onLadderMove` (lines 87-103) calls only
  `ladder.report(true|false)`. The ~14 diagnostic probe attempts (2 per motif × 6 motifs + 2
  endgame; `diagnostic.ts` `COACH_LADDER_MIN = MAX = 2`) are **never** written to `puzzleAttempts`,
  never graded into FSRS, never folded into `weaknessCounters`. `Coach.svelte` does not even import
  `attemptsRepo`. The diagnostic signal the player produces during assessment is thrown away.

- **TR2 — `weaknessCounters` is a dead-read.** It is written at three sites (`Tactics.svelte:233`,
  `Review.svelte:122`, `runAnalysis.ts:74`) but read **nowhere** except the migration/seed backfill
  (`playerModel.ts:26,77` `?? {}`). `loadNext` (`Tactics.svelte:117-161`) selects
  `drillThemes → personal → curated` and never consults it. The comment at `runAnalysis.ts:67-68`
  claiming it is "used by the trainer's personalised selection and the dashboard" is **false** — there
  is no such read. (audit-v2 V2-W10 flagged the same: "dead state … delete or rehabilitate". **This
  PR is the rehabilitation.**)

**This PR closes both gaps with one coherent move**: make the existing persistence path *also* fire
from the coach assessment, and make `weaknessCounters` a **live read** that softly biases puzzle
selection when no explicit drill filter is active.

---

## §0.5 Arbitrages (recommended defaults — applied to this V1)

| # | Question | Options | **Default applied (V1)** | Rationale |
|---|---|---|---|---|
| **Q-A** | Do coach probe attempts write FSRS cards + weaknessCounters but NOT the rating pool? | (a) SRS+weakness, no pool · (b) full incl. pool · (c) attempt log only | **(a)** | AP-COACH-8: diagnostic ladders must not seed `puzzleRating`/game pools. SRS+weakness are *learning* state, not *rating* — they belong. The puzzle row and `puzzleRating` are passed **unchanged**. |
| **Q-B** | Weakness-steered selection: soft bias or hard filter? | (a) soft (weighted/probabilistic sampling) · (b) hard `themes` filter | **(a) soft** | A hard filter starves variety and collapses to one motif; a soft bias keeps the curated zone broad while leaning toward the top weakness theme(s). Implemented purely (no `Math.random` in the core). |
| **Q-C** | Does F3 touch self-tag→action (TR3)? | (a) include · (b) defer to T1 | **(b) defer** | F3 is single-concern: *recording* + *selection*. The self-tag action loop (FSRS clamp on self-diagnosed cause) is Trainer-feedback territory (T1). selfTag write path is left untouched. |
| **Q-D** | Where does the weakness-steered branch sit in `loadNext`'s priority? | (a) above curated fallback only · (b) above personal · (c) replace personal | **(a)** | Preserve the shipped order: explicit drill **>** the player's own mistakes (personal) **>** *(new)* weakness-biased curated **>** plain curated. Personal puzzles already encode real mistakes; weakness bias only shapes the **curated fallback**. |
| **Q-E** | Coach-probe attempt `source` value? | (a) `'curated'` · (b) new `'coach'` literal | **(a) `'curated'`** | Probe puzzles ARE curated puzzles (the ladder draws from `PuzzleRepo`). A new literal would force a `PuzzleAttemptRecord.source` union change (schema churn) and risks polluting any `source`-keyed pool logic. Tag provenance via an additive optional `coachProbe?: true` flag instead (no union change). |
| **Q-F** | Does recording a probe mutate the **puzzle's own** Glicko rating? | (a) no · (b) yes | **(a) no** | Same AP-COACH-8 logic — the puzzle row is passed unchanged so the curated puzzle's difficulty rating is not perturbed by a low-stakes diagnostic. |

> **Refiner note (diminishing returns).** Cycles 1-2 surfaced Q-A/B/C (the load-bearing ones) and
> Q-D (ordering). Cycle 3 surfaced Q-E/F (provenance + puzzle-rating isolation) — genuine but smaller.
> Cycle 4 produced no new arbitrage, only wording tightening on §4/§6 → **stop, returns < 10%**.

---

## §1 Baseline (measured 2026-06-30, head `9296aff`)

- `DB_VERSION = 4`; `PlayerModel.schemaRev = 1`; `SettingsRecord.schemaRev = 1`. Latest ADR **0053**.
- **Coach probes**: ~14, **zero** persistence (no attempt row / FSRS card / weakness increment); rating
  pool correctly untouched today.
- **`weaknessCounters`**: written on miss (Tactics, Review) + per played-game motif (runAnalysis); read
  by **nothing** that affects behaviour (selection, study-plan, dashboard all ignore it).
- **`loadNext` order**: `tacticsFilterThemes` → `personal` → `curated`.
- **Green bar** (per ADR-0053 delivery): svelte-check 0/0, ~500 Vitest passing, build green. This PR must
  not regress that.
- **AP-COACH-1 (study-plan byte-identity)**: `buildStudyPlan` consumes `leaks` (from `fingerprint.ts`
  over `GameAnalysis`) + the weakest radar dimension — **never** `weaknessCounters`. F3 cannot perturb
  the study-plan. (`coach/program.ts:3` documents the same invariant.)

---

## §2 Scope (single concern)

**IN**
1. **Record coach probe attempts** through the existing persistence path: an attempt row + a graded
   FSRS card + a `weaknessCounters` increment-on-miss — **without** mutating `puzzleRating`, game pools,
   or the puzzle's own rating (AP-COACH-8).
2. **Make `weaknessCounters` a live read** that *softly biases* curated puzzle selection toward the
   player's top weakness theme(s) **only when no explicit drill filter is active**.
3. Fix the stale `runAnalysis.ts:67-68` comment to describe the now-true behaviour.

**OUT** (explicitly)
- TR3 self-tag→action / FSRS clamp on self-diagnosed cause → **T1**.
- User-facing mode toggle, theme picker, provenance UI, exhaustion message → **T2**.
- Any dashboard surfacing of `weaknessCounters` → out (this PR makes it *steer*, not *display*).
- `DB_VERSION` / destructive schema change → not needed (see §3).
- Touching `buildStudyPlan` or its inputs (AP-COACH-1).

---

## §3 Pre-flight (gates before code)

- [ ] **No new required field.** `weaknessCounters` and every `PuzzleAttemptRecord` field already exist
      (`db.ts:36-49,59`). The only *new* field is an **optional** `coachProbe?: boolean` on
      `PuzzleAttemptRecord` (additive; absent on legacy → reads falsy). **NO `DB_VERSION` bump, NO
      `schemaRev` bump** (precedent ADR-0035/0037/0040/0043/0053).
- [ ] **AP-COACH-8 path proven.** The coach-recording call passes the puzzle row and a model with
      `puzzleRating` **unchanged**; only `puzzleAttempts`, `srsCards`, and `weaknessCounters` change.
- [ ] **AP-COACH-1 path proven.** No edit to `studyPlan.ts` or its callers; `weaknessCounters` is not a
      study-plan input. Re-run the existing `studyPlan.test.ts` determinism test as a guard.
- [ ] **Pure core extracted.** Weakness→themes selection logic lives in a pure module (no `Date`, no
      `Math.random`); the soft-bias tie-break uses the existing deterministic `hashId` style seed.
- [ ] **Bilingual check.** This PR adds **no new user-facing string** (recording + selection are
      invisible). If any string is introduced, it ships FR+EN via the catalogue (ADR-0053). Confirm in
      review that the FOLD set adds none.

---

## §4 Phase A — CODE FIRST

> Order: pure core → coach recording wire-up → selection read wire-up → comment fix. Code before docs.

### A1 — Pure weakness-selection core (new) `src/trainer/weaknessSelect.ts`
A small pure module so the bias is unit-testable without IndexedDB/Svelte:

```ts
// PURE. No Date, no Math.random. Turns weaknessCounters into a steering decision
// for the trainer's no-drill curated fallback (F3 / TR2). Soft bias, not a hard
// filter (Q-B): we pick the top weakness theme(s) to PASS to PuzzleRepo.next({themes}),
// keeping the rating window wide so variety survives.
export interface WeaknessSteer { themes: string[] | undefined; topTheme?: string; }

/** Rank weakness themes worst-first; return up to `k` for a soft bias, or undefined
 *  when there is no usable signal (empty / all-zero counters). Deterministic tie-break
 *  by theme key so the choice is stable and testable. */
export function steerFromWeakness(
  counters: Record<string, number>,
  opts?: { k?: number; minCount?: number },
): WeaknessSteer;
```

- `minCount` (default **2**) suppresses one-off noise (a single miss should not redirect the queue).
- `k` (default **1**) — soft bias toward the single worst theme; `next()` still searches the rating
  window, so other themes appear when the biased theme has no in-zone puzzle.
- Returns `{ themes: undefined }` when there is no signal → caller falls through to plain curated
  (identical to today's behaviour). **This is the no-regression escape hatch.**

### A2 — Coach probe recording `src/ui/Coach.svelte`
In `onLadderMove`, after `ladder.report(solved)` for **both** the `wrong` and `solved` branches,
record the probe attempt through the existing path **without rating-pool mutation**:

- Import `recordTacticsAttempt` + `resultToGrade`.
- Build a `PuzzleAttemptRecord` from the current `trainer`/`display`: `id = `${puzzle.id}:${now}``,
  `solved`, `ms = trainer.elapsedMs(now)`, `themes`, `source: 'curated'`, **`coachProbe: true`**,
  and `ratingBefore = ratingAfter = baseline()` (NOT a graded delta — probes don't move the pool, Q-A/F).
- On a **miss**, increment `model.weaknessCounters[theme]` for the probe's themes (mirrors Tactics/Review).
- Call `recordTacticsAttempt({ attempt, puzzle: <unchanged snapshot>, model: <snapshot, puzzleRating
  unchanged>, srs: { kind: 'puzzle', refId: puzzle.id, grade: resultToGrade(solved, ms) }, now })`.
- **Reload-then-persist discipline**: the coach already reloads the model in `commit()` to preserve a
  `weaknessCounters` fold (lines 186-192, the I-1 lesson). Because each probe now writes the model
  inside the atomic tx, `commit()`'s `loadPlayerModel` will pick up the probe folds for free — verify
  no double-count and that `commit()` still reloads before writing `coachProfile`.

> **AP-COACH-8 enforcement (explicit):** the `puzzle` passed is the probe puzzle **with its rating
> fields unchanged**; the `model` passed has **`puzzleRating` unchanged**. `gradeAttempt` is **not**
> called for probes. The PuzzleLadder's internal `rating` stays local and is never persisted to
> `puzzleRating` (today's correct behaviour, preserved).

### A3 — Weakness-steered selection `src/ui/Tactics.svelte` `loadNext`
Insert ONE branch into the existing priority chain, **between personal and the plain curated fallback**
(Q-D=a):

```
1. drillThemes (dashboard)            — unchanged
2. personal (real mistakes)          — unchanged
3. NEW: weakness-biased curated      — steerFromWeakness(model.weaknessCounters) -> if themes,
        app.puzzles.next({ rating, window: 250, exclude: seen, themes })
4. plain curated                     — unchanged (the escape hatch when 3 yields null / no signal)
```

- Set `mode = 'mixed'` for the steered branch (no new UI mode — T2 owns the visible mode toggle).
- If the steered `next()` returns `null` (biased theme exhausted in-zone), fall through to plain
  curated — **never** dead-end the loop.

### A4 — Comment fix `src/analysis/runAnalysis.ts`
Replace the false claim (lines 67-68) with: counters are folded for the trainer's weakness-steered
no-drill selection (F3) — accurate, no behaviour change.

---

## §5 Tests

**Pure core — `src/trainer/weaknessSelect.test.ts` (new)**
- empty counters → `{ themes: undefined }` (no-regression escape).
- all-zero / all-below-`minCount` → `{ themes: undefined }`.
- single dominant theme above `minCount` → `{ themes: ['fork'], topTheme: 'fork' }`.
- ties → deterministic by key (stable order, no `Math.random`).
- `k`/`minCount` honored.

**Coach recording — extend `src/store/repos.test.ts` or a new `coach-probe-record.test.ts`**
- a recorded probe **writes** an attempt row (`coachProbe === true`) + an FSRS card for `puzzle:<id>`.
- a missed probe **increments** `weaknessCounters[theme]`.
- **AP-COACH-8 guard**: after recording N probes, `playerModel.puzzleRating` is **unchanged** and the
  probe puzzle's own `rating`/`ratingDeviation` are **unchanged**. (The decisive test.)
- grade mapping matches `resultToGrade(solved, ms)`.

**Selection — Tactics/loadNext (unit on the seam, or component if harness allows)**
- with no drill filter and a dominant weakness, `app.puzzles.next` is called with the biased `themes`.
- with no weakness signal, selection is byte-identical to today (plain curated path).
- steered `next()` → `null` falls through to plain curated (no dead-end).

**Regression guards**
- `studyPlan.test.ts` determinism test stays green (AP-COACH-1).
- existing `repos.test.ts` W11 atomic-write test stays green.
- existing metacog schema tests stay green (`coachProbe?` is additive, doesn't disturb `selfTag`/`confidence`).

---

## §6 Verification

- [ ] `npm test` green, **count ≥ baseline (~500) + new tests**, zero prior failures.
- [ ] `svelte-check` **0 errors / 0 warnings**.
- [ ] `npm run build` green.
- [ ] **Manual (PWA)**: run a coach assessment → confirm (a) an attempt row per probe appears
      (`coachProbe: true`), (b) probe misses move `weaknessCounters`, (c) `puzzleRating` is unchanged
      after assessment, (d) afterwards the trainer's no-drill puzzles lean toward the probed weakness.
- [ ] **AP-COACH-1**: Insights study-plan output unchanged before/after (the determinism test is the
      mechanical proof; spot-check the rendered list).
- [ ] **AP-COACH-8**: `puzzleRating` + probe-puzzle ratings unchanged across an assessment (test +
      manual).
- [ ] **i18n parity**: FOLD set adds no user-facing string (or, if any, FR+EN present).

---

## §7 Docs (LAST)

- Append **ADR-0055** to `decisions.md`: "F3 — coach probe recording + weaknessCounters rehabilitation".
  Record: Q-A..Q-F decisions; the AP-COACH-8 isolation (no pool/puzzle-rating mutation); the AP-COACH-1
  guarantee (study-plan untouched); that this **supersedes audit-v2 V2-W10's "delete weaknessCounters"
  option** in favour of rehabilitation; additive `coachProbe?` field, **no `DB_VERSION` bump**.
- Update `specs/enhancements-architecture-spec.md` F3 row status → drafted/built as appropriate.
- No README change (no user-visible feature surface; behaviour is steering + recording).

---

## §8 Acceptance

1. Every coach diagnostic probe records an attempt + FSRS card through `recordTacticsAttempt`.
2. Probe misses increment `weaknessCounters`; probe puzzles and `puzzleRating` are provably unmutated.
3. With a weakness signal and no drill filter, the trainer's curated fallback is softly biased toward
   the top weakness theme; with no signal, selection is byte-identical to baseline.
4. `weaknessCounters` is read by selection (no longer a dead-read); the stale comment is corrected.
5. Study-plan output byte-identical (AP-COACH-1); green bar preserved; no `DB_VERSION` bump.

---

## §9 Anti-patterns (AP-ATTEMPT-*)

- **AP-ATTEMPT-1 — Leaking probes into rating pools.** Recording a coach probe must never mutate
  `puzzleRating`, game pools, or the probe puzzle's own Glicko (AP-COACH-8). Pass them unchanged; never
  call `gradeAttempt` for a probe.
- **AP-ATTEMPT-2 — Hard-filtering selection on weakness.** Do not collapse selection to a single theme;
  soft bias only, with a wide rating window and a guaranteed fall-through to plain curated.
- **AP-ATTEMPT-3 — Dead-ending the loop.** A biased `next()` returning `null` must fall through, never
  leave the trainer empty.
- **AP-ATTEMPT-4 — Noise steering.** Do not redirect the queue on a single miss; require `minCount ≥ 2`.
- **AP-ATTEMPT-5 — Schema churn.** Do not add a `'coach'` literal to `PuzzleAttemptRecord.source` or bump
  `DB_VERSION`; use the additive optional `coachProbe?` flag.
- **AP-ATTEMPT-6 — Double-counting.** Probe writes the model inside the atomic tx; `commit()` reloads
  before persisting `coachProfile`. Verify a probe's weakness increment is counted exactly once.
- **AP-ATTEMPT-7 — Study-plan drift.** Never route `weaknessCounters` into `buildStudyPlan` or its inputs
  (AP-COACH-1). It steers the *trainer*, not the *plan*.
- **AP-ATTEMPT-8 — Impurity in the core.** No `Date`/`Math.random` in `weaknessSelect.ts`; deterministic
  tie-break only.

---

## §10 Rollback

- The change is additive and behind a natural feature gate (the *presence* of weakness signal).
  Reverting = (a) remove the recording call in `onLadderMove`, (b) remove the steered branch in
  `loadNext` (selection returns to drill→personal→curated), (c) drop the `coachProbe?` field. No
  migration to undo (no `DB_VERSION` bump). Existing `coachProbe: true` rows read harmlessly (optional).
- Per-half rollback is possible: the recording (A2) and the selection read (A3) are independent and can
  be reverted separately.

---

## §11 Follow-up

- **T1** — self-tag→action (TR3): FSRS clamp on self-diagnosed cause; "show solution + why".
- **T2** — user-facing mode toggle / theme picker / provenance / exhaustion message; *surface*
  `weaknessCounters` (display), building on F3's read.
- Consider (DEFER) a decay/recency weighting for `weaknessCounters` so old misses fade — out of scope
  here (would need a per-theme timestamp; F3 keeps the existing plain counter).
- Consider (DEFER) recording probes for the **endgame** ladder phase distinctly if C2 introduces
  endgame sub-types (F3 records it as the `endgame` theme like today's probe set).
