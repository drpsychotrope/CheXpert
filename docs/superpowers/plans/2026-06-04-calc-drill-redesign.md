# Calculation Drill Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Calculation drill a true read-only calculation exercise — the board stays frozen while the user taps out their whole forcing line, then Submit grades it and reveals the real solution.

**Architecture:** Three layers. (1) Pure helpers in `src/calc/calc.ts` (`firstWrongUserMove`, `formatSanLine`) — unit-tested. (2) An additive `arrows` prop on `src/ui/Board.svelte` mapped to chessground `drawable.autoShapes`. (3) `src/ui/Calculate.svelte` rewritten from move-by-move play (`TacticalTrainer.playUserMove`, board applied) to frozen-board tap-to-build → Submit → `gradeCalcLine` → animated SAN reveal. No engine, no schema, rating-neutral.

**Tech Stack:** Svelte 5 (runes), TypeScript, chessground 9.2.1, chess.js (via `ChessGame`), vitest, svelte-check, IndexedDB (`idb`).

**Spec:** `specs/calc-drill-redesign-spec.md` (V1). **Design:** `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/calc/calc.ts` | Pure calc helpers | Add `firstWrongUserMove`, `formatSanLine` (keep `gradeCalcLine`) |
| `src/calc/calc.test.ts` | Pure helper tests | Add cases for both new helpers |
| `src/ui/Board.svelte` | chessground wrapper | Add additive `arrows` prop → `drawable.autoShapes` |
| `src/ui/Calculate.svelte` | Calculation drill UI | Full rewrite: frozen-board line entry + reveal |
| `decisions.md` | Decision log (append-only) | Append ADR-0044 |
| `README.md` | User-facing docs | Update calculation-trainer description |
| `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md` | Design doc | Mark shipped |

**Commands:** tests `npm test` · type-check `npm run check`.

---

## Task 1: Pure calc helpers (`firstWrongUserMove`, `formatSanLine`)

**Files:**
- Modify: `src/calc/calc.ts`
- Test: `src/calc/calc.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/calc/calc.test.ts` (and add the two new names to the existing import on line 2 → `import { gradeCalcLine, firstWrongUserMove, formatSanLine } from './calc';`):

```ts
describe('firstWrongUserMove', () => {
  it('maps solvedPlies (even solution index) to a 1-based user-move number', () => {
    expect(firstWrongUserMove(0)).toBe(1); // first user move wrong
    expect(firstWrongUserMove(2)).toBe(2); // second user move wrong
    expect(firstWrongUserMove(4)).toBe(3);
    expect(firstWrongUserMove(6)).toBe(4);
  });
});

describe('formatSanLine', () => {
  it('numbers plies white-first', () => {
    expect(formatSanLine(['Nf3', 'e5', 'Bc4'])).toBe('1.Nf3 e5 2.Bc4');
  });
  it('handles a single ply (no black move)', () => {
    expect(formatSanLine(['Qxf7#'])).toBe('1.Qxf7#');
  });
  it('handles an empty line', () => {
    expect(formatSanLine([])).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- calc`
Expected: FAIL — `firstWrongUserMove is not a function` / `formatSanLine is not a function`.

- [ ] **Step 3: Implement the helpers**

Append to `src/calc/calc.ts` (after `gradeCalcLine`):

```ts
/** 1-based index of the user's first wrong move, derived from gradeCalcLine's
 *  solvedPlies. solvedPlies is the solution index of the first wrong USER ply
 *  (always even, because user plies sit at solution indices 0,2,4,…). */
export function firstWrongUserMove(solvedPlies: number): number {
  return Math.floor(solvedPlies / 2) + 1;
}

/** Number a SAN ply list into a readable line:
 *  ['Nf3','e5','Bc4'] -> "1.Nf3 e5 2.Bc4". White-first numbering. */
export function formatSanLine(san: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < san.length; i += 2) {
    const n = i / 2 + 1;
    out.push(san[i + 1] ? `${n}.${san[i]} ${san[i + 1]}` : `${n}.${san[i]}`);
  }
  return out.join(' ');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- calc`
Expected: PASS — all `gradeCalcLine`, `firstWrongUserMove`, `formatSanLine` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/calc/calc.ts src/calc/calc.test.ts
git commit -m "feat(calc): add firstWrongUserMove + formatSanLine pure helpers"
```

---

## Task 2: Additive `arrows` prop on `Board.svelte`

**Files:**
- Modify: `src/ui/Board.svelte` (Props interface, destructure, `config()`)

No DOM unit-test harness exists for chessground; verification is `npm run check` + a manual smoke that the existing coordinate drill is unaffected (the prop is additive).

- [ ] **Step 1: Add the prop to the `Props` interface**

In `src/ui/Board.svelte`, inside `interface Props { … }` (after the `onSelect?` line ~25), add:

```ts
    /** Programmatic arrows drawn over the board (chessground autoShapes). [from, to]
     *  UCI-square pairs. Does not interfere with user-drawn shapes; no effect when empty. */
    arrows?: Array<[string, string]>;
```

- [ ] **Step 2: Destructure it with a default**

In the `let { … }: Props = $props();` block (after `onSelect,`), add:

```ts
    arrows = [],
```

- [ ] **Step 3: Wire it into `config()`**

In `config()`, replace the existing line:

```ts
      drawable: { enabled: true },
```

with:

```ts
      drawable: {
        enabled: true,
        autoShapes: arrows.map(([orig, dest]) => ({ orig: orig as Key, dest: dest as Key, brush: 'green' })),
      },
```

(`Key` is already imported on line 10. The existing `$effect → cg.set(config())` re-syncs autoShapes whenever `arrows` changes.)

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: 0 errors, 0 warnings (clean).

- [ ] **Step 5: Commit**

```bash
git add src/ui/Board.svelte
git commit -m "feat(board): additive arrows prop -> chessground autoShapes"
```

---

## Task 3: Rewrite `Calculate.svelte` to frozen-board line entry

**Files:**
- Modify (full replace): `src/ui/Calculate.svelte`

This is a single-file rewrite; it must compile as a whole, so it is one commit. Verification is `npm run check` + the manual gates in Step 4.

- [ ] **Step 1: Replace the entire file contents**

Overwrite `src/ui/Calculate.svelte` with:

```svelte
<script lang="ts">
  // Calculation trainer (read-only line entry — ADR-0044, AP-CHESS-54/55). The board is FROZEN at the
  // start position; the user taps their FULL forcing line (arrows + a "My line" list), then Submit grades
  // the whole line via gradeCalcLine and animates the real solution. No board feedback during input.
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { gradeCalcLine, firstWrongUserMove, formatSanLine } from '../calc/calc';
  import type { Puzzle } from '../trainer/puzzle';
  import { openTrainerDB } from '../store/db';
  import { SELF_TAGS, SELF_TAG_LABELS, type Confidence, type SelfTag } from '../metacog/metacog';

  let puzzle = $state<Puzzle | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let orientation = $state<'white' | 'black'>('white');
  let lastMove = $state<[string, string] | null>(null);
  let feedback = $state('');
  let feedbackKind = $state<'good' | 'bad' | ''>('');

  // Read-only line-entry state.
  let phase = $state<'input' | 'revealed'>('input');
  let userMoves = $state<string[]>([]);            // UCI, user turns only
  let arrows = $state<Array<[string, string]>>([]); // one per committed user move
  let pendingFrom = $state<string | null>(null);
  let solved = $state(false);
  let solutionSan = $state('');
  let startedAt = 0;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;

  const seen = new Set<string>();
  const model = $derived(app.model);

  // Metacognition (ADR-0037): opt-in, skippable, never gates the flow.
  let confidence = $state<Confidence | undefined>(undefined);
  let selfTag = $state<SelfTag | undefined>(undefined);
  let logged = $state(false);                       // AP-META-5: one attempt per position
  let lastAttemptId = $state<string | undefined>(undefined);
  const metacog = $derived(app.settings?.metacogEnabled ?? false);

  function clearRevealTimer() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
  }
  onDestroy(clearRevealTimer);

  function load() {
    if (!model) return;
    clearRevealTimer();
    const p =
      app.puzzles.next({ rating: model.puzzleRating.rating, window: 400, exclude: seen, source: 'personal' }) ??
      app.puzzles.next({ rating: model.puzzleRating.rating, window: 300, exclude: seen });
    if (!p) { feedback = 'No puzzles in range.'; return; }
    seen.add(p.id);
    puzzle = p;
    display = new ChessGame(p.fen);
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black';
    lastMove = null;
    phase = 'input';
    userMoves = [];
    arrows = [];
    pendingFrom = null;
    solved = false;
    solutionSan = '';
    startedAt = Date.now();
    confidence = undefined;
    selfTag = undefined;
    logged = false;
    lastAttemptId = undefined;
    feedback = 'Calculate the full line. Tap your moves onto the board — the pieces won’t move — then Submit. No hints.';
    feedbackKind = '';
  }

  async function logAttempt(didSolve: boolean) {
    if (!model || !puzzle || logged) return; // one attempt per position
    logged = true;
    const now = Date.now();
    const ms = now - startedAt;
    const p = $state.snapshot(puzzle); // IndexedDB cannot clone a $state proxy
    const r = model.puzzleRating.rating; // Calculate is not a Glicko writer (rating unchanged)
    const attemptId = `${p.id}:${now}`;
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: attemptId,
      puzzleId: p.id,
      solved: didSolve,
      ms,
      themes: p.themes,
      ratingBefore: r,
      ratingAfter: r,
      playedAt: now,
      source: p.source,
      confidence,
      selfTag: !didSolve ? selfTag : undefined,
    });
    if (!didSolve) lastAttemptId = attemptId;
  }

  /** UPDATE the existing attempt row's selfTag (re-puts the same id — AP-META-5 preserved). */
  async function updateSelfTag(tag: SelfTag) {
    selfTag = selfTag === tag ? undefined : tag;
    if (!lastAttemptId) return;
    const db = await openTrainerDB();
    const row = await db.get('puzzleAttempts', lastAttemptId);
    if (!row) return;
    await db.put('puzzleAttempts', { ...row, selfTag });
  }

  function fmtUci(uci: string): string {
    return `${uci.slice(0, 2)}→${uci.slice(2, 4)}`;
  }

  function sideToMove(): 'white' | 'black' {
    return display.turn === 'w' ? 'white' : 'black';
  }

  // Two taps = one user move. The board never applies it; we only record UCI + an arrow.
  function onSelect(sq: string) {
    if (phase !== 'input') return;
    if (pendingFrom == null) { pendingFrom = sq; return; }   // pick from-square (chessground highlights it)
    if (sq === pendingFrom) { pendingFrom = null; return; }  // tap again to cancel
    userMoves = [...userMoves, pendingFrom + sq];
    arrows = [...arrows, [pendingFrom, sq]];
    pendingFrom = null;
  }

  function undo() {
    if (!userMoves.length) return;
    userMoves = userMoves.slice(0, -1);
    arrows = arrows.slice(0, -1);
    pendingFrom = null;
  }

  async function submit() {
    if (!puzzle || phase !== 'input' || userMoves.length === 0) return;
    pendingFrom = null;
    const g = gradeCalcLine(puzzle.moves, userMoves);
    solved = g.correct;
    if (g.correct) {
      feedback = `Full line ✓ — ${userMoves.length} ${userMoves.length === 1 ? 'move' : 'moves'}, all correct.`;
      feedbackKind = 'good';
    } else {
      const k = firstWrongUserMove(g.solvedPlies);
      const played = userMoves[k - 1];
      const want = puzzle.moves[g.solvedPlies];
      feedback = played == null
        ? `You stopped early — the line continues past your move ${k - 1}.`
        : `Diverged at your move ${k} — you played ${fmtUci(played)}, the line was ${fmtUci(want)}. You calculated ${k - 1} of your moves.`;
      feedbackKind = 'bad';
    }
    await logAttempt(g.correct);
    revealSolution();
  }

  // Step the board through the real solution, building a numbered SAN line.
  function revealSolution() {
    if (!puzzle) return;
    phase = 'revealed';
    arrows = [];
    const moves = puzzle.moves;
    const sanGame = new ChessGame(puzzle.fen);
    const san: string[] = [];
    for (const m of moves) san.push(sanGame.moveUci(m) ?? m);
    solutionSan = formatSanLine(san);

    const stepGame = new ChessGame(puzzle.fen);
    fen = stepGame.fen;
    lastMove = null;
    let i = 0;
    const step = () => {
      if (i >= moves.length) { revealTimer = null; return; }
      const m = moves[i];
      stepGame.moveUci(m);
      fen = stepGame.fen;
      lastMove = [m.slice(0, 2), m.slice(2, 4)];
      i += 1;
      revealTimer = setTimeout(step, 350);
    };
    revealTimer = setTimeout(step, 350);
  }

  $effect(() => {
    if (model && !puzzle && app.puzzles.size > 0) load();
  });
</script>

<section class="col center">
  <h2>Calculation</h2>
  <p class="muted" style="max-width:440px;font-size:0.85rem">
    Read-only board. Tap your moves to lay out the whole forcing line, then Submit — no hints, no
    feedback until you commit.
  </p>

  {#if metacog && phase === 'input'}
    <div class="row center metacog" role="group" aria-label="How confident are you?">
      <span class="muted metacog-label">Confidence:</span>
      <button type="button" class="chip {confidence === 'sure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'sure' ? undefined : 'sure')}>Sure</button>
      <button type="button" class="chip {confidence === 'unsure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'unsure' ? undefined : 'unsure')}>Unsure</button>
      <button type="button" class="chip {confidence === 'guess' ? 'on' : ''}" onclick={() => (confidence = confidence === 'guess' ? undefined : 'guess')}>Guess</button>
    </div>
  {/if}

  <div class="board-wrap">
    <Board
      {fen}
      {orientation}
      turnColor={sideToMove()}
      movableColor={undefined}
      dests={new Map()}
      check={phase === 'input' && display.inCheck()}
      viewOnly={phase === 'revealed'}
      lastMove={phase === 'revealed' ? lastMove : null}
      arrows={phase === 'input' ? arrows : []}
      onSelect={phase === 'input' ? onSelect : undefined}
    />
  </div>

  {#if phase === 'input'}
    <div class="row center myline">
      <span class="muted">My line:</span>
      {#if userMoves.length === 0}
        <span class="muted">— tap a from-square, then a to-square</span>
      {:else}
        {#each userMoves as m, i}<span class="ply">{i + 1}.{fmtUci(m)}</span>{/each}
      {/if}
    </div>
  {/if}

  <p class="feedback {feedbackKind}">{feedback}</p>

  {#if phase === 'revealed' && solutionSan}
    <p class="muted solution">Solution: {solutionSan}</p>
  {/if}

  {#if metacog && phase === 'revealed' && !solved}
    <div class="col center metacog" role="group" aria-label="Why did you miss?">
      <span class="muted metacog-label">Why did you miss? (optional)</span>
      <div class="row center" style="flex-wrap:wrap">
        {#each SELF_TAGS as tag}
          <button type="button" class="chip {selfTag === tag ? 'on' : ''}" onclick={() => updateSelfTag(tag)}>{SELF_TAG_LABELS[tag]}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="row center">
    {#if phase === 'input'}
      <button class="ghost" onclick={undo} disabled={userMoves.length === 0}>⌫ Undo</button>
      <button onclick={submit} disabled={userMoves.length === 0}>Submit</button>
    {/if}
    <button onclick={load}>Next position →</button>
  </div>
</section>

<style>
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .myline { flex-wrap: wrap; gap: 0.4rem; max-width: 440px; }
  .ply { font-variant-numeric: tabular-nums; font-size: 0.85rem; background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 0.1rem 0.45rem; }
  .solution { font-size: 0.9rem; max-width: 440px; }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: 0 errors, 0 warnings. (If `arrows`/`lastMove` type errors appear, confirm Task 2 shipped the `arrows` prop and that `lastMove` is `[string, string] | null`.)

- [ ] **Step 3: Run the unit suite (no regressions)**

Run: `npm test`
Expected: PASS — all suites green (the rewrite touches no pure logic beyond Task 1's helpers).

- [ ] **Step 4: Manual verification gates** (run `npm run dev`, open the Calculate view)

Verify each (spec §6 / §8):
1. **Board read-only (AP-CHESS-54):** tapping squares never moves a piece; the position stays at the start until Submit.
2. **Tap-to-build:** tap from → tap to draws a green arrow and adds a `1.e2→e4` row to "My line"; tapping the same square twice cancels the pending from.
3. **Undo:** `⌫ Undo` removes the last arrow + row; disabled at 0 moves.
4. **Length hidden:** nothing shows how many moves the solution has before Submit.
5. **Correct line:** enter a full correct line → "Full line ✓"; the solution animates ply-by-ply; SAN line shows.
6. **Wrong move:** enter a wrong 2nd move → "Diverged at your move 2 — you played …, the line was …. You calculated 1 of your moves." + reveal.
7. **Stopped early:** enter only the first move of a longer line → "You stopped early …" + reveal.
8. **Metacog:** confidence chips show during input; self-tag chips show only after a missed Submit; one `puzzleAttempts` row per position (check IndexedDB); rating unchanged.
9. **Next position →** loads a fresh puzzle and resets to input; no stray reveal animation bleeds into it.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Calculate.svelte
git commit -m "feat(calc): frozen-board tap-to-build line entry + animated reveal (AP-CHESS-54/55)"
```

---

## Task 4: Docs — ADR-0044, README, mark design shipped (LAST)

**Files:**
- Modify: `decisions.md` (append-only)
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md`

- [ ] **Step 1: Append ADR-0044 to `decisions.md`**

Add at the end of `decisions.md` (do NOT edit prior entries — append-only):

```markdown
## ADR-0044 — Calculation drill: read-only tap-to-build line entry (fixes ADR-0029 drift)
**Date:** 2026-06-04 · **Status:** accepted

ADR-0029 shipped `Calculate.svelte` as move-by-move play (`TacticalTrainer.playUserMove`, board applied,
opponent auto-replied), which violated its own accepted **AP-CHESS-54** (board read-only during input)
and §8 acceptance — the drill felt like no-hint Tactics, not calculation. `gradeCalcLine` (the intended
full-line grader) was used only to count plies.

Redesign (cross-links ADR-0029): the board is **frozen** at the start position; the user taps their full
line (each move = an arrow + a "My line" row; line length never shown), then **Submit** grades the whole
line via `gradeCalcLine` and **animates the real solution** as a numbered SAN line. Pending-from cue uses
chessground native selection. Adds pure `firstWrongUserMove`/`formatSanLine` (`calc.ts`, unit-tested) and
an additive `Board.arrows` → `drawable.autoShapes` prop (other drills unaffected). Still grades vs the
stored solution (no engine, per ADR-0029); metacognition chips (ADR-0037) and AP-META-5 one-attempt write
preserved; rating-neutral. True blindfold (hiding pieces) remains deferred. AP-CALC-1…8.
```

- [ ] **Step 2: Update `README.md` calculation description**

Find the calculation-trainer mention in `README.md` (search for "calculation") and update it to read:

```markdown
- **Calculation trainer** — the board stays frozen while you tap out your whole forcing line; Submit
  grades the full line and replays the real solution. Trains visualization, not reaction.
```

(Match the surrounding list formatting; replace only the existing calculation bullet.)

- [ ] **Step 3: Mark the design doc shipped**

At the top of `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md`, change the status line:

```markdown
**Status:** shipped (ADR-0044) · **Scope:** UI/UX refactor of one drill
```

- [ ] **Step 4: Final verification**

Run: `npm test && npm run check`
Expected: tests PASS, check clean.

- [ ] **Step 5: Commit**

```bash
git add decisions.md README.md docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md
git commit -m "docs: ADR-0044 calc drill read-only line entry; README + design doc"
```

---

## Self-Review

**Spec coverage:**
- §4 A1 (helpers) → Task 1. §4 A2 (arrows prop) → Task 2. §4 A3 (component rewrite, incl. removal list, onSelect/undo/submit/reveal, timers & guards, metacog phase gating, copy) → Task 3. §7 docs → Task 4.
- §8 acceptance gates → Task 3 Step 4 (gates 1-9) + Task 1 tests (helper unit tests) + Task 2/3 `npm run check`.
- Q-A native selection (Task 3 `onSelect` comment, no extra shape) · Q-B full step-through (`revealSolution` setTimeout chain) · Q-C both-coords miss message (`fmtUci` for played + want). All resolved.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands are exact (`npm test -- calc`, `npm run check`, `npm test`).

**Type consistency:** `arrows: Array<[string,string]>` identical in Board prop (Task 2) and Calculate (Task 3). `lastMove: [string,string] | null` matches Board's existing prop type. Helpers `firstWrongUserMove(number): number` and `formatSanLine(string[]): string` match their call sites. `gradeCalcLine` returns `{correct, solvedPlies}` — used as-is. `ChessGame.moveUci(uci): string | null` — used for SAN (`?? m` fallback).

**Known limitations (documented, not gaps):** underpromotion entry unsupported (queen implied via `sameMove`); Black-to-move SAN numbering reads `1.x` not `1...x` (cosmetic, spec §11).
