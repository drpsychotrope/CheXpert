# Arbitrages: loop-closers

## Critical structural defects (cycle 1 stops)
None blocking. **But cycle 1 surfaced a scope-decomposition decision (Q-A) — resolve it first.**

## Decisions requested from user

### Q-A: Split into 3 PRs? (headline)
The spec bundles 3a (missed-win mining), 3b (drill routing), 3c (comeback drills).
**Options**
- (a) **Split into 3 PRs**, ship 3a → 3b → 3c. Each is single-concern, independently testable; 3a is tiny and high-value, 3c is the large new surface.
- (b) Keep as one PR. Simpler to track, but mixes pure analysis logic, UI routing, and a new view + engine loop — wide verification surface, harder rollback.
**Refiner recommendation**: (a) — matches the repo's additive-PR history and the skill's single-concern doctrine; lets the cheap wins (3a, 3b) land without waiting on 3c.

### Q-B: Missed-win trigger thresholds (3a)
**Options**
- (a) `mate>0` OR `moverPOV(bestCp) ≥ 500`, with `winProbLoss ≥ 3` and per-game cap 3.
- (b) Forced mate only (most conservative; fewest, highest-signal puzzles).
- (c) `bestCp ≥ 300` + `winProbLoss ≥ 2`, cap 5 (more puzzles, more noise).
**Refiner recommendation**: (a) — captures missed mates *and* clearly decisive material wins while the wpl floor + cap prevent flooding a one-sided game.

### Q-C: Comeback grading (3c)
**Options**
- (a) Outcome vs the adaptive bot: draw/win = held = pass; loss = fail. No extra eval probes.
- (b) Eval-recovery: probe the engine; pass if you reach ≥ −100 within K moves.
**Refiner recommendation**: (a) — simpler, no added engine cost, and "did you save the half-point" is the real-world skill; (b) is a §11 refinement.

### Q-D: How is Comeback reached? (3c)
**Options**
- (a) Dashboard resilience Drill only (no new top-nav button).
- (b) Add a top-nav "Comeback" button too.
**Refiner recommendation**: (a) — avoids a 13th nav button; it's a targeted drill, not a primary mode.

## Auto-applied patches (no user input needed)
- `meta.kind:'missed-win'`, no invented Lichess theme (AP-CHESS-44/29).
- Tag 'missed-win' only for newly-added decisive plies; mistakes/blunders keep 'mistake'.
- `tacticsTimed` resets on clear (AP-CHESS-39); timed countdown won't double-grade.
- Comeback positions filtered to playable dips (exclude already-lost), player-to-move (AP-CHESS-40).
- Comeback plays at the player's ZPD Elo, not full strength (AP-CHESS-41).
- No IndexedDB migration (comeback positions derive from stored analyses).
- Honesty framing preserved (AP-CHESS-43).

## Stop status
- Cycles run: 4/4 (user-forced)
- Stop reason: complete; decreasing returns at cycle 4 (skip evaluator would have stopped at cycle 2)
- Final spec: `specs/loop-closers-spec.md`

## Next steps
1. **Answer Q-A first** (split or not) — it shapes the others' PR boundaries.
2. Reply (e.g. `loop Q-A: a, Q-B: a, Q-C: a, Q-D: a`).
3. If split: drafter emits 3 sub-specs (`missed-win`, `drill-routing`, `comeback`) from this meta-spec; ADRs 0022/0023/0024.
4. Drafter applies decisions as the final V1 patch; specs ready to execute.
