# Refiner cycle 1 — coach-mode (critical defect detection)

**Premise verdict: VALID — no STOP.** Every reused symbol exists with the assumed API
(`_target_exists.json`), the integration path is real (`Session.svelte` RESUMES on a pre-set
`app.activeSession`), and the game→analysis path is real (`runAnalysis(source:'played')`). No scope
obsolescence, no stale path, no foundation contradiction. Baseline sanity check PASS.

## Critical defects (would STOP the spec)
None.

## Non-critical patches (propagated to cycle 2, applied to V1)

| # | Defect | Severity | Patch |
|---|---|---|---|
| C1-1 | **Theme-vocabulary mismatch.** Probe keys must exist in `puzzle.themes` (Lichess vocab), not the internal `motif.ts` tag vocab. A key like `mate` that doesn't match could make a probe silently return 0 puzzles and read as a false weakness. | High | Added §3 theme-vocabulary pre-flight gate + A2 n=0 guard + A7 empty-theme skip. Keys chosen to match `weakness.ts:TACTICS_THEMES`, which already uses these as puzzle filters. |
| C1-2 | **n=0 probe division/scoring.** A motif with no in-band puzzle would yield `n=0`; ranking/aggregate must exclude it. | High | A2: `probes.filter(p => p.n>0)` before any scoring; empty → honest "not enough data" profile. |
| C1-3 | **`scenarioForFocus` undefined.** A8 referenced it without definition → ambiguous executor behaviour. | Med | A8: defined as a deterministic focus→`IMBALANCE_LIBRARY` id map (endgame→rook-up, opp-castle, default iqp). |
| C1-4 | **Comeback empty for fresh users.** `comebackPositions(loadAllAnalyses())` is empty with no history → resilience step dead-ends. | Med | Captured as Q-C arbitrage (default: fall back to a Sparring imbalance) + AP-COACH-5. |

## Persisted-shape check
`CoachProfile` stores only plain data (`DimensionScore[]`, `MotifScore[]`, strings) → IndexedDB
structured-clone safe. `coach/types` imports only `DimensionScore` (no engine/Svelte) → no import
cycle through `db.ts`. PASS.

Cycle-1 non-critical count: 4. Proceed to cycle 2.
