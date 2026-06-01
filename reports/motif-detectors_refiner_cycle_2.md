# Refiner cycle 2 — motif-detectors (polish + cross-axis)

Integrated cycle-1 patches P1–P3 into §4. New findings:

- P5: Tag strings must be the **exact Lichess theme keys** (`pin`/`skewer`/`discoveredAttack`/`doubleCheck`) or Tactics theme filters miss the puzzles → §4.6 + **AP-CHESS-29**.
- P6: Discovered-attack needs three guards: revealed slider is **ours**, `from` was the **sole** blocker, ray type matches the slider → §4.4 + **AP-CHESS-27**.
- P7: Should a detector require the motif to actually **win material** (engine re-check) or is geometric presence + valuable-target enough? → **arbitrage Q-B**.
- P8: Relative-pin threshold (which value gap counts; tag relative pins at all?) → **arbitrage Q-C**.

## Cross-axis checks
- §4 edits ↔ §8 acceptance: added AC#4 (fallback tests unchanged) and AC#7 (no new engine calls). Consistent.
- §6 verification covers the generatePuzzles inheritance claim (§0) — added explicit assert.

## Counters
critical = 0, polish = 4. Skip-cycle-3 would normally trigger (polish ≤ 8) — **overridden: user requested 4 cycles**.
