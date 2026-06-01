# Refiner cycle 1 — eval-graph (critical premise validation)

## Critical defects
**None.**
- All data the curve/critical-moments need is already on `GameAnalysis` (`playedWhiteCp`, `winProbLoss`, `byPhase`). `winPct` exists. Premise (UI-only, no re-eval) holds.
- No source divergence: omitting a global Accuracy grade is consistent with ADR-0009 / honesty notes.

## Non-critical patches → cycle 2
- P1: Import.svelte has **no board** today; the brainstorm design said "board jumps to fenBefore". Resolution path = read-only mini-board via Board.svelte's `viewOnly` → **arbitrage Q-A** (placement/board).
- P2: Critical-moment count + threshold unspecified → **arbitrage Q-B**.
- P3: Curve POV (White vs player) unspecified → **arbitrage Q-D**.
- P4: Whose swings count (both sides vs player) → **arbitrage Q-C**.

## Verdict
Proceed. 0 critical, 4 non-critical (all arbitrage-shaped).
