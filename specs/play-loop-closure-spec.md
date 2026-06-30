# Spec — play-loop closure (feature PR P1)

**PR**: `play-loop-closure` · **Scope**: feature (single concern: close the play→analysis→steering loop without a manual click) · **Portfolio**: P1 of `enhancements-architecture-spec.md` (dep **F5**)
**Drafted**: 2026-06-30 · **Spec version**: V1 (4 refiner cycles + 3 enrich cycles; FOLD set of 6 applied — `reports/play-loop-closure_{arbitrages,improvements}.md`) · **Pre-V0 scan**: PASS (`reports/play-loop-closure_{target_exists,baseline,collision}.json`)
**New ADR**: none (feature PR; reuses F5's read API + additive persistence + a sequential queue — no new architectural primitive; doctrine: feature PRs default to no ADR).

---

## §0 Context

The play→analysis→steering loop is the product's spine: you play a game, it gets analysed, the analysis (a) mints personal puzzles, (b) folds motif tags into `weaknessCounters`, and (c) feeds `loadAllAnalyses()` so the **next** game's opening is steered toward your weakest area (`Play.svelte:159-168` → `selectOpening`/`steeringNote`). `play.tip` even promises this in-product ("The bot then steers future openings toward whatever you're weakest at").

**But the loop only closes if the user manually clicks "Analyse this game" while still on the game-over screen.** Empirically (pre-V0, confirmed):

- `analyzePlayed()` hard-gates on `lastGame` (`Play.svelte:456`: `if (!lastGame || !model) return;`).
- `lastGame` is **component-local `$state`** (`Play.svelte:81`), set in `finishGame()` (`:451`) and **cleared on `newGame()`** (`:132`).
- The Analyse button only renders while `status==='over' && lastGame && variant!=='chess960'` (`:619`). Navigate away (Play unmounts; `lastGame` is component-scoped) or start a new game → the affordance is gone and the game is **never analysed**.
- Consequence chain: no `gameAnalyses` row → no personal puzzles → no `weaknessCounters` fold → `loadAllAnalyses()` stays empty → `buildWeaknessProfile().weakest` is `null` → `selectOpening(botColor, null, rng)` weights every opening 1:1 (neutral variety) and `steeringNote(...)` returns "Playing the X" (neutral). **The promised steering silently degrades to nothing.**

This PR (**PL2** fold) closes the loop so it fires even when the user never clicks Analyse — by making "which games are unanalysed" a durable, surfaced fact and giving a low-friction, engine-safe way to clear the backlog.

**Dependency (the contract P1 consumes):** F5 (`specs/games-store-pgn-io-spec.md`, V1) makes the `games` store readable: `getAllGames(): GameRecord[]` and `getAnalyzedGameIds(): Set<string>`. F5 §11 explicitly names P1 as its follow-up. **F5 builds first; P1 imports these — it does not define them.**

## §0.5 Arbitrages (recommended defaults; resolved → V1 after refiner)

> Defaults below are **applied to the V1 body**. Flip any to re-fold. Full rationale in `reports/play-loop-closure_arbitrages.md`.

- **Q-A — how the loop closes when the user doesn't click Analyse.** Options: (a) **persist a single "last unanalysed gameId"** and offer to analyse it; (b) **auto-run analysis on finish**; (c) **derive the unanalysed *set* from F5's reads + offer a user-initiated "Analyse all" (sequential queue)**. **Recommend (c) as the primary path, with (b) available as an OPT-IN setting.** Pre-V0 correction: F5's `getAnalyzedGameIds()` makes a persisted single-gameId **redundant and strictly weaker** — it only tracks the *last* game and goes stale the moment a second game finishes unanalysed, whereas the derived read covers the **whole backlog** with **zero schema change**. So the task's "persist last-unanalysed" is superseded by the stronger derived-read; auto-run stays an optional toggle (Q-C governs its safety). The persisted-gameId design is kept as a documented alternative only.
- **Q-B — where the "N games not analysed" affordance lives.** Options: (a) Play game-over screen only; (b) Dashboard badge only; (c) **both — a Play game-over "analyse your N unanalysed games" entry AND a Dashboard "N unanalysed" badge/section, reusing F5's history list.** **Recommend (c).** Play game-over is the natural moment (you just finished one); the Dashboard badge is the durable re-entry that survives navigation (badge precedent: `dueReview` in `App.svelte`/`Home.svelte`). No new top-level `View`.
- **Q-C — analysis is heavy (engine, per-position search); guard against auto-running many at once.** Options: (a) fire them all in parallel; (b) **sequential queue, user-initiated batch, with progress + cancel + per-run cap**; (c) cap N per run only. **Recommend (b)** (and if Q-A's opt-in auto-run is enabled, it analyses **only the one** just-finished game, never the backlog — backlog is always user-initiated). Sequential because the engine is a single worker (`app.engine`); parallel calls would contend and the analysis path forces full strength. The per-run cap (`maxPerRun`) bounds engine time on a huge backlog ("M remaining — resume").
- **Q-D — `playerColor` provenance for the backlog runner (surfaced empirically at refiner cycle 1).** `runAnalysis` requires `playerColor`, but a **stored played-game PGN has no `[White]`/`[Black]` headers** (`finishGame()` writes bare `game.pgn()`, `Play.svelte:432-449`), so `parsePgn`+`inferPlayerColor` return `null` for played games (`pgn.ts:94-109`). The Play tail only works because `playerColor` is in component scope (`Play.svelte:478`) — the exact thing P1 loses. Options: **(D-a)** add additive-optional `playerColor?: 'w' | 'b'` to `GameRecord`, set in `finishGame()`, read by the runner; **(D-b)** inject `[White]/[Black]` headers into the played PGN at write so `inferPlayerColor` recovers it. **Recommend (D-a)** — smallest, explicit, no PGN re-serialisation, no name heuristic; mirrors the additive-optional pattern (`?? undefined`), **no `DB_VERSION` bump**. Legacy played records (pre-P1) lack the field → the runner falls back to per-game analysis from the Play tail / F5 history (where color was available) or skips them from the auto-batch with a "needs manual analyse" note. (Full rationale: `reports/play-loop-closure_arbitrages.md` D1/Q-D.)

## §1 Empirical baseline

From `reports/play-loop-closure_{target_exists,baseline,collision}.json` (2026-06-30):

| Fact | Value |
|---|---|
| `analyzePlayed()` gate | `if (!lastGame || !model) return;` (`Play.svelte:456`) — broken loop root |
| `lastGame` | component `$state` (`Play.svelte:81`), set `:451`, **cleared `:132`** (newGame) |
| Analyse button visibility | `status==='over' && lastGame && variant!=='chess960'` (`:619`) — gone on navigation/new game |
| `finishGame()` | idempotent via `gameFinished` (`:405`); writes `GameRecord` (`putGame`, `:450`); id `g:${now}` (`:430-431`) |
| `runAnalysis(source:'played')` | `runAnalysis.ts:39-83`; persists `gameAnalyses`+puzzles, folds `weaknessCounters`, `invalidateAnalysesCache()` (`:64`) |
| idempotency | **caller-side** via `getAnalysis(gameId)` (`gamesRepo.ts:19`; guard at `Play.svelte:461`) — `runAnalysis` is NOT internally idempotent |
| steering read | `loadAllAnalyses()` → `buildWeaknessProfile().weakest` → `selectOpening`/`steeringNote` (`Play.svelte:159-168`) |
| neutral fallback | `weakest=null` ⇒ uniform opening weights (`openingBook.ts:91`) + "Playing the X" note (`openingBook.ts:131`) |
| `app.steerDimension` | `Dimension\|null` (`app.svelte.ts:61`); coach override, consumed+cleared `Play.svelte:166` |
| **F5 reads (dependency)** | `getAllGames()`, `getAnalyzedGameIds()` — **absent in `src/` today** (only F5 spec/reports); P1 imports them |
| **`playerColor` in stored PGN** | **NOT present** — `finishGame()` writes bare `game.pgn()` (no `[White]/[Black]` headers, `Play.svelte:432-449`); `inferPlayerColor` returns `null` for played games (`pgn.ts:94-109`). ⇒ P1 adds `GameRecord.playerColor?` (Q-D=D-a, additive). |
| `GameRecord` fields | `id,pgn,result,botElo,playedAt,coached,timeControl?,variant?,startFen?` (`db.ts:21-34`) — P1 appends `playerColor?` |
| `AnalysisResult.svelte` | exists; reusable result panel (Import + Play tail) |
| 960 analysis | disabled (AP-960-4); `Play.svelte:625-629` — unanalysed-set MUST exclude 960 games |
| Tests baseline | **504 passed / 69 files** (verified `npm test`) |
| `svelte-check` baseline | **0 errors / 0 warnings / 383 files** (verified `npm run check`) |
| `DB_VERSION` | **4 — no bump in P1** |
| component-test harness | **0 `*.svelte.test.ts`** — verify via pure-core unit tests + wiring-presence + manual/preview |

Collisions: **none** (`unanalyz*`/queue symbols absent; new `play.*` keys absent; no new `View`). ADR: P1 takes none.

## §2 Scope (single concern: close the loop without a manual click)

**In:**
1. **Unanalysed-set selector (pure-ish core)** — `src/analysis/unanalyzedGames.ts` (new): a pure function `unanalyzedPlayedGames(games: GameRecord[], analyzedIds: Set<string>): GameRecord[]` returning **standard** (non-960) played games whose `id ∉ analyzedIds`, newest-first by `playedAt`. 960 games are excluded (AP-960-4). No DB/engine/clock inside → unit-testable. The async wiring (`getAllGames()` + `getAnalyzedGameIds()` from F5) lives in the caller.
2. **`GameRecord.playerColor?` (Q-D=D-a)** — add additive-optional `playerColor?: 'w' | 'b'` to `GameRecord` (`db.ts`), set in `finishGame()` (`playerColor: playerColor[0]`, the side already in scope at write). Read by the batch runner so it analyses each game from the correct POV. **No `DB_VERSION` bump** (`?? undefined`, mirrors `variant?`/`timeControl?`). Legacy played records lack it → the runner skips them from the auto-batch (they remain analysable per-game from the Play tail / F5 history where color was in scope) and shows a "needs manual analyse" hint.
3. **Shared single-game core + sequential batch runner (Q-C=b; FOLD-F-P1-5, F-P1-4).** Extract `analyzeOnePlayedGame(engine, puzzles, model, game, opts)` — the one sequence shared by the Play-tail button, the batch loop, and auto-run: `resetVariant()` (960 clear) → `getAnalysis(game.id)` guard (skip if analysed) → `runAnalysis(source:'played')` with `playerColor: game.playerColor` → return the analysis. Then `analyzeBacklog(engine, puzzles, model, games, opts)` calls it **one game at a time**, with a **per-game try/catch** so a single failure (engine crash/timeout — cf. the existing `engineError` path) is counted (`failed++`), leaves that game in the backlog, and the loop **continues** (never strands progress on already-analysed games). Reports per-game + overall progress, is **cancellable** between games, and is bounded by a per-run cap (`maxPerRun`; default analyses up to N then stops with "M remaining"). Each game's `playerColor` comes from `GameRecord.playerColor` (Q-D); color-less/960 games are pre-filtered by the selector. Reuses the exact Play-tail call shape (`runAnalysis.ts` input at `Play.svelte:472-484`).
4. **Play game-over affordance (Q-B; F-P1-3).** On the over screen, in addition to today's "Analyse this game" (kept), show **"Analyse your N unanalysed games"** when the derived backlog `N>0`, where **`N` is exactly `unanalyzedPlayedGames(...).length`** (the same selector the batch consumes — the count never overstates what will run). Counts the just-finished game until analysed. Clicking runs `analyzeBacklog` with a progress bar (reuse the existing `aProgress`/`aTotal` bar, `Play.svelte:631-636`) and renders the **last** game's `AnalysisResult`; then refreshes `N`.
5. **Dashboard badge → F5 history (Q-B; F-P1-1, F-P1-3).** A "**N unanalysed games**" badge/line on the Dashboard (and/or Home, matching `dueReview` placement), `N` = `unanalyzedPlayedGames(...).length`. When `N>0` it **links to F5's Import history** (where each row already has a per-game analysed marker + Analyse), so the user can analyse **selectively** before committing to a heavy run — rather than blind-firing the whole batch from a badge. The one-click "Analyse all" lives on the Play over-screen (the "I just finished, do them now" moment). Durable re-entry surviving navigation; no new `View`.
6. **Optional auto-run-on-finish setting (Q-A opt-in; F-P1-2).** `SettingsRecord.autoAnalyzeOnFinish?: boolean` (additive-optional; read `?? false`). When `true`, a post-finish hook calls `analyzeOnePlayedGame(...)` for **just the finished game** (never the backlog — Q-C), non-blocking. On success surface a quiet **"analysed ✓"** on the over screen; on failure stay silent — the game simply remains counted in the visible backlog (failure visibility = the count itself, no toast clutter). 960 games never auto-run. **No `DB_VERSION` bump** (mirrors `metacogEnabled?`/`opponentStyle?`).
7. **Bilingual strings** — every new label FR+EN in `src/i18n/messages/play.ts` (a `play.loop.*` sub-namespace: backlog count, analyse-all, queue progress, badge, the auto-analyse setting label + help). Parity by construction (`translate.test.ts`).

**Out / deferred (→ §11):**
- **A persisted "last unanalysed gameId" field** — superseded by the derived read (Q-A pre-V0 correction); the derived set is strictly more complete and needs no schema. Documented as the rejected alternative.
- **Auto-running the *backlog* on finish or on app boot** — heavy/contention risk; backlog is always user-initiated (Q-C). Boot-time auto-analysis is explicitly out.
- **960-aware analysis** — still disabled (AP-960-4); 960 games never enter the backlog.
- **Re-analyse / delete / manage history** — F5 owns history rows; P1 only adds the *batch* close. Per-row re-analyse is F5's; bulk management is later.
- **Steering changes** — P1 does NOT touch `selectOpening`/steering math (P4 owns steering symmetry). P1 only ensures analyses *exist* so the existing steering has data.
- **Overclaiming the loop (F-P1-6, honest framing)** — copy and verification must NOT promise that *every* analysed game steers the next one. A clean game yields no `weakest` dimension (`buildWeaknessProfile`), so steering stays neutral even after analysis. The honest claim: analysing makes the data *available*; the next game is steered **when a weakness is detected** (doctrine AP-CHESS-13/24). `play.tip` already phrases it this way ("steers ... toward whatever you're weakest at") — keep it; do not strengthen it to "always steers".
- **Insights/study-plan** — untouched (no selection/studyPlan edit) → byte-identical (AP-COACH-1).

## §3 Pre-flight

- **F5 landed first.** Confirm `getAllGames()` + `getAnalyzedGameIds()` exist in `src/store/gamesRepo.ts` (P1 imports them). If F5 is not yet merged, build P1 on/after the F5 branch (portfolio DAG: F5→P1). **P1 must not define these symbols.**
- Confirm baseline green: `npm test` (expect 504/504) + `npm run check` (expect 0/0).
- Re-grep collisions: no `unanalyzedPlayedGames`/`analyzeBacklog`/`autoAnalyzeOnFinish`/`play.loop.*` introduced meanwhile.
- **Assert no `DB_VERSION` change** in the diff (doctrine gate). Both new fields (`GameRecord.playerColor?`, `SettingsRecord.autoAnalyzeOnFinish?`) are optional, read with `?? …`.
- Confirm the engine is single-worker (`app.engine`) → the runner MUST be sequential, not parallel.
- Confirm 960 exclusion: the selector and auto-run path both skip `variant==='chess960'`.
- **Verify `playerColor` provenance (Q-D):** confirm the stored played PGN has no `[White]/[Black]` headers (it doesn't — `game.pgn()`), so the runner relies on the new `GameRecord.playerColor?`; legacy records without it are skipped from the batch (analysable per-game elsewhere).

## §4 Phase A — CODE FIRST

**Order:** `GameRecord.playerColor?` write → selector core (+ test) → shared core `analyzeOnePlayedGame` + `analyzeBacklog` (+ tests) → Play affordance → Dashboard/Home badge → optional setting → i18n. Code compiles green before any doc edit.

1. **`GameRecord.playerColor?` (Q-D=D-a)** — in `db.ts`, add `playerColor?: 'w' | 'b';` to `GameRecord` (additive-optional, documented "absent on legacy records → batch-skipped"). In `Play.svelte` `finishGame()` (`:431-449`), add `playerColor: playerColor[0]` to the `rec` literal (the side is already in scope at write). **No `DB_VERSION` bump.**
2. **`src/analysis/unanalyzedGames.ts`** (pure core):
   ```ts
   import type { GameRecord } from '../store/db';
   /** Standard (non-960) played games not yet analysed that carry a known player side,
    *  newest-first. Pure — no DB/engine/clock. Games without playerColor are excluded
    *  (legacy records; analysable per-game from the Play tail / history where side was in scope). */
   export function unanalyzedPlayedGames(games: GameRecord[], analyzedIds: Set<string>): GameRecord[] {
     return games
       .filter((g) => g.variant !== 'chess960' && g.playerColor != null && !analyzedIds.has(g.id))
       .sort((a, b) => b.playedAt - a.playedAt);
   }
   ```
3. **Shared core + batch runner** — `src/analysis/analyzeBacklog.ts` (reused by Play + Dashboard):
   - `analyzeOnePlayedGame(engine, puzzles, model, game, opts)` (the single-game core, F-P1-5): `await engine.resetVariant()`; `if (await getAnalysis(game.id)) return existing;` else `return runAnalysis(engine, puzzles, { gameId: game.id, pgn: game.pgn, playerColor: game.playerColor!, source: 'played', baseRating: Math.round(model.puzzleRating.rating), now: Date.now(), movetimeMs: 200, onProgress })`. (`game.playerColor` is guaranteed non-null by the selector filter.) Called by the Play-tail button, the batch loop, **and** auto-run.
   - `analyzeBacklog(engine, puzzles, model, games, opts)`: `resetVariant()` once, then for each game (capped at `opts.maxPerRun`, default e.g. 10): **`try { await analyzeOnePlayedGame(...) } catch { failed++; /* leave in backlog */ continue; }`** (F-P1-4 — one failure never kills the run). Report `{ done, total, failed, currentGameId }`; honour a `cancelled` flag between games; return the **last** successful analysis + a `remaining` count (unprocessed + failed).
4. **`Play.svelte`** — compute the backlog `N` (after `finishGame`, and on mount): `getAllGames()` + `getAnalyzedGameIds()` → **`N = unanalyzedPlayedGames(...).length`** (F-P1-3 — the count is the selector output, so it never overstates). In the `status==='over'` block (`:610-624`) add, next to "Analyse this game", a ghost button **"Analyse your {n} unanalysed games"** shown when `n>0`; it runs `analyzeBacklog`, drives the existing progress bar, renders the last `AnalysisResult`, then refreshes `N`.
5. **`Dashboard.svelte`** (+ optionally `Home.svelte`) — a badge/line "**{n} unanalysed games**" when `n>0` (same `unanalyzedPlayedGames(...).length`), **linking to F5's Import history** for selective per-row analyse (F-P1-1). Mirror the `dueReview` badge placement.
6. **Optional setting** — add `autoAnalyzeOnFinish?: boolean` to `SettingsRecord` (`db.ts`), a toggle in `Settings.svelte`, and a post-finish hook in `Play.svelte` that, when enabled, calls `analyzeOnePlayedGame(...)` for the just-finished `lastGame` only (non-blocking; on success show a quiet "analysed ✓", on failure leave it in the visible backlog — F-P1-2). Read site uses `app.settings?.autoAnalyzeOnFinish ?? false`. (The just-finished game's `playerColor` is in scope here — no provenance issue.)
7. **i18n** — add `play.loop.*` keys (e.g. `play.loop.backlogCount`, `play.loop.analyseAll`, `play.loop.queueProgress`, `play.loop.badge`, `play.loop.autoAnalyzeLabel`, `play.loop.autoAnalyzeHelp`, `play.loop.remaining`) to `src/i18n/messages/play.ts`, FR+EN.

## §5 Tests (pure-core + wiring; NO component tests — none exist)

- **`unanalyzedGames.test.ts`** (new): excludes 960 games; excludes ids in `analyzedIds`; **excludes games with no `playerColor`** (legacy); returns newest-first by `playedAt`; empty in/out; stable when all analysed. Pure — no DB/fakes needed.
- **batch runner** (`analyzeBacklog.ts`): with a stubbed `analyzeOnePlayedGame`/`getAnalysis`, asserts **sequential** invocation (one at a time), **skips** already-analysed ids, passes each game's `playerColor` through, **honours the cap** (`maxPerRun`) leaving `remaining>0`, **honours cancellation** between games, **a single game's throw is caught** so the loop continues and the failed game is counted in `remaining` (F-P1-4), and returns the last successful result + remaining/failed. (Pure orchestration over injected deps — no engine.)
- **shared core** (`analyzeOnePlayedGame`): with stubs, asserts it short-circuits when `getAnalysis` returns existing (idempotent, F-P1-5) and otherwise calls `runAnalysis` once with the game's `playerColor`/`source:'played'`.
- **`GameRecord.playerColor?` round-trip**: a `repos`/`db` test that a `GameRecord` written with `playerColor` reads it back, and that a record **without** it loads fine (additive; no migration). Confirms the selector's legacy-skip path has data to act on.
- **setting additivity**: a `playerModel`/settings test that a record **without** `autoAnalyzeOnFinish` loads and reads `?? false` (no migration; mirrors existing optional-field tests).
- **i18n parity**: existing structural test covers new `play.loop.*` keys by construction — assert it still passes (no rewrite).
- **No regression**: full `npm test` stays at **≥504** passing (new tests add).
- **Insights byte-identity**: P1 touches no selection/studyPlan logic → existing Insights snapshot unaffected (assert untouched).

## §6 Verification

1. `npm test` — green, count = 504 + new, **0 failures**.
2. `npm run check` — **0 errors / 0 warnings**.
3. `npm run build` — green.
4. **Manual smoke (the loop)**:
   - Play+finish a standard game **without** clicking Analyse → leave Play (navigate to Dashboard) → Dashboard shows "**1 unanalysed game**".
   - Return to Play, finish a second game → over screen shows "**Analyse your 2 unanalysed games**".
   - Click it → sequential progress bar advances game-by-game; last `AnalysisResult` renders; badge drops to 0; personal puzzles appear; `weaknessCounters` grew.
   - **Start a new standard game** → **if a weakness was detected**, the steer note reads "Steering toward your weakest area (X)" (was "Playing the X") — loop closed. (If the analysed games were clean → no `weakest` → note stays neutral; this is correct, not a bug — F-P1-6 honest framing.)
   - Enable **auto-analyse on finish** in Settings → finish a game → it analyses itself (no click) and shows a quiet "analysed ✓"; backlog stays 0.
   - A **960** game never appears in the backlog and never auto-runs.
   - The displayed count always equals what runs: a backlog of (1 standard + 1 legacy-no-color + 1 chess960) shows "**1**", and the batch analyses exactly that one (F-P1-3 fidelity).
   - Cancel mid-batch → stops cleanly, remaining count reflects the unfinished games; if one game's analysis throws, the batch continues and that game stays counted (F-P1-4).
5. **Doctrine gates**: diff has **no `DB_VERSION` change** (both new fields additive-optional), no new store/index; engine calls are **sequential**; no network; every new string is FR+EN; steering math untouched (P4 boundary held); Insights byte-identical; no UI claim that *every* analysed game steers (F-P1-6).

## §7 Docs (LAST)

- **`decisions.md`** — **no new ADR** (feature PR; reuses F5 + additive setting + sequential queue). If the reviewer judges the auto-run toggle a genuine architectural decision, flag a number **≥0058** *after* the reserved 0054–0057 (portfolio) land — note the possible collision; default is none.
- **`specs/enhancements-architecture-spec.md`** — mark **P1** status (drafted→shipped) in §3 when merged (light touch).
- **`play.tip`** copy already promises the loop; no rewrite needed, but verify it still reads true (it does — closing the loop is exactly what it describes).
- No README change (the affordance is self-describing).

## §8 Acceptance

- [ ] `GameRecord.playerColor?` added (additive-optional) and set in `finishGame()`; round-trip tested; legacy records (no field) load fine.
- [ ] `unanalyzedPlayedGames(...)` exists (pure; excludes 960 **and** color-less legacy records; newest-first), unit-tested.
- [ ] Sequential batch runner over `runAnalysis(source:'played')`, per-game `getAnalysis` guard, passes `playerColor` through, cancellable, capped — tested with stubs.
- [ ] Play game-over shows "Analyse your N unanalysed games" when N>0; runs the batch; renders the last `AnalysisResult`; refreshes N.
- [ ] Dashboard (and/or Home) shows an "N unanalysed games" badge/entry; durable across navigation.
- [ ] Optional `autoAnalyzeOnFinish` setting (additive; `?? false`); when on, analyses only the just-finished game; 960 excluded.
- [ ] After analysing, a new standard game is **steered** (note flips from neutral) — loop closed end-to-end (manual smoke).
- [ ] No `DB_VERSION` bump — both new fields (`GameRecord.playerColor?`, `SettingsRecord.autoAnalyzeOnFinish?`) are additive-optional; no new store/index; engine calls sequential; no network.
- [ ] All new strings FR+EN; steering math untouched; Insights byte-identical.
- [ ] `npm test` ≥504 green · `npm run check` 0/0 · `npm run build` green.
- [ ] P1 imports (does not define) F5's `getAllGames`/`getAnalyzedGameIds`.

## §9 Anti-patterns (AP-PLAYLOOP-)

- **AP-PLAYLOOP-1** — re-introducing a component-local-only analysis affordance. The whole bug is that `lastGame` is component state cleared on `newGame`/navigation. The backlog must be **derived from persisted stores** (F5 reads), not a transient field.
- **AP-PLAYLOOP-2** — running the backlog **in parallel**. The engine is a single worker; analyse **sequentially** or the worker contends and stalls (analysis forces full strength). Q-C=b.
- **AP-PLAYLOOP-3** — auto-running the **backlog** on finish or on boot. Auto-run (if enabled) analyses **only the just-finished game**; the backlog is always **user-initiated**.
- **AP-PLAYLOOP-4** — analysing a **chess960** game. 960 is excluded from the backlog and from auto-run (AP-960-4); the selector filters `variant!=='chess960'`.
- **AP-PLAYLOOP-5** — defining `getAllGames`/`getAnalyzedGameIds` in P1. These are **F5's** API; P1 imports them. Defining them here collides once F5 lands.
- **AP-PLAYLOOP-6** — bumping `DB_VERSION` for the optional setting. `autoAnalyzeOnFinish?` is additive-optional (`?? false`), like `metacogEnabled?`/`opponentStyle?`. No migration.
- **AP-PLAYLOOP-7** — skipping the per-game `getAnalysis` idempotency guard in the batch. `runAnalysis` is NOT internally idempotent; re-analysing duplicates puzzles + double-folds `weaknessCounters`. Guard every item.
- **AP-PLAYLOOP-8** — `Date.now()`/`Math.random()` inside the selector core. The selector is **pure** (input games + ids); time/order come from the data (`playedAt`). Only the runner (a side-effecting orchestration) reads `Date.now()` for the `now` arg.
- **AP-PLAYLOOP-9** — touching `selectOpening`/steering math. P1 only ensures analyses exist; steering symmetry is **P4**. Insights/study-plan stay byte-identical.
- **AP-PLAYLOOP-10** — a FR-only or EN-only loop string. Every new `play.loop.*` key is a `{fr,en}` Message.
- **AP-PLAYLOOP-11** — letting an auto-run failure block play or lose the game. Auto-run is best-effort + non-blocking; on failure the game simply **stays in the backlog** for a later user-initiated batch.
- **AP-PLAYLOOP-12** — trying to recover `playerColor` from the stored played PGN. It has **no `[White]/[Black]` headers** (`game.pgn()` is bare), so `inferPlayerColor` returns `null`. Use the stored `GameRecord.playerColor` (Q-D); don't re-parse and guess a side (analysing from the wrong POV is the audit-v2 C-3/P0-02 failure mode).
- **AP-PLAYLOOP-13** (F-P1-3, fidelity) — showing a backlog count that differs from what the batch runs. The displayed "N" MUST be `unanalyzedPlayedGames(...).length` (the same selector that excludes 960 + color-less legacy). A count computed any other way (e.g. `total − analyzed`) **lies** and erodes trust.
- **AP-PLAYLOOP-14** (F-P1-4, robustness) — letting one game's analysis failure abort the whole batch. Wrap each game in try/catch; a failure is counted and the game stays in the backlog while the loop continues. Already-analysed games persist regardless.
- **AP-PLAYLOOP-15** (F-P1-6, honesty) — copy/UI claiming that analysing a game *will* steer the next one. It steers **only when a weakness is detected**; a clean game leaves steering neutral. Don't overstate the loop (AP-CHESS-13/24).

## §10 Rollback

Additive and isolated. To revert: drop `unanalyzedGames.ts` (+ test), the batch runner (`analyzeBacklog.ts`), the Play "Analyse your N" button, the Dashboard/Home badge, the `GameRecord.playerColor?` field (+ its write in `finishGame()` and round-trip test), the `autoAnalyzeOnFinish?` field + its Settings toggle + the post-finish hook, and the `play.loop.*` keys. **No schema/migration introduced** (both fields are optional; nothing to undo in IndexedDB — old records simply never had them). `analyzePlayed()`, `finishGame()` (minus the one-line `playerColor` add), `putGame`, steering, and all existing flows are untouched. No ADR to annotate.

## §11 Follow-up

- **Persisted backlog cursor / pagination** — if history grows large, replace the full `getAllGames()` read with a bounded/indexed read (cursor on `playedAt`) before deriving the unanalysed set. YAGNI now.
- **Boot-time / idle auto-drain** (opt-in) — analyse the backlog during idle with a budget, if user demand appears. Deferred (contention risk; Q-C).
- **Batch-summary view (DEFER A6)** — widen `analyzeBacklog`'s return to carry **per-game** results (not just the last) so a future view can list all N analysed games at once. YAGNI now (last-result render + counts suffice); the shape is easy to widen when a summary screen is actually built.
- **960-aware analysis** — when a 960-aware analyser lands (AP-960-4), 960 games can enter the loop.
- **Legacy played records without `playerColor`** — pre-P1 games lack the field and are skipped from the auto-batch (still analysable per-game from the Play tail / F5 history). A one-off backfill (derive side from result+moves, or just leave them) is possible later but not needed.
- **P4 steering symmetry** — fill the Black-side opening book / color-agnostic steering so the now-reliable analyses steer both colours.
- **Re-analyse from history** — already F5's per-row Analyse; a bulk "re-analyse all" is a distinct concern.
