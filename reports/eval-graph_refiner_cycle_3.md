# Refiner cycle 3 — eval-graph (second-order / edge cases)

- P9: Mate-clamped cp (±100000) → `winPct` saturates to ~0/100 cleanly (verified in winProb.ts comment); curve must not draw out-of-range. Clamp Y to [0,100]. (auto-applied §4.2)
- P10: Short/clean games — `criticalMoments` must return fewer than N (or zero) gracefully, no padding; selector test covers it → §5 + **AP-CHESS-34**.
- P11: Accessibility — SVG markers need `role`/`aria-label` and keyboard selection, matching the repo's existing keyboard-friendly nav (App.svelte brand is keyboard-activatable). (auto-applied §4.2)
- P12: Mini-board `lastMove` needs `[from,to]` from `ply.uci` (slice) — note a tiny `uciToMove` helper; reuse pattern from explain.ts `uciToSan`. (clarified §4.3)

## Counters
critical 0, polish 4 (edge/a11y). Delta ≈ flat vs cycle 2.
