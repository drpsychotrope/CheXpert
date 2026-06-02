# Refiner — `chess960` spec, cycle 2

**Date:** 2026-06-02 · **Input:** `specs/chess960-spec.md` (V1 after cycle-1 CR-1) · **Method:** draft-general §4.
**Verdict:** no critical defect; **0 critical, ≤8 polish (1 applied) → skip cycle 3** per draft-general
stop rule (cycle 2 clean AND polish ≤ 8, decreasing returns).

## Critical defects
**None.** Re-checked acceptance↔mechanism coverage, cross-spec contract, doctrine, and internal
consistency after the CR-1 edit. All sound.

## Acceptance ↔ mechanism traceability (full sweep)
| AC | Mechanism | OK |
|----|-----------|----|
| 1 generator legal/round-trip/injected | §4.1 + §5.1 | ✓ |
| 2 shim detect/validate/apply/route/fenForEngine, table-tested | §4.2 + §5.2 + §5.3 + §5.4 | ✓ |
| 3 chessground render+castle | §4.3 + §6 G-gate #1/#2 | ✓ |
| 4 engine 960, both builds verified | §4.4 + §6 G-gate #3 (Q-E) | ✓ |
| 5 GameRecord fields + chess960 pool, no bump | §4.5 + §1 contract | ✓ |
| 6 untimed + analysis-disabled | §2 + §0.5 Q-C/Q-D + §6 #6 | ✓ |
| 7 RatingPool import-or-fallback | §4.6 (Q-F) | ✓ |
| 8 tests/check/build green, std unaffected | §5 + §6 #5 | ✓ |
| 9 ADR-0041 + README override | §7 | ✓ |
No orphan AC; no orphan mechanism.

## Polish (P-N)
- **P-1 (applied)** — §4.5 used the reshaped `gameRatings.chess960`/`opponentByPool.chess960` field
  names without flagging that they presuppose the §4.6/time-controls reshape. Added a one-line callout
  making §4.6 a hard precondition for §4.5 (a reader could otherwise miss the ordering). *Applied.*
- **P-2** — §4.2 `fenForEngine()` X-FEN-vs-Shredder rule is now justified twice (its own bullet + the new
  AP-960-11 cross-ref). Slight redundancy but it's the trickiest correctness point; **keep** (redundancy
  is protective here).
- **P-3** — §6 G-gate is 6 numbered checks; that's thorough for a "heavy" spec and each is a distinct
  in-browser observable. Not over-spec'd. Keep.
- **P-4** — AP list is now 11. AP-960-11 (new) overlaps AP-960-1 (don't fork chess.js) only at the edge;
  -1 is "don't patch the library / don't feed it Shredder rights", -11 is "don't *read rights back* from
  it". Distinct concerns. Keep both.
- **P-5** — §11 could note that 960 auto-analysis also needs ECO/opening naming **suppressed** — already
  stated ("suppress ECO/opening naming"). Good.
- **P-6** — Title/status/batch header matches the house style of `scenario-sparring-spec.md` and
  `engine-perf-spec.md` (scope · status V1 · date · batch line · §0…§11). Conforms.

## Decreasing-returns check
Cycle 1 → cycle 2 delta is one correctness sentence (CR-1) + one clarity callout (P-1) + one anti-pattern.
No new critical surface uncovered; the spec's risk (the shim) was correctly front-loaded in V0. Delta
< 10% and 0 criticals at cycle 2 → **STOP (skip cycle 3)** per the stop conditions.

## Stop reason
`cycle-2 clean (0 critical, polish ≤ 8) + decreasing returns` → cycle 3 skipped.
