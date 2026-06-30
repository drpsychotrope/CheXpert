# Arbitrages — coach-probe-engine-v2 (C2)

**Method**: PRE-V0 scan → `/draft-general` 4 cycles. Defaults are **applied** in the V1 spec; this bundle
is for user ratification. Diminishing returns hit at cycle 4 (wording only).

## Decisions (defaults applied in spec §0.5)

| # | Question | **Default applied** | Reverse only if… |
|---|---|---|---|
| **Q-A** | Adaptive-depth rule (CO4) | Extend a motif's ladder only while `\|delta\| ≤ 60` and RD loose, **capped at ~20 total puzzles** | …you want a flat-but-higher 3/3 (simpler, but longer for clear cases and still noisy on borderlines). |
| **Q-B** | Endgame buckets (CF6) | 2-3 buckets via real Lichess keys (`rookEndgame`, `pawnEndgame`, `minorPieceEndgame`), drop empty, report fallback | …you'd rather keep one coarse `phase:endgame` (loses the rook-vs-pawn distinction the whole fold is about). |
| **Q-C** | À-la-carte scope (CF7) | Checkbox areas, **default ALL**, empty → all | …you want it always-all (drops CF7 entirely) or pick-exactly-one (worse UX for "recheck everything"). |
| **Q-D** | Timed-probe design (CO15) | One short **timed block** (e.g. 90 s budget) feeding `timeManagement`, opt-in via scope | …you prefer a per-puzzle clock on every probe — rejected as default because it confounds motif deltas (AP-CPROBE-6). |
| **Q-E** | Recording isolation (× F3) | Record via F3's `recordTacticsAttempt`, **SRS + weaknessCounters only, NO pool** | …never (full-pool recording violates AP-COACH-8). Only open question is *whether* to record at all if F3 slips. |
| **Q-F** | Timed grade → FSRS | Reuse `resultToGrade(solved, ms)` (speed already in it) | …you want a distinct "timed" grade path (adds churn for no signal gain). |
| **Q-G** | Where adaptive/plan logic lives | New **pure** `probePlan.ts` (planner) separate from `diagnostic.ts` (aggregator) | …you'd inline in `Coach.svelte` (loses unit-testability; violates the pure-core doctrine). |

## The one decision that needs an explicit call: **build order vs F3**

C2 ◄ **F3** (`attempt-recording-weakness`), and **F3 is drafted but NOT built** (verified: `coachProbe`
absent from `src/`). Two viable paths:

- **(Recommended) Build F3 first**, then C2 records cleanly through it (Q-E as written). Matches the
  architecture DAG (Phase 0 foundations → Phase 2 C2).
- **(Fallback) Ship C2's engine first** with recording gated off (probes unpersisted, exactly as today —
  AP-CPROBE-9), and let F3 (or a C2 follow-up) wire recording later. C2's depth/buckets/scope/timed/nudge
  all stand alone and need no F3.

Either is consistent with the spec; **please ratify the order.** Default assumption in §3/§4/§7: F3 lands
first; recording is gated on its field so C2 is safe either way.

## Honesty caveat to acknowledge (not a choice — a fact to accept)

CF6 endgame buckets need the **production** puzzle set (`puzzles.json`). The shipped **seed fallback (150
puzzles)** has no endgame themes at all, so on a fresh install without the ETL, the endgame buckets are
dropped as `n=0` (or collapse to one coarse endgame probe). This is by-design honesty (AP-CPROBE-3), not a
bug — but it means the CF6 win is invisible until the real puzzle DB is present. Documented in baseline +
spec §4.A2 / §6.
