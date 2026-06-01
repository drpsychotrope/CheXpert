# Arbitrages: eval-graph

## Critical structural defects (cycle 1 stops)
None. UI-only, all data present, no engine work.

## Decisions requested from user

### Q-A: Placement + board
**Options**
- (a) In Import.svelte + a **read-only mini-board** of the selected moment (`Board.svelte` already has `viewOnly`). Delivers "board jumps to fenBefore" cheaply.
- (b) In Import.svelte, **no board** — selecting a moment just expands the `explainPly` text.
- (c) New dedicated game-review view (board + movelist + curve).
**Refiner recommendation**: (a) — cheap (Board supports `viewOnly`), matches the brainstorm design, stays UI-only. (c) deferred to §11.

### Q-B: Critical-moment count + threshold
**Options**
- (a) Top 5, only `winProbLoss >= 10` (mistake), capped.
- (b) Top 3, same threshold.
- (c) All swings `>= 20` (blunder only).
**Refiner recommendation**: (a) — 5 turning points fit a game review; the threshold avoids noise on clean games.

### Q-C: Whose swings count as "critical"
**Options**
- (a) Both sides, visually distinguished (your swings vs the opponent's).
- (b) Player-only.
**Refiner recommendation**: (a) — a game's turning points include the opponent's blunders you faced; distinguishing them keeps the player focus. (Also sets up spec 3's "missed-win" framing.)

### Q-D: Curve point-of-view
**Options**
- (a) Player-POV — "your winning chances" over the game.
- (b) White-POV — neutral, lichess-like.
**Refiner recommendation**: (a) — the whole app is player-centric (radar, ACPL); label the axis explicitly so a Black game reads correctly.

## Auto-applied patches (no user input needed)
- Inline SVG, no charting dependency (AP-CHESS-36).
- Reuse `byPhase.acpl` (no recompute) and stored `playedWhiteCp` (no re-eval) (AP-CHESS-35).
- Hard acceptance gate: no "Accuracy"/grade number anywhere (AP-CHESS-32).
- Y clamped [0,100]; markers accessible (role/aria/keyboard); `uciToMove` helper for `lastMove`.
- Phase Z appends ADR-0021 (cross-links ADR-0009).

## Stop status
- Cycles run: 4/4 (user-forced)
- Stop reason: complete; decreasing returns at cycle 4 (skip evaluator would have stopped at cycle 2)
- Final spec: `specs/eval-graph-spec.md`

## Next steps
1. Read Q-A..Q-D.
2. Reply (e.g. `eval Q-A: a, Q-B: a, Q-C: a, Q-D: a`).
3. Drafter applies as final V1 patch (ADR-0021 records choices).
