# Refiner — practice-mechanics (3 cycles)

## Cycle 1 — critical premise + scope
0 critical. All three reuse existing infra (analyzeLines, vision.ts, dueCards/createSet); no new engine/schema.
- Scope finding: 3 separable mechanics → **recommend split 3a/3b/3c** (Q-A). Spec decomposed accordingly.
- P1: calc must grade the WHOLE line vs PV, board read-only during input → AP-CHESS-54/55.
- P2: vision `hangingPieces` must check defenders → AP-CHESS-56.

## Cycle 2 — polish + cross-axis
- P3: calc grading rule (exact PV-prefix vs eval-threshold for alt wins) → **arbitrage Q-B**; default = PV-prefix OR winning-eval.
- P4: vision drill set + timer params → **arbitrage Q-C**.
- P5: interleave must not resurface not-yet-due cards (priority within due set only) → AP-CHESS-57.
- critical 0, polish 3.

## Cycle 3 — second-order
- P6: auto lapse-set trigger — automatic vs on-demand button → **arbitrage Q-D**; default on-demand (no surprise sets), namespaced id (AP-CHESS-58).
- P7: calc position source = personal puzzles first then curated (reuse PuzzleRepo selection). (auto)
- Decreasing returns. V1 ready pending Q-A..Q-D.
