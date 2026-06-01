# Spec — `practice-mechanics`: calculation + vision drills + scheduler

**Scope:** feature (bundles #4/#5/#6 — **recommend split 3a/3b/3c**) · **Status:** V1 (3 cycles) · **Date:** 2026-06-01
Batch 2, spec C of 6.

## §0.5 Scope decomposition (Q-A)
Three separable training mechanics. Recommend shipping as 3 PRs: **3a calculation**, **3b vision-drills**, **3c scheduler**. Written so each extracts cleanly.

## §0 Context
Deliberate-practice mechanics the app lacks:
- **#4 Calculation** — most apps only test the first move; none make you commit a *full forcing line* in your head.
- **#5 Board vision** — [vision.ts](../src/vision/vision.ts) only does square-colour + knight-distance; add timed "spot all checks/captures/hanging pieces."
- **#6 Scheduling** — FSRS due-queue is FIFO-by-due; add interleaving (mix themes) + auto-build a Woodpecker set from your repeatedly-failed puzzles.

## §1 Empirical baseline
- `EngineClient.analyzeLines(fen,{multipv,movetime})` → PV lines (calc grading, no new engine).
- `vision.ts` pure + fully unit-tested; `Vision.svelte` view exists.
- `SrsStore.dueCards(now,kind,limit)` orders by due index; `woodpecker.createSet(id,name,puzzleIds,now)` builds a fixed set; `srsCards`/`woodpeckerSets` stores exist.
- 162 tests, svelte-check clean. AP-CHESS 54-58. ADR-0029(+).

## §2 Scope
**3a Calculation** (`src/calc/calc.ts` + `Calculate.svelte`): present a tactical position; the user enters a **full move sequence** (their line) WITHOUT the board updating (visualization); on submit, grade against the engine's PV (`analyzeLines`, multipv≥2) — correct if the line matches the best PV to a set depth (or reaches a winning eval). Show the PV after. Pull positions from personal puzzles / curated tactics.
**3b Vision** (extend `vision.ts` + `Vision.svelte`): pure generators `allChecks(fen)`, `allCaptures(fen)`, `hangingPieces(fen)` (via chess.js); a timed drill mode "find them all in Ns"; keep the existing colour/knight drills.
**3c Scheduler** (`src/srs/schedule.ts` + woodpecker hook): `interleave(dueCards)` — reorder the due queue so consecutive cards differ in theme/phase where possible (desirable difficulty); `buildLapseSet(attempts|cards)` → a Woodpecker set from the N most-failed personal puzzles, via `createSet`.
**Deferred:** "find the plan"/positional trainer; spaced-rep for endgames/guess (separate).

## §3 Pre-flight gates
1. `analyzeLines` + `evaluate` signatures unchanged; chess.js move-gen available to vision generators.
2. `dueCards` / `createSet` / `srsCards` lapse data available.
3. 162 tests green; svelte-check clean.

## §4 Phase A
### 3a `calc.ts` + `Calculate.svelte`
- `gradeLine(fen, userUci[], engine)` → analyzeLines on `fen` (multipv 2); replay `userUci` on a chess.js board; pass if the user's line equals the top PV prefix (move-for-move to `min(userLen, pvLen)`) OR the resulting position's eval ≥ a winning threshold (so alternative wins count). Return `{correct, pv, firstDivergencePly}`.
- View: board is **read-only** during input; the user clicks/enters moves into a "line" list (ghost, not applied); Submit → grade + reveal PV on the board. Grading depth/threshold → **Q-B**.
### 3b vision
- Pure: `allChecks(fen)`, `allCaptures(fen)`, `hangingPieces(fen)` (a piece attacked and not defended / lower-value attacker). Timed drill: render position, user taps all target squares, score vs the set, beat the clock. Set/timer params → **Q-C**.
### 3c scheduler
- `interleave(cards)` pure: stable reorder minimising adjacent same-theme (greedy), preserving overall due priority within a tolerance. Wire into Review's queue build.
- `buildLapseSet(now, k=12)`: read `puzzleAttempts`/`srsCards`, rank personal puzzles by failure count/lapses, `createSet` the top k as a "Your misses" Woodpecker set. Trigger → **Q-D** (auto vs on-demand button).

## §5 Phase B — tests
- `calc.test.ts`: line matches PV → correct; divergence → reports first wrong ply; alternative winning line accepted by threshold; non-winning deviation → incorrect.
- `vision.test.ts`: `allChecks`/`allCaptures`/`hangingPieces` on hand FENs (incl. none); existing colour/knight tests unchanged.
- `schedule.test.ts`: `interleave` reduces adjacent same-theme vs input; priority preserved within tolerance; `buildLapseSet` picks most-failed, size k, dedup.

## §6 Phase C — verification
`npm test` green incl. 3 suites; svelte-check clean; manual: calc line graded vs PV; vision timed drill scores; Review queue interleaved; "Your misses" set appears in Woodpecker.

## §7 Phase Z — docs
ADR-0029 (calc grade-vs-PV; vision generators; interleave + lapse-set) — or 0029/0030/0031 if split. README "Train & retain": add calculation trainer, vision drills, smarter scheduling.

## §8 Acceptance
Calc grades a full line vs PV (board read-only during input); vision timed drills work + pure generators tested; due queue interleaved; lapse-based Woodpecker set built; no new engine build/schema; ADR/README updated.

## §9 Anti-patterns
- **AP-CHESS-54** — Calc board updating during input (defeats visualization) — board must stay read-only until submit.
- **AP-CHESS-55** — Calc grading only the first move (that's Tactics, not calculation) — grade the whole line vs PV.
- **AP-CHESS-56** — Vision `hangingPieces` ignoring defenders (false positives) — require attacked AND net-winning capture.
- **AP-CHESS-57** — Interleave breaking due-priority (resurfacing not-yet-due cards) — reorder only within the due set, bounded.
- **AP-CHESS-58** — Auto lapse-set silently overwriting a user's existing set — namespaced id + don't clobber.

## §10 Rollback
New `calc/`, `Calculate.svelte`, `schedule.ts`, vision additions, View-union arms. No schema. Revert per sub-feature (3a/3b/3c independent).

## §11 Follow-up
"Find the plan" positional trainer; blindfold sequences in vision; FSRS for endgames/guess; spaced calc.
