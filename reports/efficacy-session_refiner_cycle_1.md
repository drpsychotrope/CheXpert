# Refiner — `efficacy-session` cycle 1

**Date:** 2026-06-02 · Reviewer pass over `specs/efficacy-session-spec.md` (draft-general §4).
Method: adversarial check vs (a) doctrine, (b) the authoritative data-model contract, (c) the **actual**
code signatures read from `src/`, (d) draft-general's required section set + single-concern rule.

## Verdict: PASS with 5 defects (1 critical-doc, 4 polish). No structural blocker. → proceed to cycle 2.

## Critical / correctness

- **C1 (correctness, MUST-FIX-IN-SPEC) — existing `db.test.ts` hard-asserts `DB_VERSION === 4` and an
  exact store enumeration.** [src/store/db.test.ts](../src/store/db.test.ts) lines 17-19 assert
  `expect(DB_VERSION).toBe(4)` and `expect([...db.objectStoreNames].sort()).toEqual([...10 stores])`.
  If Q-B=a (v5 + `sessions`) is chosen, this test **will fail** and is part of the change's blast radius —
  the spec's Phase B / pre-flight must name it so the implementer updates the assertion + adds `sessions`
  to the enumeration. The draft's §5.3 mentions mirroring db.test setup but does not flag that the
  *existing* assertions change. → **FIXED:** added a pre-flight gate note (§3.5) + §5.3 line.
  *(Spec-doc fix only; I do not touch the test — implementation does.)*

## Polish

- **P1 — `runAnalysis` import path unverified at draft time.** Now confirmed: `loadAllAnalyses` is
  exported from [src/analysis/runAnalysis.ts](../src/analysis/runAnalysis.ts) (line 85). Link is correct;
  no change beyond keeping the existing reference. ✓ (no-op, recorded for traceability).
- **P2 — Reflection step `minutes: 0.5` vs `totalMinutes` sum.** A fractional 0.5 in `totalMinutes`
  renders as e.g. "30.5 min". → clarify the UI rounds the displayed total and the reflection is shown as
  "~20s", while the core keeps the precise number for determinism. Cheap copy fix in §4.1/§4.3.
- **P3 — Q-F "Review block" depends on due cards, which the pure core can't see.** The core reserves the
  slot (`includeReview`), but whether Review is *useful* depends on `dueCount(now)` — a UI/async concern.
  The draft already says "driven by due-card availability at the UI boundary"; tighten to: the UI passes
  `includeReview: (await dueCount(now)) > 0`. Keeps the core pure. → clarified in §4.3.
- **P4 — §0.5 split recommendation should state the *ordering* consequence concretely.** Draft says "ship
  6b first". Make explicit *why it's safe*: 6b is zero-schema/zero-nav (only an Insights panel + one pure
  module), so it cannot regress nav or DB and de-risks the larger 6a. → one clause added to §0.5/Q-A.

## Confirmed solid (no change)

- **Data-model contract honored.** Spec treats `sessions` as the sole v4→v5 bump, makes it conditional,
  and offers the derive fallback — exactly the scan's "justify the store or drop it" mandate. Field-adds
  elsewhere (none needed here) correctly wouldn't bump.
- **Purity doctrine.** Both cores forbid `Date`/random (AP-ES-8), inject `now`/ids at the boundary, match
  the `studyPlan.ts`/`fingerprint.ts`/`SrsStore.ts` precedent.
- **No-LLM honesty.** Reflection is store+display-only (AP-ES-6); efficacy is descriptive with a
  spec-fixed verbatim caveat (AP-ES-4) echoing the README — no causal claim.
- **Reuse over reimplementation.** Runner launches existing trainers via the established signal-flag
  pattern; shared `leakKey`/`drillLeak` reuse prevents drift (AP-ES-1/2/5). Nav constraint (one view at a
  time, no overlay) correctly surfaced as the Q-E orchestration arbitrage rather than hand-waved.
- **Signatures match source.** `buildStudyPlan(leaks, weakest, minutesPerDay)` (single-day), `Leak`/
  `PlanItem`/`TrendPoint` shapes, `loadAllAnalyses`, `View` union, `clearAllData` (iterates all stores) —
  all verified against the files, not assumed.
- **Section set complete.** §0..§11 present; AP-ES-N prefix used; §7 specifies (not appends) ADR-0039;
  §0.5 raises the bundling/single-concern tension as instructed.

## Delta vs nothing: ~1 correctness-doc + 4 polish = within tolerance; cycle 2 will recheck C1's fix +
sweep wording. Not stopping early (cycle 1 had a correctness finding).
