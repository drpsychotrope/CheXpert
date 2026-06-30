# Improvements — coach-intake-metacognition (C5)

**Pipeline**: `/enrich` 3 cycles, 8-axis sweep → FOLD / DEFER / REJECT. **Date**: 2026-06-30.
**Runs AFTER** `/draft-general` arbitrages (Q-A..Q-D = a). Anti-fabrication: an empty axis is
reported **CLEAN** (a finding is added only when real); the FOLD set is a SET, it does not grow
to hit a count.

> Cycle cadence: C1 swept all 8 axes (6 candidate findings). C2 pruned (2 REJECT, 1 DEFER) and
> tightened the survivors. C3 = conditional/honesty hardening only (no new FOLD). Diminishing
> returns after C2; C3 added wording, not scope.

## 8-axis sweep

| # | Axis | Finding | Verdict |
|---|---|---|---|
| E1 | **Capability gap** | The intake goal is collected but, if the user later re-runs the assessment from Settings, the goal is lost (re-asked each time). Persist `goal` on `coachProfile` AND seed the picker's default from `coachProfilePrev.goal` so a returning user sees their last goal pre-selected (still changeable). | **FOLD** |
| E2 | **Observability / honesty** | The calibration sentence (Q-C) must carry the SAME sample-size honesty as Insights — show it ONLY above the floor and phrase it descriptively. Add the explicit anti-fabrication clause: below floor ⇒ no line; never synthesize a verdict. Also: when the goal is `fix-blunders` but metacog is OFF, add a gentle one-time hint ("enable confidence check-ins to coach this") rather than silently dropping the goal's main lever. | **FOLD** |
| E3 | **Render fidelity** | The leverage step (Q-D) and any goal-added step must be visually distinguishable from remediation steps in the result list (e.g. a "leverage"/"your goal" tag), so the user understands WHY a strength-based step appears in a weakness program. Additive label via existing `programItemMeta` pattern. | **FOLD** |
| E4 | **Robustness** | Goal weighting must be **idempotent and total**: an unknown/legacy `goal` value (or `undefined`) falls through to today's weakness-first plan unchanged; `applyGoalWeighting` never drops or duplicates a step (assert `out.length >= in.length`, same set of weakness steps). Guards the additive-optional contract and old profiles. | **FOLD** |
| E5 | **Reuse** | `leverageStepFor(strength)` and the goal→focus map should reuse the EXISTING `scenarioForFocus` (program.ts:19) and the existing activity vocabulary rather than introducing parallel scenario ids. Keeps one source of truth for focus→scenario. | **FOLD** |
| E6 | **Extensibility** | Make `CoachGoal` a closed exported union + a single `GOAL_WEIGHTS`/`goalPlan` table (goal → {floatFocus, ensureStep}) so a 5th goal is a one-line table addition, not scattered conditionals. Mirrors `SELF_TAGS`/`COACH_MOTIF_PROBES`. | **FOLD** |
| E7 | **Symmetry** | The coach result surfaces metacog coaching (Q-C); for symmetry the same one-liner could also appear contextually elsewhere (e.g. after a coached session). | **DEFER** (belongs to C7 closed-loop / a session-result PR, not C5 intake). |
| E8 | **Honest framing** | C5 must NOT let the goal override measured weaknesses, and the metacog line must stay "where to focus" not a grade. Bake AP-CINTAKE anti-patterns: no goal hard-override, no calibration grade, no fabricated coaching on thin data, no DB bump, C5≠C7 routing. | **FOLD** (as anti-patterns, not a feature) |

## Verdicts

### FOLD (6) — integrated into the V1 spec
| ID | One-line | Axis | Where folded |
|---|---|---|---|
| E1 | Persist `goal`; pre-select from `coachProfilePrev.goal` on re-run | capability gap | §2, §4 (A-intake + commit), §8 AC |
| E2 | Calibration line sample-gated + metacog-OFF hint for `fix-blunders` | observability/honesty | §4 (result), §9 AP-CINTAKE-3/4 |
| E3 | Tag leverage / goal-added steps so they read as intentional | render fidelity | §4 (result list), §5 tests |
| E4 | `applyGoalWeighting` total + idempotent; unknown goal ⇒ unchanged plan | robustness | §4 (program), §5 tests, §9 AP-CINTAKE-5 |
| E5 | Reuse `scenarioForFocus` + existing activities for leverage step | reuse | §4 (program) |
| E6 | Closed `CoachGoal` union + single goal table | extensibility | §4 (types + program), §9 AP-CINTAKE-2 |
| E8 | Anti-pattern set (no override / no grade / no fabrication / no bump / C5≠C7) | honest framing | §9 |

### DEFER (1)
- **E7** — metacog one-liner after a coached session → **C7** (closed-loop efficacy) or a session-result PR. Out of C5's intake/result scope.

### REJECT (2, pruned in cycle 2)
- **Goal-specific puzzle difficulty tuning** (e.g. `target-rating` raises ladder difficulty) — REJECT: changes the diagnostic measurement, contaminating the profile (the ladders must measure true level, not a goal-biased one). Violates AP-COACH-2 honesty. The goal steers the PROGRAM, never the MEASUREMENT.
- **A numeric "calibration score" in the coach** — REJECT: AP-META-1 / AP-COACH-2 forbid a grade. The readout is descriptive only.

## Anti-fabrication ledger
- Axes with NO genuine finding: none were padded. E7 was a real idea but wrong-PR (DEFER), not folded.
- The two REJECTs are recorded as guards, not folded as features.
- Net FOLD set = **6** (held flat across C3; C3 hardened wording only).
