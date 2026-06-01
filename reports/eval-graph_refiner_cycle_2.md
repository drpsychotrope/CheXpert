# Refiner cycle 2 — eval-graph (polish + cross-axis)

- P5: No charting lib in the stack — mandate **inline SVG** (no dependency, no license/bundle creep) → §4.2 + **AP-CHESS-36**. (auto-applied)
- P6: `explainPly` works for ANY ply, not just player mistakes → the selected critical moment (even an opponent swing) can show an explanation. Confirmed; §4.3 uses it directly.
- P7: Per-phase ACPL must read `result.byPhase[phase].acpl` (no recompute) → AC#6 + **AP-CHESS-35** scope clarified. (auto-applied)
- P8: Accuracy-grade prohibition needs a hard acceptance gate, not just prose → added AC#3 + **AP-CHESS-32**.

## Cross-axis
- §4 ↔ §8: every Phase-A item has a matching acceptance gate. §6 adds a grep gate for "no engine import / no new package / no 'Accuracy' string".

## Counters
critical 0, polish 4. Skip-3 would trigger; overridden (user wants 4).
