# Calculation drill redesign — read-only line entry

**Date:** 2026-06-04 · **Status:** design (approved, pre-plan) · **Scope:** UI/UX refactor of one drill
**Touches:** `src/ui/Calculate.svelte`, `src/ui/Board.svelte` · **Reuses:** `src/calc/calc.ts` (`gradeCalcLine`, unchanged)

## Problem

The Calculation drill (`Calculate.svelte`, route `calculate`) promises visualization —
*"See the whole forcing line before you touch a piece, then play it out"* — but the board **updates
move-by-move** as the user plays, with the opponent's correct reply auto-played each step
(`Calculate.svelte` `onMove`). So the user never calculates a line in their head; they play reactively
with full board feedback (normal Tactics, minus hints). The *"you calculated N plies"* verdict is
misleading because every position was visible. This is what feels "strange and unintuitive."

### Root cause: the shipped drill violates its own accepted spec

`practice-mechanics-spec.md` (ADR-0029) specified, and these were **accepted**:

- §8 Acceptance: *"Calc grades a full line vs … (board **read-only** during input)."*
- **AP-CHESS-54**: *"Calc board updating during input (defeats visualization) — board must stay
  read-only until submit."*
- **AP-CHESS-55**: *"Calc grading only the first move (that's Tactics, not calculation) — grade the
  whole line."*

The shipped component does the opposite: it applies each move to the board and grades move-by-move via
`TacticalTrainer.playUserMove`, failing on the first wrong move. `gradeCalcLine` — the intended
full-line grader — exists and is unit-tested but is only called to count plies for the miss message.

ADR-0029 deferred **true blindfold** (hiding pieces) to a follow-up, but **read-only-during-input was
meant to ship** and did not. This redesign closes that gap.

## Goals

- Board stays read-only during input (AP-CHESS-54); the user commits a **full** line before any feedback.
- Make line entry **intuitive** (the user's actual complaint), not just spec-compliant.
- Turn a miss into a lesson: reveal the real solution line after Submit.

## Non-goals (v1)

- Live engine / accept-alternative-winning-lines (stays `gradeCalcLine` vs stored solution — ADR-0029).
- Full blindfold (hiding pieces) — deferred, per ADR-0029.
- Underpromotion entry, SAN typing, legality enforcement during input.

## Design

### Interaction model — "tap-to-build + arrows"

The board is anchored at `puzzle.fen` and **never moves** during input. It is a coordinate-input
surface plus a static reference, not a move player.

- The user builds **their own line** by tapping squares: tap *from* → tap *to* = one of their moves.
  Each committed move draws an **arrow** on the static board and appends to a **"My line"** list
  (`e2→e4`, `f1→c4`, …). The user visualizes the opponent's replies mentally.
- `⌫ Undo` removes the last move (its arrow + list row). `Submit` grades.
- **Line length is never displayed** — showing "3 moves" would leak the answer. The user submits when
  they judge the line complete (mate / decisive).

### Input mechanics

- Reuse `Board.svelte`'s existing `onSelect(square)` callback (chessground `events.select`,
  already wired for the coordinate drill). Capture two clicks → a UCI move (`from + to`).
  - First click sets a pending *from* (highlight it); second click sets *to* and commits the move;
    clicking the pending *from* again cancels it.
- `movableColor=undefined` and no `onMove` → piece drags do not apply; `fen` is held at `puzzle.fen`,
  so the board cannot change during input.
- The user enters **only their own moves** (their turns) — exactly `gradeCalcLine`'s contract
  (`userMoves` = user turns only; it walks the solution and skips the opponent's auto-reply plies).
- Promotion: a bare `from+to` matches a queen-promotion solution move via `sameMove`'s 4-char→`+q`
  normalization. Underpromotion in a solution cannot be expressed by tap → **known v1 limitation**
  (rare in tactic solutions; a promotion picker is a later enhancement).
- No move-legality check during input: a tapped move is an *assertion* of a calculated move; the frozen
  board has no live position to validate against, and grading catches wrong moves.

### Grading & verdict (core unchanged — ADR-0029)

- `Submit` → `gradeCalcLine(puzzle.moves, userMoves)` → `{ correct, solvedPlies }`.
- **Correct:** `correct === true` (the full line matched). Message: *"Full line ✓ — N moves, all
  correct."*
- **Miss:** derive the first wrong **user move** index `K` from `solvedPlies`
  (`K = floor(solvedPlies / 2) + 1`, 1-based). Message: *"Diverged at your move K — you played
  `<from→to>`, the line was `<from→to>`. You calculated K−1 of your moves."*
- Submitting a line **shorter** than the solution is a miss (`gradeCalcLine` returns `correct:false`
  when `userMoves[u]` is `null` at a user turn) — the user must enter the complete line.

### Reveal (the missing payoff)

After Submit (correct or miss):

- **Animate the real solution** on the board: step a fresh `ChessGame(puzzle.fen)` through
  `puzzle.moves`, updating `fen` with the existing 200ms animation and `lastMove` highlight.
- Show the solution as a **SAN list** with move numbers (`1.Nf3 e5 2.Bc4 …`), computed from the
  stepped `ChessGame` (SAN is available because the real position is known).
- The user's own ghost list stays shown as coordinate moves (their imagined line has no live position
  to convert to SAN). Divergence point highlighted.

Replaces today's behavior: a raw-UCI dump in the feedback string and a jarring snap-back to the start
position.

### Component change — `Board.svelte`

Add one prop:

```ts
/** Programmatic arrows/shapes drawn over the board (chessground autoShapes).
 *  Does not interfere with user-drawn shapes; no effect when empty. */
arrows?: Array<[string, string]>;   // [from, to] pairs
```

Wire into `config()` as `drawable.autoShapes` (mapping each `[from,to]` to
`{ orig, dest, brush: 'green' }`). `drawable` is already enabled. Reusable, behavior-neutral when unset.

## Kept as-is

- Metacognition (ADR-0037): confidence chips during input, self-tag chips on a miss.
- One `puzzleAttempts` row per position, written **once** on Submit (AP-META-5 guard).
- Rating-neutral: Calculate is not a Glicko writer (`ratingBefore === ratingAfter`).
- "Next position →" loads the next puzzle; `seen` de-dup; metacog reset.
- Intro copy updated to match the new flow (e.g. *"Calculate the full line. Tap your moves onto the
  board — the pieces won't move — then Submit to check. No hints."*).

## Data flow

```
load()            → puzzle = next(); fen = puzzle.fen (held); userMoves = []; arrows = []
onSelect(sq)      → pending==null ? pending = sq
                  : sq===pending  ? pending = null            (cancel)
                  : commit(pending→sq): userMoves.push(uci); arrows.push([pending,sq]); pending=null
undo()            → userMoves.pop(); arrows.pop()
submit()          → g = gradeCalcLine(puzzle.moves, userMoves)
                  → feedback from g; logAttempt(g.correct) once; revealSolution()
revealSolution()  → step ChessGame(puzzle.fen) through puzzle.moves, animating fen + SAN list
```

State machine: `input` (tapping) → `revealed` (post-Submit, read-only). `Next` resets to `input`.

## Error handling / edge cases

- Empty line: `Submit` disabled until `userMoves.length >= 1`.
- Double-tap same square: cancels the pending *from* (no zero-length move).
- Tap during `revealed`: ignored (only `Next` is active).
- No puzzles in range: existing "No puzzles in range." path unchanged.
- Promotion: queen auto-matches; underpromotion unsupported (documented).

## Testing

- `calc.test.ts` (existing): `gradeCalcLine` already covers full match, early divergence (`solvedPlies`),
  short line → miss. Add a case asserting the `K = floor(solvedPlies/2)+1` user-move mapping if that
  derivation is extracted into a pure helper (preferred: a tiny `firstWrongUserMove(solvedPlies)` in
  `calc.ts`, unit-tested, so the component holds no arithmetic).
- `svelte-check` clean.
- Manual: enter a correct full line → ✓ + animated reveal; enter a wrong 2nd move → diverged-at-K
  message + reveal; Undo removes last arrow; line length never shown pre-Submit.

## Rollback

Changes are confined to `Calculate.svelte` and an additive prop on `Board.svelte`. No schema, no engine,
no rating change. Revert the two files to roll back; `gradeCalcLine` and `calc.test.ts` are untouched.

## Anti-patterns honored

- **AP-CHESS-54** — board read-only during input (now true: `fen` held, no `onMove`).
- **AP-CHESS-55** — grades the whole line via `gradeCalcLine`, not the first move.
- **AP-META-5** — exactly one `puzzleAttempts` row per position.
