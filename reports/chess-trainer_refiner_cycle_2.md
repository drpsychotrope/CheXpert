# Refiner cycle 2 — polish + cross-axis

**Date:** 2026-05-31 · integrates cycle-1 non-critical patches P1–P5.

## Cross-axis consistency checks
- **Cross-references:** Phase 1 §11 → Phase 2/3/4 file paths correct. ✓
- **ADR numbering:** P1 0001–0004, P2 0005–0007, P3 0008–0009, P4 0010–0012 — sequential, no collision. ✓
- **Anti-pattern numbering:** P1 AP-CHESS-1..8, P2 9..13, P3 14..17, P4 18..22 — sequential, greppable, no collision. ✓
- **Arbitrage propagation:** Q-C appears in P1 §0.5 (engine build) and P2 §0.5 (load-bearing) — consistent framing. ✓
- **Gate measurability:** P1 §6 (latency ms, win-rate band, reload) and P2 (<30s) are concretely measurable. ✓
- **Phase ordering:** every spec puts Phase A (code) before Phase Z (docs). ✓
- **Single-concern:** P4 explicitly flagged as a bundle to split per-feature at execution. ✓

## Patches applied (cycle 1 → cycle 2)
- P1: Phase 1 calibration scope addition is intentional and documented (needed to seed both ratings) — accepted, no change needed beyond the existing §2 note.
- P2: Q-D (UI framework) promoted to the arbitrages bundle as a build-blocking decision.
- P3: Q-E (puzzle subset) promoted to the arbitrages bundle with a concrete recommendation.
- P4: "resilience/rebound" → recommend defining as *recovery rate after a disadvantage* (does the player's eval recover after falling behind?) — captured as an open definition in arbitrages note.
- P5: Q-G (location + git init) added to the arbitrages bundle.

## Residual polish (non-critical, post-merge-able)
1. Exact Glicko-2 vs Glicko-1 choice (recommend Glicko-2; minor).
2. Win-probability formula constant (sigmoid k) — tune empirically in Phase 2.
3. Curated-subset count (50k vs 100k) — empirical, tune at ETL time.
4. Service-worker cache versioning detail — implementation detail.
5. FSRS default parameters — use ts-fsrs defaults initially.

**Critical count: 0. Polish count: 5 (≤ 8).**

## Skip-cycle-3 evaluation
`skip_cycle_3 = (critical==0) AND (polish<=8)` → **TRUE**. Cycle 3 skipped (decreasing returns). See `chess-trainer_cycle_3_skipped.json`. Ship as V1.
