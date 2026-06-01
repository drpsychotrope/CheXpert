# Refiner cycle 4 — loop-closers (final pass)

(User-forced. Decreasing returns.)

- P12: Top-nav for Comeback — adding a 13th top-nav button risks clutter; recommend reaching it via the Dashboard resilience Drill only (top-nav optional) → **arbitrage Q-D**.
- P13: README/ADR honesty wording — comeback + missed-win framed as practice with local tracking, not a proven method (AP-CHESS-43). (auto-applied)
- P14: Confirmed 3a adds no new engine eval pass — it reuses `lines.evaluateLines` already called in the generator loop; only the candidate COUNT grows (bounded by the per-game cap). Acceptance grep gate added.

## Stop
critical 0; polish delta < 10% (wording + one nav decision). **Decreasing returns** — skip evaluator
would have stopped at cycle 2. V1 ready pending Q-A..Q-D. **Strong recommendation: act on Q-A (split)
before execution.**
