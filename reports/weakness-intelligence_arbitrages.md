# Arbitrages: weakness-intelligence

## Critical defects
None.

## Decisions

### Q-A: Leak → activity mapping
- (a) Reuse `drillTarget(dimension)` + a motif→theme table (recommended) — consistent with the dashboard routing, no parallel logic.
- (b) Bespoke per-leak mapping with finer rules.
**Reco: (a).**

### Q-B: Trend windowing
- (a) Rolling windows by game-count (e.g. blocks of 5 analysed games) (recommended) — stable regardless of play cadence.
- (b) Calendar windows (per week) — intuitive but noisy when play is sparse.
**Reco: (a)** (UI can offer (b) later).

### Q-C: Insights entry point
- (a) Dashboard link + a nav button (recommended) — discoverable; it's a primary coaching surface.
- (b) Dashboard link only (no nav clutter).
**Reco: (a).**

## Auto-applied
Confident-motif-only clustering (AP-CHESS-48); recompute trend (no store); deterministic plan (no Date); leak/sample caps; low-data flags (AP-CHESS-50); reuse EvalGraph SVG for trend.

## Stop status
3/3 cycles; decreasing returns (polish-only past cycle 1). Spec `specs/weakness-intelligence-spec.md`. ADR-0027.

## Next steps
Reply e.g. `A: Q-A a, Q-B a, Q-C a` (or `A: all reco`).
