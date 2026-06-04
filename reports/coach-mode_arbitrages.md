# Arbitrages: coach-mode

## Critical structural defects (cycle 1 stops)
None. Premise valid — every reused symbol exists with the assumed API, the `Session.svelte` resume
path and the `runAnalysis` game→profile path are real. Spec is ready to execute pending the
decisions below.

## Decisions requested from user

### Q-A: Diagnostic game persistence
**Options**
- (a) Run the Stage-2 game through `runAnalysis(source:'played')` — persists a `gameAnalyses` row,
  generates personal puzzles, folds `weaknessCounters`. Makes the coach game feed the existing loop
  and seeds downstream Comeback/Sparring/Play-steer.
- (b) Ephemeral `analyzeGame` only — no history written; cleaner separation, but Comeback stays empty
  and nothing downstream is seeded.
**Refiner recommendation**: (a) — consistent with the app's "your games train you" doctrine and the
only way resilience→Comeback has any data on a fresh run.

### Q-B: Game-mode seeding depth
**Options**
- (a) Add `app.sparringScenarioId` + `app.steerDimension` signals so a program step auto-seeds the
  exact scenario / steering dimension (≈2 extra file touches: `Sparring.svelte`, `Play.svelte`).
- (b) Minimal — a program step only lands the user on the mode's picker; no new signals.
**Refiner recommendation**: (a) — "dédié à la correction" implies the program targets the *specific*
weakness, not a generic mode landing. Cost is small and additive.

### Q-C: Resilience → Comeback fallback
**Options**
- (a) When no comeback positions exist (no history), fall back to a resilience-style **Sparring**
  imbalance (`rook-up` / `opp-castle`).
- (b) Show "play and analyse a game first" and skip the step.
**Refiner recommendation**: (a) — avoids a dead-end step for new players (AP-COACH-5).

### Q-D: Per-motif ladder length
**Options**
- (a) `COACH_LADDER_MIN/MAX = 3/5` (~7 probes × ~4 = ~28 puzzles, ~6–9 min). Balanced signal.
- (b) `2/3` (~14–21 puzzles, faster, noisier deltas).
**Refiner recommendation**: (a) — 3–5 puzzles/theme is the floor for a non-laughable per-motif delta;
still under 10 min total.

## Auto-applied patches (no user input needed)
- n=0 / empty-theme probe guard in `buildCoachProfile` + wizard skip (cycle-1 C1-1/C1-2).
- `scenarioForFocus` defined as a deterministic focus→imbalance-id map (cycle-1 C1-3).
- Theme-vocabulary + exhaustive-switch pre-flight gates (cycle-1/2).
- "compute `buildCoachProgram` once" + Insights byte-identical confirmation (cycle-2).

## Stop status
- Cycles run: 2/3 (cycle 3 skipped — `cycle_3_skipped.json`)
- Stop reason: cycle-3-skip (0 critical, 6 polish ≤ 8)
- Final spec: `specs/coach-mode-spec.md` (V1)

## Next steps
1. Read the four decisions above.
2. Reply with choices, e.g. `Q-A: a, Q-B: a, Q-C: a, Q-D: a` (all defaults = reply "defaults").
3. I apply the chosen decisions as a final V1 patch (most defaults are already baked; only deviations need edits).
4. Spec is then ready to execute (→ `superpowers:writing-plans` for the implementation plan).
