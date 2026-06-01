# Arbitrages: practice-mechanics

## Critical defects
None. (Scope: recommend split into 3 PRs — Q-A.)

## Decisions

### Q-A: Split into 3 PRs?
- (a) Split 3a calculation / 3b vision / 3c scheduler (recommended) — single-concern, independently shippable.
- (b) One PR.
**Reco: (a).**

### Q-B: Calculation grading
- (a) Line matches the top PV prefix move-for-move, OR the line's end-eval ≥ winning threshold (recommended) — accepts alternative wins, not just the engine's exact line.
- (b) Strict: must equal the engine PV exactly.
**Reco: (a).**

### Q-C: Vision drill set + timer
- (a) Three timed tasks (all checks / all captures / all hanging), ~20–30s each, alongside existing colour/knight (recommended).
- (b) Only "hanging pieces" (the highest-transfer one) to start.
**Reco: (a).**

### Q-D: Auto lapse-Woodpecker trigger
- (a) On-demand button "Build a set from my misses" (recommended) — no surprise sets; namespaced id, never clobbers.
- (b) Auto-create/refresh after each session.
**Reco: (a).**

## Auto-applied
Board read-only during calc input (AP-CHESS-54/55); hanging requires net-winning capture (AP-CHESS-56); interleave bounded to due set (AP-CHESS-57); namespaced lapse-set id (AP-CHESS-58); calc positions from personal-first selection.

## Stop status
3/3 cycles; decreasing returns. Spec `specs/practice-mechanics-spec.md`. ADR-0029 (or 0029-0031 if split).

## Next steps
Reply e.g. `C: all reco`.
