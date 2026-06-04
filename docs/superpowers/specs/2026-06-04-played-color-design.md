# Played-color integration + play Black — design

**Date:** 2026-06-04 · **ADR:** ADR-0047 · **Status:** approved (brainstorm)

## Goal

Two user requests:
1. Integrate the **color the player is on** into every game mode — including the coaching test — so the board orientation and an explicit "You play White/Black" cue are consistent everywhere.
2. Allow **playing Black** in real games (Play), across all standard time controls.

Decisions (brainstorm): Play color picker = **White / Black / Random on all standard TCs**. Coach-test game = **same picker** (orient + analyse for the side actually played).

## Current state (explored)

- `Play.svelte` is **already fully parameterized** by `playerColor` (`botSide`, `playerSideClock`, outcome mapping `t.winner === playerColor[0]`, `orientation={playerColor}`, `runAnalysis({ playerColor })`) — but hardcoded `const playerColor = 'white'` (line 35). White always moves first; no engine kickoff for Black.
- `Sparring.svelte` / `Comeback.svelte` already derive `playerSide` + `orientation` from the scenario/position side and guard the move loop on `game.turn !== playerSide`.
- `Coach.svelte` game stage and `Onboarding.svelte` calibration game are **White-locked** (`orientation="white"`, `playerColor:'w'`, user moves first). Onboarding's ACPL loop computes loss from White's POV.
- `Board.svelte` has `showTurn`/`turnLabel` (ADR-0046) for solve drills; play modes were left untouched because the side is fixed/known.

## Design

### A. Shared color infrastructure (DRY)
- `src/game/color.ts`:
  - `export type ColorChoice = 'white' | 'black' | 'random';`
  - `export function resolveColor(choice: ColorChoice, rng: () => number = Math.random): 'white' | 'black'` — Random → concrete side, resolved **once per game** at start.
- `src/ui/ColorPicker.svelte` — minimal segmented control bound to a `ColorChoice`, label "Play as". Reused by Play, Coach, Onboarding.

### B. Play — selectable color + engine-first
- `playerColor` becomes reactive: a `ColorChoice` state (default `'white'`), resolved to a concrete `'white'|'black'` in `newGame()`. All downstream logic already keyed off `playerColor` — unchanged.
- After `newGame()` sets up the position, if `turnColor() !== playerColor` (you are Black → bot is White, on move), call `engineMove()` once to kick off.
- Picker rendered with the time-control / opponent-style controls; available on every standard time control (and No-clock). Chess960 is out of scope (separate variant flow).
- Rating: a Black result updates the same per-time-control pool (outcome already mapped through `playerColor`). No pool/logic change.

### C. Coach game — color picker
- Add the `ColorPicker` to the `offer-game` panel; store the chosen `ColorChoice`.
- In `startGame()`: resolve the side, set `coachPlayerColor`, orient the board to it; if Black, the engine (White) plays first.
- In `finishGame()`: call `runAnalysis({ ..., playerColor: side[0] })` (currently hardcoded `'w'`). `analyzeGame`/`buildWeaknessProfile` already key off `analysis.playerColor`, so opening/time/resilience reflect the side played.

### D. Onboarding calibration game — same
- Picker + orientation + engine-first, identical pattern.
- Extra: the inline ACPL loop computes `loss = bestCp − after.whiteCp` (White POV). When the player is Black, flip to the player's POV (`-(bestCp − after.whiteCp)` equivalent, i.e. measure the drop from the Black-to-move side) so the seed rating is correct. This is the only non-trivial color edit (other modes route through `BatchAnalyzer`, which already handles `playerColor`).

### E. "You play {White/Black}" indicator — all play modes
- A consistent fixed label above the board in Play, Coach game, Onboarding game (and Sparring/Comeback if not already shown). Renders the resolved player side. Distinct from the ADR-0046 per-move side-to-move badge (which is for solve drills); this is the fixed "which side am I" cue the request asks for.

## Testing
- Unit: `resolveColor` (white/black passthrough; Random with a seeded `rng`).
- UI is not unit-tested (repo norm) → gates: `npm test` (no regression), `npm run check` (0 errors), `npm run build`. Manual smoke: play a full Black classical game (engine opens, orientation flipped, result + analysis correct); run the Coach test as Black and confirm the analysis measures Black play; onboarding Black seed sane.

## Non-goals
- Chess960 color choice (separate variant flow).
- Persisting the last color choice (YAGNI — default White each session).
- No rating-pool or schema changes.

## Decision log
- **ADR-0047** — Play either color + consistent played-color display. Cross-links ADR-0046 (side-to-move badge), ADR-0041 (Chess960, color out of scope).
