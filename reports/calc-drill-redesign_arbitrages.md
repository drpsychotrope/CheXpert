# Arbitrages: calc-drill-redesign

## Critical structural defects (cycle 1 stops)
None. Pre-V0 scan + cycle 1 found no obsolete scope, stale path, wrong premise, or non-canonical metric.
The `K = floor(solvedPlies/2)+1` mapping was verified against `gradeCalcLine` and the existing tests.

## Decisions requested from user

### Q-A: pending-from highlight (the "you've picked a from-square" cue)
**Options**
- (a) **Native chessground selection** — clicking a square highlights it until the next click; no extra
  code. The `arrows` prop stays moves-only.
- (b) Orig-only circle shape — more prominent, but `Board.arrows` must accept an optional `dest`
  (`[from]` or `[from,from]`) and map to a circle brush.
**Refiner recommendation:** (a) — free, and a half-entered move is transient; a full custom cue is
over-engineering. Bump to (b) only if testing shows the cue is too subtle.

### Q-B: solution reveal animation
**Options**
- (a) **Full step-through** — animate each ply (timer, ~200ms/ply, `lastMove` highlight) so the line
  plays out. (Timer cleanup already specced under §4 "Timers & guards".)
- (b) Jump to the final position with `lastMove` set — simplest, no timer.
**Refiner recommendation:** (a) — the reveal is the drill's payoff and the main fix for today's bare
UCI dump; watching the line play is the teaching moment. Cost is one guarded `setTimeout` chain.

### Q-C: miss-message move format
**Options**
- (a) Expected move in SAN, played move in coords — `"you played e7→e5, the line was Nf6"`.
- (b) **Both in coords** (`fmtUci`) — `"you played e7→e5, the line was g8→f6"`; symmetric.
**Refiner recommendation:** (b) — symmetric and simplest; the full SAN line is already shown in the
reveal, so the inline message doesn't need SAN. (a) mixes two notations in one sentence.

## Auto-applied patches (no user input needed)
- P1 `formatSanLine` helper + sequential SAN build (fixed garbled draft line).
- P2 full `TacticalTrainer` removal list (no dead wiring — AP-CALC-8).
- P3 pending-from → native selection (fallback documented).
- P4 `autoShapes` `Key` cast note.
- P6 `fmtUci` promotion-drop documented.
- S3 `submit()` ignores dangling `pendingFrom`.
- S4 reveal timer held + cleared in `load()`/`onDestroy`.
- S1 Black-to-move SAN numbering logged as cosmetic follow-up (§11).

## Stop status
- Cycles run: 2/3
- Stop reason: cycle-3-skip (cycle 2 critical=0, residual polish=0)
- Final spec: `specs/calc-drill-redesign-spec.md` (V1)

## Next steps
1. Read Q-A / Q-B / Q-C above.
2. Reply with decisions (e.g. `Q-A: a, Q-B: a, Q-C: b` — or just "go with the recommendations").
3. I apply the chosen decisions as a final V1 patch to the spec.
4. The spec is then ready to hand to `writing-plans` for the implementation plan.
