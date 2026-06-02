# Refiner — `efficacy-session` cycle 2

**Date:** 2026-06-02 · Re-review of `specs/efficacy-session-spec.md` after cycle-1 fixes.
Method: verify each cycle-1 finding is closed; sweep for new defects (internal consistency, doctrine,
contract, draft-general section set).

## Verdict: PASS — 0 critical, 2 trivial polish (≤8). → **STOP; skip cycle 3** (stop condition: cycle 2
had 0 critical defects AND polish ≤ 8). Spec is V1.

## Cycle-1 findings — all closed
- **C1 (db.test version assertion)** → CLOSED. §3.5 now states the v5 blast radius (db.test.ts lines
  17-19: `DB_VERSION` assertion + 10-store enumeration both change); §5.3 unchanged-but-correct. Spec
  flags it as implementation-time work; no test edited by the drafter (per task constraint). ✓
- **P1 (loadAllAnalyses path)** → CLOSED (verified, link correct). ✓
- **P2 (reflection 0.5 / total display)** → CLOSED. §4.1 + §4.3 now: core keeps `0.5`, UI shows "~20s"
  and rounds the displayed total. ✓
- **P3 (Review slot vs due cards)** → CLOSED. §4.3 now passes `includeReview: (await dueCount(Date.now())) > 0`,
  keeping the core free of due-queue I/O. ✓
- **P4 (split ordering rationale)** → CLOSED. §0.5 now states *why* 6b ships first (zero-schema/zero-nav,
  can't regress DB/nav). ✓

## New sweep — findings
- **P5 (trivial) — `dueCount` import surface.** §4.3 references `dueCount` from
  [SrsStore](../src/srs/SrsStore.ts); confirmed exported there (`dueCount(now, kind?)`). Signature
  matches the spec's usage (`dueCount(Date.now())`). No change needed; recorded for traceability.
- **P6 (trivial) — `SessionStepKind` superset note.** `PlanItem.activity` (`tactics|endgames|repertoire|comeback|vision`)
  is a strict subset of `SessionStepKind` (adds `review`, `reflection`). Spec §4.1 states this ("the
  PlanItem.activity union is a subset"), so the mapping is total and type-safe — no defect, just noting
  the type relationship holds. No change.

## Re-confirmed solid
- Two-core purity (AP-ES-8), no-LLM reflection (AP-ES-6), descriptive efficacy + verbatim caveat
  (AP-ES-4), reuse-not-reimplement (AP-ES-1/2/5), single-store-or-derive contract compliance (AP-ES-9),
  nav-constraint surfaced as Q-E rather than hand-waved.
- All external references verified against `src/`: `buildStudyPlan`/`buildFingerprint`/`weaknessTrend`/
  `loadAllAnalyses`/`dueCount`/`clearAllData`/`View` union/`drillTarget`/`SrsCardRecord` precedent.
- §0..§11 complete; AP-ES-N prefix; §7 *specifies* ADR-0039 (new AP-CHESS range ≥ 68 at impl time).
- §0.5 raises the bundling/single-concern arbitrage + recommends the split, as instructed.

## Decreasing-returns check
Cycle 1 → cycle 2 delta: 1 correctness-doc + 4 polish → 0 critical + 2 trivial (recorded, no edit).
Delta < 10% material change; remaining items are no-ops. Decreasing returns reached → stop at 2 cycles.
