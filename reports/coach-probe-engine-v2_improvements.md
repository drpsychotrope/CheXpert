# Improvements (enrich) — coach-probe-engine-v2 (C2)

**Method**: `/enrich` 3 cycles, 8-axis sweep over the drafted V1. Verdicts: **FOLD** (into spec) /
**DEFER** (good, wrong PR) / **REJECT** (violates scope/causality/doctrine). Anti-fabrication: an axis
with nothing genuine is marked **CLEAN** — the set is *not* padded to look thorough.

Coherent precedents cited are **this repo's**: F3's AP-ATTEMPT isolation, ADR-0045 pure-core split,
audit v2 L17 honest n/a axes, the ETL raw-theme passthrough, AP-COACH-1/2/6/8.

---

## Cycle 1 — broad sweep (8 axes)

| Axis | Finding | Verdict | Disposition |
|---|---|---|---|
| **Capability gap** | Endgame fallback chain was under-specified: what if *some* but not all buckets are empty? | **FOLD** | §4.A2: per-bucket `n=0` drop; only if **all** empty, fall back to one coarse `phase:endgame` probe. |
| **Capability gap** | `minorPieceEndgame` is a C2 umbrella, not a Lichess key — needs an explicit mapping or it silently matches nothing. | **FOLD** | §4.A1: `minorPieceEndgame` → `themes:['knightEndgame','bishopEndgame']` (ANY-of). Documented in `COACH_ENDGAME_BUCKETS` note. |
| **Observability** | Adaptive depth is invisible — a user/reviewer can't tell why a motif got 4 puzzles. | **FOLD (light)** | §6 manual check explicitly verifies "borderline >2, clear =2, total ≤ cap". (No telemetry surface — local-first; a visible per-motif n is already shown via sampleSize labels.) |
| **Render fidelity** | CO7 radar is already honest (L17) — risk of re-implementing it. | **FOLD as guard** | §0/§2 state the radar render is UNCHANGED; CO7 = the upstream skip nudge only. Prevents wasted work. |
| **Robustness** | Timed block with a too-small budget could yield a misleading 1-puzzle score. | **FOLD** | §4.A5 + AP-CPROBE-7: 0 attempts → `sampleSize:0` → n/a; the read is sample-size-labelled. |
| **Reuse** | The recording wire-up duplicates F3's A2 almost verbatim across new probe kinds. | **FOLD** | §4.A7 explicitly says "exactly F3's A2 pattern, extended to endgame buckets + timed" — reuse, not re-invent. |
| **Extensibility** | More endgame buckets (queen, opp-bishop) will be wanted later. | **DEFER → §11** | Keep ≤3 until production per-bucket counts are measured (length honesty). Logged as a follow-up. |
| **Honest framing** | CF6 win is invisible on the seed set — could be mistaken for "broken". | **FOLD** | baseline.json + spec §6 call it out as by-design degradation, not a bug. |

Cycle-1 FOLD count: **6** (+2 DEFER/guard already in scope). No REJECT yet.

---

## Cycle 2 — prune + adversarial pass

| Axis | Finding | Verdict | Disposition |
|---|---|---|---|
| **Symmetry** | Should the timed probe also feed a *tactics* speed read, not just `timeManagement`? | **REJECT** | Scope creep — `timeManagement` is the CO15 target; a tactics-speed axis is a new dimension (not in the 5-dim radar). Out. |
| **Capability gap** | Aggregator seam: a new required arg to `buildCoachProfile` would break call sites + tests. | **FOLD** | §4.A5 makes `timedDim?` **optional**; existing calls stay valid and byte-identical when absent. AP-CPROBE-8. |
| **Robustness** | Adaptive depth + cap interaction: a late borderline motif could be starved by an early one eating the cap. | **FOLD (accept + document)** | §4.A3: cap is a hard global ceiling by design; first-come motifs may consume it. Acceptable for v1 (honesty > perfect fairness); noted so it's a conscious choice, not a bug. |
| **Reuse** | `probePlan.ts` vs the existing `THEMES` array — risk of two sources of truth. | **FOLD** | §4.A2/A4: `THEMES` is *replaced* by `buildProbePlan` output; the hard-coded array goes away (single source). |
| **Observability** | DEFER candidate: persist the chosen scope so a re-assessment remembers it. | **DEFER → §11/C1** | Needs a settings field; C2 stays schema-free. C1 (persistence) is the right home. |
| **Extensibility** | CLEAN — `ProbeSpec`/`ProbeKind` already make adding a probe kind a one-line addition. | **CLEAN** | No change; the shape is already open for extension. |
| **Honest framing** | CLEAN — AP-COACH-2 labels already enforced; timed read inherits them. | **CLEAN** | No change. |
| **Render fidelity** | CLEAN — no new chart; radar untouched. | **CLEAN** | No change. |

Cycle-2 FOLD count: **3** new; **1 REJECT**; **1 DEFER**; **3 CLEAN** (honestly empty, not padded).

---

## Cycle 3 — conditional / final

| Axis | Finding | Verdict | Disposition |
|---|---|---|---|
| **Robustness** | F3 coupling: spec must guarantee C2 ships if F3 slips. | **FOLD** | AP-CPROBE-9 + §3 gate + §4.A7 no-op branch. Already the strongest version. |
| **Reuse** | `resultToGrade` reuse for timed solves (don't invent a grade). | **FOLD (= Q-F)** | Confirmed in §0.5 Q-F; no new path. |
| **All other axes** | No new genuine findings — only re-statements of cycle 1-2. | **CLEAN** | **Stop. Returns < 10%.** The sweep is exhausted; further cycles would fabricate. |

Cycle-3 FOLD count: **2** (both already reflected). Confirms convergence.

---

## Final fold summary

**FOLD total: 11** distinct improvements folded into the V1 spec (counting deduped across cycles):

1. Endgame fallback chain (some-empty vs all-empty) — §4.A2 — *axis: capability gap*
2. `minorPieceEndgame` → real Lichess key mapping — §4.A1 — *axis: capability gap*
3. Adaptive-depth manual observability check — §6 — *axis: observability*
4. CO7 "radar already honest, don't re-implement" guard — §0/§2 — *axis: render fidelity*
5. Timed-budget too-small → n/a (not a fake score) — §4.A5/AP-CPROBE-7 — *axis: robustness*
6. Recording reuses F3's A2 pattern verbatim — §4.A7 — *axis: reuse*
7. CF6-invisible-on-seed-set honest framing — §6/baseline — *axis: honest framing*
8. `timedDim?` optional arg (no call-site break, byte-identity) — §4.A5/AP-CPROBE-8 — *axis: capability gap*
9. Cap-vs-borderline starvation accepted + documented — §4.A3 — *axis: robustness*
10. `buildProbePlan` replaces `THEMES` (single source of truth) — §4.A2/A4 — *axis: reuse*
11. F3-slip resilience (C2 ships regardless) — AP-CPROBE-9/§3 — *axis: robustness*

**DEFER: 3** — more endgame buckets (§11), persist chosen scope (C1), recency-weighted timed read (§11).
**REJECT: 1** — timed→tactics-speed axis (scope creep; new dimension).
**CLEAN: 6** axis-passes with no genuine finding (extensibility ×1, honest framing ×1, render fidelity ×1,
plus the cycle-3 sweep) — recorded as CLEAN, not inflated into pseudo-improvements.

**Net effect on scope**: the FOLD set *tightened* the existing five folds (CO4/CF6/CF7/CO7/CO15); it did
**not** grow C2 into new concerns. Every DEFER/REJECT was pushed out, honoring single-concern discipline.
