# Spec — `played-game-review`: one-click in-app analysis (no PGN paste)

**Scope:** feature (UX enabler) · **Status:** V1 · **Date:** 2026-06-01
**Added per user directive:** "UI must be the simplest / most user-friendly; avoid external manipulations."
This is the enabler the other specs build on — it removes the only external manipulation in the loop.

---

## §0 Context
[Play.svelte](../src/ui/Play.svelte) persists every finished game to the `games` store (`finishGame`,
line 158) but offers **no** analysis. The only path today is the on-screen tip (Play.svelte:217):
*"import the game in Analyse"* — the user must **copy the PGN and paste it into [Import.svelte](../src/ui/Import.svelte)**.
That is an external manipulation. The analysis pipeline already supports played games end-to-end:
`runAnalysis(...)` (used by Import) persists `gameAnalyses` + personal puzzles, `GameAnalysis.source`
already has the value `'played'`, and `loadAllAnalyses()` (used by Dashboard/Play steering) reads them
back. **Only a one-click UI hook is missing.**

## §1 Empirical baseline
- `games` store keyed `g:<ts>` holds `{pgn, result, botElo, playedAt, coached}` (db.ts:71/109).
- `runAnalysis(engine, puzzles, {gameId,pgn,playerColor,source,baseRating,now,movetimeMs,onProgress})` is the exact call Import makes; it returns `{analysis, puzzles}` and persists `gameAnalyses`/`puzzles` (consumed by Dashboard's `loadAllAnalyses`).
- Import's result panel (stat row + explained mistakes) is inline in Import.svelte → duplicating it in Play would violate DRY. Extract a shared component.
- 135 tests baseline; `svelte-check` clean. AP-CHESS alloc 45–47; ADR-0022.

## §2 Scope
**In:**
- Extract Import's result panel into a reusable `src/ui/AnalysisResult.svelte` (props: `analysis`, `puzzlesMade`). Import renders it; Play reuses it. **This is where `eval-graph`'s `EvalGraph` + critical-moments live**, so both entry points get the curve for free.
- Add an **"Analyse this game"** button to Play's game-over screen → runs `runAnalysis` on the just-finished game (`source:'played'`, `gameId = rec.id`), shows a progress bar (engine is in a worker — non-blocking), then renders `<AnalysisResult>` inline.
- Replace the "copy/paste into Analyse" tip with the one-click action.
**Deferred:** auto-analysing every game without a click (compute cost; keep it explicit/opt-in); batch-analysing the whole `games` history (§11).

## §3 Pre-flight gates
1. `runAnalysis` persists `gameAnalyses` + puzzles (verify: Dashboard reads them after Import). If the caller must persist, replicate Import's persistence.
2. `games` records carry a valid PGN (`game.pgn()` at finish).
3. Player color in `Play` is White today (`playerColor='white'`) — pass `'w'`.
4. 135 tests green; `svelte-check` clean.

## §4 Phase A — code
- `AnalysisResult.svelte` (new): move the `status==='done'` markup from Import.svelte (stat row, puzzles-made line, "see dashboard", the explained-mistakes `<details>` list) into it. Import.svelte imports and renders it (no behaviour change to Import).
- `Play.svelte`: when `status==='over'`, render an "Analyse this game" button. Handler mirrors Import's `analyze()` but reads `pgn = game.pgn()`, `gameId = g:<ts>` of the just-saved record, `playerColor='w'`, `source:'played'`. Reuse the progress bar. On done, render `<AnalysisResult {analysis} {puzzlesMade}/>` below the board. Guard against double-runs (AP-CHESS-45): if a `gameAnalyses` row for this `gameId` exists, label the button "View analysis" and skip re-running.
- Update the tip text: remove the external import instruction; state the game becomes puzzles/feeds the dashboard with one click.

## §5 Phase B — tests
- A small store/integration test: after the played-game analyse path, a `gameAnalyses` row with `source:'played'` exists for the game id, and any generated puzzles are persisted. (Logic of `runAnalysis` already covered by existing tests.)

## §6 Phase C — verification
- Manual: play a quick game vs the bot → resign/finish → "Analyse this game" → progress bar → curve + mistakes render inline; puzzles appear in Tactics; the game shows on the Dashboard; **no paste anywhere**.
- Re-clicking shows "View analysis", not a re-run.
- `npm test` green; `svelte-check` clean.

## §7 Phase Z — docs
- Append **ADR-0022 — "One-click played-game review (no PGN paste); shared AnalysisResult component"** to [decisions.md](../decisions.md), superseding the manual copy/paste workflow noted in Play's tip. Append-only; cross-link ADR-0006 (batch analysis).
- README: note that games you play in-app become puzzles/weakness data with one click (paste-import remains for external games).

## §8 Acceptance criteria
1. "Analyse this game" on Play's game-over screen runs the same pipeline as Import, no paste.
2. `AnalysisResult.svelte` is shared by Import and Play (no duplicated result markup).
3. The played game is persisted/analysed with `source:'played'`; puzzles + dashboard update.
4. Double-run guarded (View vs re-Analyse).
5. Progress bar keeps the UI responsive (worker); tip no longer instructs an external import.
6. 135 + new test pass; `svelte-check` clean; ADR-0022 + README updated.

## §9 Anti-patterns
- **AP-CHESS-45** — Re-analysing the same played game on every click (must detect an existing `gameAnalyses` row).
- **AP-CHESS-46** — Running analysis on the main thread / freezing the board (use the existing worker + progress bar).
- **AP-CHESS-47** — Leaving the contradictory "copy/paste into Analyse" tip after shipping the one-click path.

## §10 Rollback
Revert Play.svelte hook + the tip; inline `AnalysisResult` back into Import (or keep the component — it's behaviour-neutral). No schema/migration (uses existing `games`/`gameAnalyses` stores).

## §11 Follow-up
- Optional "Analyse all my games" batch over the `games` history.
- An "Analyse" affordance from a future game-history list.

## Integration note
Sequence **after `eval-graph`** (so `AnalysisResult` embeds `EvalGraph`). Once shipped,
`missed-win` and `comeback` automatically draw on played games — no paste, fully in-app.
