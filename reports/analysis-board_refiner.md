# Refiner — analysis-board (3 cycles)

## Cycle 1 — critical premise
0 critical. `analyzeLines` (MultiPV) + interactive Board + ChessGame undo/history all exist; no new engine/LLM/schema.
- P1: rapid moves → overlapping engine calls; must `interrupt()` + debounce (one at a time) → AP-CHESS-62.
- P2: positional claims must be FEN-grounded, conservative (honesty doctrine, cf. ADR-0007) → AP-CHESS-63.

## Cycle 2 — polish + cross-axis
- P3: positional phrases must ONLY fill the "no tactical motif" branch; tactical/mate paths untouched → AP-CHESS-64, §4.2.
- P4: engine depth/movetime/multipv for the interactive board → **arbitrage Q-A**; default multipv 3, movetime ~600ms.
- critical 0, polish 2.

## Cycle 3 — second-order
- P5: variation walker scope — linear back/forward + try-line now; full branching tree deferred → **arbitrage Q-B**.
- P6: entry from AnalysisResult critical moments ("Explore") + standalone view → **arbitrage Q-C**.
- Decreasing returns. V1 ready pending Q-A..Q-C.
