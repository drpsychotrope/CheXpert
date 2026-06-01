# Arbitrages: openings

## Critical defects
None.

## Decisions

### Q-A: ECO data footprint
- (a) Full named set (~3500 lines) as compact JSON (recommended) — best coverage, still small gzipped.
- (b) Curated subset (mainlines only) — smaller, but "unknown opening" more often.
**Reco: (a).**

### Q-B: Explorer depth in v1
- (a) Name + immediate book continuations only; no game stats (recommended) — offline, no stats DB; stats explorer is §11.
- (b) Include frequency/win-rate stats now — needs a bundled stats DB (bigger).
**Reco: (a).**

### Q-C: "Add to repertoire" seed
- (a) Seed the in-book prefix you played, stop at your deviation (recommended) — you add the line you should have known.
- (b) Also append the engine's better next move (needs analysis present).
**Reco: (a)** (b as a later enhancement when an analysis is loaded).

## Auto-applied
Longest-prefix naming (AP-CHESS-51); bundled JSON not raw TSV (AP-CHESS-52); chess.js-validated ETL (AP-CHESS-53); transposition limitation documented; stats explorer deferred.

## Stop status
3/3 cycles; decreasing returns. Spec `specs/openings-spec.md`. ADR-0028.

## Next steps
Reply e.g. `B: all reco`.
