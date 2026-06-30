# Arbitrages — coach-intake-metacognition (C5)

**Pipeline**: `/draft-general` 4 refiner cycles. **Drafted**: 2026-06-30.
**Pre-V0 scan**: PASS (`reports/coach-intake-metacognition_{target_exists,baseline,collision}.json`).
**Status**: defaults **APPLIED** to the V1 spec body (additive-optional doctrine). Ratify or override.

> Diminishing-returns note: cycle 1 surfaced the four real decisions (Q-A..Q-D) + two
> structural corrections; cycle 2 added the C5↔C7 boundary guard (Q-B scope) and the
> metacog-gate fact (Q-C); cycle 3 only hardened wording (no new arbitrage, delta < 10%);
> **cycle 4 skipped** (0 critical defects, polish ≤ 8). Stop early per skill rule.

---

## Structural corrections applied pre-cycle-2 (from the scan, not arbitrages)

1. **`buildCoachProgram` is 3-arg** `(profile, minutes=30, locale='fr')`, not 2-arg. The new goal
   param is appended as a 4th optional arg — never reorders the existing signature.
2. **Coaching data is already bilingual & pure.** `calibration()` + its readout/labels ship FR/EN
   and are rendered in Insights. C5 adds **zero** new metacog math; it surfaces the existing core.
3. **Metacog is opt-in** (`settings.metacogEnabled`). The coaching line inherits that gate.

---

## The four arbitrages

### Q-A — Intake step: content & shape
**Decision: a short, OPTIONAL 3–4 option goal picker shown once before the ladders.**

| Opt | Choice | Trade-off |
|---|---|---|
| **a (DEFAULT)** | A new `goals` step (before `ladders`): pick 1 of **target-rating · fix-blunders · opening-prep · time-trouble**, plus a **"Skip / just assess me"** escape. Stored as `CoachProfile.goal?` (optional). | Honours "coach the player"; one tap; fully skippable so the zero-friction infer-everything path still exists. |
| b | No intake; infer the goal from the worst dimension only. | Keeps today's behaviour; but the whole point of C5 is to ASK — rejected as defeating the feature. |
| c | Free-text goal. | Unparseable, can't steer the program deterministically, i18n-hostile. Rejected. |

**Why a**: closed 4-option set maps deterministically onto the existing program routing (no NLP);
"Skip" preserves the additive-optional posture (a fresh user can ignore it entirely).
Goal taxonomy is a **closed union** (`CoachGoal`), mirroring `SELF_TAGS` (AP-META-2 discipline).

### Q-B — How the goal steers the program
**Decision: SOFT weighting on top of weakness-first — re-order/boost, never replace.**

| Opt | Choice | Trade-off |
|---|---|---|
| **a (DEFAULT)** | The goal **re-orders** the existing weakness-first plan and may **add one goal-aligned step** if the matching area isn't already covered. Weakness-first remains the spine. E.g. `time-trouble` floats the `focus:'time'` tactics step to the top; `opening-prep` ensures a `repertoire`+`play-steered` pair exists; `fix-blunders` boosts the metacog/calibration surface + tactics; `target-rating` = today's behaviour (no reweight). | Respects honesty (still targets real weaknesses) AND the user's stated intent. Thin layer C7 can later refine. |
| b | Goal HARD-overrides: program = only the goal area. | Dishonest (ignores measured weaknesses); collides with C7's routing remit. Rejected. |
| c | Goal shown but ignored (cosmetic). | Pointless. Rejected. |

**Why a + boundary guard**: C7 (Program v2) owns mastery/efficacy/time-budget routing. C5's
weighting is a deliberately **thin re-ordering pass** (`applyGoalWeighting(plan, goal)`) layered
*after* `buildCoachProgram` builds the weakness-first plan, so C7 can supersede it without a rewrite.
Recorded in spec §0 + **AP-CINTAKE-6**.

### Q-C — Metacognition / calibration coaching surface
**Decision: ONE descriptive, honesty-framed line in the result, ONLY when there's enough data AND metacog is enabled.**

| Opt | Choice | Trade-off |
|---|---|---|
| **a (DEFAULT)** | In the `result` step, if `settings.metacogEnabled` AND `calibration(attempts).readout` is non-null (≥ `minReported` reported attempts), render **one** descriptive sentence derived from the existing readout — e.g. the verdict + the top self-tag cause ("Your misses cluster on *rushed* — slow down on the ones you feel sure about"). Uses the SAME `calibration()` core Insights uses; no new math. If below floor or opted-out → render nothing (no nag). | Closes CO14 with the existing pure, bilingual core; honest (descriptive, sample-gated); silent when thin. |
| b | Full calibration table in the coach (duplicate Insights). | Duplication; the coach result is a summary, not the Insights dashboard. Rejected (DEFER the table to Insights). |
| c | Always show a line, even with 1 attempt. | Violates the sample-size floor / honesty. Rejected. |

**Why a**: the readout is **already computed and gated** for Insights; C5 reuses it verbatim and adds
**one** coach-voiced sentence keyed off `readout.verdict` + `readout.topCause`. Anti-fabrication:
no data ⇒ no line (CLEAN), never a fabricated "you're well calibrated" on an empty set.

### Q-D — Strength-leverage step
**Decision: ONE optional leverage step appended to the program when a clear strength exists.**

| Opt | Choice | Trade-off |
|---|---|---|
| **a (DEFAULT)** | If `profile.strengths` is non-empty (a motif delta ≥ +40 or a dim ≥ 65), append **one** "play to your strength" step (e.g. strong tactics → an attacking `play-steered`/`sparring` step; strong endgame → a conversion `endgames` maintenance step), with a coach-voiced reason. Capped at **one** step; only if the program has budget left. | Closes CO18 (strengths finally acted on, not just a checkmark); one step keeps the program weakness-dominated. |
| b | Two+ leverage steps / a full "strengths program". | Dilutes the weakness focus; the coach's job is mostly remediation. Rejected. |
| c | No leverage step (keep strengths display-only). | Leaves CO18 unaddressed — the explicit C5 goal. Rejected. |

**Why a**: maps the **top** strength to a single deterministic step via a small
`leverageStepFor(strength)` helper (mirrors `scenarioForFocus`). Budget-gated and capped at one, so
the program stays "patch weaknesses first, then leverage one strength."

---

## Defaults summary (APPLIED to the V1 spec)

| Q | Default | One-line |
|---|---|---|
| Q-A | **a** | Optional closed 4-goal intake step + Skip; stored as `CoachProfile.goal?`. |
| Q-B | **a** | Soft goal weighting (re-order + ≤1 goal step) layered after weakness-first; C7-safe. |
| Q-C | **a** | One descriptive calibration sentence, gated by `metacogEnabled` + sample floor. |
| Q-D | **a** | One optional strength-leverage step when a clear strength exists + budget remains. |

## ADR posture
**No new ADR by default.** C5 extends ADR-0045 (coach) + ADR-0037 (metacog) + ADR-0053 (bilingual),
all additive-optional. **Flag ADR-0059** (first free; 0054-0058 reserved) ONLY if PR-time review
deems goal-weighting an architectural decision — default is a `decisions.md` note, not a new ADR.

## Open decisions for the user
1. Ratify Q-A..Q-D defaults (all **a**), or override any.
2. Confirm goal taxonomy wording: `target-rating · fix-blunders · opening-prep · time-trouble` (+ Skip).
3. Confirm ADR posture: note-only (default) vs pre-allocate ADR-0059.
