# Refiner cycle 1 — `calc-drill-redesign`

**Focus:** premise validity (scope obsolete / path stale / foundation wrong / non-canonical metric / inferred values).

## Critical defects
**None.**

| Check | Result |
|---|---|
| Scope obsolete | NO — baseline confirms drill is still move-by-move + board-applied (AP-CHESS-54 live). Refactor valid. |
| Path stale | NO — `Calculate.svelte`, `Board.svelte`, `calc.ts`, `calc.test.ts`, `ChessGame.ts` all exist. |
| Foundation premise wrong | NO — baseline matches the premise (gradeCalcLine underused; onSelect + drawable present). |
| Non-canonical metric | NO — `K = floor(solvedPlies/2)+1` verified against `gradeCalcLine`: user plies sit at even solution indices; first-wrong example `solvedPlies=2 → K=2` matches the existing test. |
| Inferred values w/o empirical block | NO — all numbers (175/178/24 LOC, 4 tests) sourced from `baseline.json` §1. |

**Verdict: PASS — proceed to cycle 2.** No escalation.

## Non-critical patches (→ apply in cycle 2)

- **P1 (ambiguity, §4 A3 revealSolution):** SAN-build line is garbled (`.join formatted`). Specify a pure
  `formatSanLine(san: string[]) → "1.Nf3 e5 2.Bc4 …"` and build SAN by stepping a single
  `ChessGame(puzzle.fen)` sequentially (moveUci mutates; order matters).
- **P2 (completeness, §4 A3 state removal):** Spec removes `TacticalTrainer` but doesn't enumerate every
  current usage. Must replace: the `$effect` load sentinel `!trainer` → `!puzzle`; `trainer.elapsedMs`
  → `Date.now() - startedAt`; board `trainer?.state.status` gates → `phase`. List them so no dead
  reference remains (ties to AP-CALC-8).
- **P3 (ambiguity, Q-A pending-from highlight):** A zero-length arrow `[from,from]` may not render. Prefer
  chessground's **native selection highlight** (free when `selectable.enabled` + onSelect). Fallback: an
  orig-only `{orig, brush}` circle, which would require `Board.arrows` to accept an optional-dest shape.
  Keep `arrows` as moves-only; resolve highlight via Q-A.
- **P4 (correctness, §4 A2 typing):** `autoShapes` wants chessground `Key` types — cast like the existing
  `toDests` shim (`as unknown as`). Note it so the build stays clean.
- **P5 (polish, §4 A3 verdict):** The expected divergence move (`puzzle.moves[solvedPlies]`) *can* be
  shown in SAN (position is known up to that ply) instead of coords — nicer feedback. Optional → Q.
- **P6 (note, §4 fmtUci):** `fmtUci` drops a promotion suffix (`a7a8q → "a7→a8"`); acceptable (queen
  implied), document it.

Polish count: **6** (0 critical).
