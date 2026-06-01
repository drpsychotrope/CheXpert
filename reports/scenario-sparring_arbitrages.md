# Arbitrages: scenario-sparring

## Critical defects
None.

## Decisions

### Q-A: Scenario sources
- (a) Both: a curated imbalance library AND "from my games" (fingerprint leak FENs) (recommended) — library works standalone, weakness-source adds personalisation.
- (b) Imbalance library only.
- (c) Weakness-sourced only (hard dep on A).
**Reco: (a)** (degrades to library if A unshipped).

### Q-B: Grading
- (a) Outcome vs the adaptive bot (win or hold = pass), as comeback (recommended) — no extra eval cost.
- (b) Eval-improvement probe.
**Reco: (a).**

### Q-C: Entry point
- (a) From Insights + a nav button (recommended).
- (b) From Insights only.
**Reco: (a).**

## Auto-applied
Legal/side-checked FENs (AP-CHESS-59); ZPD Elo (AP-CHESS-60); standalone library, empty weakness-source if no A (AP-CHESS-61); per-scenario goal text.

## Stop status
3/3 cycles; decreasing returns. Spec `specs/scenario-sparring-spec.md`. ADR-0030.

## Next steps
Reply e.g. `D: all reco`.
