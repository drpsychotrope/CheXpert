# Spec — Phase 2: the differentiating loop

**Status:** V2 (re-baselined against real Phase 1 code 2026-05-31) · **Scope:** feature
> ✅ **PREMISE RE-BASELINED.** Phase 1 shipped (commit 8c2e999). Verified integration points against real code:
> - `ChessGame` (`src/game/ChessGame.ts`): `loadPgn`/`history`/`move`/`moveUci`/`terminal`/`fen`/`turn`. No per-ply FEN accessor → the PGN parser uses chess.js verbose history (`before`/`after`/`captured`/`san`/`lan`) directly.
> - `EngineClient` (`src/engine/EngineClient.ts`): `evaluate(fen,{depth|movetime}) → {bestmove,whiteCp,score,depthReached}`, injectable worker factory (fake engine in tests). **Added** `analyzeLines(fen,{multipv})` for uniqueness checks; new `parseMultiPv` in `uci.ts` (left `parseInfo` untouched to preserve its tests).
> - DB v1 cached-connection + `closeTrainerDB`; `puzzles` store has a `source` index → personal puzzles reuse it via `PuzzleRepo.addPuzzles`. v2 migration adds `importedGames` + `gameAnalyses`.
> - Win-probability uses the Lichess logistic on White-POV cp (mate already clamped by `scoreToWhiteCp`).

---

## §0 Context

This is **the part no existing tool does end to end**: turn the player's own losses into personalised training. Lichess has puzzles, Aimchess has weakness analytics, Chessable has spaced repetition — none wires *your blunders → your puzzles → your weakness profile → an opponent that probes them*. Phase 2 builds the diagnosis half of the loop.

Depends on Phase 1: chess.js game model, the Stockfish engine worker + `EngineClient`, IndexedDB store, Glicko ratings, the tactical trainer (consumes generated puzzles), onboarding calibration (Stage 2 gets upgraded here).

## §0.5 Arbitrages — RESOLVED (2026-05-31)

- **Q-C Engine build → (a) Hybrid.** Lite single-thread default; for batch analysis use a **fixed movetime/ply** budget + **background-incremental** analysis (don't block the user); multi-thread (`lila-stockfish-web`, AGPL) only where the host can set COOP/COEP. The < 30s/40-move target stays a **perf gate (G2)** — if single-thread misses it at acceptable depth, fall to background-incremental or opt-in multi-thread. See ADR-0004/ADR-0006.
- **Q-F Gaffe metric → (a) win-probability delta** (consistent across eval ranges; centipawn fallback). See ADR-0005-P2.
- **Resilience dimension → defined** as *eval recovery rate after falling behind* (does the player's eval recover after dropping to a disadvantage?). Confirm at execution.

## §1 Empirical baseline *(to capture against real Phase 1 code)*

| To measure at exec time | Why |
|---|---|
| Phase 1 `EngineClient` API surface | Phase 2 batch analysis reuses it |
| Single-ply analysis time at depth D / movetime T on target hardware | Drives the < 30s/40-move feasibility (Q-C) |
| IndexedDB schema v1 shape | Phase 2 adds stores via migration, must not break v1 |
| Phase 1 calibration Stage 2 (`CalibrationGame`) hooks | Phase 2 upgrades it to a fully analyzed game |

## §2 Scope

**IN:**
1. **PGN import** — single game + bulk; parse via chess.js; store raw + parsed in IndexedDB (new store `importedGames`).
2. **Batch analysis** — run Stockfish over every ply of each game; capture eval (cp / mate) per ply. Must not block UI (worker + chunked/yielding). Honour the < 30s gate (Q-C=a hybrid).
3. **Gaffe classification** — per ply, label inaccuracy / mistake / blunder via **win-probability delta** (Q-F=a) with a centipawn fallback. Defaults (tunable): inaccuracy ≈ 5–10% win-prob drop, mistake ≈ 10–20%, blunder ≈ ≥20% (or mate-loss).
4. **Motif tagging** — tag the *missed* motif of each significant gaffe using the **same 64-theme taxonomy** as the Lichess puzzle DB (fork, pin, skewer, backRankMate, deflection, discoveredAttack, …). Heuristic detectors over the engine's best line + position features.
5. **Phase tagging** — opening / middlegame / endgame (by move number + material).
6. **Time tagging** — if the PGN carries clock data, flag time-management leaks (too fast before a blunder; long think then error).
7. **"From your games" generator** — for each significant gaffe where a clearly better, reasonably **unique** move existed: emit a puzzle = FEN *before* the best move, solution = the engine's principal variation. Dedup; store in the puzzle store with a `source: personal` flag so the Phase 1 trainer serves them.
8. **Weakness dashboard** — radar across dimensions: tactics, endgame conversion, opening accuracy, time management, resilience/rebound — each **benchmarked against the player's level band**, with one-click drill into the matching exercises.
9. **Calibration Stage 2 upgrade** — replace Phase 1's live single-position ACPL with a fully analyzed calibration game (reuses the new batch analyser) for a sharper initial game rating. Keep the Phase 1 path as fallback.

**OUT / DEFERRED:** FSRS scheduling of these personal puzzles → Phase 3. NL "why" explanations → Phase 4. Opponent *consuming* the weakness profile to probe gaps → Phase 4 (loop closure).

## §3 Pre-flight gates

| Gate | Check | Stop-if-fail |
|---|---|---|
| G1 | Phase 1 shipped; `EngineClient` + store + trainer + calibration present and green | yes |
| G2 | **Perf probe:** analyse a real 40-move PGN end-to-end; measure wall time | if > 30s → apply Q-C=a fallback (background-incremental / opt-in multi-thread) before building the generator |
| G3 | IndexedDB v1 → v2 migration adds new stores without data loss | yes |
| G4 | Win-probability model chosen + unit-tested (Q-F=a) | yes |

## §4 Phase A — code (ordered)

1. PGN import + `importedGames` store (schema v2 migration).
2. Batch analyser: queue plies → `EngineClient` at a fixed per-ply budget; yield to UI between plies; persist per-ply eval. Honour the < 30s gate — if infeasible single-thread, apply Q-C=a (movetime cap, background analysis, or opt-in multi-thread + COOP/COEP).
3. Win-probability + gaffe classifier (Q-F=a), with thresholds in settings.
4. Motif/phase/time taggers; reuse the puzzle-DB theme vocabulary.
5. "From your games" generator: gaffe → uniqueness check → puzzle record (`source: personal`, themes, sourceGameId).
6. Weakness aggregator: roll attempts + game gaffes into the radar dimensions; compute level-band benchmark.
7. Dashboard UI (Svelte): radar + drill-through to trainer filtered by weak dimension.
8. Calibration Stage 2 upgrade: analyzed-game path reusing the batch analyser.

## §5 Phase B — tests

- PGN parse round-trip (incl. clock comments).
- Classifier on fixtures with known cp/win-prob → expected labels.
- Motif tagger precision on a labelled fixture set (track false-positive rate — see AP-CHESS-9).
- Generator: rejects positions with no unique clearly-better move (AP-CHESS-10); dedups.
- Migration v1→v2 preserves Phase 1 data.

## §6 Phase C — verification

| Gate | Target |
|---|---|
| 40-move game analysed | **< 30s** client-side (the headline benchmark) |
| UI responsive during batch | no main-thread stall (AP-CHESS-11) |
| Generated puzzles | solvable, unique solution, correctly themed on fixtures |
| Dashboard | dimensions populate and benchmark vs band |

## §7 Phase Z — docs

- `decisions.md` (append): ADR-0006 batch-analysis strategy (Q-C=a resolution), ADR-0007 motif-tagging approach + fallback, ADR-0008 gaffe metric = win-prob delta (Q-F=a). New entries appended; never amend prior.
- README: PGN import + dashboard usage; restate privacy (analysis is local).

## §8 Acceptance criteria

- [x] Import a PGN, get per-ply evals, gaffes labelled, motifs/phase/time tagged.
- [x] Significant gaffes become personal puzzles served by the trainer (verified: 2 generated + stored + drillable).
- [x] Radar dashboard benchmarks the player vs their level band with drill-through (verified in browser).
- [x] 40-move analysis < 30s (measured in-browser: 20.4s for 80 plies / 81 evals @200ms); v1→v2 migration additive.
- [ ] Calibration Stage 2 upgraded to analyzed-game path — **DEFERRED**: Phase 1's live ACPL path already
      seeds the game rating acceptably; folding the batch analyser into onboarding is low-value vs. Phase 3.
      Tracked as a follow-up, not a blocker. (Single-concern: it doesn't belong in the import/dashboard PR.)

## §9 Anti-patterns

- **AP-CHESS-9** — motif mis-tagging. Tagging engine lines to the 64-theme taxonomy is the hardest part; require a confidence threshold and a fallback (tag by phase + gaffe magnitude when the motif is uncertain) rather than confidently wrong tags.
- **AP-CHESS-10** — generating puzzles from positions with no unique best move (multiple equal moves → unscored, frustrating). Require a clear eval gap to the second-best.
- **AP-CHESS-11** — batch analysis blocking the UI. Chunk + yield, keep it in the worker.
- **AP-CHESS-12** — raw centipawn thresholds across all eval ranges (a 200cp swing means different things at ±50 vs ±900). Use win-probability delta.
- **AP-CHESS-13** — over-claiming the dashboard. Benchmarks are directional, not a published-study-grade verdict (intellectual honesty per brief).

## §10 Rollback

Per-feature commits. The v1→v2 migration is the one irreversible step — gate it (G3) and back up the object stores (export) before first run.

## §11 Follow-up

Phase 3 schedules these personal puzzles with FSRS; Phase 4 closes the loop (opponent reads the weakness profile) and adds NL "why".
