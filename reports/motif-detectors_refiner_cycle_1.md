# Refiner cycle 1 — motif-detectors (critical premise validation)

## Critical defects
**None.** Premise valid:
- Path/symbol exist (`detectMotif` motif.ts:60). Not scope-obsolete.
- Baseline consistent with spec claims (only mate/hanging/fork today).
- ADR-0007 explicitly sanctions "taxonomy extends in later passes" → no source divergence; this IS the later pass.
- `MotifResult.confidence` has no `'medium'`; geometric-only at `'high'` needs no type change. Consistent.

## Non-critical patches → propagate to cycle 2
- P1: Pin vs skewer must disambiguate by `front`/`back` value ordering incl. king cases. (clarified §4.2–4.3)
- P2: `doubleCheck` should be composed as direct+discovered, NOT via chess.js `attackers()` (API uncertain in 1.4.0). (rewrote §4.5)
- P3: Need an explicit "clear ray" helper; reuse-or-add. (added §4.1)
- P4: Primary-tag precedence undefined when multiple detectors fire → **arbitrage Q-A**.

## Verdict
Proceed to cycle 2. 0 critical, 4 non-critical.
