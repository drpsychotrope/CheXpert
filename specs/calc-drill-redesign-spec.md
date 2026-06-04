# Spec — `calc-drill-redesign`: read-only line entry for the Calculation drill

**Scope:** refactor (UI/UX of one drill) · **Status:** V1 (refiner cycle 1-2; cycle 3 skipped; arbitrages Q-A/B/C resolved) · **Date:** 2026-06-04
**Design source:** `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md` (approved)
**Touches:** `src/ui/Calculate.svelte`, `src/ui/Board.svelte`, `src/calc/calc.ts`, `src/calc/calc.test.ts`

## §0 Context

The Calculation drill (`Calculate.svelte`, route `calculate`, 175 lines) promises visualization —
*"See the whole forcing line before you touch a piece"* — but applies each move to the board during
input (`onMove` → `TacticalTrainer.playUserMove` → `display = new ChessGame(trainer.getFen())`, with the
opponent's correct reply auto-played) and grades move-by-move, failing on the first wrong move. This
contradicts the drill's own accepted spec (**AP-CHESS-54** board read-only during input; **AP-CHESS-55**
grade the whole line; §8 acceptance). `gradeCalcLine` — the intended full-line grader (`calc.ts:12-23`,
pure, 4 tests) — is called only to count plies for the feedback string.

This PR switches the drill to read-only **tap-to-build + arrows** line entry: the board stays anchored
at `puzzle.fen`, the user taps their full line (arrows + a "My line" list), `Submit` grades via
`gradeCalcLine` and animates the real solution as a SAN list. No engine, no schema, rating-neutral.

## §1 Empirical baseline (captured 2026-06-04 — `reports/calc-drill-redesign_baseline.json`)

| Item | Current state |
|---|---|
| `Calculate.svelte` | 175 LOC; input = move-by-move, board APPLIED; opponent auto-reply shown; miss → snap-back to start + raw-UCI dump |
| `gradeCalcLine` | `calc.ts:12-23`, pure, returns `{correct, solvedPlies}`; `solvedPlies` = solution index of first wrong **user** ply (always even) or solution length on full match. **Underused** (ply-count only) |
| `firstWrongUserMove` | absent (to add) |
| `Board.svelte` | 178 LOC; `onSelect` present (chessground `events.select`); `drawable.enabled = true`; **no** `arrows`/`autoShapes` prop |
| `ChessGame` | `moveUci(uci) → SAN|null`, `history() → SAN[]` — reveal SAN list feasible, no new API |
| `calc.test.ts` | 4 tests (full match, first-wrong `solvedPlies=2`, short line, promo); no `firstWrongUserMove` test |
| AP violations today | AP-CHESS-54 (board updates during input), AP-CHESS-55 (move-by-move fail) |

## §2 Scope

**In:** read-only line entry in `Calculate.svelte` (tap-to-build, arrows, "My line" list, Submit,
animated SAN reveal); additive `arrows` prop on `Board.svelte`; `firstWrongUserMove` helper + test in
`calc`. **Single concern:** the calc drill's input/grade/reveal loop.

**Deferred (→ §11):** live engine / accept-alternative-winning-lines, full blindfold (hide pieces),
underpromotion entry, SAN typing, move-legality enforcement during input, a step-through `◀ ▶` reveal
control.

## §3 Pre-flight gates (re-verify at exec time — fail any ⇒ STOP)

1. `Calculate.svelte` still drives input through `TacticalTrainer.playUserMove` with the board applied
   (baseline still true; refactor not already done).
2. `Board.svelte` still exposes `onSelect` and `drawable.enabled = true`, and has **no** `arrows` prop.
3. `gradeCalcLine(solutionMoves, userMoves)` signature/return unchanged (`{correct, solvedPlies}`).
4. `ChessGame.moveUci` still returns SAN (`string|null`).
5. `npm test` green and `svelte-check` clean **before** editing.

## §4 Phase A — code change (code first; ordered)

### A1 — `src/calc/calc.ts`: add pure helpers
```ts
/** 1-based index of the user's first wrong move, from gradeCalcLine's solvedPlies.
 *  solvedPlies is the solution index of the first wrong USER ply (always even). */
export function firstWrongUserMove(solvedPlies: number): number {
  return Math.floor(solvedPlies / 2) + 1;
}

/** Number a SAN ply list into a readable line: ['Nf3','e5','Bc4'] -> "1.Nf3 e5 2.Bc4". */
export function formatSanLine(san: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < san.length; i += 2) {
    const n = i / 2 + 1;
    out.push(san[i + 1] ? `${n}.${san[i]} ${san[i + 1]}` : `${n}.${san[i]}`);
  }
  return out.join(' ');
}
```
Keeps arithmetic/formatting out of the component and unit-testable. No change to `gradeCalcLine`.

### A2 — `src/ui/Board.svelte`: additive `arrows` prop
- Add to `Props`: `arrows?: Array<[string, string]>;` (default `[]`).
- In `config()`, set `drawable: { enabled: true, autoShapes: arrows.map(([orig, dest]) => ({ orig, dest, brush: 'green' })) }`.
- `orig`/`dest` are chessground `Key`s — cast the string pair the same way `toDests` already shims
  (`as unknown as`), so `svelte-check` stays clean.
- `autoShapes` is programmatic and does not interfere with user-drawn shapes; behavior-neutral when
  `arrows` is empty/unset. The existing `$effect → cg.set(config())` re-syncs on change. Other consumers
  (coordinate/blindfold drills) pass no `arrows` ⇒ identical render to today (AP-CALC-6).

### A3 — `src/ui/Calculate.svelte`: read-only line entry
Replace the move-by-move flow. Remove the `TacticalTrainer` input path (it is a move-by-move solver and
is the AP-CHESS-54-violating mechanism); drive the board from local state.

**Remove every current `TacticalTrainer` usage** (AP-CALC-8 — no dead wiring):
- `import { TacticalTrainer }` and the `trainer` `$state` → deleted.
- `$effect(() => { if (model && !trainer && ...) load() })` load sentinel `!trainer` → `!puzzle`.
- `logAttempt`'s `trainer.elapsedMs(now)` → `now - startedAt`.
- Board prop gates `trainer?.state.status === 'solving' | 'failed'` → `phase === 'input' | 'revealed'`.
- `onMove` handler → deleted (replaced by `onSelect`).

**State**
- `phase: 'input' | 'revealed'` (replaces reliance on `trainer.state.status`).
- `userMoves: string[]` (UCI, user turns only), `arrows: Array<[string,string]>`, `pendingFrom: string | null`.
- `solved: boolean` (set on Submit), `solutionSan: string` (built on reveal), `startedAt: number` (timing; replaces `trainer.elapsedMs`).
- Keep `puzzle`, `display` (a `ChessGame` used for the reveal animation), `feedback`, `feedbackKind`,
  `seen`, metacog state (`confidence`, `selfTag`, `logged`, `lastAttemptId`).

**`load()`** — `phase='input'`; `puzzle = next(...)`; `display = new ChessGame(p.fen)`; `fen = p.fen`;
`orientation` by side to move; reset `userMoves=[]`, `arrows=[]`, `pendingFrom=null`, `solved=false`,
`solutionSan=''`, metacog; `startedAt = Date.now()`; intro copy (see §4-copy).

**`onSelect(sq)`** (board click during input)
- `if (phase !== 'input') return;`
- `if (pendingFrom == null) { pendingFrom = sq; return; }`
- `if (sq === pendingFrom) { pendingFrom = null; return; }` (cancel)
- commit: `userMoves = [...userMoves, pendingFrom + sq]; arrows = [...arrows, [pendingFrom, sq]]; pendingFrom = null;`
- Pending-from highlight: **chessground native selection** [Q-A=a] — free with `selectable.enabled` +
  `onSelect` (the clicked square stays highlighted until the next click). No extra shape; `arrows` stays moves-only.

**`undo()`** — `userMoves = userMoves.slice(0, -1); arrows = arrows.slice(0, -1); pendingFrom = null;`

**`submit()`** — guard `userMoves.length >= 1 && phase === 'input'`:
- `const g = gradeCalcLine(puzzle.moves, userMoves);`
- `solved = g.correct;`
- correct → `feedback = \`Full line ✓ — ${userMoves.length} moves, all correct.\`; feedbackKind='good';`
- miss → `const k = firstWrongUserMove(g.solvedPlies); const played = userMoves[k-1]; const want = puzzle.moves[g.solvedPlies];`
  - `played == null` → `\`You stopped early — the line continues past your move ${k-1}.\``
  - else → `\`Diverged at your move ${k} — you played ${fmtUci(played)}, the line was ${fmtUci(want)}. You calculated ${k-1} of your moves.\``
  - `feedbackKind='bad';`
- `await logAttempt(solved);` (unchanged writer; one row per position — AP-META-5)
- `revealSolution();`

**`revealSolution()`** — `phase='revealed'`:
- Build SAN by stepping **one** `ChessGame(puzzle.fen)` sequentially (`moveUci` mutates, so order
  matters — use a loop, not `.map` for clarity):
  ```ts
  const g2 = new ChessGame(puzzle.fen);
  const san: string[] = [];
  for (const m of puzzle.moves) san.push(g2.moveUci(m) ?? m);
  solutionSan = formatSanLine(san);   // "1.Nf3 e5 2.Bc4 Nf6 3.Qxf7#"
  ```
- `formatSanLine(san: string[]): string` — pure helper (number pairs as `i.white black`); unit-test it.
- Animate the real line on the board: **full step-through** [Q-B=a] — step `puzzle.moves` from a
  `ChessGame(puzzle.fen)`, updating `fen` + `lastMove` on a `setTimeout` chain (~200ms/ply, reusing
  Board's animation). Timer held + cleared per §4 "Timers & guards".
- Clear `arrows` on reveal [Q-A=a].
- Miss message keeps **both moves in coords** via `fmtUci` [Q-C=b] — no SAN inline; the numbered SAN line
  (`solutionSan`) is shown separately under the board.

**`fmtUci(uci)`** — `\`${uci.slice(0,2)}→${uci.slice(2,4)}\`` (coordinate display; user's imagined line
has no live position for SAN). Drops any promotion suffix (`a7a8q → "a7→a8"`) — queen implied, acceptable.

**Board props**
- input: `fen={puzzle.fen}` (held), `movableColor={undefined}`, no `onMove`, `onSelect={onSelect}`,
  `arrows={arrows}`, `dests={new Map()}`, `viewOnly={false}`.
- revealed: `fen={steppedFen}`, `lastMove`, `arrows={[]}`, `viewOnly={true}`, no `onSelect`.

**Controls**
- input: `⌫ Undo` (disabled when `userMoves.length===0`), `Submit` (disabled when `userMoves.length===0`).
- always: `Next position →`.

**Timers & guards**
- The step-through reveal uses a `setTimeout` chain; hold its handle in a module/`$state` var and
  **clear it in `load()` and `onDestroy`** (cf. Vision's `blindTimer`) so a pending reveal can't fire
  onto the next puzzle.
- `submit()` ignores a dangling `pendingFrom` (grades committed `userMoves` only); clear it on Submit.

**Metacognition** (ADR-0037, kept)
- Confidence chips: gate on `phase === 'input'` (was `trainer.state.status === 'solving'`).
- Self-tag chips: gate on `phase === 'revealed' && !solved` (was `status === 'failed'`).
- `logAttempt`/`updateSelfTag` unchanged (one row per position; `elapsedMs = Date.now() - startedAt`).

### §4-copy — intro text
Replace lines 49 / 128-130 with: *"Calculate the full line. Tap your moves onto the board — the pieces
won't move — then Submit to check. No hints."*

## §5 Phase B — tests

- `calc.test.ts`: add `firstWrongUserMove` cases — `solvedPlies 0 → 1`, `2 → 2`, `4 → 3` (consistent with
  the existing `solvedPlies` cases). Existing `gradeCalcLine` tests unchanged.
- `formatSanLine` (place in `calc.ts` — pure, no chess logic): test `['Nf3','e5','Bc4'] → "1.Nf3 e5 2.Bc4"`
  and the odd-length tail (`['Qxf7#'] → "1.Qxf7#"`).
- Pure verdict logic lives behind `firstWrongUserMove` + `fmtUci` + `formatSanLine`. No DOM test
  framework is assumed — Svelte interaction is covered by §6 manual gates.

## §6 Phase C — verification (acceptance gates)

1. `npm test` green incl. new `firstWrongUserMove` cases; `svelte-check` clean.
2. Manual — board read-only during input: tapping squares **never** moves a piece; `fen` stays at
   `puzzle.fen` until Submit (AP-CHESS-54).
3. Manual — tap from→to draws an arrow and appends a "My line" row; `⌫ Undo` removes the last; line
   length is **not** displayed before Submit.
4. Manual — correct full line → "Full line ✓" + animated solution reveal + SAN list.
5. Manual — wrong 2nd move → "Diverged at your move 2 …" + reveal; short line → "stopped early" + reveal.
6. Manual — confidence chips show during input; self-tag chips show only after a missed Submit; exactly
   one `puzzleAttempts` row per position (AP-META-5); rating unchanged (`ratingBefore===ratingAfter`).

## §7 Phase Z — docs (last)

- Append **ADR-0044** to `decisions.md` (append-only; cross-link ADR-0029): "Calculation drill: read-only
  tap-to-build line entry — board frozen during input (AP-CHESS-54 now honored), full-line grade via
  `gradeCalcLine`, animated SAN reveal; `Board.arrows` autoShapes prop; `calc.firstWrongUserMove`."
- README "Train & retain": update the calculation-trainer line to describe frozen-board line entry.
- Mark the design doc `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md` as shipped.

## §8 Acceptance criteria

- [ ] Board does not change during input; `fen` held at `puzzle.fen` until Submit (AP-CHESS-54).
- [ ] Full line entered then graded once on Submit via `gradeCalcLine` (AP-CHESS-55) — no move-by-move fail.
- [ ] Tap-to-build: from→to → arrow + "My line" row; Undo works; length hidden pre-Submit.
- [ ] Miss reveals the real line animated + as SAN; correct shows ✓ + reveal.
- [ ] `Board.arrows` prop is additive (no behavior change when unset); coordinate drill unaffected.
- [ ] `firstWrongUserMove` unit-tested; `npm test` + `svelte-check` green.
- [ ] One `puzzleAttempts` row/position (AP-META-5); rating-neutral; metacog chips intact.
- [ ] ADR-0044 appended; README updated; design doc marked shipped.

## §9 Anti-patterns

- **AP-CALC-1** — Board updating during input (the original bug). The board must hold `puzzle.fen`;
  no `onMove`, `movableColor=undefined`. (= AP-CHESS-54.)
- **AP-CALC-2** — Grading move-by-move or on the first tap. Grade only on Submit, whole line. (= AP-CHESS-55.)
- **AP-CALC-3** — Leaking line length (showing "move 2 of 3", a progress bar, or expected-count). Never
  reveal how many moves remain.
- **AP-CALC-4** — Writing more than one `puzzleAttempts` row per position (e.g. logging per tap). One row
  on Submit. (= AP-META-5.)
- **AP-CALC-5** — `firstWrongUserMove` off-by-one (using ply index as move number, or 0-based). It is
  `floor(solvedPlies/2)+1`, 1-based; unit-test it.
- **AP-CALC-6** — Making `Board.arrows` non-additive (changing default render, breaking the coordinate or
  blindfold drills). Empty/unset ⇒ identical to today.
- **AP-CALC-7** — Reveal computing SAN from the user's imagined line (no live position). SAN comes only
  from stepping `ChessGame(puzzle.fen)` through `puzzle.moves`.
- **AP-CALC-8** — Leaving dead `TacticalTrainer`/`playUserMove` wiring in the component after the rewrite.

## §10 Rollback

Confined to `Calculate.svelte`, additive prop on `Board.svelte`, additive helper+test in `calc`. No
schema, no engine, no rating change. Revert the four files; `gradeCalcLine` and existing `calc.test.ts`
cases are untouched, so other drills and the rating path are unaffected.

## §11 Follow-up

- Live engine / accept any winning line (multipv) — would need an engine call in this drill.
- Full blindfold (hide pieces after N s), per ADR-0029 deferral.
- Underpromotion entry (promotion picker) + SAN typing input mode.
- `◀ ▶` step-through reveal control; per-move "your line vs solution" diff overlay.
- `formatSanLine` numbers plies White-first; when the puzzle's side to move is Black the display reads
  `1.<black>` instead of `1...<black>` (cosmetic only — grading is unaffected). Fix if it bothers in use.
