# Arbitrages — `attempt-recording-weakness` (F3)

`/draft-general` 4 refiner cycles. Self-adversarial. **Defaults below are APPLIED in spec V1**; listed
here for the user to ratify or override.

## Decisions to ratify

| # | Question | Options | **Recommended default (applied)** | Why |
|---|---|---|---|---|
| **Q-A** | Coach probes write FSRS + weaknessCounters but NOT the rating pool? | a) SRS+weakness, no pool · b) full incl. pool · c) attempt log only | **a** | AP-COACH-8: probes must not seed `puzzleRating`/game pools. SRS/weakness are learning state and belong; the pool does not. |
| **Q-B** | Weakness-steered selection weighting | a) soft bias (weighted sampling) · b) hard `themes` filter | **a (soft)** | Hard filter starves variety / collapses to one motif. Soft bias leans toward the top weakness while keeping the curated zone broad. Pure (no RNG). |
| **Q-C** | Touch self-tag→action (TR3) here? | a) include · b) defer to T1 | **b (defer)** | Single concern. TR3's FSRS-clamp-on-cause is Trainer-feedback (T1). selfTag write path left untouched. |
| **Q-D** | Position of the weakness branch in `loadNext` | a) above curated only · b) above personal · c) replace personal | **a** | Preserve shipped order: drill > personal (real mistakes) > *(new)* weakness-biased curated > plain curated. Bias shapes only the curated fallback. |
| **Q-E** | Coach-probe attempt `source` value | a) `'curated'` + additive `coachProbe?` flag · b) new `'coach'` literal | **a** | Probe puzzles ARE curated. A new literal = `PuzzleAttemptRecord.source` union change (schema churn) + risk to `source`-keyed logic. Tag provenance with an optional boolean. |
| **Q-F** | Recording a probe mutates the puzzle's own Glicko? | a) no · b) yes | **a (no)** | Same AP-COACH-8 logic: a low-stakes diagnostic shouldn't perturb a curated puzzle's difficulty rating. Pass the puzzle row unchanged. |

## Refiner cycle log (honest, with diminishing returns)

- **Cycle 1** — found the two load-bearing arbitrages (Q-A pool isolation, Q-B soft-vs-hard). Flagged
  the single-concern risk → Q-C (defer TR3). Confirmed both folds empirically real and AP-COACH-8/1 in
  play. No structural STOP.
- **Cycle 2** — ordering question (Q-D): where the weakness branch sits relative to personal. Resolved
  to keep personal ahead (real mistakes already encode weakness). Tightened the no-signal escape hatch
  (the no-regression guarantee). Delta vs cycle 1 ≈ 35%.
- **Cycle 3** — provenance + puzzle-rating isolation (Q-E `source`/`coachProbe?`, Q-F puzzle Glicko).
  Genuine but smaller; both avoid schema churn / pool leakage. Delta ≈ 15%.
- **Cycle 4** — no new arbitrage; only §4/§6 wording tightening and the AP-ATTEMPT-6 double-count note
  (commit() reload interaction). **Delta < 10% → stop.**

## Critical premises (verified, no STOP)

- CF1 real: `onLadderMove` records nothing; no `attemptsRepo` import. (`Coach.svelte:87-103`)
- TR2 real: `weaknessCounters` written 3×, read by selection 0×; `runAnalysis.ts:67-68` comment is false.
- AP-COACH-8 satisfiable: `gradeAttempt` is pure; `recordTacticsAttempt` persists whatever model/puzzle
  the caller passes → pass them with `puzzleRating`/puzzle-rating unchanged.
- AP-COACH-1 safe: `buildStudyPlan` reads `leaks`/dimensions, never `weaknessCounters`.
- No `DB_VERSION` bump: all fields exist; only an additive optional `coachProbe?`.
