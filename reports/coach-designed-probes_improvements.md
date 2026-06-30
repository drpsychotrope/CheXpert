# C3 — coach-designed-probes · Enrichment (/enrich, 3 cycles, 8-axis)

**Discipline**: FOLD (integrate) / DEFER (good idea, wrong PR) / REJECT (violates scope/honesty/causality).
**Anti-fabrication**: empty axis = CLEAN (not a forced finding). The set is **pruned, not grown** (8 candidates → 1 REJECT, 1 DEFER, **4 FOLD**).

## Cycle log
- **Cycle 1 (sweep 8 axes)**: surfaced 6 candidates (E1–E5 + reuse=CLEAN, honest-framing=already-Q-C).
- **Cycle 2 (prune)**: REJECT E1 (separate win/loss success gate — violates honesty/no-grade; the ACPL-derived dimension score already IS the directional outcome). Its one useful grain (a per-probe ply cap) folds into the spec body, not a finding.
- **Cycle 3 (conditional)**: confirmed E4 (registry) is just Q-B's two seeds expressed as data (no conflict); set stayed at 4 — pruning held, no growth.

## FOLD (4 — integrated into V1)

| ID | Axis | Finding | Fold |
|---|---|---|---|
| **E2** | Observability | After a probe, the radar cell is a black box — the user can't tell a designed-probe reading from a game reading from "not measured." | `CoachProfile.source` gains a `probes?: boolean` flag (additive, mirrors `{ladders, game}`); the probe's `DimensionScore.detail` NAMES the designed position ("from a designed rook-up endgame" / "depuis une finale de tours conçue"). Renders through the EXISTING radar `detail`+sampleSize — no radar redesign. → spec §4 A3, §0.5 provenance, bilingual keys. |
| **E3** | Robustness | Engine failure mid-probe (the even game has `try/catch`+`finishWithoutGame`, Coach.svelte:173/177) — a probe must not crash or emit a garbage cell. | A failed/aborted probe leaves its axis "not measured" (sampleSize 0, neutral 50) exactly as today, and surfaces nothing false. Mirror the existing `catch`. Each probe is capped at a sane ply limit (reuse GAME_MOVE_LIMIT-style bound) so a non-converting rook-up can't run forever. → spec §4 A2, §9 AP-CDESIGN-3. |
| **E4** | Extensibility | Hard-coding two seeds inline makes a third probe (e.g. opening) a code change. | A small PURE table `COACH_PROBES: { dimension, seed (Scenario or seed id), targetDimension }[]` — V1 holds exactly the two Q-A entries (conversion→rook-up, resilience→coach:defend-worse), but adding a probe later is DATA. Lives beside scenarios.ts (pure, FEN-validated in tests). → spec §4 A1. |
| **E5** | Symmetry | `rook-up` is White-to-convert; a Black-side player would only ever probe conversion from White. | The probe offers a **side-appropriate** seed: respect the existing ColorPicker/`coachSide` (Coach.svelte:44-45,131) and mirror the FEN for the other color so conversion/resilience are probed from the player's side. Pure FEN-mirror helper, tested. → spec §4 A1/A2, §5 test. |

## DEFER (1)

| ID | Axis | Finding | Why DEFER |
|---|---|---|---|
| **E6** | Render fidelity | The radar could visually mark each axis by evidence type (designed-probe vs game vs ladder vs not-measured) — e.g. a distinct ring/badge. | Radar visual treatment is **C6 (Output & teaching)**'s remit, not C3's single concern. C3 supplies the honest `detail`+`sampleSize`+`source.probes` so C6 can render the distinction later. Folding a radar redesign here breaks single-concern. |

## REJECT (1)

| ID | Axis | Finding | Why REJECT |
|---|---|---|---|
| **E1** | Capability gap | Add an explicit probe "success criterion" (converted? held?) → a win/loss/pass verdict per probe. | Violates the **honesty doctrine** (directional, no grade — AP-CHESS-13/24). The probe's outcome is the ACPL-derived `DimensionScore` from `buildWeaknessProfile` (conversion = endgame-phase accuracy; resilience = recovery rate from the engineered behind-position) — a directional score, not a pass/fail. A binary verdict would be a fabricated grade on n=1. The only useful grain (bound the probe's length) is kept as a ply cap in §4, not as a verdict. |

## Net effect on V1
4 FOLD integrated (E2 provenance, E3 graceful-skip+ply-cap, E4 probe registry, E5 color symmetry). 1 DEFER → C6. 1 REJECT (no fabricated grade). No FOLD adds a store, a DB_VERSION bump, an ADR, or touches the rating pool / Insights.
