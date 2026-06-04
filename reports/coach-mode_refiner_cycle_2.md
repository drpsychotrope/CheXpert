# Refiner cycle 2 — coach-mode (polish + cross-axis)

Integrates cycle-1 patches; checks integration consistency, cross-references, measurability, reproducibility.

## Critical defects
None.

## Cross-axis findings (applied to V1)

| # | Finding | Action |
|---|---|---|
| C2-1 | **Union widening vs exhaustive switch.** Widening `PlanItem.activity` / `SessionStepKind` could break an existing exhaustive `switch`/`never` check → `svelte-check` failure. | Added §3 exhaustiveness pre-flight gate. Verified current consumers are non-exhaustive `Record` maps (`TRAINER_VIEW`, `activityForLeak`) and `drillTarget` switches on `Dimension` (not `activity`) → safe. |
| C2-2 | **`buildCoachProgram` called twice in A7** (render + Start session) → risk of two different lists if inputs drift. | Noted: compute once, reuse for both the rendered list and `buildSession`. |
| C2-3 | **Insights regression surface.** Cross-checked AP-COACH-1: `buildStudyPlan` never emits `sparring`/`play-steered`; union widening is type-only. Insights output byte-identical. | Confirmed; gate in §6 ("no prior test regressed") covers it. |
| C2-4 | **`buildSession` passthrough.** Verified `session.ts:53` does `kind: item.activity` and `tacticsRouting` only special-cases `'tactics'` → new kinds pass through with no logic change. | Confirmed; A4 states "no logic change beyond the union". |
| C2-5 | **Measurability of acceptance gates.** §8 criteria each have a concrete ✅ check; §6 gates are runnable commands. | PASS. |
| C2-6 | **Reproducibility.** A fresh executor can run the spec: ordered phases, pure cores test-injectable, manual smoke path explicit. | PASS. |

## Polish count: 6 (C2-1..C2-6). Critical: 0.

## Cycle-3 skip evaluation
```
skip_cycle_3 = (cycle_2_critical_count == 0) AND (cycle_2_polish_count <= 8)
             = (0 == 0) AND (6 <= 8)
             = TRUE
```
→ **Skip cycle 3.** Residual items are wording/consistency nits, not premise or structural risks.
See `coach-mode_cycle_3_skipped.json`.
