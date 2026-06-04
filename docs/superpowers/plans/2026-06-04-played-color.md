# Played-color Integration + Play Black — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player choose their color (White/Black/Random) in real games and the coaching test, play either side correctly (engine opens when you're Black), and show a consistent "You play {color}" cue across every game mode.

**Architecture:** A tiny pure `color.ts` util (`ColorChoice` + `resolveColor`) and a shared `ColorPicker.svelte` feed three already-color-aware game flows. `Play.svelte` is already fully parameterized by `playerColor` (just hardcoded white); `Coach.svelte` and `Onboarding.svelte` calibration games are White-locked and get parameterized. Sparring/Comeback already orient correctly and only need the label.

**Tech Stack:** Svelte 5 (runes), TypeScript (strict), Vitest, chess.js, Stockfish (Web Worker).

**Spec:** `docs/superpowers/specs/2026-06-04-played-color-design.md`. **ADR:** ADR-0047.

**Test command:** single file `npx vitest run <path>`; full `npm test`; types `npm run check`; build `npm run build`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/game/color.ts` | `ColorChoice` type + `resolveColor` | create |
| `src/game/color.test.ts` | unit tests | create |
| `src/ui/ColorPicker.svelte` | shared "Play as" select | create |
| `src/ui/Play.svelte` | selectable color + engine-first + label | modify |
| `src/ui/Coach.svelte` | coach-game color picker + analysis color + label | modify |
| `src/ui/Onboarding.svelte` | calibration-game color + ACPL sign + label | modify |
| `src/ui/Sparring.svelte` | "You play" label | modify |
| `src/ui/Comeback.svelte` | "You play" label | modify |
| `decisions.md` | ADR-0047 (append-only) | modify |

---

## Task 1: Color util

**Files:**
- Create: `src/game/color.ts`
- Test: `src/game/color.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { resolveColor, type ColorChoice } from './color';

describe('resolveColor', () => {
  it('passes white/black through unchanged', () => {
    expect(resolveColor('white')).toBe('white');
    expect(resolveColor('black')).toBe('black');
  });

  it('resolves random via the injected rng (deterministic in tests)', () => {
    expect(resolveColor('random', () => 0.1)).toBe('white'); // < 0.5 → white
    expect(resolveColor('random', () => 0.9)).toBe('black'); // >= 0.5 → black
    expect(resolveColor('random', () => 0.5)).toBe('black'); // boundary → black
  });

  it('accepts ColorChoice values', () => {
    const c: ColorChoice = 'random';
    expect(['white', 'black']).toContain(resolveColor(c, () => 0));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/color.test.ts`
Expected: FAIL — cannot resolve `./color`.

- [ ] **Step 3: Implement**

```ts
// Player color choice for games (ADR-0047). Pure; rng injected so 'random' is
// testable. The UI resolves a choice to a concrete side once per game start.

export type ColorChoice = 'white' | 'black' | 'random';

/** Resolve a choice to a concrete side. 'random' uses rng() (< 0.5 → white). */
export function resolveColor(choice: ColorChoice, rng: () => number = Math.random): 'white' | 'black' {
  if (choice === 'white' || choice === 'black') return choice;
  return rng() < 0.5 ? 'white' : 'black';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/game/color.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/color.ts src/game/color.test.ts
git commit -m "feat(color): ColorChoice + resolveColor util + tests"
```

---

## Task 2: Shared ColorPicker component

**Files:**
- Create: `src/ui/ColorPicker.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  // Shared "Play as" picker (ADR-0047). Bindable ColorChoice; reused by Play,
  // Coach, and Onboarding. Matches the existing Play <select> control styling.
  import type { ColorChoice } from '../game/color';
  interface Props { value: ColorChoice; disabled?: boolean; }
  let { value = $bindable(), disabled = false }: Props = $props();
</script>

<label class="muted" style="font-size:0.85rem">
  Play as:
  <select bind:value {disabled}>
    <option value="white">White</option>
    <option value="black">Black</option>
    <option value="random">Random</option>
  </select>
</label>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ColorPicker.svelte
git commit -m "feat(color): shared ColorPicker component"
```

---

## Task 3: Play — selectable color + engine-first

**Files:**
- Modify: `src/ui/Play.svelte`

- [ ] **Step 1: Imports + reactive color state**

At the top of `<script>`, after the existing imports add:
```ts
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
```
Replace line 35 `const playerColor: 'white' | 'black' = 'white';` with:
```ts
  let colorChoice = $state<ColorChoice>('white');
  let playerColor = $state<'white' | 'black'>('white');
```
Replace lines 57-58 (the two `const botSide` / `const playerSideClock`) with reactive derivations:
```ts
  const botSide = $derived<Side>(playerColor === 'white' ? 'b' : 'w');
  const playerSideClock = $derived<Side>(playerColor === 'white' ? 'w' : 'b');
```

- [ ] **Step 2: Resolve color + steer the right side in `newGame()`**

In `newGame()`, immediately after `if (!model) return;` (line 114) add:
```ts
    playerColor = resolveColor(colorChoice);
```
In the standard branch, change the opening-steer line (currently `opening = selectOpening('b', weakestDim, Math.random());`, line 147) to steer the BOT's color (opposite of the player):
```ts
      opening = selectOpening(playerColor === 'white' ? 'b' : 'w', weakestDim, Math.random());
```

- [ ] **Step 3: Engine opens when the player is Black**

In `newGame()`, inside the `try` block, change:
```ts
      await opponent.applyStrength(); // sets UCI_Chess960 = (variant==='chess960') on boot
      status = 'playing';
      startClockLoop();
```
to:
```ts
      await opponent.applyStrength(); // sets UCI_Chess960 = (variant==='chess960') on boot
      status = 'playing';
      startClockLoop();
      // If the player is Black, the engine (White) makes the first move.
      if (turnColor() !== playerColor) await engineMove();
```

- [ ] **Step 4: Picker in the controls + "You play" label**

In the controls `<div>` (the row with the Mode/Time selects), add the picker right after the Mode `</label>` (after line 479) — available on all standard time controls and Chess960 alike, but **only meaningful for standard** (Chess960 keeps White; gate it):
```svelte
    {#if variant !== 'chess960'}
      <ColorPicker bind:value={colorChoice} disabled={live} />
    {/if}
```
Below the board, add a fixed "You play" cue. Change the board-wrap block so a label sits above it — insert immediately before `<div class="board-wrap">` (line 523):
```svelte
  {#if variant !== 'chess960'}
    <p class="muted" style="font-size:0.82rem">You play {playerColor === 'white' ? 'White' : 'Black'}</p>
  {/if}
```

- [ ] **Step 5: Verify**

Run: `npm run check && npm run build`
Expected: 0 type errors; build green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Play.svelte
git commit -m "feat(play): choose White/Black/Random, engine opens when Black, You-play label"
```

---

## Task 4: Coach game — color picker + correct analysis side

**Files:**
- Modify: `src/ui/Coach.svelte`

- [ ] **Step 1: Imports + state**

At the top of `<script>` add:
```ts
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
```
Near the other game state (around line 38), add:
```ts
  let coachColorChoice = $state<ColorChoice>('random');
  let coachSide = $state<'w' | 'b'>('w');
```

- [ ] **Step 2: Extract a bot-reply helper**

Add this function (near `startGame`):
```ts
  async function botReply() {
    if (!opponent) return;
    thinking = true;
    try {
      const uci = await opponent.pickMove(game.fen, 400);
      if (uci) { game.moveUci(uci); gameFen = game.fen; }
    } catch { /* ignore */ }
    thinking = false;
  }
```

- [ ] **Step 3: Resolve side + engine-first in `startGame()`**

Replace `startGame()` (lines 106-120) with:
```ts
  async function startGame() {
    coachSide = resolveColor(coachColorChoice) === 'white' ? 'w' : 'b';
    step = 'game';
    game = new ChessGame();
    gameFen = game.fen;
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(baseline()));
    thinking = true;
    info = 'Starting engine…';
    try {
      await opponent.applyStrength();
      info = 'Your move — play naturally.';
      thinking = false;
      if (coachSide === 'b') await botReply(); // engine (White) opens
    } catch {
      return finishWithoutGame();
    }
  }
```

- [ ] **Step 4: Parameterize `onGameMove` by side**

Replace `onGameMove` (lines 122-139) with:
```ts
  async function onGameMove(from: string, to: string) {
    if (!opponent || game.turn !== coachSide || thinking) return;
    await app.engine.resetVariant();
    const san = game.move(from, to, 'q');
    if (!san) return;
    gameFen = game.fen;
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) return finishGame();
    await botReply();
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) finishGame();
  }
```

- [ ] **Step 5: Analyse the side actually played**

In `finishGame()` (line 149) change `playerColor: 'w',` to:
```ts
        playerColor: coachSide,
```

- [ ] **Step 6: Orient the board + label in the `game` step template**

Replace the `{:else if step === 'game'}` board block (lines 216-225) with:
```svelte
  {:else if step === 'game'}
    <p class="muted">{info}</p>
    <p class="muted" style="font-size:0.82rem">You play {coachSide === 'w' ? 'White' : 'Black'}</p>
    <div class="board-wrap">
      <Board fen={gameFen} orientation={coachSide === 'w' ? 'white' : 'black'}
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!thinking && game.turn === coachSide ? (coachSide === 'w' ? 'white' : 'black') : undefined}
        dests={!thinking && game.turn === coachSide ? game.dests() : new Map()}
        check={game.inCheck()} onMove={onGameMove} />
    </div>
    {#if thinking}<p class="feedback">Bot thinking…</p>{/if}
```

- [ ] **Step 7: Picker on the offer-game panel**

In the `{:else if step === 'offer-game'}` block, add the picker above the buttons (after the `<p class="muted">…</p>` on line 209):
```svelte
      <ColorPicker bind:value={coachColorChoice} />
```

- [ ] **Step 8: Verify**

Run: `npm run check && npm run build`
Expected: 0 errors; build green.

- [ ] **Step 9: Commit**

```bash
git add src/ui/Coach.svelte
git commit -m "feat(coach): color picker for the coach game, analyse the side played"
```

---

## Task 5: Onboarding calibration game — color + ACPL sign

**Files:**
- Modify: `src/ui/Onboarding.svelte`

- [ ] **Step 1: Imports + state**

At the top of `<script>` add:
```ts
  import ColorPicker from './ColorPicker.svelte';
  import { resolveColor, type ColorChoice } from '../game/color';
```
Near the calibration-game state (around line 34-41), add:
```ts
  let gameColorChoice = $state<ColorChoice>('white');
  let gameSide = $state<'w' | 'b'>('w');
```

- [ ] **Step 2: Resolve side + engine-first in `startCalibrationGame()`**

In `startCalibrationGame()` (line 99), set the side at the very start (after `step = 'game';`):
```ts
    gameSide = resolveColor(gameColorChoice) === 'white' ? 'w' : 'b';
```
Then after the existing `await opponent.applyStrength();` and the `gameInfo = 'Your move…'` line (around line 111), before `gameThinking = false;`, add:
```ts
      if (gameSide === 'b') { gameThinking = false; await engineReply(); } // engine (White) opens
```

- [ ] **Step 3: Parameterize `onGameMove` guard + ACPL sign**

In `onGameMove` (line 121), change the guard:
```ts
    if (!opponent || game.turn !== gameSide || gameThinking) return;
```
Change the loss computation (line 139-140) to be player-POV:
```ts
      // Loss from the PLAYER's POV: White wants whiteCp high, Black wants it low.
      const loss = gameSide === 'w'
        ? Math.max(0, bestCp - after.whiteCp)
        : Math.max(0, after.whiteCp - bestCp);
```
Note: keep the pre-move `bestCp = before.whiteCp;` line as-is (it's the best-eval anchor for both sides).

- [ ] **Step 4: Outcome by side**

In `currentOutcome()` (line 167-168) change:
```ts
    if (t.over && t.reason === 'checkmate') return t.winner === gameSide ? 'win' : 'loss';
```

- [ ] **Step 5: Orient board + label in the `game` step template**

Replace the `{:else if step === 'game'}` board block (lines ~277-290) so orientation/guards use `gameSide` and a label shows. The board element (lines 281-289) becomes:
```svelte
    <p class="muted" style="font-size:0.82rem">You play {gameSide === 'w' ? 'White' : 'Black'}</p>
    <div class="board-wrap">
      <Board
        fen={gameFen}
        orientation={gameSide === 'w' ? 'white' : 'black'}
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!gameThinking && game.turn === gameSide ? (gameSide === 'w' ? 'white' : 'black') : undefined}
        dests={!gameThinking && game.turn === gameSide ? game.dests() : new Map()}
        check={game.inCheck()}
        onMove={onGameMove}
      />
    </div>
```

- [ ] **Step 6: Picker on the offer-game panel**

In the `{:else if step === 'offer-game'}` block, add the picker above the buttons (after the explanatory `<p>`):
```svelte
      <ColorPicker bind:value={gameColorChoice} />
```

- [ ] **Step 7: Verify**

Run: `npm run check && npm run build`
Expected: 0 errors; build green.

- [ ] **Step 8: Commit**

```bash
git add src/ui/Onboarding.svelte
git commit -m "feat(onboarding): calibration game color choice + player-POV ACPL"
```

---

## Task 6: Sparring + Comeback — "You play" label

**Files:**
- Modify: `src/ui/Sparring.svelte`, `src/ui/Comeback.svelte`

Both already derive `orientation` from the trained side; only the explicit label is missing.

- [ ] **Step 1: Sparring label**

In `src/ui/Sparring.svelte`, immediately before its `<div class="board-wrap">` (around line 130), add:
```svelte
        <p class="muted" style="font-size:0.82rem">You play {orientation === 'white' ? 'White' : 'Black'}</p>
```
(Place it inside the same `{#if status === 'playing' …}` / board container so it shows during play. Match the file's existing block structure — if the board is inside an `{:else}`/playing branch, put the label there.)

- [ ] **Step 2: Comeback label**

In `src/ui/Comeback.svelte`, immediately before its `<div class="board-wrap">` (around line 142), add the same line:
```svelte
        <p class="muted" style="font-size:0.82rem">You play {orientation === 'white' ? 'White' : 'Black'}</p>
```

- [ ] **Step 3: Verify**

Run: `npm run check && npm run build`
Expected: 0 errors; build green.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Sparring.svelte src/ui/Comeback.svelte
git commit -m "feat(play): show You-play label in Sparring and Comeback"
```

---

## Task 7: Docs — ADR-0047

**Files:**
- Modify: `decisions.md` (append-only)

- [ ] **Step 1: Append ADR-0047**

Confirm the file ends at ADR-0046, then APPEND:
```markdown

## ADR-0047 — Play either color + consistent played-color display
**Date:** 2026-06-04 · **Status:** accepted

Games hardcoded the player to White. Add a `ColorChoice` (White/Black/Random) picker — a shared
`ColorPicker.svelte` over a pure `resolveColor` (rng-injectable) — to **Play** (all standard time
controls; Chess960 stays White, no theory) and the **coach** + **onboarding** calibration games.
`Play.svelte` was already fully parameterized by `playerColor`, so the change is reactive state +
the engine opening when the player is Black + steering the opening for the bot's color. The coach
game analyses with the side actually played (`runAnalysis({ playerColor })`); the onboarding ACPL is
measured from the player's POV (sign flips for Black). Every game mode shows a fixed "You play
{White/Black}" cue (Sparring/Comeback already oriented to the trained side). No schema, no rating-pool
change (a Black result updates the same per-time-control pool via the existing outcome mapping).
Cross-links: ADR-0046 (side-to-move badge), ADR-0041 (Chess960 — color out of scope).
```

- [ ] **Step 2: Commit**

```bash
git add decisions.md
git commit -m "docs: ADR-0047 played-color integration + play Black"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full suite** — `npm test` → all prior + `color` tests green, no regression.
- [ ] **Step 2: Types** — `npm run check` → 0 errors.
- [ ] **Step 3: Build** — `npm run build` → green.
- [ ] **Step 4: Manual smoke:**
  - Play → pick **Black**, classical → engine plays White's first move, board flipped, "You play Black", you move second; finish → result + analysis correct.
  - Play → **Random** a few times → resolves to a concrete side, label matches orientation.
  - Coach → assessment → offer-game pick **Black** → engine opens, board flipped → analysis populates the game dimensions (measured as Black).
  - Onboarding re-run (Settings → Re-run skill evaluation) → calibration game as **Black** → ACPL/seed sane.
  - Sparring/Comeback → "You play" label matches orientation.

---

## Self-Review

**Spec coverage:** A (color.ts + ColorPicker) → Tasks 1-2; B (Play black + engine-first) → Task 3; C (Coach game) → Task 4; D (Onboarding incl. ACPL flip) → Task 5; E (You-play indicator all modes) → Tasks 3/4/5/6; ADR-0047 → Task 7; gates → Task 8. All covered.

**Placeholder scan:** none — every step has concrete code and exact insertion points (line numbers from the current files).

**Type consistency:** `ColorChoice`/`resolveColor(choice, rng?)` defined Task 1, consumed Tasks 2-5. `ColorPicker` `value` is `$bindable<ColorChoice>` (Task 2), bound in Tasks 3/4/5. `coachSide`/`gameSide` are `'w'|'b'` and feed `runAnalysis({ playerColor })` / `currentOutcome()` consistently. `botSide`/`playerSideClock` change from `const` to `$derived` in Play (Task 3) — still `Side`-typed, all existing readers unaffected.

**Known nuance flagged:** Task 3 relies on `$derived` `botSide`/`playerSideClock` updating after `playerColor` is set in `newGame()` (Svelte 5 derived reads are fresh on access — correct). The opening-steer line uses a local ternary on `playerColor` (not `botSide`) to avoid any ordering doubt.
