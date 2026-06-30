# Spec — Coach probe engine v2 (feature **C2**)

**PR name**: `coach-probe-engine-v2` · **Type**: feature (coach diagnostic engine) · **Spec version**: **V1**
**Drafted**: 2026-06-30 · **Method**: PRE-V0 scan → `/draft-general` (4 cycles, defaults applied) → `/enrich` (3 cycles, 8-axis sweep, FOLD set folded)
**Parent**: `specs/enhancements-architecture-spec.md` §3 (C2) · **Folds**: CO4, CF6, CF7, CO7, CO15
**Hard dependency**: **F3** (`attempt-recording-weakness`, ADR-0055) — drafted, **not yet built**; C2 records probes *through* F3's path.
**ADR**: none required (extends ADR-0045 coach engine; consumes ADR-0055 recording). Flag **ADR-0059** only if the reviewer rules the à-la-carte scope + timed probe an architectural surface (0054-0058 reserved).
**Empirical artifacts**: `reports/coach-probe-engine-v2_{target_exists,baseline,collision}.json`

---

## §0 Context

The coach assessment (ADR-0045) drives one `PuzzleLadder` per theme and aggregates the results in the
pure `buildCoachProfile`. Five product-depth gaps were verified against the real code (PRE-V0 scan,
head `9296aff`):

- **CO4 — flat probe depth.** `COACH_LADDER_MIN = COACH_LADDER_MAX = 2` (`diagnostic.ts:21-22`): every
  motif gets exactly 2 puzzles, ~14 total. The module comment admits a single puzzle swings ±~115
  Glicko, so a motif whose delta lands *near zero* (borderline strength/weakness) is exactly the one
  that needs more samples — but gets the same flat 2 as a clearly-strong or clearly-weak motif.

- **CF6 — one coarse endgame bucket.** The endgame probe is `{ theme: 'endgame', phase: 'endgame' }`
  (`Coach.svelte:25, 72`): `themes` is `undefined`, so it filters only by the `phaseOf(fen)` heuristic
  and lumps rook / king-&-pawn / minor-piece endgames into a single number. A player strong at rook
  endings but lost in pawn endings reads as "average endgames".

- **CF7 — all-or-nothing scope.** `THEMES` (`Coach.svelte:23-26`) is fixed; the wizard always runs all
  7 ladders in a fixed order. A returning player who only wants to re-check forks must sit through the
  whole sweep. The array is trivially subsettable — the engine just never exposes the choice.

- **CO7 — radar n/a / skippable game.** `Radar.svelte` already collapses unmeasured axes
  (`sampleSize === 0`) to the centre with an `n/a` tag (audit v2 L17). The honesty gap is *upstream*:
  the calibration game is fully skippable (`Coach.svelte:229`), so 4 of 5 dimensions stay n/a with no
  nudge explaining what skipping costs.

- **CO15 — no timed probe.** `timeManagement` is only ever read from the optional game's blunder-under-
  pressure signal (`weakness.ts`). There is no puzzle-side time probe, even though a pure Fischer
  `Clock` core (`clock/Clock.ts`) already exists and the trainer already tracks `elapsedMs`.

**This PR makes the probe engine deeper, less noisy, and à-la-carte**: adaptive depth on borderline
motifs (capped for honesty about length), 2-3 endgame sub-buckets via real Lichess theme keys, a
user-selectable probe scope (default all), a "what skipping the game costs" nudge that makes the game
less silently-skippable, and a small optional timed block that produces an honest `timeManagement`
read from puzzles. All probe results flow into the **unchanged** pure `buildCoachProfile`; recording
(if enabled) goes through **F3**'s path with **no rating-pool leak**.

---

## §0.5 Arbitrages (recommended defaults — applied to this V1)

| # | Question | Options | **Default applied (V1)** | Rationale |
|---|---|---|---|---|
| **Q-A** | Adaptive-depth rule for CO4 | (a) extend a motif's ladder only while `\|delta\| ≤ borderline band`, capped at a global total · (b) flat-but-higher (3/3) · (c) RD-driven only | **(a)** | Targets the noise where it matters (motifs near the strength/weakness boundary) without lengthening clear cases. **Cap the GRAND TOTAL puzzles** (default ~20) so the assessment stays honest about length (AP-CHESS-23 short onboarding). RD-tightening (`isDone`) still applies. |
| **Q-B** | Endgame buckets for CF6 | (a) 2-3 buckets via real Lichess theme keys (`rookEndgame`, `pawnEndgame`, minor) with fall-back · (b) keep one `phase:endgame` · (c) many fine buckets | **(a) 2-3 via theme filter, fall back + report** | The ETL preserves raw Lichess themes (`puzzle-etl.mjs:97`); `rookEndgame`/`pawnEndgame`/minor exist in production. The **seed set has none** → an empty bucket is dropped by `buildCoachProfile`'s `n>0` guard (no fake score) and reported honestly. ≤3 keeps it short. |
| **Q-C** | À-la-carte UI for CF7 | (a) checkbox set of motifs/areas, **default ALL** · (b) always-all · (c) pick-one | **(a) default all, optional subset** | Preserves today's behaviour as the default (no regression, no surprise length change). A returning player can deselect; selecting none is treated as all (never an empty assessment). `THEMES` becomes a filtered view of the catalogue. |
| **Q-D** | Timed-probe design for CO15 | (a) one short timed BLOCK (puzzle-rush style, fixed budget) feeding a `timeManagement` read · (b) per-puzzle clock on every probe · (c) no timed probe | **(a) small timed block, opt-in** | A dedicated short block (e.g. 90 s, solve as many on-level puzzles as you can) yields a clean speed/accuracy signal without making *every* probe time-pressured (which would confound the motif deltas). Reuses `Clock`. Opt-in via the scope picker (an "area"), default included only if the user keeps the full sweep. |
| **Q-E** | If probes are recorded (F3 dependency) | (a) record to SRS + weaknessCounters only, **no pool** · (b) full incl. pool · (c) don't record | **(a) record via F3, no pool leak** | C2 ◄ F3. When F3 is present, probe attempts (incl. timed-block solves) record through `recordTacticsAttempt` with puzzle+model rating fields **unchanged** and `coachProbe: true` — never `gradeAttempt`, never `puzzleRating`/pool mutation (AP-COACH-8 / AP-ATTEMPT-1). If F3 is NOT yet built, C2 still functions (probes just aren't persisted, as today) — recording is gated on F3's field existing. |
| **Q-F** | Timed-block grade → FSRS | (a) use the SAME `resultToGrade(solved, ms)` (speed already in it) · (b) special "timed" grade | **(a) reuse `resultToGrade`** | The existing grade already folds `ms` (fast→Easy, slow→Hard). No new grade path, no schema churn; the timed block just produces faster `ms`, which `resultToGrade` already handles. |
| **Q-G** | Where does adaptive depth live | (a) a new **pure** `probePlan.ts` core (depth + bucket + scope decisions) · (b) inline in `Coach.svelte` · (c) inside `diagnostic.ts` | **(a) pure `probePlan.ts`** | Keep `diagnostic.ts` as the pure *aggregator* (single responsibility) and put the *plan* (which themes, how many, borderline rule) in its own pure, unit-testable core — no `Date`/`Math.random` (AP-COACH-3). `Coach.svelte` stays the impure driver. |

> **Refiner note (diminishing returns).** Cycle 1 surfaced Q-A/Q-B/Q-C (the load-bearing folds). Cycle 2
> surfaced Q-D (timed design) and Q-G (pure-core placement). Cycle 3 surfaced Q-E/Q-F (recording
> isolation + grade reuse) — real but smaller. Cycle 4 produced no new arbitrage, only tightened the
> §4 ordering and the cap wording → **stop, returns < 10%**.

---

## §1 Baseline (measured 2026-06-30, head `9296aff`)

- **Tests**: 504 passing / 69 files; `svelte-check` 0/0 (portfolio anchor); `DB_VERSION = 4`. C2 must not regress.
- **No Svelte component-test harness** (0 `*.svelte.test.ts`) → C2 verifies via **pure-core unit tests + static wiring-presence + manual/preview**.
- **Probe engine today**: 6 motifs + 1 endgame ladder; flat 2 puzzles/motif (~14 total); endgame = one
  coarse `phase:'endgame'` bucket; fixed order; all-or-nothing; **no timed probe**; probes persist
  **nothing** (F3's gap).
- **`PuzzleLadder`** (`Calibration.ts`): `LadderOpts { min, max, themes, phase, window }`; `report()`
  rating stays **local** (never persisted → AP-COACH-8 already holds); `isDone()` = `count>=max` OR
  `count>=min && rd<=90`.
- **`PuzzleRepo.next`**: theme filter exact (`p.themes.includes`), phase filter heuristic
  (`phaseOf(fen)`), deterministic `hashId` pick (no `Math.random`), `null` when pool empty.
- **Puzzle data**: production `puzzles.json` carries raw Lichess themes incl. `rookEndgame`/`pawnEndgame`/
  minor-piece endings; the **seed fallback (150)** has only `mate`/`mateIn1`/`backRankMate` → endgame
  buckets fall back gracefully there.
- **`Clock`** (`clock/Clock.ts`): pure Fischer clock, no `Date`/`performance.now` inside.
- **AP-COACH-1**: `buildStudyPlan` never reads probe internals → C2 cannot perturb the study plan.

---

## §2 Scope (single concern: the probe ENGINE)

**IN**
1. **Adaptive depth (CO4)** — a pure rule that extends a motif's ladder *only while its running delta is
   inside a borderline band*, with a **global cap on total probe puzzles** (honesty about length). Clear
   strengths/weaknesses keep the flat minimum.
2. **Endgame sub-buckets (CF6)** — replace the single endgame ladder with **2-3** themed ladders
   (`rookEndgame`, `pawnEndgame`, minor-piece) using real Lichess theme keys; an empty bucket (no
   in-zone puzzle) is **dropped, never faked**.
3. **À-la-carte scope (CF7)** — a checkbox selector of probe *areas* (motifs + endgame + timed), **default
   all**; an empty selection is treated as all. The probe set becomes a filtered view of the catalogue.
4. **Game-skip honesty nudge (CO7)** — on the offer-game step, show which radar dimensions will read
   `n/a` if the game is skipped (the radar render itself is already honest — unchanged).
5. **Timed probe (CO15)** — an optional short timed *block* (fixed budget via `Clock`) that produces an
   honest, sample-size-labelled `timeManagement` read from puzzles.
6. **Recording isolation (CO4/CF6/CO15 × F3)** — when F3 is present, probe + timed-block attempts record
   through `recordTacticsAttempt` with **no pool leak** (`coachProbe: true`, ratings unchanged).

**OUT** (explicitly)
- Changing the pure aggregator `buildCoachProfile` shape, the study plan, or Insights (AP-COACH-1).
- A dedicated coach rating pool / progress trend across runs → **C1** (already deferred, coach §11).
- Designed-position conversion/resilience probes → **C3**.
- Blending real played-game history into the profile → **C4**.
- Building F3 itself (the recording path + `coachProbe?` field) → **F3** owns it; C2 consumes it.
- A new visible "mode" beyond the scope picker; narrative coaching voice → **C6**.
- `DB_VERSION` / schema migration (see §3).

---

## §3 Pre-flight (gates before code)

- [ ] **No new required field; no `DB_VERSION` bump.** Probe results stay in-memory (`ThemeProbeResult[]`)
      until aggregation, exactly as today. The only persisted touch is the *recording* path, which reuses
      F3's additive optional `coachProbe?` (no new field owned by C2). Confirm `DB_VERSION` stays **4**.
- [ ] **F3 contract check.** Recording is gated on `PuzzleAttemptRecord.coachProbe?` existing. If F3 is
      not yet merged, C2's recording branch is a no-op (probes behave as today: unpersisted) and the rest
      of C2 (depth/buckets/scope/timed/nudge) still ships. Document the build-order expectation (F3 → C2).
- [ ] **AP-COACH-8 path proven.** No probe (motif, endgame, or timed) calls `gradeAttempt` against the
      player pool, and the recording call passes the puzzle row + model with `puzzleRating` **unchanged**.
      The `PuzzleLadder.rating` stays local (today's behaviour, preserved).
- [ ] **AP-COACH-6 honesty.** Endgame buckets use **real** Lichess theme keys only; a bucket with no
      in-zone puzzle is dropped by the existing `n>0` guard — never scored from zero.
- [ ] **AP-COACH-1 path proven.** No edit to `studyPlan.ts` or its inputs; re-run `studyPlan.test.ts`.
- [ ] **Pure cores.** Depth/bucket/scope logic lives in a pure `probePlan.ts` (no `Date`/`Math.random`);
      the timed core uses the pure `Clock`. `buildCoachProfile` stays the single pure aggregator.
- [ ] **Bilingual.** Every new string (endgame bucket labels, scope picker, timed copy, skip nudge)
      ships FR+EN via the catalogue (ADR-0053). The probe *keys* (`rookEndgame`…) stay stable/untranslated.

---

## §4 Phase A — CODE FIRST

> Order: pure plan core → endgame buckets → adaptive depth → scope picker → timed block → skip nudge →
> recording wire-up. Code before docs. Each step is independently revertable (§10).

### A1 — Pure probe-plan core (new) `src/coach/probePlan.ts`
A pure module that turns the user's scope selection + the running ladder state into the next probe
decision. No `Date`, no `Math.random`, no engine/Svelte imports.

```ts
// PURE. The single source of truth for WHICH probes run, in what ORDER, and HOW DEEP.
// diagnostic.ts stays the pure AGGREGATOR; this is the pure PLANNER (Q-G).

export type ProbeKind = 'motif' | 'endgame' | 'timed';

/** One planned probe: a theme/phase filter + its depth bounds. */
export interface ProbeSpec {
  kind: ProbeKind;
  key: string;                 // stable key: motif ('fork'), endgame bucket ('rookEndgame'), or 'timed'
  themes?: string[];           // exact theme filter for PuzzleRepo (undefined for a pure phase probe)
  phase?: 'endgame';           // coarse phase filter (kept for the timed/fallback case)
  min: number;                 // floor puzzles (default COACH_LADDER_MIN)
  max: number;                 // ceiling puzzles (raised by adaptive depth, bounded by the grand cap)
}

/** Endgame sub-buckets (CF6) — REAL Lichess theme keys; order is the probe order. */
export const COACH_ENDGAME_BUCKETS = ['rookEndgame', 'pawnEndgame', 'minorPieceEndgame'] as const;
// NOTE: 'minorPieceEndgame' is the C2 umbrella key mapped to Lichess {knightEndgame,bishopEndgame}
//       via themes:['knightEndgame','bishopEndgame'] (ANY-of match in PuzzleRepo.next).

export const COACH_BORDERLINE_BAND = 60;   // |delta| <= band => borderline => earn an extra probe
export const COACH_PROBE_MAX_TOTAL = 20;   // grand cap on total probe puzzles (honesty about length, Q-A)

/** Build the ordered probe plan from the selected areas (default = all). Empty selection => all. */
export function buildProbePlan(opts: {
  selected?: ProbeKind[] | 'all';
  includeTimed?: boolean;
}): ProbeSpec[];

/** Adaptive depth (CO4): given a ladder's current delta-vs-baseline, RD, count, and the puzzles spent
 *  so far across the whole assessment, decide whether THIS probe earns one more puzzle. Pure. */
export function borderlineDepth(args: {
  spec: ProbeSpec;
  currentDelta: number;        // ladder.rating - baseline, so far
  currentRd: number;           // ladder rd
  countSoFar: number;          // puzzles in THIS ladder
  totalSpent: number;          // puzzles across the WHOLE assessment
  band?: number;               // default COACH_BORDERLINE_BAND
  cap?: number;                // default COACH_PROBE_MAX_TOTAL
}): boolean;                   // true => extend this ladder by one (raise its effective max)
```

- `borderlineDepth` returns `true` only when `|currentDelta| <= band` **and** `currentRd` is still loose
  (e.g. `> 90`, mirroring `isDone`) **and** `totalSpent < cap`. Clear motifs and a hit cap → `false`
  (flat minimum, today's behaviour).
- `buildProbePlan('all', includeTimed:true)` reproduces today's set **plus** the endgame buckets and the
  timed block; a subset returns only the selected specs. Empty/`undefined` → all (no empty assessment).

### A2 — Endgame sub-buckets (CF6) `src/ui/Coach.svelte`
Replace the single endgame `THEMES` entry with the planned endgame specs from `buildProbePlan`:

- Build the probe list once via `buildProbePlan` (A1) instead of the hard-coded `THEMES`.
- Each endgame bucket runs its own `PuzzleLadder({ themes: spec.themes, window: 300, … })` (theme filter,
  not just `phase`). `finishThemeLadder` pushes one `ThemeProbeResult { theme: spec.key, … }` per bucket.
- **Graceful fall-back**: if a bucket's first `ladder.next()` returns `null` (no in-zone puzzle — e.g. the
  seed set), record it as `n = 0`; `buildCoachProfile`'s existing `p.n > 0` filter drops it (no fake
  score). If **all** endgame buckets are empty, fall back to a single coarse `phase:'endgame'` probe so
  endgame is never silently absent when *some* endgame data exists.

### A3 — Adaptive depth (CO4) `src/ui/Coach.svelte` + `Calibration.ts` (minimal)
- After each `ladder.report(solved)`, consult `borderlineDepth(...)` with the running delta/RD/counts. If
  `true`, raise this ladder's effective ceiling by one (the cleanest seam: the ladder already stops at
  `max` or `rd<=90`; expose a tiny `extend()` or pass a higher `max` when re-arming `next()`).
- Maintain a running `totalSpent` across all ladders; once `totalSpent >= COACH_PROBE_MAX_TOTAL`, no
  ladder may extend (hard honesty cap). Clear motifs keep the flat `COACH_LADDER_MIN`.
- **No pool mutation**: extending only changes how many *local* ladder updates happen; `puzzleRating` is
  still untouched (AP-COACH-8).

### A4 — À-la-carte scope picker (CF7) `src/ui/Coach.svelte` (intro step)
- On the `intro` step, render a checkbox set of probe *areas* (the 6 motifs grouped, "Endgames",
  "Timed") — all checked by default. Persist the choice only in component state (no schema).
- `startLadders` passes the selection to `buildProbePlan`. Empty selection → treat as all.
- The progress label (`coach.themeProgress`) already uses `THEMES.length`; point it at the planned list's
  length so "3 / 3" is correct for a subset.

### A5 — Timed probe block (CO15) `src/coach/timedProbe.ts` (new, pure) + `Coach.svelte`
- New pure core `timedProbe.ts`: given a `ClockState` (fixed budget, e.g. `initClock(90_000, 0)`) and a
  stream of solved/failed + `ms` results, accumulate `{ solved, attempted, totalMs }` and derive a
  `timeManagement` `DimensionScore` (speed×accuracy → 0..100, **sample-size-labelled**, directional —
  AP-COACH-2). No `Date`/`Math.random`; the UI feeds `performance.now()` deltas into `tick`.
- `Coach.svelte` runs the timed block (when selected) as one extra step: serve on-level puzzles back-to-
  back under the `Clock` until `flagged`, feeding each result to the pure core, then hand the resulting
  `DimensionScore` to `buildCoachProfile` **as a `gameDimensions`-style `timeManagement` override** (or a
  new optional `timedDim` arg — see §4 note) so the radar's `timeManagement` axis is no longer n/a from
  puzzles alone.
- **Aggregator seam (minimal, additive)**: prefer passing the timed `DimensionScore` via an **optional**
  `timedDim?: DimensionScore` arg to `buildCoachProfile` that fills `timeManagement` *only when the game
  didn't* — keeping the function pure and the existing call sites valid. (If the reviewer prefers zero
  signature change, merge it in the UI before the call; the pure-core option is recommended for testability.)

### A6 — Game-skip honesty nudge (CO7) `src/ui/Coach.svelte` (offer-game step)
- On `offer-game`, compute which dimensions will be `n/a` if the game is skipped (today: all game-only
  dims unless the timed block covered `timeManagement`). Show a short, bilingual line: "Skipping leaves
  *Opening, Endgame, Resilience* unmeasured (n/a)." The radar render stays unchanged (already honest).
- This makes the skip an **informed** choice (CO7) without forcing the game (AP-CHESS-23 skippable).

### A7 — Recording wire-up (Q-E, gated on F3) `src/ui/Coach.svelte`
- When `PuzzleAttemptRecord.coachProbe?` exists (F3 merged), record each probe + timed-block solve via
  `recordTacticsAttempt` with `source: 'curated'`, `coachProbe: true`, `ratingBefore = ratingAfter =
  baseline()`, `grade = resultToGrade(solved, ms)` (Q-F), and the puzzle/model passed with rating fields
  **unchanged**. On a miss, increment `weaknessCounters[theme]` (mirrors Tactics/Review). This is exactly
  F3's A2 pattern, extended to the new endgame buckets and the timed block.
- If F3 is not present, skip recording (no-op) — C2 still ships its engine improvements.

---

## §5 Tests

> Pure cores carry the weight (no component harness). Static wiring-presence + manual cover the UI seam.

**Pure plan core — `src/coach/probePlan.test.ts` (new)**
- `buildProbePlan('all', includeTimed:true)` → 6 motifs + 3 endgame buckets + 1 timed, in order.
- subset selection → only the selected specs; empty/`undefined` → all (never empty).
- `COACH_ENDGAME_BUCKETS` are the real Lichess keys; `minorPieceEndgame` maps to
  `themes:['knightEndgame','bishopEndgame']`.
- `borderlineDepth`: borderline delta + loose RD + under cap → `true`; clear delta → `false`; at cap →
  `false`; tight RD → `false`. Deterministic (no `Date`/`Math.random`).
- the grand cap is honored: a sequence that would extend past `COACH_PROBE_MAX_TOTAL` stops extending.

**Pure timed core — `src/coach/timedProbe.test.ts` (new)**
- accumulates solved/attempted/totalMs from a result stream; derives a 0..100 `timeManagement` score that
  is monotonic in accuracy and (inversely) in time; carries the correct `sampleSize` (attempted count).
- `sampleSize: 0` when no puzzle was attempted (e.g. budget too small) → radar shows n/a (honest).
- pure: same inputs → same output; no `Date`/`Math.random`.

**Aggregator seam — extend `src/coach/diagnostic.test.ts`**
- with `timedDim` provided and no game, `timeManagement` is filled from the timed read (sampleSize > 0)
  while the other game-only dims stay placeholders.
- with both a game and `timedDim`, the game's `timeManagement` wins (or the documented precedence) — and
  the result is byte-identical to today when neither is provided (no-regression).
- endgame buckets: a `ThemeProbeResult` per bucket with `n>0` is scored; `n=0` buckets are dropped
  (existing guard) — no fabricated endgame score.

**Recording (gated on F3) — extend `src/store/repos.test.ts` or a new `coach-probe-record.test.ts`**
- a recorded probe/timed solve writes an attempt (`coachProbe === true`) + an FSRS card; a miss
  increments `weaknessCounters[theme]`.
- **AP-COACH-8 guard (decisive)**: after recording N probes across motif/endgame/timed, `puzzleRating`
  and each probe puzzle's own `rating`/`ratingDeviation` are **unchanged**.

**Regression guards**
- `studyPlan.test.ts` determinism stays green (AP-COACH-1).
- existing `diagnostic.test.ts` cases stay green (the 6-motif constants, n=0 drop, fr/en labels).
- `Clock.test.ts` unaffected (reused, not modified).

---

## §6 Verification

- [ ] `npm test` green, **count ≥ 504 + new tests**, zero prior failures.
- [ ] `svelte-check` **0 errors / 0 warnings**.
- [ ] `npm run build` green.
- [ ] **Manual (PWA), production puzzle set**: run an assessment with all areas → confirm (a) borderline
      motifs get >2 puzzles while clear ones stay at 2, and the total never exceeds the cap; (b) 2-3
      endgame sub-buckets appear with their own scores; (c) the scope picker can drop areas (and "none"
      still runs all); (d) the timed block yields a non-n/a `timeManagement` axis with a sample-size
      label; (e) the offer-game step names the dims that would be n/a if skipped.
- [ ] **Manual, seed fallback set**: endgame buckets fall back gracefully (dropped as n=0, or one coarse
      endgame probe) — never a fabricated endgame score (AP-COACH-6).
- [ ] **AP-COACH-8**: `puzzleRating` + probe-puzzle ratings unchanged across an assessment (test + manual).
- [ ] **AP-COACH-1**: Insights study-plan output unchanged before/after (determinism test + spot-check).
- [ ] **i18n parity**: every new string present in FR **and** EN; probe keys untranslated.
- [ ] **F3 gating**: with F3 absent, the assessment runs (probes unpersisted) and no recording call fires;
      with F3 present, `coachProbe: true` rows appear.

---

## §7 Docs (LAST)

- **No new ADR** by default — extend the **ADR-0045** narrative in prose where C2 changes the probe set
  (adaptive depth, endgame buckets, scope, timed), and reference **ADR-0055** (F3) for the recording
  isolation. If the reviewer rules the à-la-carte scope + timed probe an architectural surface, append
  **ADR-0059** ("C2 — coach probe engine v2"): record Q-A..Q-G, the `COACH_PROBE_MAX_TOTAL` honesty cap,
  the AP-COACH-8 isolation, the AP-COACH-1 guarantee, and the F3 build-order dependency.
- Update `specs/enhancements-architecture-spec.md` C2 row → drafted/built as appropriate; note the F3
  prerequisite.
- README: a short line under the coach feature only if the scope picker / timed probe is deemed a
  user-visible surface worth documenting (bilingual). Otherwise no README change.

---

## §8 Acceptance

1. Borderline motifs (small `|delta|`, loose RD) earn extra probes; clear motifs stay at the flat
   minimum; the **total probe puzzles never exceed `COACH_PROBE_MAX_TOTAL`** (CO4 + honesty cap).
2. The endgame probe is split into 2-3 sub-buckets via real Lichess theme keys; empty buckets are
   dropped, never faked; the seed fallback degrades gracefully (CF6, AP-COACH-6).
3. The user can choose which areas to probe (default all; empty → all); the probe set and progress label
   follow the selection (CF7).
4. The offer-game step names the dimensions that will read `n/a` if the game is skipped; the radar render
   is unchanged and already honest (CO7).
5. An optional timed block produces a sample-size-labelled, directional `timeManagement` read from
   puzzles, reusing the pure `Clock` (CO15).
6. With F3 present, probe + timed solves record through `recordTacticsAttempt` with **no** `puzzleRating`/
   pool/puzzle-rating mutation and `coachProbe: true` (Q-E, AP-COACH-8); with F3 absent, C2 still ships.
7. `buildCoachProfile` shape, study-plan output (AP-COACH-1), and the green bar are preserved; **no
   `DB_VERSION` bump**.

---

## §9 Anti-patterns (AP-CPROBE-*)

- **AP-CPROBE-1 — Leaking probes into rating pools.** No probe (motif, endgame, or timed) may mutate
  `puzzleRating`, game pools, or the probe puzzle's own Glicko. The `PuzzleLadder.rating` stays local;
  recording (if F3) passes ratings unchanged and never calls `gradeAttempt` for a probe (cites AP-COACH-8,
  AP-ATTEMPT-1).
- **AP-CPROBE-2 — Unbounded adaptive depth.** Adaptive depth must respect `COACH_PROBE_MAX_TOTAL`; the
  assessment must stay short and honest about its length. Extend only borderline motifs with loose RD.
- **AP-CPROBE-3 — Fabricated endgame buckets.** Endgame sub-buckets use **real** Lichess theme keys; a
  bucket with no in-zone puzzle is dropped (`n=0`), never scored from zero (cites AP-COACH-6).
- **AP-CPROBE-4 — Empty assessment from à-la-carte.** An empty scope selection must be treated as "all";
  the engine never produces a zero-probe assessment.
- **AP-CPROBE-5 — Impurity in the cores.** `probePlan.ts` and `timedProbe.ts` carry no `Date`/`Math.random`;
  the UI owns the clock deltas and `assessedAt` (cites AP-COACH-3).
- **AP-CPROBE-6 — Time pressure confounding motif deltas.** The timed read comes from a *dedicated block*,
  not from clocking every motif probe (which would bias the strength/weakness deltas).
- **AP-CPROBE-7 — Dishonest timed score.** The `timeManagement` read is sample-size-labelled and
  directional; a too-small budget (0 attempts) yields `sampleSize: 0` → radar n/a, not a fake number
  (cites AP-COACH-2).
- **AP-CPROBE-8 — Aggregator drift.** Do not reshape `buildCoachProfile`'s output or route probe internals
  into `buildStudyPlan`; the timed dim enters via an additive optional arg only (cites AP-COACH-1).
- **AP-CPROBE-9 — Silent F3 coupling.** Recording must be *gated* on F3's `coachProbe?` field existing;
  C2 must not hard-require an unbuilt F3 to function (engine improvements ship regardless).

---

## §10 Rollback

- Every sub-feature is independently revertable:
  - **A2 endgame buckets** → restore the single `{theme:'endgame', phase:'endgame'}` entry.
  - **A3 adaptive depth** → fix the ladder ceiling at `COACH_LADDER_MAX` (drop `borderlineDepth`).
  - **A4 scope picker** → always pass `'all'` to `buildProbePlan`.
  - **A5 timed block** → drop the timed step and the optional `timedDim` arg (call site reverts).
  - **A6 nudge** → remove the offer-game line.
  - **A7 recording** → remove the `recordTacticsAttempt` call (probes return to unpersisted, as today).
- No migration to undo (no `DB_VERSION` bump). Any `coachProbe: true` rows written by A7 read harmlessly
  (optional field) after a revert. The pure cores (`probePlan.ts`, `timedProbe.ts`) can remain unused
  without affecting behaviour.

---

## §11 Follow-up

- **C1** — coach rating pool + progress trend across re-runs (delta already stored via `coachProfilePrev`).
- **C3** — designed-position conversion/resilience probes (seeded scenarios) for the still-game-only dims.
- **C4** — blend real played-game history into the profile (PGN import) so the n/a dims fill without a game.
- Consider (DEFER) widening `COACH_ENDGAME_BUCKETS` to more endings (queen, opposite-bishop) once the
  production set's per-bucket counts are measured — keep ≤3 until then (length honesty).
- Consider (DEFER) recency weighting of the timed read across re-assessments (needs a per-run timestamp;
  C2 keeps a single-shot read).
- Consider (DEFER) seeding the worst probed area into Play/Tactics automatically (closing the loop tighter)
  — overlaps C7/F3's weakness-steered selection.
