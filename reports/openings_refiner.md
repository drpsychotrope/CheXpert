# Refiner — openings (3 cycles)

## Cycle 1 — critical premise
0 critical. CC0 ECO data is available + same provenance as existing assets; naming is pure prefix-match; no schema. Non-critical →
- P1: naming must be longest-prefix, not exact-match → §4.2, AP-CHESS-51.
- P2: ship compact bundled JSON, not raw TSV / runtime fetch (offline, local-only) → §4.1, AP-CHESS-52. (auto)
- P3: data footprint — full ~3500 lines vs subset → **arbitrage Q-A**.

## Cycle 2 — polish + cross-axis
- P4: ETL must validate SAN→UCI through chess.js + drop/log unparseable lines → AP-CHESS-53. (auto)
- P5: explorer scope — name+deviation now vs stats explorer → stats deferred to §11. **arbitrage Q-B** confirms.
- P6: "Add to repertoire" — seed in-book prefix only, or also engine's better move? → **arbitrage Q-C**.
- critical 0, polish 3.

## Cycle 3 — second-order
- P7: transposition handling — prefix match misses transpositions; document as a known limitation (name by move-order line), full transposition support = follow-up. (auto)
- P8: AnalysisResult addition is additive/read-only — no conflict with eval-graph block. (verified)
- Decreasing returns. V1 ready pending Q-A..Q-C.
