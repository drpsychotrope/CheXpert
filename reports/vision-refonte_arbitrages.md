# Arbitrages: vision-refonte

## Critical structural defects (cycle 1 stops)

None. Premise valid, paths exist, empirical baseline captured. The spec is V1, ready to execute once
the decisions below are confirmed (all three already have a recommended default baked into the spec).

## Decisions requested from user

### Q-A — Review-gate scope (the one real decision)
The session Review gate (`Session.svelte:67`) currently calls `dueCount(Date.now())` **unscoped**.
The Review step is puzzle-only, so this already over-counts repertoire today (pre-existing latent bug).
Vision cards must not inflate it. How far to fix?

**Options**
- **(a) exclude-vision-only** — `(dueCount(now,'puzzle') + dueCount(now,'repertoire')) > 0`. Preserves
  the existing puzzle+repertoire gate semantics exactly; only vision is excluded.
- (b) narrow-to-puzzle — `dueCount(now,'puzzle') > 0`. Also fixes the latent repertoire over-count as
  a side-effect, but changes repertoire gate behavior (out of this feature's scope).

**Refiner recommendation:** **(a)** — single-concern; don't change repertoire behavior inside a vision
PR. The latent repertoire bug is logged as §11 follow-up. *(spec default = a)*

### Q-B — Blindfold grading
**Options**
- **(a) correctness-only** — `blindfoldGrade = solved ? Good : Again`; speed ignored.
- (b) speed-graded like coordinate (`VISION_GRADE_THRESHOLDS` 1500/5000 ms).

**Refiner recommendation:** **(a)** — blindfold is a memory task; a correct-but-slow recall after a
3 s flash must not be penalised as "slow" (F1). *(spec default = a)*

### Q-C — Blindfold: does colour count?
"What piece is on e5?" — must the answer include the piece's **colour** (white N vs black n)?

**Options**
- **(a) colour matters** — compare the case-sensitive FEN char; picker shows 12 pieces + empty.
- (b) type only — normalise case; picker shows 6 piece types + empty (easier, weaker board memory).

**Refiner recommendation:** **(a)** — colour is part of holding the board image. *(spec default = a)*

## Auto-applied patches (no user input needed)
- F5: relation `between` answer → numeric **count** (was a list of square names).
- F6: `visionMastery` threshold named `MASTERY_STABILITY_DAYS` (default 21, tunable).
- F8: coordinate board needs `selectable.enabled` for empty-square clicks (else `onSelect` never fires).
- F3/F9/F10: documentation of untrained-square coverage, empty-square blindfold mix, benign rollback.

## Stop status
- Cycles run: **4/4** (user override of the default 1–3; skip-evaluator would have stopped at cycle 2).
- Stop reason: cycles-exhausted + decreasing-returns (cycle 4 material defects ≈ 0).
- Final spec: `specs/vision-refonte-spec.md` (V1).
- Pre-V0 artifacts: `reports/vision-refonte_{target_exists,baseline,collision,source_divergence}.json`.

## Next steps
1. Read Q-A / Q-B / Q-C above.
2. Reply with decisions, e.g. `Q-A: a, Q-B: a, Q-C: a` (all = accept the spec defaults → no patch needed).
3. The drafter applies any non-default choices as a final V1 patch, then the spec is ready to execute
   (→ `writing-plans` / implementation).
