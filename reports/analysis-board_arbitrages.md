# Arbitrages: analysis-board

## Critical defects
None.

## Decisions

### Q-A: Interactive engine budget
- (a) MultiPV 3, movetime ~600ms, debounced + interrupt prior (recommended) — responsive, snappy on lite engine.
- (b) MultiPV 5 / longer movetime — richer but laggier on single-thread.
**Reco: (a)** (faster once `engine-perf` (F) lands).

### Q-B: Variation model in v1
- (a) Linear walker: back/forward + try-a-line, "reset to game" (recommended) — covers exploration; simple.
- (b) Full branching tree editor with PGN annotations (bigger; §11).
**Reco: (a).**

### Q-C: Entry point
- (a) "Explore" link from AnalysisResult critical moments + standalone view (recommended).
- (b) Standalone view only.
**Reco: (a).**

## Auto-applied
interrupt()+debounce, one analysis at a time (AP-CHESS-62); FEN-grounded conservative positional claims (AP-CHESS-63); positional phrases only in the no-motif branch (AP-CHESS-64).

## Stop status
3/3 cycles; decreasing returns. Spec `specs/analysis-board-spec.md`. ADR-0031.

## Next steps
Reply e.g. `E: all reco`.
