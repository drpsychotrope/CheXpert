# Spec — Phase 1: MVP backbone (client-side)

**Status:** V1 (draft-general output) · **Scope:** feature (greenfield) · **Premise:** REAL (this is the foundation; nothing depends on unbuilt code).

> This is the **executable foundation** spec. Phases 2–4 specs depend on the code this spec produces and are explicitly marked ESTIMATED until this ships.

---

## §0 Context

Greenfield build of a client-side chess **progression trainer** (not a Chess.com clone). The product's single reason to exist is to make the player gain real Elo per hour of practice, via one closed loop: *play → auto-analysis → weakness diagnosis → personalised puzzles → spaced repetition → opponent that probes the gaps → play*. Phase 1 builds the spine of that loop's left half: an **adaptive opponent**, a **tactical trainer**, and the **player model** that later phases read and write.

Baseline (`reports/phase1-mvp_baseline.json`): empty repo, not a git repo, 0 LOC. All numeric targets here are **execution-time gates**, not measured anchors (there is no code to measure yet).

## §0.5 Arbitrages — RESOLVED (user decisions 2026-05-31)

All blocking decisions made; baked into the spec below. Full record in `reports/chess-trainer_arbitrages.md`.

- **Q-A Licensing → (b) Local-only / no distribution.** GPL-3.0 obligations do NOT trigger while the app is not distributed/hosted publicly. Keep chessground + Stockfish. Document the posture; **no project `LICENSE` adopted yet** — ship `ATTRIBUTION.md` only. If you ever distribute/host, GPL-3.0 source-publication kicks in → revisit (and AGPL if Q-C ever picks multi-thread). See ADR-0002.
- **Q-B Maia → (a) Stockfish-calibrated only for v1.** Maia deferred to Phase 4. See ADR-0003.
- **Q-C Engine build → (a) Hybrid.** Lite single-thread default (no COOP/COEP); fixed movetime/ply + background-incremental for Phase 2 batch; multi-thread only where host supports headers. See ADR-0004.
- **Q-D UI framework → (a) Svelte.**
- **Q-E Puzzle subset → (a) build-time Node ETL → ~50–100k curated**, shipped compressed, seeded into IndexedDB on first run.
- **Q-F Gaffe metric → (a) win-probability delta** (Phase 2).
- **Q-G Project location → (a) build in `D:/Download/Chess`, `git init` in place.**

**New requirement (user 2026-05-31): launch-time skill evaluation.** Designed as two-stage adaptive onboarding — see §2 item 7 and §4 item 8. Decision recorded in ADR-0005.

## §1 Empirical baseline

| Fact | Value | Source |
|---|---|---|
| Repo state | empty except `.claude/`, not git | scan 2026-05-31 |
| LOC | 0 | greenfield |
| Toolchain | node v20.20.2 · npm 10.8.2 · git 2.54.0 (VERIFIED) | scan 2026-05-31 |
| Deps (verified) | chess.js 1.4.0 BSD-2 · chessground 9.2.1 GPL-3.0 · stockfish 18.0.7 GPL-3.0 · idb 8.0.3 ISC · vite 8.0.14 MIT | npm view 2026-05-31 |

⚠ **Engine packaging:** the npm `stockfish` package unpacks to **~251MB** (all builds). Copy **only the lite single-thread WASM+JS asset** into `public/stockfish` and load that — never depend on the whole package at runtime (G3). `lila-stockfish-web` (modern multi-thread) is **AGPL-3.0** — only relevant if Q-C picks multi-thread.

## §2 Scope

**IN (Phase 1):**
1. Project skeleton — Vite + TypeScript (strict) + **Svelte** (Q-D=a), PWA manifest + service worker, Web Worker + WASM build config.
2. Game model — chess.js for rules/legality/FEN/PGN; chessground board with move input, promotion, legal-dest highlighting, check/mate/draw detection, arrows/circles.
3. Engine worker — Stockfish lite single-thread in a **Web Worker**, UCI wrapper (`init / setLevel / go / bestmove / stop|terminate`).
4. Adaptive opponent — `UCI_LimitStrength` + `UCI_Elo` (1320–3190); per-game win-rate tracker; adjust target Elo ±50–100 per game toward a ~55% player win band.
5. Tactical trainer — curated Lichess puzzle subset loader; **active-recall** solve loop (player plays the move; solution is never auto-played); multi-move lines step through opponent replies; Glicko-2 update of both player and puzzle rating.
6. Player model — IndexedDB (via `idb`): stores for games, puzzleAttempts, playerModel (ratings + RD + volatility + nascent weakness counters), settings.
7. **Launch-time skill evaluation (two-stage adaptive onboarding)** — required on first run, re-runnable from Settings:
   - **Stage 1 — adaptive puzzle ladder (always).** ~6–10 puzzles, start mid (~1200–1300), step difficulty by result (Glicko-2 over the puzzle subset). Seeds the **puzzle rating** with a real RD.
   - **Stage 2 — short calibration game (optional, recommended).** One game vs Stockfish at strength set from Stage 1 + the declarative self-rating. After **each player move**, run a quick fixed-depth single-position eval (≈100–300ms) and accumulate **ACPL** (average centipawn loss). Game result + ACPL → seeds the **game rating**. Skippable.
   - **Skip path.** If Stage 2 skipped → provisional game rating derived from puzzle rating + declarative self-rating with a **wide RD**, refined over the player's first real games via Glicko.
   - **2–3 declarative questions** (self-rated level, goal, prior platform rating if any) bias the priors and set initial RD.
   - Seeds **both** a puzzle rating and a game rating (brief wants both; they are not the same — AP-CHESS-5). Stage 2 uses live single-position eval, **not** Phase 2 batch analysis (which doesn't exist yet); Phase 2 later upgrades Stage 2 to a fully analyzed game.
8. Minimal UI shell — Home / Play / Tactics / Settings; "everything stays on your device" privacy notice.

**DEFERRED (later phases, do not build now):**
- PGN import + batch analysis + gaffe classification + motif tagging + "From your games" generator + weakness dashboard → **Phase 2**.
- FSRS scheduling + opening repertoire + endgame trainer (Syzygy) → **Phase 3**.
- NL analysis, Guess-the-move, calc/visualisation drills, Woodpecker fixed-set mode, Maia → **Phase 4**.

**Single-concern guard:** Phase 1 ships the spine only. Resist pulling Phase 2 analysis forward "while we're here."

## §3 Pre-flight gates (re-verify reality before any edit)

| Gate | Check | Stop-if-fail |
|---|---|---|
| G1 | `node --version` ≥ 18, `npm`, `git` present; `git init` done (Q-G) | yes |
| G2 | `npm install` of pinned deps succeeds (versions/licenses already verified in `dep_check.json`); confirm lockfile | yes |
| G3 | The **lite single-thread** WASM asset (extracted from the ~251MB `stockfish` 18.0.7 package, not the whole package) loads inside a Worker and answers `uci` → `uciok` and `isready` → `readyok` with **no** COOP/COEP headers; record its real filename + size | yes — if it needs headers, escalate Q-C |
| G4 | chessground renders a board and emits legal moves wired to chess.js | yes |
| G5 | Curated puzzle subset asset present, parses, and seeds IndexedDB (see Q-E) | yes |

## §4 Phase A — code (ordered; code before docs)

1. **Skeleton:** Vite + TS strict; dir layout `src/{engine,game,trainer,rating,store,ui,calibration}`, `public/{stockfish,puzzles}`, `scripts/` (ETL). PWA manifest + service worker (cache app shell + engine wasm + puzzle subset). Vite config: worker format `es`, wasm asset handling, dev-server COOP/COEP toggle left **off** by default (Q-C).
2. **Engine worker** (`src/engine/stockfish.worker.ts` + `EngineClient`): UCI message protocol; promise-based `bestmove`/`eval`; **interruption = terminate+respawn worker** (lite single-thread ports cannot be stopped mid-search). Single long-lived worker reused across moves.
3. **Game model** (`src/game/`): chess.js wrapper — legal dests map for chessground, promotion handling, terminal-state detection, FEN/PGN in/out.
4. **Adaptive opponent** (`src/engine/AdaptiveOpponent.ts`): map target Elo → `setoption UCI_LimitStrength true` + `UCI_Elo <n>` (clamp 1320–3190; UCI_Elo takes precedence over Skill Level). Win-rate tracker over a sliding window; after each game adjust target ±50–100 toward the 55% band. Persist target in playerModel.
5. **Glicko-2** (`src/rating/glicko2.ts`): player rating + RD + volatility; puzzles seed from dataset `Rating`/`RatingDeviation`. Pure, unit-tested against known vectors. Used by both the opponent (game rating) and the trainer (puzzle rating) — keep the two ratings separate.
6. **Puzzle store** (`src/store/` + `src/trainer/PuzzleRepo.ts`): seed curated subset into IndexedDB on first run; query by rating window ± theme/phase filters; return next puzzle in the player's zone.
7. **Tactical trainer** (`src/trainer/`): present FEN; player makes moves on the board (active recall); validate each ply against the solution line; auto-play only the *opponent's* forced replies; on success/fail update Glicko-2 for player and puzzle; record a `puzzleAttempt` (id, result, ms, themes).
8. **Launch-time skill evaluation** (`src/calibration/`):
   - `PuzzleLadder` — adaptive ladder (start mid, step by result) over ~6–10 puzzles → puzzle rating + RD via Glicko-2.
   - `CalibrationGame` — short game vs Stockfish; after each player move call `EngineClient.eval(fen, fixedDepth)` (single position, ~100–300ms), accumulate ACPL; map (result, ACPL, move count) → seed game rating. **Reuses the Phase-1 engine worker** — no batch analysis.
   - `acplToElo(acpl)` — pure, unit-tested mapping (monotonic decreasing; calibrate the curve empirically, treat thresholds as gates not anchors per §3.3).
   - Skip Stage 2 → derive provisional game rating from puzzle rating + self-rating, wide RD. Declarative questions set priors. Persist both ratings + RDs to playerModel. Re-runnable from Settings (Glicko RD already enables continuous re-calibration).
9. **Persistence** (`src/store/db.ts`, `idb`): schema **v1** — stores `games`, `puzzleAttempts`, `playerModel`, `settings`; versioned `upgrade()` with a migration scaffold for Phase 2+.
10. **UI shell** (`src/ui/`): Home, Play (board + opponent + optional "coached" gaffe-warning toggle), Tactics (trainer), Settings (privacy: local-only by default; export/clear data). Privacy notice on first run.

## §5 Phase B — tests (Vitest)

- **Unit:** chess.js wrappers (dests, promotion, terminal states); Glicko-2 math vs published vectors; opponent Elo-mapping + ±band adjustment logic; puzzle query filters.
- **Worker integration:** engine boots, answers `uci`/`isready`, returns a parseable `bestmove` for a known FEN; interruption respawns cleanly.
- **Store:** IndexedDB round-trip (fake-indexeddb) for each store; schema upgrade path.
- **Flow (light e2e):** play one move vs opponent; solve one scripted puzzle end-to-end (active recall path) and one failed attempt.
- **Calibration:** puzzle ladder converges (a scripted all-correct run lands higher than an all-wrong run); `acplToElo` monotonic on fixtures; Stage-2-skip path yields a provisional game rating with wide RD.
- **Fixtures:** a handful of known FENs + 3–5 puzzles with known solution lines and themes.

## §6 Phase C — verification (acceptance gates)

| Gate | Target | How to measure |
|---|---|---|
| Engine latency | **< 1s** per opponent move on a mid-range laptop | time `go` → `bestmove` at the active level; log p50/p95 |
| Puzzle load | near-instant (**< 200ms**) from cache | time PuzzleRepo.next() after seed |
| Opponent calibration | win-rate trends toward **55%** band | simulate N games at fixed skill; assert target Elo adjusts correct direction |
| Rating sanity | Glicko-2 monotonic + bounded | property tests |
| Persistence | survives reload | seed → reload → assert state |
| Calibration | seeds both ratings; ladder converges; Stage-2 game ACPL → plausible game Elo | run onboarding, assert puzzle+game rating + RD persisted |
| No main-thread block | UI responsive during search/calibration eval | engine confined to worker (AP-CHESS-1) |

## §7 Phase Z — docs (LAST)

- `README.md` — what/why, build/run, privacy stance, **licensing posture (Q-A=b): local/personal use; GPL-3.0 components present; distributing or hosting publicly triggers GPL-3.0 source obligations → revisit then**.
- **No `LICENSE` file yet** (Q-A=b — not distributing). Ship `ATTRIBUTION.md` instead — Lichess puzzles/openings CC0; chess.js BSD-2; chessground GPL-3.0; Stockfish GPL-3.0.
- `decisions.md` — append-only ADRs: ADR-0001 stack, ADR-0002 licensing=local-only (Q-A=b), ADR-0003 Maia deferred (Q-B=a), ADR-0004 engine build=hybrid (Q-C=a), **ADR-0005 launch-time skill evaluation = two-stage (puzzle ladder + optional ACPL calibration game)**. New entries appended; never amend prior; cross-link supersedence.

## §8 Acceptance criteria

- [ ] G1–G5 pre-flight gates all pass and `dep_check.json` updated with real versions/licenses.
- [ ] Can play a full game vs the adaptive Stockfish; engine moves < 1s; target Elo adjusts toward 55% across games.
- [ ] Can solve puzzles via **active recall**; solution is never auto-revealed; player + puzzle Glicko ratings update.
- [ ] **Launch-time evaluation runs on first run:** puzzle ladder seeds a puzzle rating; optional calibration game (live ACPL) seeds a game rating; skip path yields a wide-RD provisional game rating. Both ratings + RDs persist. Re-runnable from Settings.
- [ ] All state persists in IndexedDB across reloads; nothing leaves the device.
- [ ] `npm test` green; engine isolated in a worker.

## §9 Anti-patterns

- **AP-CHESS-1** — engine on the main thread. Must be a Web Worker.
- **AP-CHESS-2** — passive puzzles (solution auto-plays). Must be active recall: the player plays the move.
- **AP-CHESS-3** — localStorage for volume data. Use IndexedDB.
- **AP-CHESS-4** — shipping the full ~5.94M-puzzle DB to the client. Ship a curated subset only.
- **AP-CHESS-5** — selling puzzle rating as *the* measure of strength. It correlates weakly with playing strength; surface it honestly.
- **AP-CHESS-6** — making Stockfish "weak" via random/blunder injection. Use `UCI_LimitStrength`+`UCI_Elo` (instructive, not broken).
- **AP-CHESS-7** — blocking the UI on any engine/store batch op.
- **AP-CHESS-8** — sending any data off-device without explicit consent.
- **AP-CHESS-23** — onboarding too long/punishing (friction kills first-run). Cap the ladder (~6–10), make Stage 2 skippable, never block entry on calibration.
- **AP-CHESS-24** — treating the calibration ACPL→Elo curve as a hard anchor. It's a rough seed with a wide RD; let Glicko refine it over real games. Don't present the launch number as a precise rating.

## §10 Rollback

Greenfield → per-feature commits on a branch off `main`. Each Phase A item is independently revertable. If G3 fails (engine needs headers), stop and resolve Q-C before continuing — do not hack headers into an incompatible host.

## §11 Follow-up

- **Phase 2** (`specs/phase2-loop-spec.md`) — PGN import → batch analysis → gaffe/motif tagging → "From your games" → weakness dashboard. **The differentiator.** Also **upgrades onboarding Stage 2** from live single-position ACPL to a fully analyzed calibration game (reuses the new batch analyser) for a sharper initial game rating.
- **Phase 3** (`specs/phase3-retention-spec.md`) — FSRS + endgames (Syzygy).
- **Phase 4** (`specs/phase4-refinements-spec.md`) — NL analysis, guess-the-move, calc drills, Woodpecker, Maia.
