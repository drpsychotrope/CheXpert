# Refiner — weakness-intelligence (3 cycles)

## Cycle 1 — critical premise
0 critical. Premise valid: all data on stored `gameAnalyses`; pure/local; no schema. Non-critical →
- P1: cluster key must gate on `motif.confidence==='high'` or it fabricates leaks (ADR-0007 doctrine) → §4.1, AP-CHESS-48.
- P2: trend source — persist vs recompute → recompute (no store). (auto)
- P3: leak→activity mapping should reuse `drillTarget` not re-invent → §4.2. **arbitrage Q-A** (mapping granularity).

## Cycle 2 — polish + cross-axis
- P4: study-plan must be deterministic (no Date in pure code; `days` is a count, UI stamps) → §4.2, mirrors openingBook's pick-determinism. (auto)
- P5: trend windowing (by game-count vs time) → **arbitrage Q-B**; default rolling by game-count.
- P6: §8 acceptance ↔ §5 tests aligned (3 suites). Insights empty-state added.
- critical 0, polish 3.

## Cycle 3 — second-order
- P7: leak cap (top 8) + sampleFens cap (3) to keep UI scannable + perf trivial. (auto)
- P8: "low data" flag on trend/leaks with small n (honesty parity with radar) → AP-CHESS-50. (auto)
- P9: Insights reachable from Dashboard (and nav?) → **arbitrage Q-C** (entry point).
- Decreasing returns; skip-cycle-3 would've fired (polish-only). V1 ready pending Q-A..Q-C.
