# Refiner — scenario-sparring (3 cycles)

## Cycle 1 — critical premise
0 critical. Reuses the proven Comeback vs-adaptive loop + AdaptiveOpponent; no new engine/schema.
- P1: imbalance FENs must be legal + correct side-to-move → validate like endgame drills, AP-CHESS-59.
- P2: must spar at ZPD Elo not full strength → AP-CHESS-60 (mirror ADR-0025).

## Cycle 2 — polish + cross-axis
- P3: dependency on spec A — library must stand alone; weakness-source returns [] if no fingerprint → AP-CHESS-61. **arbitrage Q-A** (sources).
- P4: grading = outcome (win/hold), consistent with comeback → **arbitrage Q-B** confirms (vs eval-based).
- critical 0, polish 2.

## Cycle 3 — second-order
- P5: scenario "goal" text per imbalance (what to aim for) keeps it instructive, not just "play". (auto)
- P6: entry from Insights (A) + nav → **arbitrage Q-C**.
- Decreasing returns. V1 ready pending Q-A..Q-C.
