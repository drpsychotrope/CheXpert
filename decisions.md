# Decision log (ADRs)

Append-only. Never amend a prior entry in place; supersede with a new one and cross-link.

---

## ADR-0001 — Stack
**Date:** 2026-05-31 · **Status:** accepted

chess.js (rules) + chessground (board) + Stockfish lite single-thread WASM (engine, in a Web
Worker) + Svelte 5 + Vite + TypeScript + IndexedDB (via idb). Rationale and full trade-offs in
`specs/phase1-mvp-spec.md`. Versions verified at build time: chess.js 1.4.0, chessground 9.2.1,
stockfish 18.0.7, svelte 5.56, vite 6.4, idb 8.0.3.

## ADR-0002 — Licensing posture: local / no distribution (Q-A=b)
**Date:** 2026-05-31 · **Status:** accepted

chessground and Stockfish are GPL-3.0. We build for personal/local use, so GPL's distribution
obligations are dormant. **No `LICENSE` file is adopted yet**; we ship `ATTRIBUTION.md`. If the
app is ever distributed or publicly hosted, GPL-3.0 source-publication applies and this decision
must be revisited (and if the multi-thread engine `lila-stockfish-web` is later adopted,
AGPL-3.0 applies — see ADR-0004).

## ADR-0003 — Opponent: Stockfish-calibrated only for v1; Maia deferred (Q-B=a)
**Date:** 2026-05-31 · **Status:** accepted

The adaptive opponent uses Stockfish `UCI_LimitStrength` + `UCI_Elo`. Maia (human-like sparring)
needs lc0 and a non-trivial deployment; combined with ADR-0002 (no backend in scope) it is
deferred to Phase 4 and only built if a backend is opted into.

## ADR-0004 — Engine build: hybrid, lite single-thread default (Q-C=a)
**Date:** 2026-05-31 · **Status:** accepted

Default and only Phase 1 engine is the lite single-thread build (~7 MB, no COOP/COEP headers),
vendored from the `stockfish` npm package (which unpacks to ~251 MB of all variants) into
`public/stockfish/` by `scripts/copy-engine.mjs`. Interruption = terminate + respawn the worker
(lite single-thread ports cannot be stopped mid-search). Phase 2 batch analysis may opt into the
multi-thread build (faster, requires COOP/COEP, AGPL-3.0) only where the host supports the
headers. G3 verified 2026-05-31: handshake + bestmove in ~1s.

## ADR-0005 — Launch-time skill evaluation: two-stage adaptive onboarding
**Date:** 2026-05-31 · **Status:** accepted

On first run (re-runnable from Settings):
- **Stage 1 (always):** adaptive puzzle ladder (~6–10 puzzles, Glicko-2) seeds the *puzzle rating*.
- **Stage 2 (optional):** a short game vs Stockfish with live per-move single-position eval
  accumulating ACPL → seeds the *game rating*. Uses the Phase-1 engine worker, NOT Phase-2 batch
  analysis (which doesn't exist yet).
- **Skip:** provisional game rating from puzzle rating + declarative self-rating, wide RD,
  refined over real games via Glicko.

Both ratings are seeded and kept separate (puzzle rating correlates weakly with playing strength).
Phase 2 will upgrade Stage 2 to a fully analyzed calibration game. User requirement, 2026-05-31.

## ADR-0006 — Phase 2 batch analysis: single-pass, fixed movetime (Q-C=a)
**Date:** 2026-05-31 · **Status:** accepted

Each game position is evaluated exactly once: eval-after-ply-i == eval-before-ply-(i+1), so N
plies need N+1 evals. Default 200ms/ply on the lite single-thread engine in the existing Worker.
Verified in-browser: an 80-ply (40-move) game = 81 evals in **20.4s < 30s gate** (G2), ~252ms/position.
The evaluator is an
injectable interface (`PositionEvaluator`) so analysis logic is engine-free in tests. Multi-thread
remains a future opt-in only if the <30s gate ever fails on slower hardware.

## ADR-0007 — Motif tagging: small high-confidence detector + honest fallback (Q-F context)
**Date:** 2026-05-31 · **Status:** accepted

Tagging engine lines to the 64-theme Lichess taxonomy is the hardest, most error-prone part of the
diagnosis (AP-CHESS-9). We detect ONLY a small set we can do reliably — mate / mateInN / backRank,
hanging piece, fork/knightFork — and otherwise FALL BACK to a `{phase}Mistake` tag with
`confidence:'low'` (surfaced in the UI as a "?"). We do NOT fabricate pin/skewer/discovered-attack
from scratch; a wrong specific tag is worse than an honest generic one. Taxonomy extends in later
passes, never by guessing.

## ADR-0008 — Gaffe metric: win-probability delta (Q-F=a)
**Date:** 2026-05-31 · **Status:** accepted

Moves are classified by win-probability points lost (Lichess logistic on White-POV cp, k=0.00368208),
not raw centipawns: inaccuracy ≥5%, mistake ≥10%, blunder ≥20%. A centipawn-loss figure is still
stored for ACPL display. Rationale: a 200cp swing means very different things at ±50 vs ±900.

## ADR-0009 — Weakness dimensions + benchmarks are directional (AP-CHESS-13)
**Date:** 2026-05-31 · **Status:** accepted

Radar = tactics, openingAccuracy, endgameConversion, timeManagement, resilience. "Resilience" =
recovery rate after falling clearly behind (mover-POV ≤ −200 later returning to ≥ −100), per the
arbitrage. ACPL benchmarks come from rough community anchors, presented as "where to focus", never
as a precise grade. Schema migrated to IndexedDB v2 (importedGames, gameAnalyses; additive, v1 data
preserved).

## ADR-0010 — Retention: FSRS via ts-fsrs; one card per trainable item (Q-I=a)
**Date:** 2026-05-31 · **Status:** accepted

ts-fsrs 5.4.1 (MIT). One SRS card per item, id `${kind}:${refId}` (kinds: puzzle, repertoire). Cards
persist as epoch-ms records (not Date objects) for deterministic storage/tests; conversion at the
boundary in `srs/fsrs.ts`. Grade mapping (Q-I=a): fail→Again, fast clean (≤8s)→Easy, slow (≥25s)→Hard,
else→Good. Cards are created the first time an item is attempted (Tactics + Review both call
`reviewItem`), so the due queue self-populates from normal play. Active recall preserved (AP-CHESS-15):
the player plays the move before any grading. Verified in-browser: schedule→due-queue→review round-trip.

## ADR-0011 — Repertoire: chess.js-validated lines, drilled as FSRS cards
**Date:** 2026-05-31 · **Status:** accepted

A repertoire line is a chess.js-validated SAN/UCI sequence stored in the `repertoire` store. `RepertoireDrill`
auto-plays the opponent's moves and requires the player to play their own (active recall); the whole-line
result (mistake-free?) + time maps to an FSRS grade on a `repertoire:` card. (Lichess `chess-openings`
CC0 naming integration deferred — lines are user-named for now; the `opening` field is reserved.)

## ADR-0012 — Endgames: Syzygy via Lichess API, consent-gated + cache-first (Q-H=a, Q-A=b)
**Date:** 2026-05-31 · **Status:** accepted

Perfect endgame feedback (WDL/DTZ, ≤7 pieces) from `tablebase.lichess.ovh` — the ONE network egress in
the app. Gated on explicit `settings.allowNetwork` consent with a clear dialog (AP-CHESS-17, Q-A=b);
off by default, drills still work engine-only. Every result cached in a dedicated IndexedDB
(`chess-trainer-tbcache`) so each position is fetched at most once (AP-CHESS-14) — verified: 2 probes,
1 fetch. A cached result is served even with consent off (no network needed). The HTTP client is
dependency-injected so tests never touch the network. Schema migrated to IndexedDB v3 (srsCards,
repertoire; additive, v1/v2 preserved — verified live at version 3 with all 9 stores).

## ADR-0013 — "Delete all my data" must wipe every store (privacy correctness)
**Date:** 2026-05-31 · **Status:** accepted

`clearAllData()` originally enumerated 5 stores by name; adding Phase 2/3 stores silently left imported
games, analyses, SRS cards, and the repertoire behind on wipe — a privacy defect. Fixed to iterate
`db.objectStoreNames` (covers future stores automatically) plus clear the separate tablebase cache DB.
Regression-guarded by a test that seeds a v2 and a v3 store and asserts every store is empty after wipe.

## ADR-0014 — Loop closure: opponent steers the OPENING toward the weakness (not strength)
**Date:** 2026-05-31 · **Status:** accepted

The payoff of the whole architecture. On a new game, `Play.svelte` reads the weakness profile from
analysed games and `selectOpening('b', weakest, pick)` weights the bot's opening ~3:1 toward an
opening tagged with the player's weakest dimension, keeping variety (AP-CHESS-22: bias, don't
obsess). The book feeds the bot's moves while the game stays on the line; once the player deviates
the engine takes over at the calibrated ~55% Elo, so the flow band is preserved. We steer the
opening, NOT the engine's strength or a forced move-by-move structure — real and testable without
overclaiming. Verified: steer hit-rate ~0.5 with variety; book replies correct for both colours.

## ADR-0015 — NL explanations: rule-based templates, fact-derived only (Q-J)
**Date:** 2026-05-31 · **Status:** accepted

`explain.ts` builds {headline, reasons, better} entirely from facts already on PlyAnalysis (severity,
winProbLoss, motif+confidence, phase, mate, bestUci). No LLM (AP-CHESS-19): a specific tactic is
named only when a motif detector fired with high confidence; otherwise it explicitly says it can't
name a pattern; a forced mate is mentioned only when the engine reported one; "Better was <SAN>"
only when a best move exists. Keeps the app faithful and fully local. (Fixed uciToSan to only pass a
promotion field when the UCI carries one — chess.js 1.4.0 rejects it on non-promoting moves.)

## ADR-0016 — Woodpecker: fixed-set speed drilling, complements FSRS
**Date:** 2026-05-31 · **Status:** accepted

A fixed, ordered puzzle set repeated as timed cycles until automatic — distinct goal from FSRS
Review (retention across an expanding pool). Pure cycle logic (immutable), persisted in IndexedDB
v4 `woodpeckerSets`; `improvement()` reports faster-and-≥-accurate vs the previous cycle. Schema
migrated v3→v4 additively; the db migration test was also de-duplicated (stale repeated assertion +
stray brace) and bumped to v4.

## ADR-0017 — Guess-the-Move: built-in master games, exact-match scoring
**Date:** 2026-05-31 · **Status:** accepted

Active recall on famous games (Opera, Immortal, Evergreen). PGNs are asserted legal + finished by
the test suite so a typo can't ship. A guess is credited only on an exact match with the played
move (honest scoring — no partial credit we didn't compute); wrong guesses don't advance; Reveal
shows without crediting. No DB writes.

## ADR-0018 — Calculation/vision drills: pure deterministic primitives
**Date:** 2026-05-31 · **Status:** accepted

Square-colour and knight-distance (BFS shortest path) drills, no board. `vision.ts` is pure and
deterministic (no Math.random in the core — the UI seeds prompts), so it's fully unit-tested
(knight a1→h8 = 6 moves, path legality, square colours). Completes Phase 4.

## ADR-0019 — Maia stays OUT of v1 (consequence of Q-A=b + Q-B=a)
**Date:** 2026-05-31 · **Status:** accepted

Q-A=b (local-only, no distribution) ⇒ no backend in scope; Q-B=a deferred Maia to a backend that
doesn't exist. So Maia is not built. The adaptive Stockfish opponent + the loop-closure opening
steering (ADR-0014) cover the "instructive adversary" goal client-side. Revisit only if a backend
is ever adopted (which also reopens the licensing posture — hosting triggers GPL/AGPL).

## ADR-0020 — Motif taxonomy extension: four geometric detectors (extends ADR-0007)
**Date:** 2026-06-01 · **Status:** accepted

The "later pass" ADR-0007 anticipated. `detectMotif` now also tags **pin** (absolute + relative),
**skewer**, **discoveredAttack**, and **doubleCheck**, all at `confidence:'high'`. Every relation is
verified by clear-ray geometry on the position after the missed best move (`detectGeometric` in
`motif.ts`) — no engine re-check (Q-B=a), so motif tagging stays pure/synchronous like fork/hanging.
Decisions taken: Q-A primary-tag precedence `mate > doubleCheck > fork > skewer > pin >
discoveredAttack > hangingPiece`; Q-C relative pins tagged when the back piece is more valuable and
`≥5` (rook/queen), plus all absolute pins. Tag strings are the exact Lichess theme keys, so they flow
into personal-puzzle themes (`generatePuzzles`) and NL explanations (`explain.ts`, gated on high
confidence per AP-CHESS-19) for free. **The `confidence:'low'` phase/magnitude fallback is unchanged**:
a detector fires only when geometrically certain, else the honest generic tag stands (ADR-0007 intact).
New anti-patterns AP-CHESS-25…31. `doubleCheck` is computed as direct + discovered check (no chess.js
`attackers()`), so it needs no API beyond geometry.

## ADR-0021 — Analysis visualization: win% curve + critical moments, no global accuracy grade
**Date:** 2026-06-01 · **Status:** accepted

The analysis view gains a **player-POV win-probability curve** (`EvalGraph.svelte`, inline SVG — no
charting dependency) and a **critical-moments** list (`criticalMoments.ts`, a pure selector: top 5
plies by win-prob loss ≥ 10, both sides distinguished), plus per-phase ACPL read straight from
`byPhase`. Everything derives from the stored `GameAnalysis` — **no engine re-evaluation**. We
deliberately show **no single "accuracy %" grade**: per the honesty notes and ADR-0009 (benchmarks are
directional), a precise-looking grade would overstate confidence. Selecting a moment shows a
**read-only** mini-board at that position + the rule-based `explainPly` text. Decisions Q-A..Q-D all
took the recommended defaults. AP-CHESS-32…37.

## ADR-0022 — One-click played-game review (no PGN paste); shared AnalysisResult
**Date:** 2026-06-01 · **Status:** accepted

Supersedes the old workflow where the only way to analyse a game you played in-app was to copy its
PGN and paste it into the Analyse view. `Play` now offers **"Analyse this game"** on the game-over
screen, running the same `runAnalysis` pipeline with `source:'played'` (the function's header already
anticipated this caller). The engine is reset to full strength first (the adaptive opponent had left
`UCI_LimitStrength` on at a low Elo). The result panel — stat row, win% curve, critical moments,
explained mistakes — is extracted into a shared `AnalysisResult.svelte` used by both Import and Play
(DRY). A guard reuses an existing `gameAnalyses` row instead of re-running. Motivated by the user's
"simplest UI / avoid external manipulations" directive: games you play become puzzles + weakness data
with one click, nothing to paste. Paste-import stays for external games. AP-CHESS-45…47.

## ADR-0023 — Missed-win puzzle mining (loop-closers 3a)
**Date:** 2026-06-01 · **Status:** accepted

`generatePuzzlesFromAnalysis` now also mines **missed wins** — player plies where a decisive best
move existed but wasn't played, even if the move was scored `good`/`inaccuracy` (you stayed winning
but missed the clean kill — the most rating-relevant skill, converting won positions). Trigger
(Q-B=a): you didn't play best (`cpLoss>0`) AND either a **forced mate** existed (always qualifies) or
the best move was worth **≥ 500 cp** (mover POV) with **win-prob loss ≥ 3** (the floor stops a
one-sided game flooding). The existing MultiPV uniqueness gate is reused unchanged (it already treats
"only best is mate" as unique). Missed wins are capped at **3 per game**; they carry `meta.kind:
'missed-win'` (ordinary errors carry `meta.kind:'mistake'`) — a string in the existing freeform
`meta`, no Lichess-theme string invented. No new engine eval pass (reuses the generator's MultiPV
call). AP-CHESS-38 (flood control), AP-CHESS-44 (`meta.kind`).

## ADR-0024 — Per-dimension drill routing (loop-closers 3b)
**Date:** 2026-06-01 · **Status:** accepted

The dashboard used to route **every** weak dimension into Tactics (opening/endgame mis-filtered by
theme) and showed no button for time/resilience. Now a pure `drillTarget(dim)` (in `weakness.ts`,
unit-tested) maps each dimension to its proper destination: tactics→Tactics (themes, now including the
geometric motifs from ADR-0020), openingAccuracy→Repertoire, endgameConversion→Endgames,
timeManagement→**timed Tactics** (`app.tacticsTimed`, a per-puzzle clock; running out = a graded miss
via the existing `finish(false)`; reset on clear, AP-CHESS-39), resilience→**Comeback** (ADR-0025).
Every dimension now shows a one-click Drill button (AP-CHESS-42 — never route opening/endgame back into
Tactics). `'comeback'` added to the `View` union here; its route + view ship in ADR-0025.

## ADR-0025 — Comeback drills (loop-closers 3c)
**Date:** 2026-06-01 · **Status:** accepted

The resilience dimension's drill. `comeback.ts` (`comebackPositions`, unit-tested) replays the
**player-to-move** positions where you first fell behind (mirrors `resilienceScore`'s behind-episode
detection: entry at player-POV cp ≤ −200, one per episode), **excluding hopeless dips** (≤ −900) so a
drill stays winnable. `Comeback.svelte` plays each vs the **adaptive opponent at your ZPD Elo** (NOT
full strength — AP-CHESS-41), graded on **outcome** (hold a draw or win = success, Q-C=a) so no extra
eval probes are needed. Positions derive on the fly from stored `gameAnalyses` — **no IndexedDB
migration**. Reached only from the Dashboard resilience "Defend" button (Q-D=a; no 13th top-nav
button). With `played-game-review`, the whole loop is paste-free: play → one-click analyse → your
collapses become comeback drills. AP-CHESS-40/41/43.

## ADR-0026 — Skip button on the launch evaluation
**Date:** 2026-06-01 · **Status:** accepted

ADR-0005 specified a skippable onboarding, but the only "Skip" button was on the calibration-game
step (Stage 2); the launch screen forced the puzzle ladder. Added a **Skip** button to the first
(`declare`) onboarding step: it seeds provisional puzzle + game ratings from the declared self-level
(via the existing `priorFromDeclarative` + `seedGameRating(..., null)` path, `ladder` null), marks the
model onboarded, and routes straight Home — no ladder, no game. Wide RD, sharpens with play; re-runnable
from Settings. Reuses the already-tested calibration functions, so no new logic. Verified: launch →
Skip → onboarded, ratings seeded (~1100/1100, RD 300), Home.

## ADR-0027 — Weakness intelligence: fingerprint + study plan + progress (batch 2, spec A)
**Date:** 2026-06-01 · **Status:** accepted

The coaching brain, all pure/local/no-LLM over stored `gameAnalyses`. `fingerprint.ts`:
`buildFingerprint` clusters the player's mistakes by confident motif (else `phase:severity` fallback,
honesty per ADR-0007), ranks "leaks" by impact (count × avg win-prob loss), keeps 3 example FENs, caps
8. `weaknessTrend` recomputes the radar over rolling windows of games (no new store). `studyPlan.ts`:
`buildStudyPlan` turns leaks + the weakest dimension + a time budget into a deterministic daily plan
(vision warm-up, then worst-impact leaks mapped to Tactics/Endgames/Repertoire/Comeback). New
`Insights.svelte` view (leaks with one-click Drill, plan, per-dim trend sparkline); reachable from a nav
button + a Dashboard link. No engine, no schema. AP-CHESS-48…50.

## ADR-0028 — Openings: ECO naming + repertoire-gap + explorer (batch 2, spec B)
**Date:** 2026-06-01 · **Status:** accepted

`eco.ts` names a game's opening by **longest-prefix** match over a bundled CC0 table and reports the
**first out-of-book ply**. A curated **seed** `public/openings/eco.json` (~40 common lines) ships;
`scripts/build-eco.mjs` (`npm run etl:eco`) regenerates the full ~3500-line set from the Lichess
chess-openings TSVs (seed→ETL pattern, like the puzzle DB). `AnalysisResult` shows the opening name +
where you left book, with **"Add this line to repertoire"** (builds a line from the in-book SAN prefix
via the existing `buildLine`/`saveLine`). A minimal `Explorer.svelte` names typed lines + shows book
continuations (no frequency stats — follow-up). Static data, no schema, no engine. Transposition naming
is move-order-based (documented limitation). AP-CHESS-51…53.

## ADR-0029 — Practice mechanics: calculation + vision drills + scheduler (batch 2, spec C)
**Date:** 2026-06-01 · **Status:** accepted

Three deliberate-practice mechanics (shipped together; would split 3a/3b/3c as PRs):
- **3a Calculation** (`calc.ts` + `Calculate.svelte`): solve a tactic with NO hints — see the whole
  line first. `gradeCalcLine` validates the user's line against the puzzle's stored solution (the
  precomputed best line — no live engine). True frozen-board blindfold is a §11 enhancement.
- **3b Vision** (`tacticsVision.ts` + a Vision "Find them all" drill): pure `allChecks`/`allCaptures`/
  `hangingPieces` (hanging requires a net-winning capture, defenders checked); count-input drill.
- **3c Scheduler** (`schedule.ts`): `interleave` reorders the Review due-queue so adjacent cards differ
  in theme (priority preserved); `buildLapseSet` builds a fixed "Your misses" Woodpecker set from your
  most-failed personal puzzles (on-demand button, namespaced `wp:lapses`, never clobbers user sets).
Pure cores unit-tested; no schema; no new engine. AP-CHESS-54…58.

## ADR-0030 — Scenario sparring (batch 2, spec D)
**Date:** 2026-06-01 · **Status:** accepted

`scenarios.ts`: a curated **imbalance library** (IQP, opposite-side castling, bishop pair, rook-up
ending) of legal positions (FENs validated in tests, side-to-move == side-to-train), plus
`scenariosFromWeakness` reusing the fingerprint's leak FENs. `Sparring.svelte` plays a chosen scenario
vs the **adaptive opponent at the player's ZPD Elo** (reuses the Comeback loop + AdaptiveOpponent),
**outcome-graded** (win/hold = success). Library works standalone; the weakness source degrades to
empty without analyses. No new engine, no schema. AP-CHESS-59…61.

## ADR-0031 — Analysis board: interactive MultiPV + positional explanations (batch 2, spec E)
**Date:** 2026-06-01 · **Status:** accepted

`AnalysisBoard.svelte`: move freely; `analyzeLines(multipv 3)` shows the top lines (eval + SAN) for the
current position; click a line to follow it; back/reset; an eval bar from `winPct`. Stale results are
dropped via a seq token (no per-move engine respawn). Reachable from nav + an "Explore this position"
link on a critical moment. `positional.ts` (`positionalFeatures`/`explainPositional`, pure, tested)
derives doubled/isolated/passed pawns + material from the FEN; `explain.ts` appends these **honest**
phrases ONLY in the no-tactical-motif branch (tactical/mate paths untouched) — extends the
say-only-what-you-can-prove doctrine to positional features. No LLM, no new engine, no schema. AP-CHESS-62…64.

## ADR-0032 — Multi-thread engine under cross-origin isolation (batch 2, spec F; extends ADR-0004)
**Date:** 2026-06-01 · **Status:** accepted

Adopt the **multi-thread** Stockfish for faster analysis (Q-A=a). The launcher (`server.cjs`) and vite
dev/preview now send **COOP `same-origin` + COEP `require-corp`**, so the app window is cross-origin
isolated and `SharedArrayBuffer` is available. `copy-engine.mjs` vendors the multi-thread build as
`stockfish-mt.*` (the non-"single" build; lite-MT chosen for size) alongside the lite single-thread
default. `EngineClient` loads MT when `crossOriginIsolated`, sets `Threads`, and **falls back to lite if
the MT engine fails to boot** (AP-CHESS-65 — never leave the app without an engine). Lite single-thread
remains the universal fallback for hosts that can't set the headers.

**Licensing (Q-A accepted):** the multi-thread build is **AGPL-3.0** (vs lite's GPL-3.0). Under ADR-0002
(local / no public distribution) the obligation stays dormant; if the app is ever publicly hosted or
distributed, AGPL-3.0 source-publication applies — revisit then. Recorded per AP-CHESS-67. COEP
`require-corp` can block cross-origin fetches — the only one is the opt-in Syzygy lookup; verify it
still resolves under isolation (AP-CHESS-66), else it stays a documented constraint (endgames work
offline vs the engine regardless). AP-CHESS-65…67.

## ADR-0033 — Cap the first-solve SRS interval so Review actually fills
**Date:** 2026-06-01 · **Status:** accepted

Bug: Review was empty even after many Tactics sessions. Root cause (not a storage/index bug —
investigated): a fast solve (≤8 s) maps to **Easy**, and ts-fsrs graduates a **New** card on Easy
straight to a ~**10-day** interval (skipping the 1m/10m learning steps), so quickly-solved puzzles
never came due. Fix: in `gradeCard`, cap **Easy → Good on a New card** (state 0) — the first exposure
resurfaces in ~10 min, then graduates normally on the next review. Verified: a fast first solve is now
due in < 1 day (was ~10). Also: Review's empty state now shows **N scheduled · next due in Y**
(`allCards` + `intervalLabel`) so it's never a mysterious blank. Plus a usability fix: **Tactics shows
the Retry button at all times** (reset the current puzzle), not only after a miss.

## ADR-0034 — Human-like opponent via MultiPV temperature sampling (Maia-spike alternative)
**Date:** 2026-06-01 · **Status:** accepted

The Maia-WASM spike (`reports/maia-wasm-spike.md`) deferred a neural human model (high effort/bloat).
Cheaper path adopted: `humanMove.ts` `sampleHumanMove` samples among the engine's top moves
(`analyzeLines` multipv 4) weighted by eval with a softmax **temperature** set by the bot's target Elo
(`temperatureForElo`: lower Elo → hotter → more variety), **excluding any move > 150 cp below best** (no
catastrophic blunders). `AdaptiveOpponent.pickHumanMove` wires it (falls back to best move if MultiPV
unavailable); `Play` uses it for the bot's non-book moves. Pure core unit-tested (rand injected); no ML,
no new dependency, reuses the engine. Result: varied, plausible, beatable opponent moves instead of
always-best. (Comeback/Sparring still use `pickMove`; can opt into `pickHumanMove` later.) ADR-0019 (no
Maia) stands.

## ADR-0035 — Selectable opponent style in Play (human-like vs engine)
**Date:** 2026-06-02 · **Status:** accepted

The human-like opponent (ADR-0034) is now a **choice**, not forced. New persisted setting
`SettingsRecord.opponentStyle: 'human' | 'engine'` (default `'human'`; old records read `?? 'human'`).
A selector on the Play screen — "Human-like (varied moves)" vs "Engine (best moves)" — sets it and
persists. `Play.engineMove` branches: `engine` → `pickMove` (best), `human` → `pickHumanMove` (sampled).
Strength is still the adaptive Elo; this is a *style* knob on top. UI wiring only (no new logic/tests).

## ADR-0036 — Time controls: clocks + per-time-control ratings (batch 3, spec 1)
**Date:** 2026-06-02 · **Status:** accepted

Play now has chess **clocks** and Lichess-style time-control **categories**, and the single game
rating / single adaptive bot are split into **per-time-control pools** (`RatingPool`).

- **Pure `Clock` core** (`src/clock/Clock.ts`): state `{ whiteMs, blackMs, incMs, side, running }`;
  `tick(elapsedMs)` decrements only the running side (clamped ≥ 0); `press(mover)` adds the Fischer
  **increment-on-press** to the mover then flips the side; `flagged()` reports the out-of-time side.
  **No `Date.now()` / `Math.random()` / `performance.now()` inside** (AP-TC-1) — the Play loop measures
  elapsed via `performance.now()` deltas and injects them. Immutable transitions, fully unit-tested.
- **`categoryFor(initialSec, incrementSec)`** (`src/clock/categories.ts`) bands on the estimate
  `initialSec + 40·incrementSec` (bullet < 179 ≤ blitz < 479 ≤ rapid < 1499 ≤ classical). `TIME_CONTROL_PRESETS`
  seeds Bullet 1+0/2+1, Blitz 3+2/5+0, Rapid 10+0/15+10, Classical 30+0, **No clock**, Custom (Q-A).
- **`RatingPool` union owned here** (`src/rating/pools.ts`): `'bullet'|'blitz'|'rapid'|'classical'|'chess960'`
  (the `chess960` member is populated lazily by the chess960 spec). `PlayerModel` reshaped to
  `gameRatings: Partial<Record<RatingPool, Rating>>` + `opponentByPool: Partial<Record<RatingPool, {
  targetElo; recent }>>` with a **load-path migration and NO `DB_VERSION` bump** (field reshape only,
  per the shared contract — AP-TC-2): a legacy single `gameRating` seeds the 4 standard pools (RD widened
  to ≥ 150); onboarding now seeds all 4 standard pools too.
- **Per-pool Glicko + per-pool adaptive bot:** a finished game rates into *exactly* the selected pool and
  nudges *that* pool's bot (`recordGame` mirrored per pool) — never the old single rating, never every
  pool (AP-TC-3). The bot's clock **runs while it thinks** and is `press()`ed when it moves, so it can flag
  (AP-TC-4); its movetime budget scales with its own remaining time, phase-aware
  (`movesLeft = max(8, 40−⌊ply/2⌋)`), clamped per category (Q-D).
- **"No clock"** = classical pool + `GameRecord.timeControl.untimed:true`, no clock UI, today's loop verbatim
  (Q-B=a, AP-TC-8). **Flag vs insufficient mating material = draw** (FIDE Art. 6.9, Q-C=a): a conservative
  pure `insufficientMatingMaterial(fen, side)` helper (bare K / K+B / K+N / same-colour bishops only).
  `SettingsRecord.lastTimeControl` is persisted and restored on mount; per-pool Elo is kept on TC switch (Q-E).
- **UI (Q-F):** the Play header shows the **selected pool's** rating; Dashboard/Home/Insights keep one
  headline number = the **classical** pool (multi-rating Dashboard → §11). Comeback/Sparring drills remain
  untimed = classical pool.

Cross-link: **supersedes the single-`gameRating` model** of ADR-0005 / ADR-0026 (onboarding now seeds all
standard pools). The chess960 spec/ADR **consumes** this `RatingPool` union (adds `variant`/`startFen`,
populates the `chess960` pool) — no migration conflict by construction. Deferred (§11): per-pool rating
history + multi-rating Dashboard; delay/Bronstein increments; low-time warnings; timed onboarding/drills;
PGN `TimeControl` header on export.

## ADR-0037 — Metacognition: confidence + self-diagnosed error cause on puzzle attempts
**Date:** 2026-06-02 · **Status:** accepted

Captures two signals the engine cannot see — how *sure* the player felt before the reveal, and *why*
they think they missed — as **optional, additive** fields on `PuzzleAttemptRecord`
(`confidence?: 'sure'|'unsure'|'guess'`, `selfTag?: string`). Per the data-model contract these are
additive only: **no `DB_VERSION` bump** (stays 4), no migration; legacy records simply lack the fields and
`calibration()` treats `undefined` as "not reported". A new pure core `src/metacog/metacog.ts`
(`calibration(attempts, opts?)`, default sample floor 10) returns a per-confidence accuracy table, a
self-tag breakdown over a **fixed closed taxonomy** (`miscalculated | missed-opponent-resource | rushed |
unfamiliar-pattern | wrong-plan | other`; unknown/legacy values bucket under `other`), and an honest
readout — a fact-sentence ("when you said sure, you were right 78%") plus a *descriptive* verdict word
(`well-calibrated | overconfident | underconfident | mixed`), **never a grade** (extends the
say-only-what-you-can-prove / no-fake-grade doctrine, cf. ADR-0007/0009/0027). Metric = confidence×accuracy
table, **not** Brier (Q-B; Brier deferred). The whole feature is **opt-in** via
`SettingsRecord.metacogEnabled?` (**default off**, read `?? false`) so the chips never appear unless chosen
and **never gate** the active-recall move flow; chips are skippable and confidence is captured live during
`solving` (hindsight would destroy the signal). Chips ship in **Tactics** (attached to its existing
`puzzleAttempts` write) and **Calculate** — which previously logged **no** attempt and now writes one
minimal `puzzleAttempts` row per position (Q-C=a, a deliberate scoped side effect: calc attempts begin
counting in history/calibration; calc's in-memory grading is unchanged and it is not a Glicko writer, so
`ratingBefore === ratingAfter`). **Review chips deferred** (it has no attempt write of its own — adding one
would double-count, AP-META-5). **Self-tags persist** via an in-place UPDATE of the just-written
`puzzleAttempts` row by `id` (an `updateSelfTag` handler doing `db.get` then `db.put` with the same id —
one row, no second insert, AP-META-5 preserved), so the Insights self-tag breakdown populates from real
data. The readout surfaces in **Insights** (descriptive self-knowledge already lives there), gated on
opt-in + the sample floor. Pure core unit-tested (no `Date.now`/`Math.random`);
chips/persistence manually verified.


## ADR-0038 — Critical-moment ("when to think") drill: recognition over stored win-prob swings; no engine at drill time
**Date:** 2026-06-02 · **Status:** accepted

Time trouble is a decision-allocation problem, not a clock-speed one. New recognition drill: show a
player-to-move position from the user's own analysed games on a READ-ONLY board, ask **CRITICAL**
(invest time) vs **ROUTINE** (play fast), then reveal the REAL win-probability swing that hung on the
move plus the existing `explainPly` text. No clock — the trained skill is *recognising* the critical
moment, upstream of managing the clock.

Pure selector `src/analysis/criticalMomentDrill.ts`: `labelPly` tags a player ply from its **realised**
`winProbLoss` — CRITICAL `>= 15`, ROUTINE `<= 3`, the band `(3,15)` is **ambiguous and excluded**
(Q-A). `buildDrillSet(analyses, rand, opts)` collects PLAYER-to-move plies only (`ply.color ===
playerColor`), excludes **trivial recaptures** from ROUTINE (a ply that recaptures on the previous
ply's destination square; never a CRITICAL one — a recapture can itself blunder, Q-C), dedups by
`fenBefore`, balances CRITICAL/ROUTINE *best-effort* (tops up from the larger side; never
empty-on-imbalance) and **Fisher–Yates shuffles via an INJECTED `rand`** — no `Math.random`/`Date.now`
in the core (AP-CMD-4). `scoreCall` is **binary** (Q-D): correct iff the call matches the truth; the
UI shows the **raw swing**, never an accuracy % (AP-CMD-1, honesty doctrine).

**Honesty (AP-CMD-2):** the CRITICAL label is the *realised* swing, NOT a proven "only-move" margin.
Stored analysis has ONE eval per position and no second-best line (ADR-0006), so `bestCp − secondBestCp`
is not available. Recovering a true uniqueness margin would need MultiPV at drill time (violates the
no-engine-at-drill-time doctrine, comeback/eval-graph precedent) or persisting a margin during analysis
(a `BatchAnalyzer` change) — **deferred (Q-B, §11)**. Copy says "a moment where a wrong move proved
expensive", never "the only move".

**Fallback (Q-E):** a curated static FEN set (`src/analysis/criticalMomentFallback.ts`) keeps the drill
non-empty before any game is analysed; legality + label-agreement asserted by a test (MASTER_GAMES
precedent). It feeds the SAME `scoreCall`/reveal path.

**Access (Q-F/Q-G):** Dashboard-reached, **no top-nav button**. The `timeManagement` row keeps its
existing Drill button (timed Tactics, ADR-0024) and gains an **additive** companion link "Train when to
think →" → `app.go('when-to-think')`. **No `weakness.ts` change** (`drillTarget` unchanged). New
`'when-to-think'` member on the `View` union + one route arm in `App.svelte`.

**No schema change** (AP-CMD-6): positions derive on the fly from the stored `gameAnalyses`; no
`DB_VERSION` bump, no object store, no `PlyAnalysis` field. **No new dependency** (AP-CMD-3); chess.js
appears only in the fallback legality TEST, never at drill time.

Cross-links: ADR-0006 (one eval per position — why no only-move margin), ADR-0021 (criticalMoments /
no accuracy grade), ADR-0024 (time-management drill routing), ADR-0025 (comeback: Dashboard-reached,
derive-on-the-fly precedent). Anti-patterns AP-CMD-1…8 (spec §9). Append-only; supersedes nothing.

## ADR-0039 — Deliberate-practice session runner + descriptive efficacy readout
**Date:** 2026-06-02 · **Status:** accepted

Adds two related pieces, **shipped split** (Q-A): a **descriptive efficacy readout** first, then a
**guided session runner** — behind one ADR, each independently revertable.

**Efficacy readout (shipped first).** `src/analysis/efficacy.ts` `motifEfficacy(analyses, motifKey, opts?)`
reports a **two-window** (early vs recent) per-motif **miss-rate** with a **phase-scoped denominator**
(misses ÷ player plies in the motif's phase(s) in that window, not ÷ all moves — AP-ES-3) and a
`minMoves` gate (default 20; below it, `enoughData=false` and the UI greys the row + drops the Δ).
The split is a **balanced split on distinct `analyzedAt` timestamps** — each window holds whole games,
and both sides are non-empty whenever ≥ 2 distinct timestamps exist (boundary = `distinct[⌊n/2⌋]`; plies
strictly before it are "early", boundary and later are "recent"). It shares fingerprint's cluster rule via
an extracted `leakKey(ply)` helper so a leak and its efficacy number can never disagree (AP-ES-1). The
Insights "Did it move?" panel renders before→after + signed Δ for the top ~3 leaks, carrying the **verbatim**
honesty caveat (Q-C): *descriptive, not proof; does not prove training caused the change; "personalised beats
generic" stays plausible, not proven.* The core is **pure** (no `Date`/random), returns numbers only —
**never a verdict string** (AP-ES-4/8).

**Session runner (shipped second).** `src/analysis/session.ts` `buildSession(plan, opts?)` wraps the
existing `buildStudyPlan` output into ordered `SessionStep[]`, inserts a spaced-**Review** slot **only when
`dueCount(now) > 0`** (Q-F), and appends a terminal **reflection** step. It reuses the Insights/`drillTarget`
leak→trainer routing rather than re-deriving it (AP-ES-2) and is **pure** (no `Date`/random; the UI stamps
elapsed time). `Session.svelte` (new `'session'` View) steps through it, **launching the existing trainers
via signal flags + `app.go`** (Q-E) — no trainer is reimplemented (AP-ES-5). Entry is an Insights "Start
session" button (Q-G); a "Session" nav arm is the return path after a trainer launch.

**Q-B — derive, NO schema change.** The `sessions` object store and `sessionStore.ts` are **NOT built**;
**`DB_VERSION` stays 4** (no v4→v5 bump; `db.ts`/`db.test.ts` untouched). Session **reflection is
display-only and NOT persisted** — a documented limitation; persisting session history + notes (and pinning
the efficacy split to "when you started drilling motif X") is a **§11 follow-up**. The bump would be
justified ONLY by storing reflection notes + explicit session boundaries (AP-ES-9); since we derive, we do
not bump.

**Runner resume mechanism.** Session state lives in **`app.activeSession`** — an in-memory field on the
`AppState` singleton (transient, like `tacticsFilterThemes` / `analysisFen` / `analysisPgn`), NOT
IndexedDB. When a trainer is launched via `app.go()` the Session view unmounts but `app.activeSession`
survives; returning via the "Session" nav arm re-mounts it and resumes at the current step index. The
singleton is cleared (`null`) when the session finishes.

**Known follow-up — tactics theme filter.** For tactics steps the runner currently passes the study-plan
`focus` string (the leak's display label, e.g. `"fork"`) as `app.tacticsFilterThemes`, rather than the raw
`leakKey` Insights uses internally. For confident single-motif leaks the values coincide; for phase-based
leaks (e.g. `"endgame blunder"`) the filter may pass through unmatched. Limited practical impact — the
drill still lands on the right weakness category; exact key alignment is noted as a §11 cleanup.

**Honesty / doctrine.** Descriptive only — **no causal claim** ("training improved you"), no precise grade,
no LLM/NLP over the reflection free-text (display-only here — not even stored — AP-ES-6), no network, no
engine in either core. Mirrors AP-CHESS-13/43 and the README Honesty note; cross-links **ADR-0027**
(weakness fingerprint + study plan + progress, which these extend) and **ADR-0007/0009** (honest tagging /
directional-not-a-grade). New anti-patterns **AP-ES-1…9** map to the next free **AP-CHESS** range (≥ 68).

Cross-links: ADR-0027 (fingerprint / study plan / progress baseline), ADR-0007/0009 (honesty doctrine),
ADR-0033 (SRS Review, `dueCount` gate), ADR-0034/0035 (drillTarget routing reused by session steps).
Append-only; supersedes nothing.

## ADR-0040 — Concept cards: teach-before-test via curated worked examples
**Date:** 2026-06-02 · **Status:** accepted

The app was all assessment, no teaching: detectors name a motif (`motif.ts`), `buildLapseSet`
(`schedule.ts`) finds the puzzles you fail most, the SRS resurfaces them — but nothing ever *showed
the pattern*. Concept cards add that one missing arrow.

**What ships.** A committed seed asset `public/concepts/concepts.json` holds **7 cards**, one per
high-confidence motif **family** the detector emits — `mate`, `hangingPiece`, `fork`, `pin`, `skewer`,
`discoveredAttack`, `doubleCheck` — each with 2-3 worked examples (`{fen, keyMove, why}`). Sub-tags
alias to the family card (`mateInN`/`backRankMate`→`mate`; `knightFork`→`fork`; `absolutePin`/
`relativePin`→`pin`; `discoveredCheck`→`discoveredAttack`). Pure `src/concepts/concepts.ts`
(`cardForMotif`/`cardForThemes` + `MOTIF_ALIASES` + `CARD_PRECEDENCE`) mirrors `eco.ts`: pure lookup
unit-tested against an in-memory table; `loadConcepts()` fetches the bundled JSON and degrades to `[]`
on any failure (a missing asset never breaks Tactics). `ConceptCard.svelte` renders each example on a
read-only board with the key move highlighted; `Concepts.svelte` is the nav library.

**Two honest, independent triggers.** (a) **First exposure** — the first time a motif's resolved card
is unseen on a Tactics puzzle, offer it; recorded in the additive `PlayerModel.conceptSeen?: string[]`
the moment the card is opened (one-shot per motif; keyed off the **resolved card motif**, not raw
themes, so a no-card puzzle never burns an entry and `knightFork`/`fork` share one entry). (b)
**Leech** — a puzzle failed **≥ 3** times (`isLeech`, threshold N=3) offers its motif card before the
next attempt; this branch does **not** consult or mutate `conceptSeen`, so a re-failed leech keeps
offering its card. The fail count reuses `failCountByPuzzle`, extracted from `buildLapseSet` (output
byte-identical) so the leech trigger and the "Your misses" set share one definition.

**Doctrine.** Cards are **CURATED static content — no LLM** (ADR-0015). They exist **only for motifs we
confidently detect** — the seed test asserts coverage == the detector family set (extends the
ADR-0007/0020 honesty doctrine to *teaching*; no fabricated patterns). Teaching is **optional and
non-blocking** — a "Learn the pattern" link, never a forced modal; loading the next puzzle is never
gated on a card (AP-CHESS-15). Every example FEN + key move is **chess.js-verified legal** in tests
(ADR-0017 / AP-CHESS-53 precedent). `conceptSeen` is an **additive field — NO `DB_VERSION` bump**
(stays v4; migrated in the load path with `?? []`; wiped on data-reset via `clearAllData`).

**Anti-patterns.** AP-CC-1 generated card text/examples (reject; curated only). AP-CC-2 a card for a
motif we don't confidently detect. AP-CC-3 a blocking modal that interrupts the recall loop. AP-CC-4
an illegal example FEN / key move (tests verify). AP-CC-5 re-offering the same motif's card every
exposure, or losing "seen" state. AP-CC-6 bumping `DB_VERSION` / adding a store for `conceptSeen`.
AP-CC-7 re-implementing the fail-count tally separately from `buildLapseSet`.

Cross-links: ADR-0007 (high-confidence motifs only), ADR-0020 (geometric motifs + precedence),
ADR-0015 (no LLM), ADR-0017 (legal-content-in-tests), ADR-0029 (`buildLapseSet`/lapse logic).
Deferred (§11): personalised cards from the user's own failed puzzles; an interactive "now you try"
mini-puzzle; positional-motif cards (ADR-0031); spaced review of cards; localisation.

## ADR-0041 — Chess960 ("wild" mode): castling shim + own rating pool; README override
**Date:** 2026-06-02 · **Status:** accepted

Adds **one** variant, Chess960, vs the adaptive bot, untimed and not auto-analysed in v1.

**README override.** Reverses the "no variant catalogue" non-goal — narrowly. Chess960 is
anti-memorisation (no opening theory → trains understanding), so it is *on-doctrine*, not a step
toward a Chess.com-style variant menu. The matchmaking and social-ranking non-goals stand. README
line 5 amended.

**chess.js finding (drives the design, re-verified 2026-06-02).** chess.js 1.4.0 loads a scrambled
960 start but generates **zero** castling moves, echoes `KQkq` verbatim even when both rooks sit on
one side of the king, and **rejects** Shredder/X-FEN file-letter rights (`Invalid FEN: castling
availability is invalid`). So a local **castling shim** in/around `ChessGame` is the **sole** source
of castling rights and the sole path that generates/validates/applies a 960 castle; chess.js stays
the rules authority for every non-castling move. (AP-960-1, AP-960-11.)

chess.js's castling field is **neutralized to `'-'` in 960 mode** (constructor/load/reload) to stop
chess.js generating phantom standard castles — a CRITICAL bug found and fixed in review. This makes
the shim the unambiguous sole source of 960 castling rights.

**Shim design.** Detect king-onto-own-rook intent (Q-B=a — the only unambiguous encoding); validate
generalised legality (king not in/through check; king-path ∪ rook-path empty except the two castling
pieces; right live; fixed 960 targets king g/c, rook f/d); apply king+rook relocation manually; track
960 rights by rook file as the sole truth; `fenForEngine()` emits X-FEN (collapses to `KQkq` for the
outermost-rook case) / Shredder file-letters for the engine; route the engine's king-to-rook castle
UCI (`e1h1`) back through the shim (AP-960-5).

**Engine integration.** `AdaptiveOpponent` sets `UCI_Chess960` per game via `applyStrength` (interrupt
= respawn drops options, so it is re-applied on every respawn). `EngineClient.resetVariant()` resets
`UCI_Chess960` to `false` for every standard engine consumer — Endgames, AnalysisBoard, Import,
Onboarding, analyzePlayed — so 960 never leaks into standard analysis. This was a CRITICAL leak
found and fixed in review.

**G-gate result (Q-E) — PASSED.** Verified in-browser on BOTH vendored builds: lite single-thread
`stockfish.js` AND multi-thread `stockfish-mt.js` honor `UCI_Chess960`. Each: parsed a
king-on-f-file + `KQkq` position (legal only in 960), returned legal moves, evaluated post-castle
positions, and returned `f1h1` (king-onto-h-rook = 960 O-O) as best move in a natural castling
position.

**Rating.** `chess960` is its own pool, orthogonal to time category (Lichess model). Standard pools
untouched by 960 games and vice-versa (AP-960-7). Pool seeded lazily on the first 960 game. Source:
`RatingPool` union owned by `time-controls`; if 960 shipped first, §4.6 fallback defines the union +
idempotent `PlayerModel` load-path reshape with **no `DB_VERSION` bump** (DB stays v4 — AP-960-8;
`time-controls` later no-ops it). `GameRecord.variant` and `GameRecord.startFen` are additive fields.

**v1 limitations.** Untimed-only (Q-C); **no auto-analysis** — the pipeline assumes standard rules
and opening theory, so a 960 game would mislead (AP-960-6, Q-D). The "Analyse this game" button is
disabled for 960 games with an honest note. Both lift in §11.

**Arbitrages.** Q-A both (random default + SP-ID 0–959); Q-B drag king onto own rook; Q-C
untimed-only; Q-D defer analysis (disabled for 960); Q-E both-build in-browser G-gate — PASSED;
Q-F `time-controls` owns the union, fallback if 960 ships first. Anti-patterns AP-960-1…11.

**§11 follow-ups (recorded).** Add a 960 guard to `ChessGame.loadPgn` (latent — unreachable today,
becomes relevant if 960 games are ever analyzed/imported); a unit test pinning `resetVariant`/
`UCI_Chess960`; a clarifying comment on `coachCheck`'s engine-variant ownership; the
currently-unreachable Shredder branch in `fenForEngine`; timed 960; 960 auto-analysis.

## ADR-0042 — Concept-card board sizing: shrink via `--board-size`, never ancestor `transform: scale`
**Date:** 2026-06-03 · **Status:** accepted

The "Learn the pattern" card (ADR-0040) rendered a visibly wrong board — pieces bunched toward the
top-left, off their squares — even though the FEN and key move were correct. Root cause is the shrink
mechanism, not the data. `ConceptCard.svelte`'s `.mini-board` wrapped the chessground host in
`transform: scale(0.62)`. chessground places every piece with an absolute pixel offset
`pos * bounds.width / 8`, where `bounds = elements.board.getBoundingClientRect()` (chessground 9.2.1,
`util.posToTranslate` + the memoised bounds in `chessground.js`). `getBoundingClientRect()` reports the
transform-scaled rect, but the board element's own coordinate space stays full-size — so pieces landed
at 0.62× their correct local offset and clustered at the origin. Only `ConceptCard` wrapped a board in
a CSS transform; `Play`/`Tactics` render at natural size and were never affected.

**Decision.** Shrink a board by its **real CSS size**, never by an ancestor transform. `Board.svelte`'s
`--board` now reads an overridable `var(--board-size, min(82vw, 68vh, 540px))` — default unchanged, so
every existing consumer is byte-for-byte identical — and `ConceptCard` sets `--board-size:
min(51vw, 42vh, 336px)` (≈ the old 0.62× visual size), dropping the `transform`/`--scale`/`--mini`/
`overflow` machinery. The multiple-of-8 flooring (`round(down, …, 8px)`) is preserved so the rank/file
gutters stay aligned. Verified in-browser: all three back-rank examples place every piece on its exact
FEN square at a 336px board.

**Anti-patterns.** AP-CC-8 wrapping a chessground host in `transform: scale()` (or any ancestor
transform) — it desyncs pieces from squares because placement is `getBoundingClientRect`-based; size the
board with `--board-size` instead. The guard `src/ui/concept-card-board-size.test.ts` pins this at the
source level (jsdom does no layout, so the visual desync cannot be unit-reproduced).

Cross-links: ADR-0040 (concept cards), ADR-0001 (chessground 9.2.1 board). Fix commit `a8ebc7d`.

## ADR-0043 — Board-vision drills refonte
**Date:** 2026-06-03 · **Status:** accepted

Supersedes the vision-drill roster of ADR-0018. **The closed-form test:** a vision drill whose answer
follows from a position-independent formula trains arithmetic, not vision. The old `Square colours`
drill failed it (colour = `(file+rank)` parity), so it is **cut as an isolated drill** — the
`squareColor` function stays, surfacing only as a by-product of the new Lines & diagonals drill.

**New roster (5):** coordinate↔square + blindfold (single-square), lines/diagonals/reach, and the kept
knight-distance + find-them-all. **Hybrid persistence (Q-A/Q-B/Q-C accepted at default):**
- Per-square retention reuses FSRS via a new `SrsItemKind` `'vision-square'` (`refId` = the square),
  graded by coordinate (speed, `VISION_GRADE_THRESHOLDS` 1500/5000 ms) and blindfold (**correctness
  only** — memory, not speed). Reuses ADR-0010/ADR-0011 scheduling; no new scheduler.
- Per-drill skill (diagonal/knight/find-all) on the additive `PlayerModel.visionStats` field — **no
  `DB_VERSION` bump** (precedent `conceptSeen`).
- Blindfold answers are colour-sensitive (case-sensitive FEN char).

Weak squares (`weakSquares` over due `vision-square` cards) retarget the studyPlan warm-up ("targeted
recall") and seed the coordinate/blindfold prompts via `app.visionWeakSquares`. The session Review
gate is scoped to `puzzle`+`repertoire` so due vision cards never reserve a Review slot
(exclude-vision-only); `Review.svelte` was already puzzle-scoped. Pure cores in `src/vision/`
(`geometry`, `blindfold`, `visionStats`, `weakSquares`, `grading`), one `*.test.ts` each. Spec:
`specs/vision-refonte-spec.md`; design: `docs/superpowers/specs/2026-06-02-vision-refonte-design.md`.

**Follow-ups.** Dedicated dashboard/insights vision tile; full blindfold reconstruction (multi-square);
the pre-existing repertoire Review-gate over-count (only excluded here, not fixed).

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
stored solution (no engine, per ADR-0029); metacognition chips (ADR-0037) and the AP-META-5 one-attempt
write preserved; rating-neutral. True blindfold (hiding pieces) remains deferred. AP-CALC-1…8.
Spec: `specs/calc-drill-redesign-spec.md`; design: `docs/superpowers/specs/2026-06-04-calculation-drill-redesign-design.md`.

## ADR-0045 — Coach mode: active multi-dimensional diagnostic reusing the calibration method

**Context.** The weakness radar (ADR-0027) and the practice session (ADR-0039) are driven by analysed
*played* games — blank for a new/returning player. The launch calibration (ADR-0005) is the opposite:
an adaptive probe needing no history, but it outputs only two scalar ratings.

**Decision.** Add a re-runnable Coach mode that reuses the calibration method — the Glicko `PuzzleLadder`
run once per geometric motif (fork·pin·skewer·hangingPiece·discoveredAttack·mate) + an endgame-phase
probe, plus the optional calibration game analysed through `runAnalysis(source:'played')` — to build a
`CoachProfile` (per-motif deltas vs the puzzle-rating baseline + the 5-dim radar). The profile drives a
prioritized program of drills AND game modes via the existing `buildSession` runner.

- Profile persists as additive `PlayerModel.coachProfile? + coachProfilePrev?` (delta over re-runs).
  **No `DB_VERSION` bump** — schema stays v4 (precedent: ADR-0040 `conceptSeen?`, ADR-0043 `visionStats?`).
- Program routes to game modes via additive `SessionStepKind`/`PlanItem.activity` values `'sparring'`
  and `'play-steered'`, plus one-shot `app.sparringScenarioId` / `app.steerDimension` signals.
- `PuzzleLadder` gained an additive `LadderOpts { min, max, themes, phase, window }` ctor argument so it
  can run short, themed probes; default behaviour (Onboarding) is unchanged.
- Q-A: the diagnostic game is persisted via `runAnalysis(source:'played')` (feeds the loop, seeds
  downstream Comeback/Sparring/Play-steer). Q-B: program steps auto-seed the exact scenario/dimension.
  Q-C: resilience falls back to a defensive Sparring imbalance when no comeback positions exist.
  Q-D: `COACH_LADDER_MIN/MAX = 3/5` per theme.

**Honesty.** Directional, not a grade (cf. AP-CHESS-13/24): per-motif from 3–5 puzzles and one short game
are low-n; every score carries a sample-size / data-source label; empty-theme probes are dropped, never
scored as a weakness.

**Consequences.** `buildStudyPlan` (Insights) is untouched — `buildCoachProgram` is a separate core, the
union widening is type-only. Deferred: multi-day scheduling, a separate coach rating pool, Chess960 probe.

Cross-links: ADR-0005 (calibration), ADR-0027 (weakness fingerprint/study plan), ADR-0039 (session runner).

## ADR-0046 — Side-to-move badge on solve drills (follow-up to ADR-0044)
**Date:** 2026-06-04 · **Status:** accepted

Solve drills (Calculate, Tactics, Review, Woodpecker, Guess-the-move, Vision find-all) flip the board
orientation to the side to move **per puzzle**, but never stated which side the player is on — you could
not tell whether you were calculating for White or Black (the orientation flip alone is ambiguous). Add
an **additive** `Board` `showTurn` / `turnLabel` prop that renders a side-to-move badge (colored disc +
"You play Black" for the solve drills where you play that side, "Black to move" for the count-only
find-all) above the board, derived from `turnColor`. `.board-shell` is `display:contents` by default, so
consumers that don't pass `showTurn` are byte-unaffected. Also collapses the Calculation drill's two
overlapping instruction blocks into one line. No schema, no engine; play/analysis drills (fixed, known
player side — Play, Endgames, Spar, Comeback, Repertoire which already labels "You play") are untouched.
Concepts (study illustrations) deferred. Cross-links: ADR-0044 (calc redesign), ADR-0043 (vision drills).

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

## ADR-0048 — Coach assessment: one puzzle per motif, scored regardless of outcome (supersedes ADR-0045 Q-D)
**Date:** 2026-06-06 · **Status:** accepted

The coach assessment ran a 3–5 puzzle `PuzzleLadder` per theme (ADR-0045 Q-D) — ~21–35 puzzles across the
six motifs + endgame, too long for a "quick" diagnostic. Cut each themed probe to **exactly one puzzle**
(`COACH_LADDER_MIN/MAX = 1`), so the assessment is **≈7 puzzles total**, one per motif (+ endgame). Both
solved and failed attempts already advanced the probe (`PuzzleLadder.report` counts either outcome); the
old "— solve it" wording wrongly implied success was required, so the wizard copy now reads as a test you
simply play through ("solved or not, we move on"). Tradeoff: n=1 per motif is noisier than 3–5, so the
per-motif delta is even more strictly *directional* — the existing sample-size labels (`n`, "(N puzzles)")
keep it honest (AP-COACH-2). No schema, no API change; only the two constants + wizard copy + the constants
test assertion move. Cross-links: ADR-0045 (coach mode — Q-D superseded), ADR-0005 (calibration ladder method).

## ADR-0049 — Launcher: fixed port (stable origin) so the profile persists across sessions
**Date:** 2026-06-07 · **Status:** accepted

Symptom: from one launch to the next the player profile/ratings looked unsaved. Root cause was **not** the
persistence code — `savePlayerModel` writes the `playerModel` singleton correctly and the Chrome
`--user-data-dir` was already fixed. The `.exe` launcher (`server.cjs`) bound `listen(0)`, a fresh random
ephemeral port every run, and browser storage (IndexedDB) is partitioned per **origin = scheme + host +
PORT**. So each session opened `http://127.0.0.1:<new port>` against its own empty partition; the real data
sat stranded under each prior run's port. Fix: bind a **constant port (7424)**, overridable via
`CHESS_TRAINER_PORT`. On `EADDRINUSE` the launcher probes the holder for a sentinel `X-Chess-Trainer`
response header — our own already-running instance just gets another window at the same URL (same origin =
same profile), while a foreign holder triggers a clear "set CHESS_TRAINER_PORT" message instead of opening a
stranger's page. Added `CHESS_TRAINER_NO_OPEN=1` (headless / bring-your-own-tab; also drives the launcher
smoke test). Limitation: profiles stranded under old random ports are **not** auto-migrated — users
re-onboard once, then it sticks. Dev/preview were never affected (vite's fixed 5173/4173). Launcher-only:
no app code, schema, or API change. Cross-links: ADR-0032 (launcher COOP/COEP headers — the other
`server.cjs` decision).

## ADR-0050 — Board derives chessground `turnColor` from the FEN (fixes Black-side moves never applying)
**Date:** 2026-06-07 · **Status:** accepted

Symptom: in any human-vs-engine mode where the player was **Black** (Coach assessment game, Play, the
onboarding calibration game), the human could grab pieces but moves never applied — chessground snapped
them back "as if in check". Root cause was a **stale `turnColor`**. Callers computed the board's
`turnColor` from a `ChessGame` instance held in `$state`, but Svelte 5 does **not** deep-proxy class
instances — so the engine's reply (and the human's own move) **mutated** the game without **reassigning**
it, and the `turnColor` derived, whose only reactive dependency was that `game` signal, never recomputed.
It froze at its initial value (`'white'`, the side to move at game start). `movableColor`/`dests` stayed
correct only because their deriveds *also* read `status`/`thinking` (which fire every move) and re-read
the live game when they recomputed; `turnColor` read nothing else. chessground applies a drag as a real
move only when `turnColor === movable.color`; with a frozen `'white'` turnColor and a fresh `'black'`
movableColor, every Black move was silently demoted to a **premove** that never executed. White never hit
it because the frozen `'white'` happens to match White's own turns; position-based drills where the human
moves first (Sparring/Comeback/Endgames) were latently stale but coincidentally correct (the frozen value
equalled the player's side). Fix: the side to move is a fact **of the position**, so `Board.svelte` now
derives it from the `fen` prop (`fen.split(' ')[1]`) — the one input every caller refreshes on each move —
and hands *that* to chessground, instead of the separately-passed `turnColor` prop (retained only as a
fallback for a fen with no side field). One change at the single source of truth fixes every game mode at
once and makes the class of bug unreintroducible. Note (out of scope): the `check` prop is stale by the
same mechanism, but that is cosmetic (king-highlight lag) and never blocks a move; AnalysisBoard has a
broader, colour-agnostic staleness (its `movableColor`/`dests` also read only `game`) tracked separately.
jsdom does no layout and the WASM engine can't run headless, so the behaviour is guarded by a source
invariant (`board-turn-color.test.ts`, same approach as ADR's mini-board sizing guard). No schema, no API
change. Cross-links: ADR-0047 (play either colour — introduced the Black path), ADR-0046 (side-to-move
badge — also now fen-derived).

## ADR-0051 — Board props reactive per move: reassign `game` (AnalysisBoard) / tie `check` to `fen`
**Date:** 2026-06-07 · **Status:** accepted

Same root-cause family as ADR-0050 (turnColor in Board.svelte): Svelte 5's `$state` does **not**
deep-proxy a `ChessGame` (a class instance), so an in-place `game.move()`/`moveUci()` never fires
the `game` signal — only *reassigning* `game` does. Any board prop derived solely from `game`
therefore goes stale until the next reassignment (back()/reset()).

**Blocking bug — AnalysisBoard (spec E / ADR-0031):** `movableColor`/`dests`/`check` derive only
from `game`, and the analysis board has no other reactive co-dependency, so after the FIRST manual
move all three froze and a second consecutive move was impossible (clicking an engine line hit the
same wall). Fix: `advance()` now reassigns `game = new ChessGame(fen)` after each move — the pattern
back()/reset() already used — refreshing all three at once. Safe here because the analysis board is
standard-only, keeps its own `stack` for history, and never calls `game.terminal()`.

**Cosmetic sibling — Play / Sparring / Comeback / Endgames + the calibration-game boards in Coach &
Onboarding:** there `movableColor`/`dests` survive because they share a co-dependency on a toggling
`$state` (`status`/`thinking`/`gameThinking`) that re-fires every move-cycle and re-reads the mutated
`game`; but `check={game.inCheck()}` has no such co-dependency, so the in-check king highlight never
updated mid-game. Fix: a `$derived` anchored on the reactive `fen`/`gameFen` (reassigned every move)
— `const inCheck = $derived(fen ? game.inCheck() : false)`. We deliberately do **not** reassign
`game` in these modes: they support Chess960 (rebuilding from a standard FEN would drop the castling
shim — ChessGame.ts) and need full move history for threefold/fifty-move `terminal()`. The
puzzle/ladder boards (Coach & Onboarding `display`, plus Tactics / Woodpecker / GuessMove / Review /
Calculate) already reassign `display` per move, so they were never stale.

Board wiring only — no schema, API, or rules change. Cross-links: ADR-0050 (Board turnColor — the
other half of the same fen-reactivity fix), ADR-0031 (interactive analysis board / spec E).

## ADR-0052 — Audit v2 remediation: scope, decisions, and delivery
**Date:** 2026-06-16 · **Status:** accepted

A second audit (`reports/audit-v2-2026-06-10.md` — 16 agents + adversarial verification + **live
execution**, the dynamic pass v1 lacked) produced a 143-finding backlog (4 critical / 37 major /
64 minor / 38 note) plus the first UX/UI review. Remediation is planned in
`specs/audit-v2-remediation-spec.md` (18 workstreams) with the `/enrich` bundle
`reports/audit-v2-remediation_improvements.md`.

**Ratified decisions (2026-06-10):** Q1 one PR per workstream, merged by priority batch; Q2 fold
trivial P3 into their axis, defer the rest; Q3 **UI target language = French** (a dedicated chantier,
W18); Q4 keep English SAN as the international convention; Q5 light theme deferred (tokens first);
Q6 SAN/UCI keyboard input before arrow-key board navigation.

**Delivered (merged; svelte-check 0 errors/0 warnings, 488 Vitest, build green):** P0 — W1
full-strength analysis (`fullStrength` per call), W2 import-colour detection, W3 Chess960 castle-aware
undo, W4 keyboard move path. P1 — W5 engine seams + shell resilience, W6 rules guards (moveUci ×5,
960 king-step), W7 import/repertoire id robustness, W8 coach/insights honesty, W9 drill guards, W10
due-card badge, W11 async on-target puzzle index, W12-part1 non-blocking coach dialog + clock-fix,
P1-05 engine-crash recovery (Play). P2 — W13 a11y baseline + nav (absorbed W16), W14 click-to-move +
themed confirm dialogs, W15 UX journeys, W17 design tokens + promoted shared components.

**Remaining (tracked in the spec §13), future work:** **W18** — the full French UI conversion
(i18n catalogue + ~316 strings + data JSON + SAN-display policy + tests); this ADR records the
*decision*, the conversion itself is a standalone effort. **W12-part2** — extracting Play.svelte's
state machine + clock controller to meet the `<300`-line DoD. Plus mechanical W17 scoped-dup deletion,
the Sparring/Comeback/Endgames crash-recovery siblings of P1-05, and assorted journey / aria-live
polish. Cross-links: ADR-0032 (CSP), ADR-0050/0051 (board reactivity — preserved throughout).

## ADR-0053 — W18: bilingual FR/EN UI with a runtime language switch (supersedes ADR-0052 Q3)
**Date:** 2026-06-16 · **Status:** accepted

**Supersedes ADR-0052 Q3** (which chose a *mono-locale* French catalogue, no runtime i18n). The user
asked for a **language toggle (FR ↔ EN)**, so the app is now **bilingual with a runtime switch,
default French**. A switch requires both locales complete and a reactive current-locale, so English is
no longer left inline — it is captured into the catalogue alongside the French. ADR-0052 Q4 (SAN stays
English, the international convention) is **unchanged** and holds in both locales.

**Mechanism (`src/i18n/`).** No runtime i18n library (ADR-0052 Q3a intent kept). Each message carries
*both* locales — `{ fr, en }` — so `keys(fr) === keys(en)` is structural (a key can't exist in one
locale only). A pure `translate(messages, key, locale, params)` core (interpolation + a missing-key →
fallback → key guard + a missing-param guard) is importable by pure cores and tests. The reactive
current locale lives in `locale.svelte.ts` (`$state`); UI calls `t()`/`tn()`/`fmtPct()` which read it,
so flipping the language re-renders every `t()` output live (the ADR-0050/0051 reactivity lesson — a
tracked `$state` dependency). Pure generators (`explain`/`positional`/`program`/`metacog`/`diagnostic`)
take an **injected `locale`** and resolve via the catalogue (`gt`), staying pure/unit-testable; the UI
passes `getLocale()` reactively. Locale persists as the additive `SettingsRecord.locale` (read
`?? 'fr'`, **no `DB_VERSION` bump** — precedent ADR-0035/0037/0040/0043); a Settings toggle sets it and
mirrors `<html lang>`.

**Number/typography (W18 I3):** locale-aware `formatNumber`/`formatPercent` — FR `78 %` (no-break space)
/ comma decimal, EN `78%` / dot. Honest, measurable DoD (W18 I1): a structural completeness test
(`keys(fr) === keys(en)`, no cross-domain key collision) replaces an "is it all French?" eyeball; the
catalogue is the single source, so the consolidation of duplicated dimension-label maps (Radar / Coach /
Dashboard / Insights) fell out for free. Fixes P3-19 (coach-program reason routed the raw motif key —
now via the motif label).

**Delivered (merged; svelte-check 0/0, 500 Vitest green, build green, runtime-verified FR default +
live FR↔EN switch):** the i18n infra + switch; all **31 views** translated; the TS generator + label
layer (move explanations, coach diagnostic/program, metacog calibration, dimension/motif/severity/
self-tag labels); `lang="fr"` + FR `<title>`.

**Deferred (tracked in `specs/audit-v2-w18-french-ui-spec.md` §10), residual English in FR mode —
a clean "deeper data / secondary-generator" boundary, all additive:** the data-content JSON
(`concepts.{fr,en}.json`, `eco.json` opening names + the `build-eco.mjs` ETL mapping, `endgame/drills.ts`
goals) which is async-loaded and needs locale-aware reload; `studyPlan.ts` plan-item reasons + the
Insights leak motif/phase labels + `DimensionScore.detail` (weakness.ts) + `scenarios.ts` names/goals;
and the static `<title>` (set at load, not reactive). None block use; each is a follow-up. Cross-links:
ADR-0052 (the FR decision this implements + supersedes Q3), ADR-0050/0051 (reactivity), ADR-0037 (additive
field precedent).

## Note — P1 play-loop closure (feature PR, no ADR)
**Date:** 2026-06-30 · **Status:** shipped · **Spec:** `specs/play-loop-closure-spec.md`

Closes the play→analysis→steering loop so it fires even when the user never clicks "Analyse this
game". No new ADR (feature PR: reuses F5's read API + an additive setting + a sequential queue — no
new architectural primitive; doctrine default for feature PRs).

**The bug.** `analyzePlayed()` was gated on `lastGame`, component-local `$state` cleared on
`newGame()`/navigation, so once you left the over screen the game was never analysed → no
`gameAnalyses` row → no personal puzzles → no `weaknessCounters` fold → `loadAllAnalyses()` empty →
`buildWeaknessProfile().weakest` null → opening steering silently degraded to neutral.

**Fix.** "Which games are unanalysed" is now a **derived fact** over the persisted stores, not a
transient field (AP-PLAYLOOP-1): a pure `unanalyzedPlayedGames(games, analyzedIds)` selector
(`src/analysis/unanalyzedGames.ts`) over F5's `getAllGames()` minus `getAnalyzedGameIds()`, excluding
chess960 (AP-960-4) and legacy color-less records (analysing from the wrong POV is the audit C-3
failure mode — AP-PLAYLOOP-12), newest-first. A user-initiated **"Analyse your N unanalysed games"**
(Play over-screen) runs `analyzeBacklog` (`src/analysis/analyzeBacklog.ts`) **one game at a time**
(single engine worker — sequential, never parallel, AP-PLAYLOOP-2), **cancellable** between games,
**capped** per run, with a **per-game try/catch** so one failure is counted and the loop continues
(F-P1-4). Both cores share `analyzeOnePlayedGame` (the `resetVariant`→`getAnalysis` idempotency
guard→`runAnalysis(source:'played')` sequence; AP-PLAYLOOP-7), also used by the Play-tail single-game
button (FOLD-F-P1-5) and the opt-in auto-run. A durable Dashboard/Home **"N unanalysed games"** badge
(`app.unanalyzedGames`, refreshed on boot + view change like `dueReview`) links to F5's history for
selective analyse. The displayed N is exactly the selector's length so it never overstates what runs
(F-P1-3 / AP-PLAYLOOP-13).

**Settings.** `SettingsRecord.autoAnalyzeOnFinish?` (opt-in, default off, `?? false`): analyses
**only the just-finished game** (never the backlog — AP-PLAYLOOP-3), non-blocking; on failure the
game simply stays counted in the backlog (the count is the failure signal — AP-PLAYLOOP-11).

**Pre-check finding (recorded).** F5 had **already** added `GameRecord.playerColor?` (written by
`Play.finishGame()`, read by history) and `getAllGames()`/`getAnalyzedGameIds()`. P1 **consumes**
these — it does not re-add the field or redefine the reads (AP-PLAYLOOP-5). Spec §4.1's "add
playerColor" was therefore a no-op; only the `SettingsRecord` field is new this PR.

**Doctrine.** Additive-only, **no `DB_VERSION` bump** (stays v4; both touched fields optional, read
with `??`). Steering math untouched (P4 owns symmetry — AP-PLAYLOOP-9); Insights/study-plan
byte-identical. Honest framing kept (F-P1-6 / AP-PLAYLOOP-15): analysing makes the data *available*;
the next game steers **only when a weakness is detected** — a clean game leaves steering neutral, by
design. Free fix: the single-game/cached-result panel now reads `analysis.puzzlesGenerated` for the
puzzle count instead of a hard 0 (audit P3-16). Bilingual `play.loop.*` keys (FR+EN). Cross-links:
F5 (`games`-store reads this consumes), ADR-0022 (one-click played-game review this generalises),
ADR-0014 (opening steering this feeds), ADR-0006 (one eval per position).

**ADR-0053 follow-up — F1 i18n-label-routing:** display keys (activity/themes) routed through the
catalogue; routing keys unchanged. Added `activity.*` (7-value `PlanItem.activity` union, FR+EN) +
common theme sub-tags to `generators.ts`, a generic `labelOrRaw(ns,key,locale)` resolver in `gen.ts`
(consumed by Coach + Insights), and a union-exhaustive parity test. Display-only: `focus`/`activity`/
theme keys passed downstream stay raw; Insights study-plan DATA byte-identical; no `DB_VERSION` bump.
§11 deferred (own PR, raw fallback meanwhile): `Session.svelte` `step.kind` (`SessionStepKind` = activity
∪ review/reflection — needs labels outside `activity.*`) and the open-vocabulary `focus` prose line.

## ADR-0055 — F3: coach probe recording + weaknessCounters rehabilitation
**Date:** 2026-06-30 · **Status:** accepted

**Spec:** `specs/attempt-recording-weakness-spec.md` (V1). **Parent:** `specs/enhancements-architecture-spec.md`
§2 (F3). Folds CF1 + TR2; TR3 (self-tag→action) deferred to T1, display of counters deferred to T2.

**Two verified gaps closed with one coherent move.** (CF1) The coach assessment's ~14 diagnostic
probes (2 per motif × 6 + 2 endgame; `diagnostic.ts` `COACH_LADDER_MIN = MAX = 2`) were thrown away —
`Coach.svelte:onLadderMove` called only `ladder.report()`, never writing an attempt row, FSRS card, or
weakness increment. (TR2) `weaknessCounters` was a **dead-read**: written on miss (Tactics/Review) and
per played-game motif (runAnalysis) but consulted by no selection path. F3 makes the existing
persistence path *also* fire from the coach, and makes `weaknessCounters` a **live read** that softly
biases the trainer's no-drill curated fallback. **This supersedes audit-v2 V2-W10's "delete
weaknessCounters" option in favour of rehabilitation.**

**Arbitrages (defaults applied).** **Q-A** probe records SRS card + weaknessCounters but **not** the
rating pool. **Q-B** weakness steering is a **soft bias** (top-k themes passed to `next()` with a wide
rating window), never a hard filter. **Q-C** TR3 self-tag→action is out (T1); the selfTag write path is
untouched. **Q-D** the steered branch sits **between personal and plain curated** — preserving the
shipped order drill > personal > *(new)* weakness-biased curated > plain curated. **Q-E** probe
`source` stays `'curated'` (probe puzzles ARE curated); provenance is an additive optional
`coachProbe?: boolean` flag, **no `PuzzleAttemptRecord.source` union change** (AP-ATTEMPT-5). **Q-F** the
probe puzzle's own Glicko rating is passed unchanged — a low-stakes diagnostic must not perturb curated
difficulty.

**AP-COACH-8 isolation (the load-bearing invariant).** `gradeAttempt` is **never** called for a probe.
`recordTacticsAttempt` is invoked with the probe puzzle's rating fields **unchanged** and the model's
`puzzleRating` **unchanged**; only `puzzleAttempts`, `srsCards`, and `weaknessCounters` change.
`ratingBefore = ratingAfter = baseline()` is recorded honestly. The decisive regression guard
(`coach-probe-record.test.ts`) records a mix of solved/missed probes and asserts both `puzzleRating`
and the probe puzzle's `rating`/`ratingDeviation` are byte-unchanged. The PuzzleLadder's internal
`rating` stays local, never persisted (today's correct behaviour, preserved).

**AP-COACH-1 guarantee (study-plan byte-identity).** `buildStudyPlan`/`buildCoachProgram` consume
`leaks` (from `fingerprint.ts`) + the weakest radar dimension — **never** `weaknessCounters`. F3 adds no
edit to `studyPlan.ts` or its inputs; the existing `studyPlan.test.ts` determinism test is the
mechanical proof and stays green. weaknessCounters steers the *trainer*, not the *plan*.

**Mechanism.** New PURE `src/trainer/weaknessSelect.ts` (`steerFromWeakness`: no `Date`/`Math.random`,
deterministic tie-break by theme key; `minCount` default 2 noise floor so a single miss never
redirects the queue — AP-ATTEMPT-4; `k` default 1; returns `{ themes: undefined }` when there is no
signal → the caller falls through to plain curated, the no-regression escape hatch). `Coach.svelte`
gains a `recordProbe()` that mutates the live model's counters (so the fold lands in the same atomic tx
AND survives `commit()`'s reload — the I-1 reload-then-persist discipline is preserved, no
double-count, AP-ATTEMPT-6) and records via `recordTacticsAttempt`. `Tactics.loadNext` inserts one
steered branch; a biased `next()` returning null falls through (AP-ATTEMPT-2/3, never dead-ends). The
false `runAnalysis.ts` comment ("used by the trainer's personalised selection and the dashboard") is
corrected to the now-true behaviour.

**Additive, no migration.** `coachProbe?` is an optional field on `PuzzleAttemptRecord`; absent on
legacy/normal rows reads falsy. **NO `DB_VERSION` bump, NO `schemaRev` bump** (precedent
ADR-0035/0037/0040/0043/0053). Adds no user-facing string. Delivered: svelte-check 0/0, 533 Vitest green
(514 baseline + 19 new: 10 pure-core + 5 probe-record incl. the no-pool-leak guard + 4 selection seam),
build green. Rollback is per-half independent (recording A2 and selection A3 revert separately); existing
`coachProbe: true` rows read harmlessly. Cross-links: ADR-0045 (coach diagnostic/program), ADR-0037
(additive-field precedent), ADR-0053 (i18n — no new strings here).

## F4 — Reusable `SolutionReveal` + "show solution" & "why" on a trainer miss (no new ADR)
**Date:** 2026-06-30 · **Status:** accepted · **No ADR allocated** (Q-E default — reuse under
ADR-0040/0044/0021/0052/0053; the extraction was not judged decision-worthy enough to pre-spend ADR-0054).

**Spec:** `specs/teach-explain-surfacing-spec.md` (V1, Foundation F4). **Parent:**
`specs/enhancements-architecture-spec.md` §2 (F4). Folds TR1 core; the Coach game-review consumption
(EvalGraph + turning points) is **deferred to C6** per the DAG.

**One concern: make the existing "solution + why" capability reusable and surface it on a Trainer miss.**
The 350 ms animated reveal lived trapped in `Calculate.revealSolution` (AP-TEACH-1). F4 **extracts** it into
a prop-driven `src/ui/SolutionReveal.svelte` (view-only `<Board>` stepper + `formatSanLine` SAN line +
an optional source-agnostic `why?`), refactors `Calculate` to **consume** it byte-equivalently (same SAN
line, same 350 ms cadence — Calculate's `calc.test.ts`/`explain.test.ts` byte-identity anchors stay green),
and wires it as the proof consumer on **both** structurally-identical trainer-miss paths (`Tactics.svelte`
**and** `Review.svelte`) behind an opt-in "Show solution" toggle.

**Arbitrages (defaults applied).** **Q-A** new shared component both consume (not extend-in-place).
**Q-B** depth-of-why is **per consumer**: trainer-miss → a theme/motif-derived line (no engine; honest);
Coach → EvalGraph **[C6]**. **Q-C** component + BOTH trainer-miss consumers now; Coach deferred. **Q-D** an
opt-in toggle (Retry-safe), not auto-reveal — Calculate keeps its existing auto-reveal-on-Submit (it has no
Retry). **Q-G** the "why" reuses the existing bilingual `motifExpl.*`/`motif.*` catalogue keyed off the
puzzle's highest-precedence theme — **no new prose content, only a mapping.**

**The trainer "why" is theme-derived, never engine-derived (the load-bearing honesty invariant).** A
trainer miss has **no `PlyAnalysis`** at solve time (puzzle lines are pre-verified; no live engine), so
F4 does **not** call `explainPly` and does **not** fabricate eval facts (AP-TEACH-3). New PURE
`missWhy(themes, locale)` + `primaryMotifFamily(themes)` in `concepts.ts` reuse `familyKey`/`CARD_PRECEDENCE`
(so they can't desync from `cardForThemes`), resolve the primary motif family, and render the existing
`motifExpl.*` idiom framed as a **pattern HINT** (`reveal.themeWhy`), **returning `null` when no
high-precedence family resolves** → no asserted reason shown (AP-TEACH-2, mirrors `explain.ts`). `explainPly`
remains the Coach path (C6), which will pass its richer line through the **same** `why?` prop (FOLD-4) — C6
must not fork the component.

**Premise corrections carried from the empirical scan.** `explain.ts` `uciToSan` is **module-private**;
SAN for the reveal is derived via `new ChessGame(fen).moveUci(uci)` + `formatSanLine` (exactly as the old
reveal did) — F4 does **not** widen the export surface. Reveal tolerates empty/short/illegal-mid-line UCI
(`moveUci(m) ?? m`, clean stop, never throws — FOLD-3), highlights the key move each step via `lastMove`
(FOLD-1), and honors `prefers-reduced-motion` → instant render via `stepMs=0` (FOLD-2).

**i18n (additive, bilingual).** `reveal.showSolution`/`reveal.hideSolution` (UI toggle labels) in
`tactics.ts`; `reveal.themeWhy` (the pure-core pattern-hint template, resolved by `missWhy` via `gt`) in
`generators.ts`. `calc.solution` is **reused** for the SAN line (not redefined). `reveal.why` from Q-F was
**dropped** — it was conditional ("only if the component prefixes the why line"), and since framing folds
into `missWhy`/`reveal.themeWhy` the component renders `why` bare, so the key would be dead weight. Every
new key has FR+EN; the `translate.test.ts` catalogue-integrity + collision guards gate parity automatically.

**Additive, no migration.** No `DB_VERSION`/`schemaRev` bump (precedent ADR-0035/0037/0040/0043/0053); no
persisted fields; no engine on the trainer path. Pure cores stay pure (locale injected). Delivered:
svelte-check **0/0**, **543 Vitest green** (533 baseline + 10 new: 6 pure `primaryMotifFamily`/`missWhy`
incl. honest-null + FR≠EN parity, + 4 FOLD-3 SAN-line tolerance), build green. `SolutionReveal.svelte` is
verified by build + manual (no component-test harness; the logic that matters is pure and unit-tested).
Rollback: revert the PR; or revert just A4/A5 (the toggle) and keep A2/A3 — `Calculate` stays
byte-equivalent, so partial rollback is safe. Cross-links: ADR-0040 (concept cards / `motifExpl.*` reuse),
ADR-0044 (calculation reveal origin), ADR-0053 (i18n discipline), ADR-0037 (additive-field precedent).
Follow-ups: **T1** (second-try / alt-move acceptance / self-tag) and **C6** (Coach replay + EvalGraph +
`explainPly` narrative) both build on `SolutionReveal`.

## ADR-0056 — F5: readable `games` store + client-side PGN export & played-game history
**Date:** 2026-06-30 · **Status:** accepted

**Spec:** `specs/games-store-pgn-io-spec.md` (V1; the spec named ADR-0054, renumbered to **ADR-0056**
because F4 noted it would not pre-spend 0054 and F3 took 0055). **Parent:**
`specs/enhancements-architecture-spec.md` §2 (F5, the infrastructure PR). Lands the **client-side PGN
I/O primitive** + a minimal history surface; the coach PGN-assessment consumer (CO11) is **deferred to
C4**, coach profile export (CF10) **to C8**.

**One concern: turn the write-only `games` store into a readable asset + a client-side PGN-out
primitive.** `putGame` was called once (`Play.svelte`) and read **nowhere** in `src/` (only tests read
it back) — every played game was persisted then invisible. F5 adds two thin index-backed reads to
`gamesRepo.ts` — `getAllGames()` (`getAllFromIndex('games','playedAt')`, ascending; the caller reverses
for newest-first) and `getAnalyzedGameIds()` (`new Set(getAllKeys('gameAnalyses'))`) — surfaces a
**played-game history `<section>` inside the existing Import view**, and adds a greenfield download
helper (`src/ui/pgnDownload.ts`).

**Arbitrages (recommended defaults applied — V1).** **Q-A=a** history is a section **inside Import**
(`view 'import'`), not a new top-level view — Import already owns PGN paste + `AnalysisResult` and is
nav/Home-reachable, so a new `View`-union/`loaders[]`/`NAV[]` triple-edit + lazy chunk buys nothing
(AP-GAMES-4). **Q-B=a** PGN import stays **single-game paste**, reusing the EXISTING hardened
`Import.svelte` flow (multi-game split detection, headers-only + colour-not-detected guards) verbatim —
no re-parsing; bulk file import deferred (§11). **Q-C=a** F5 lands the **primitive only**
(read+export+re-analyse-from-history); coach PGN-assessment integration is the hard **C4** boundary
(AP-GAMES-5). **Q-D=defer** coach profile export (CF10) is a different artifact → **C8**.

**FOLD-G1 — batched analysed markers (AP-GAMES-3).** The history list resolves analysed/not via ONE
`getAllKeys('gameAnalyses')` set, not N per-row `getAnalysis` calls. **FOLD-G2 — Play-tail export.** An
"Export PGN" ghost button sits next to "Analyse this game" in the game-over tail (and, unlike Analyse,
is offered for 960 too — its PGN is valid even though analysis isn't). Each non-960, not-yet-analysed
history row gets an **Analyse** action reusing the played-analysis pipeline (idempotent via
`getAnalysis`, `runAnalysis(source:'played')`), rendered through the existing `AnalysisResult.svelte`;
960 rows keep Analyse disabled (AP-960-4 / AP-GAMES-7).

**PGN export is a download wrapper, never a re-serialisation (AP-GAMES-2).** `GameRecord.pgn` already
holds a chess.js-serialised PGN, so `downloadPgn(pgn, filename)` is a `Blob` → `createObjectURL` →
anchor-click → `revokeObjectURL` side-effect — **strictly client-side**, no server (AP-GAMES-9),
feature-detected for SSR/jsdom, no-op on empty PGN. The filename core `pgnFilename(playedAt, result)`
is **pure** — `game-YYYY-MM-DD-<result>.pgn` derived from the record's `playedAt`, **never `Date.now()`**
(AP-GAMES-6) — and unit-tested for determinism + result sanitisation. `getAllGames` reads **only** the
`games` store; `importedGames` never leaks in (AP-GAMES-8, guarded by a test).

**One additive field — `GameRecord.playerColor?` — to keep history re-analysis correct.** A *played*
game's PGN (`this.chess.pgn()`) carries **no White/Black headers**, so colour is not inferable from the
stored PGN, and analysing from the wrong POV corrupts every player-attributed metric (audit v2 P0-02).
F5 therefore persists the side the human played (`Play.svelte` writes `playerColor[0]`); history reads
it, with a best-effort fallback for legacy pre-F5 records (terminal-checkmate + result, else White).
This is the one **deviation** from the spec's read-only framing — the spec's §2.4 re-analyse feature is
incorrect without it. **Additive optional field; legacy records read `undefined`. NO `DB_VERSION` bump,
no new store/index** (precedent ADR-0035/0037/0040/0041/0043/0053; the `playedAt` index already exists
from the v1 upgrade). AP-GAMES-1 held.

**i18n (additive, bilingual).** A `history.*` sub-namespace (title/subtitle/empty/analysed/notAnalysed/
analyse/export/result{Win,Loss,Draw}/botElo/chess960/untimed/cat{Bullet,Blitz,Rapid,Classical}) +
`play.exportPgn` in `messages/play.ts`, every key FR+EN; the structural `translate.test.ts` parity +
collision guards gate it automatically (AP-GAMES-10). The history date is locale-aware via
`Intl.DateTimeFormat` keyed off `getLocale()`.

**Insights byte-identity.** F5 touches no selection/`studyPlan` logic, so Insights output is unchanged
(no edit to those files). **Delivered:** svelte-check **0/0**, **555 Vitest green** (543 baseline + 12
new: 5 `gamesRepo` F5 — ordering, empty, imported-isolation, analysed-set membership/exclusion — + 7
`pgnDownload` — pure filename determinism/sanitisation/no-`Date.now`, feature-detect, empty-PGN no-op,
jsdom click+revoke), build green. **Rollback:** additive and isolated — drop the two repo reads, the
`pgnDownload` util + test, the Import history `<section>`, the Play-tail button, the `playerColor` field
+ write, and the `history.*` keys; no migration was introduced (nothing to undo in IndexedDB).
Cross-links: ADR-0022 (Play one-click analysis), the Phase-2 import flow, ADR-0041 (960 exclusion),
ADR-0037 (additive-field precedent), ADR-0053 (i18n discipline), `enhancements-architecture-spec.md`
F5. Follow-ups: **C4** (coach PGN-assessment consumer), **P1** (auto-queue the last unanalysed game),
bulk file import, imported-games history, **C8/CF10** (coach profile export), history management
(delete/paginate/filter).

---

## ADR-0057 — Shared game-session controller (F6): extract Play's loop to `gameSession.ts`

**Context.** `Play.svelte` (666 ln), `Sparring.svelte`, `Comeback.svelte` each reimplemented the
`onMove→checkEnd→engineReply→checkEnd` loop, the ADR-0051 in-check reactivity contract, the P1-17
illegal-move halt, and the P1-14 resign-during-think guard; only Play carried clock / `pickHumanMove` /
`retryEngineMove`. F6 extracts the loop into a pure, DOM-free `src/game/gameSession.ts` (`GameSession`
class + `createGameSession`), consuming the existing `playSession.ts` helpers + `AdaptiveOpponent` via an
injected `EnginePort` (no `Date`/`Math.random`/`performance.now` in the core).

**Decisions.** (Q-A) controller owns the loop, the component keeps the view. (Q-B) clock optional,
default off — siblings stay clockless. (Q-C) `pickHumanMove`/`retryEngineMove` opt-in flags; Play turns
on exactly what it used → **behaviour-preserving**. (Q-D) Play migrated this PR; Sparring/Comeback
fast-follow. (Q-E) new `gameSession.ts`; `playSession.ts` stays pure helpers. (Q-F) injected ports.
(Q-G) **return-state API, NO auto-chain** of `applyPlayerMove`→`engineReply` — Play's coached takeback +
clock press interpose (Play.svelte ~265-289), preserved exactly. `startFen` is a first-class init param
(enables C3 designed probes). `checkTerminal` pure + idempotent (W6 double-fold guard).

**Delivered.** New `gameSession.ts` + 22-test parity core (`gameSession.test.ts`); Play migrated to
consume it with observable behaviour unchanged. svelte-check **0/0**, **577 Vitest green** (555 baseline
+ 22), build green. No `DB_VERSION` bump. **Rollback:** revert Play to its pre-F6 inline loop and drop
`gameSession.{ts,test.ts}`. Cross-links: ADR-0050/0051 (engine concurrency / in-check reactivity),
audit-v2 W12 (`playSession` pure home), `enhancements-architecture-spec.md` F6. Follow-ups: migrate
Sparring + Comeback onto the controller (inheriting human-move + retry); **P3** (opponent agency) and
**C3** (designed probes) consume this controller.

## F2 — board-input-a11y: keyboard/text move entry + aria across board consumers (no new ADR)

**Extends ADR-0052's a11y line (P0-04 / W4) + ADR-0053 (bilingual).** No new ADR (Q-D — display/markup
follow-up; mirrors F1's precedent and reserves the portfolio's ADR-0054; a future board-aria ADR takes
the first free number *after* 0054, never 0054 itself). **Spec:** `specs/board-input-a11y-spec.md` (V1).

**Premise correction (the key scan output).** The audit's CF9 "boards are mouse-only, no aria" was
**false** at the component + 3-consumer level: `Board.svelte` already shipped `onMoveText` + the keyboard
form + an assertive `role=alert` error region (P0-04), and Tactics/Review/Play already wired it. F2 was
therefore *finish the rollout + label the region*, not *build keyboard entry* — shrinking the PR to wiring
9 files + one aria attribute.

**Decisions (RESOLVED defaults).** (Q-A) text move entry + a basic region `aria-label` **now**;
`role="grid"` per-square navigation **DEFER** (announcing a grid with no arrow model is worse than a group
— AP-A11Y-4 / §11 D1). (Q-B) ←/→ ply MOVE NAVIGATION **DEFER** (needs a ply cursor that exists nowhere).
(Q-C) region aria lives in the **single source** `Board.svelte` so every consumer inherits it; only the
`onMoveText` *callback* is per-consumer (it needs that consumer's game + turn guard). (Q-D) no new ADR.
(Q-E) whitelist the **11 interactive** instances; `onSelect` calc/vision drills + view-only boards are
excluded — the `{#if onMoveText && !viewOnly}` guard makes wiring them a no-op or wrong (AP-A11Y-3).

**Delivered.** `Board.svelte`: a derived `interactive = !viewOnly && !!onMoveText` drives a split region
label — `role="group"` + `t('board.label')` when interactive, else `role="img"` + `t('board.labelView')`
(positional, no "type below" claim). FOLD A1: focus returns to the move input after a successful typed
move (consecutive keyboard moves need no re-tab). FOLD A3: a visually-hidden polite `aria-live="status"`
node announces `t('board.movePlayed')` on success — the polite counterpart to the kept assertive error.
Three new bilingual keys (`board.label`, `board.labelView`, `board.movePlayed`). The 11 interactive
boards (Coach×2, Comeback, Sparring, Endgames, GuessMove, AnalysisBoard, Repertoire [scratch
`new ChessGame(drill.fen())` — no persistent game], Woodpecker, Onboarding×2) now pass `onMoveText` via
the canonical Tactics pattern, each gated by that consumer's existing turn/play condition so a typed move
can never apply when a dragged one couldn't (AP-A11Y-2). Promo-less last-rank pushes auto-queen (`?? 'q'`)
for parity with Tactics/Play/Review (§11 D6).

**Tests.** Reused `resolveMove` core (already covers SAN/UCI/coord/castle/promo, standard + 960). New
static wiring guard `src/ui/board-input-wiring.test.ts` (Node `fs`, no DOM): asserts each of the 11
consumers passes `onMoveText` + resolves via `resolveMove`, that the excluded boards do **not**, and that
`Board.svelte` carries the region-aria branch + the focus/announce loop. **Honest limit (FOLD A8):** this
guards the *presence* of the wiring, not the correctness of each turn/play guard — behavioural correctness
(typed move rejected off-turn) is manual (spec §6 C2/C3). i18n parity is covered by the existing catalogue
integrity test (iterates `ALL_MESSAGES`).

**Doctrine.** Additive UI only; **no `DB_VERSION` bump** (nothing persisted — AP-A11Y-6); single concern
(no `resolveMove`/move-API/selection/persistence change); Insights study-plan byte-identical. svelte-check
**0/0**, **613 Vitest green** (577 baseline + 36 wiring), build green. **Rollback:** revert the commit —
the `onMoveText` props vanish (those 9 files fall back to mouse-only), the 3 keys + the region role/label
are removed; no data/schema/migration to unwind; per-file safe. Cross-links: ADR-0052 (a11y line / P0-04),
ADR-0053 (bilingual), ADR-0043 (coords/onSelect drills, excluded), `enhancements-architecture-spec.md` F2.
Follow-ups (§11): full ARIA-grid navigation (D1), ←/→ ply nav (D2), a Svelte component-test harness (D3),
square-tap a11y for the onSelect drills (D4), an optional board-aria ADR (D5), typed under-promotion via
the keyboard field (D6).

---

## T1 — trainer-feedback-core: solution+why on miss, self-tag actions, alt-move accept, second-try (no new ADR)

**Reuses ADR-0037 (metacog) / 0010+0033 (FSRS clamp lineage) / 0040 (concept cards) / 0052+0053 (i18n);
builds on F4 (`SolutionReveal` + `missWhy`) and F3 (attempt recording / `selfTag`+`confidence` capture).**
No new ADR (Q-F): the alt-move "what counts as solving" change is gated behind a code-level flag, not
ratified architectural — reserved ADR numbers (0054-0057) untouched, ADR-0058 NOT spent. **Spec:**
`specs/trainer-feedback-core-spec.md` (V1, 4 refiner + 3 enrich cycles).

**Premise correction at build time.** The spec's §1 baseline (504 tests, pre-F4) was stale: at HEAD all
of F1-F6 are committed (**613 tests**), so **TR1 was already shipped** — both `Tactics.svelte` and
`Review.svelte` already mount F4's `<SolutionReveal>` with `why={missWhy(puzzle.themes, getLocale())}` on
a miss. T1's remaining work was therefore TR6 (second-try), accept-alternate-winning, and TR3 (self-tag
reactions + confidence clamp), built on the committed foundations rather than re-implementing TR1.

**Decisions (RESOLVED defaults).** (Q-A) accept an off-line move iff it is mate FOR the solver, OR within
`withinCp` (50) of the mainline best AND clearly winning beyond `winningFloorCp` (200) — the dual gate is
the honesty guard (relative-only would accept "less bad" losing moves; absolute-only would reject a thin
quiet-tactic). Behind a flag `acceptAltWinning` (default ON, code-level const — **no persisted setting**,
no schema churn). (Q-B) one on-board second try before the fail locks; the wrong move stays visible; the
attempt **still records the miss** (`mistakes >= 1`). (Q-C) exactly 3 reactions, Tactics-only:
`unfamiliar-pattern`→open the motif's concept card (reuse `cardForThemes`/`openLearn`); `rushed`→one-tap
"Try this timed" (reuse `app.tacticsTimed`); `confidence ∈ {guess,unsure}` on a SOLVE → clamp FSRS grade
≤ Good. (Q-D) reveal stays opt-in (inherits F4). (Q-E) the clamp is a tiny pure helper
`clampForConfidence(grade, confidence)` wrapping the grade before `recordTacticsAttempt`. (Q-H) an
accepted alt records `solved:true` like any solve — no new provenance field.

**Delivered.** `src/srs/fsrs.ts`: pure `clampForConfidence` (downgrades Easy/Good→Good for guess/unsure;
never upgrades; no-op on miss/sure/undefined; inline `'sure'|'unsure'|'guess'` union so `srs/` stays a
dependency leaf). `src/trainer/altMove.ts` (new): pure `acceptAltMove(solver, bestLine, playedLine,
policy?)` — White-POV sign discipline (flips for a Black solver), mate-for-solver short-circuit, dual
relative+absolute gate; `AltMovePolicy`/`LineEval`/`DEFAULT_ALT_MOVE_POLICY` exported. `TacticalTrainer`:
additive `retriesLeft` in `SolveState` (constructor `retries=1`, `DEFAULT_RETRIES`); `playUserMove` returns
a new `'retry'` (records the miss, stays solving, board not advanced) before locking `'wrong'`; new
`acceptUserMove(uci)` applies the off-line move + scripted opponent reply exactly like the matched path
(engine-free — the decision is made outside). `Tactics.svelte`: handles `'retry'` (leaves the wrong move
on the board), runs an async `tryAcceptAlt` on a would-be miss (two back-to-back `fullStrength` evals —
mainline best via `analyzeLines` + the after-position via `evaluate`; honest fall-through to a miss on
reject/illegal/error/timeout, never hangs — a `checkingAlt` guard blocks a racing second move), applies
`clampForConfidence` on solve, and reacts to the self-tag chips (`unfamiliar-pattern`→card, `rushed`→timed
offer). `Review.svelte`: TR6 + symmetric alt-accept (no TR3 — Review has no metacog capture, PC-3). Seven
new bilingual keys (`tactics.secondTry/checkingAlt/altAccepted/tryTimed/offerTimed/reactUnfamiliar`,
`review.secondTry`); reuses F4's `reveal.*` and `tactics.learnPattern`/`openInLibrary`.

**Tests.** Pure cores unit-tested (no harness): `altMove.test.ts` (mate accept, within-cp clearly-winning
accept, rejects the relative-only "less bad" trap, rejects equal-but-below-floor, rejects gap>withinCp,
Black-solver sign correctness, custom thresholds); `fsrs.test.ts` extended (clamp downgrades/no-ops/never
upgrades/Again untouched/composes with the first-exposure clamp); `TacticalTrainer.test.ts` extended
(first wrong → `'retry'` with `mistakes===1, retriesLeft===0, status solving`; second wrong → `'wrong'`
+ failed; `retries:0` reproduces instant-fail; correct-after-retry still solves; `acceptUserMove` advances
the line + opponent reply; illegal `acceptUserMove`→`'wrong'` no state change). **Honest limit:** the
async alt-accept *wiring* + the TR3 reaction UI are behavioural (no `*.svelte` test harness exists —
portfolio fact); covered by spec §6 manual. **Cores stay pure** (no Date/Math.random/engine);
`TacticalTrainer` stays engine-free (AP-TFEED-6).

**Doctrine.** Additive only; **no `DB_VERSION`/`schemaRev` bump, no new persisted field** (selfTag/
confidence already on `PuzzleAttemptRecord`; the clamp is computed; an alt-accept records `solved:true`).
Honesty: pattern hint not a verdict, a retried/alt-accepted miss is still a miss (AP-TFEED-2/3); bilingual
FR+EN for every new key. Single concern (miss-feedback react + self-tag react + alt-move + second-try); the
recording/selection path (F3) and the reveal component (F4) untouched. **630 Vitest green** (613 baseline
+ 17 new, zero regressions), svelte-check **0/0** (396 files), build green; `metacog.calibration()` /
study-plan / `explainPly` / EvalGraph byte-identical. **Rollback:** revert the commit — per-fold safe and
independent (drop the clamp → grades return to `resultToGrade`; drop the alt seam → `sameMove`-only
acceptance; `retries:0` reproduces instant-fail without code removal; TR1 stays for F4 consumers). No
data/migration to unwind. Cross-links: ADR-0037/0010/0033/0040/0052/0053, F3, F4,
`enhancements-architecture-spec.md` Trainer T1. Follow-ups (§11): T2 (mode/theme/provenance, Review
metacog), T3 (`usedHint` clamp, progressive hints, impulsivity signal, alt-accept telemetry → revisit an
`altAccepted?` flag), C6 (coach reuses `SolutionReveal` with an `explainPly`-derived why).

## T2 — trainer-personalization: personal-puzzle provenance + source/theme/difficulty picker + honest exhaustion (no new ADR)

**Spec:** `specs/trainer-personalization-spec.md` (V1, 4 draft + 3 enrich cycles). **Parent:**
`specs/enhancements-architecture-spec.md` §3 (T2; folds TR4/TR9/TR10). **No new ADR** (feature; additive-
optional, no `DB_VERSION`/`schemaRev` bump — precedent ADR-0037/0040/0043/0053; reserved 0054-0057
untouched). Display + selection only.

**Premise correction.** F3 (ADR-0055) had **already** shipped the weakness-steered "Mixed" branch in
`loadNext` + the pure `weaknessSelect.ts`, so T2 did **not** re-implement selection bias (AP-TPERS-5) —
its real remaining work was TR4 provenance, TR9 the explicit toggle + theme/difficulty picker, and TR10
the exhaustion message (the dashboard display + richer selection F3 deferred to T2). Verified before edit.

**What shipped.** `src/trainer/provenance.ts` (new, PURE — no Date/Math.random/Svelte): `provenanceOf(meta)`
turns a personal puzzle's `meta` (consumed nowhere before) into a displayable pre-solve object, returning
`null` for curated / partial / legacy meta and **never throwing** (AP-TPERS-10); `bandToQuery(band, base)`
maps a coarse 3-band difficulty to `(rating, window)` (on-level == today's `{base, 250}`, no-regression;
AP-TPERS-7); `sourceToQuery(source)` maps the toggle 1:1 onto `PuzzleQuery.source` (`mixed`→undefined).
`Tactics.svelte`: a **pre-solve** provenance line ("Move N of your game — you played X (severity). Find
what you missed.") replacing the generic star while solving, and an **after-solve** line ("The win you
left: SAN" / "The move you missed: SAN") whose SAN is rendered from `moves[0]` (a UCI) via the **existing**
`new ChessGame(puzzle.fen).moveUci(...)` at the call site — `null`→omit, no new parser (enrich E1,
AP-TPERS-6); the generic `fromYourGameTag` is kept ONLY for the `null`-provenance case (AP-TPERS-1). A
3-way **source toggle** (Mixed / From my games / Curated) persisted via additive-optional
`SettingsRecord.trainerSource?` read `?? 'mixed'` (default never buries personal puzzles — AP-TPERS-12), an
in-trainer **theme picker** writing the SAME `app.tacticsFilterThemes` the dashboard drill uses with
`motifLabelOrRaw` labels (single source of truth — AP-TPERS-11), and a session-only coarse **difficulty
band** (not persisted). **Honest exhaustion** (TR10/AP-TPERS-2): a themed query that yields `null` in-zone
sets an explicit state + **Widen range** (re-query at window 800; escalates if still empty) / **Switch to
mixed** (clear theme + set source mixed) instead of the silent fall-through; never a blank board
(AP-TPERS-3). New **closed `sev.*` severity namespace** (FR+EN, parity-gated) — `severity.*` was taken on
the live baseline by `generators.ts`' article-prefixed explain phrases ("une gaffe"), which read wrong in
the parenthetical and feed Insights (must stay byte-identical), so the bare-word set lives under `sev.*`.

**Tests.** `provenance.test.ts` (new): `provenanceOf` full/curated/missing/partial-legacy(→null, no
throw)/extra-keys/kind-normalisation/determinism; the call-site SAN contract (`moveUci` known + null);
`bandToQuery` per band incl. on-level==baseline; `sourceToQuery` mapping. `labelRouting.test.ts`: a
union-exhaustive `sev.*` parity gate (`Record<Severity, true>` — compile-time exhaustiveness mirroring the
activity.* gate). `tactics-personalization-wiring.test.ts` (new): static wiring-presence (no Svelte
harness — portfolio fact) for provenance / toggle / picker / band / exhaustion / F3-steer consumption.

**Doctrine.** Additive-only; **no `DB_VERSION`/`schemaRev` bump** (only optional `trainerSource?`, mirrors
`locale?`); bilingual FR+EN for every new string; pure cores (no Date/Math.random/Svelte); single concern
(provenance display + selection routing). **AP-COACH-1 preserved** — `studyPlan.ts`/`session.ts` and the
generators' `severity.*` untouched; Insights byte-identical. **655 Vitest green** (630 baseline + 25 new,
zero regressions), svelte-check **0/0** (400 files), build green. **Rollback:** revert per sub-feature
(provenance markup / toggle + drop `trainerSource?` (legacy rows read `?? 'mixed'`) / picker / exhaustion);
no migration to unwind. Cross-links: ADR-0037/0040/0043/0053/0055, F1 (`motifLabelOrRaw`), F3
(`steerFromWeakness`), `ChessGame.moveUci`. Follow-ups (§11): T1 miss-path (shipped), T3 (`usedHint`/clamp,
progressive hints, streak), provenance in Review (DEFER), "open the source game" deep-link after F5 (DEFER).

## T3 — trainer-integrity-retention: hint integrity (usedHint clamp) + day-streak/daily-goal + impulsivity signal (no new ADR)

**Spec** `specs/trainer-integrity-retention-spec.md` (V1). One coherent move on the trainer solve→`finish()`
seam closing three honest-measurement gaps that all hang off the same `PuzzleAttemptRecord`. **No new ADR**
(feature PR; the grade-clamp policy was not deemed architectural — the Q-A..Q-E decisions are recorded here
inline, per §7 default).

**Hint integrity (TR5, Q-A/Q-B).** `hint()` is now **3 progressive tiers** (motif → target square → full
move) off `trainer.expectedMove()` (NOT a `revealSolution`); **any** tier latches `usedHint`. A hinted
**solve** is clamped two ways: FSRS grade ≤ `Hard` via the new pure `clampGradeForHint` AND the player's
Glicko **gain is skipped** via `applyGlickoGain` — the player rating AND the puzzle's own rating stay
**flat** (neither raised nor dropped), mirroring F3's AP-COACH-8 "pass unchanged". A hinted **miss** is
unaffected (the normal loss path is honest). The clamp composes with the FSRS first-exposure clamp
(`fsrs.ts` `Easy→Good` on `State.New`) and the T1 low-confidence clamp as a net `min()` — three
downgrade-only clamps, a hint can only ever LOWER the effective grade (AP-TINTEG-1/2/3). `usedHint?` is
additive-optional on `PuzzleAttemptRecord` (after `coachProbe?`), recorded `usedHint || undefined` so it
drops on structured clone; a "(hint used)" marker on the solved feedback keeps the clamp transparent.

**Retention (TR8, Q-C/Q-E).** Three additive-optional fields on `PlayerModel`: **`dailyStreak`** (NOT bare
`streak` — Vision owns that in-drill counter, AP-TINTEG-4), `dailyGoal` (default **10**, Settings number
input), `lastTrainedAt`. Pure `retention.ts` `rollStreak` folds one training event per **calendar day** via
an **injected `dayKey`** (default local YYYY-MM-DD): same day → unchanged; adjacency decided by re-keying
`now − 24h` (no key-string parsing, DST/format-robust) → +1; >1-day gap → reset to 1 (AP-TINTEG-5).
`goalProgress` is pure; today's solved-count uses a **bounded `playedAt` index range** (`solvedTodayCount`,
O(today) not O(all), AP-TINTEG-11). Streak+goal line in the trainer header; **streak on Home** beside the
Review badge. **`schemaRev` 1→2 with a load-path backfill, NO `DB_VERSION` bump** (additive precedent
ADR-0037/0040/0043/0053; mirrors `conceptSeen?`); a rev-0/rev-1 record backfills defaults on load.

**Impulsivity (Q-D).** Pure `metacog/impulsivity.ts` — DESCRIPTIVE, never a grade (AP-META-1/AP-TINTEG-7):
splits attempts by the grader's **own** `DEFAULT_GRADE_THRESHOLDS.fastMs` (imported, not re-declared), reports
avg solve time + the fast-wrong vs slow-right split **with denominators** (k/n like calibration), and a
`kind` sentence (impulsive/deliberate/mixed) that is `null` below the sample-size floor (default 10 —
anti-fabrication). Rendered in Insights' existing **metacog-gated** section (a NEW section, never a study-plan
input — **AP-COACH-1 preserved**, `studyPlan.ts`/`session.ts` untouched, determinism test green). Sentences
describe the *attempts*, not the player (no label noun, /enrich#8b). A gentle, self-dismissing inline
"missed in {n}s — slow down?" nudge fires in Tactics on a fast miss; never blocks the loop (AP-TINTEG-10).

**Doctrine.** Additive-only; **no `DB_VERSION` bump** (`schemaRev` 1→2 + backfill only); bilingual FR+EN for
every new string (catalogue parity gate is automatic via `translate.test.ts`); pure cores with injected
`now`/`dayKey` (no `Date.now`/`Math.random`, AP-TINTEG-9); single concern. **Tests:** `hintGrade.test.ts`,
`retention.test.ts`, `impulsivity.test.ts` (clamp composition, streak/dayKey rollover incl. midnight
boundary, impulsivity buckets + denominators + floor) + schema round-trips in `metacog-schema.test.ts`/
`playerModel.test.ts`. **692 Vitest green** (655 baseline + 37 new, zero regressions), svelte-check **0/0**
(406 files), build green. One pre-existing test (`poolModel.test.ts` "no re-seed") updated to assert the
current `schemaRev` after the 1→2 bump — data-preservation assertion intact. **Rollback:** fully additive
and per-fold separable — revert single-tier `hint()` + the `usedHint` thread (A3), the `rollStreak`/goal
calls + header/Home/Settings (A4), or the impulsivity section + nudge (A5) independently; the `schemaRev`
backfill is idempotent; no migration to unwind. Cross-links: ADR-0033 (first-exposure clamp), ADR-0037/0040/
0043/0053 (additive precedent), ADR-0055 (F3 AP-COACH-8 pass-unchanged), `fsrs.ts` `DEFAULT_GRADE_THRESHOLDS`.
Follow-ups (§11): record `hintTier?` if a "how much did the hint help" consumer appears (DEFER — no consumer
now); FSRS `stability` as a mastery readout (DEFER); streak decay-weighting + calendar/notifications (DEFER).

---

## ADR-0058 — Takeback during a rated Play game marks that game un-counted (P2)

**Context.** Before P2, `Play.svelte`'s `finishGame` **always** rated + persisted a finished game, and a
takeback only existed inside the automatic coached-blunder flow (which interposes *before* the clock press
and lets the game continue, so it never touched the rating). P2 adds an **on-demand** takeback in normal
play (a player can undo their last move + the bot's reply on their own turn). An un-gated on-demand takeback
in a rated game is a clear **abuse vector**: undo every bad move, keep only the rating gains. The honest fix
must let a slow, learning-oriented player take a move back **without** letting that inflate a measured
rating — and the cost must be visible to the player at the moment they take the move back, not hidden.

**Decision (Q-B = a).** The on-demand takeback is **opt-in** via a new `SettingsRecord.takebackInPlay?`
(default **OFF** → today's behaviour is byte-identical for everyone who doesn't enable it). When ON, and the
player takes a move back during a game, that game becomes **un-counted**: the in-progress game is flagged
`unrated` in component state (surfaced immediately by a muted "this game won't count" note), `finishGame`
**skips the entire rating-write block** (no `updateRating`, no `opponentByPool`/`gameRatings` assignment, no
`applyStrength` nudge) and persists the saved `GameRecord` with an honest `unrated: true`. The game is still
recorded (`putGame`) and other model state still persists (`persistModel`) — only the *rating* is left
unchanged. The skip decision is a single pure authority, `playSession.ts:shouldRate(unrated)` (`!unrated`),
unit-tested. The coached takeback is **unchanged** (it already interposes pre-clock-press and the game
continues — it never rated anything to forfeit). The takeback also carries degenerate guards (FOLD A4 /
AP-PLAYUX-10): it requires the **player** to have actually moved — pure `canTakeBackInPlay(historyLength,
playerColor)` (White ≥ 2 plies, Black ≥ 3) so a Black player at ply 1 can **not** undo the bot's opening
move (which would empty the board with the bot to move); it undoes the bot reply **and** the player move
together (back to the player's turn) via the controller's `takeBackPlayerMove()`; it **never** auto-fires
the engine (the loop resumes on the player's next move); and it is disabled while an analysis is in flight
(a generation token discards any stale `runAnalysis` result so it can't land on a fresh game / post-undo
position).

**Consequences.** Honesty preserved — a rating can never be inflated by taking moves back; the forfeit is
visible before the game ends. Default OFF keeps the rating math byte-identical to pre-P2 for the existing
user base (and the existing `finishGame`/rating tests stay green). Additive-optional fields only —
`GameRecord.unrated?` (after `coached`) and `SettingsRecord.takebackInPlay?` — both read-site defaulted
(`?? false`), mirroring the `coached?`/`variant?`/`metacogEnabled?`/`autoAnalyzeOnFinish?` precedent, so
**no `DB_VERSION` bump** (AP-PLAYUX-6). **Tests:** `playSession.test.ts` covers `shouldRate` (counted vs
un-counted) + `canTakeBackInPlay` (White/Black degenerate cases incl. the Black-at-ply-1 guard);
`gameSession.test.ts` covers `takeBackPlayerMove` (undoes both plies, lands on the player's turn, recomputes
the highlight, never consults the engine); the static wiring guard `play-in-game-ux-wiring.test.ts` locks
the `shouldRate(unrated)` gate + the `unrated: true` record write. **737 Vitest green** (712 baseline + 25),
svelte-check **0/0** (413 files), build green. **Rollback:** revert the P2 commit — the rating-skip + the
`unrated` field + the `takebackInPlay` toggle go together (avoid a half-state where a record is marked
`unrated` but still rated); records that carry `unrated`/settings that carry `takebackInPlay` read fine
elsewhere (both optional), no migration to unwind. Cross-links: ADR-0057 (F6 controller — the takeback is a
new controller hook, not an inline loop), ADR-0037/0040/0043/0053/0056 (additive-optional precedent),
`specs/play-in-game-ux-spec.md` §0.5 Q-B / §4 A2-A4 / §9 AP-PLAYUX-3/10. Follow-ups (§11): a takeback
budget / per-game cap with a difficulty/penalty model (D5 — would re-open this policy; out of P2).

---

## Decision note — Opponent agency & realism on Play (P3, no new ADR)

**Context.** Pre-P3 the Play opponent's strength was 100% automatic and invisible (the adaptive nudge
toward ~55% in `AdaptiveOpponent.recordGame`/`playSession.applyGameResult`), the opponent-style select only
toggled *how* the bot picked moves (human-sampled vs best) not *how strong*, the bot never resigned a
dead-lost position nor accepted a draw, `botMovetime` ignored the clock increment, and `coachEvalBad` used a
flat 250 cp blunder gate regardless of bot strength. This note records the P3 decisions (per
`specs/play-opponent-agency-spec.md` V1 §0.5 arbitrages Q-A…Q-I); the realism model was judged a feature
extension, not a new architectural axis, so **no new ADR** is opened (the honesty rule extends
AP-CHESS-13/24 and ADR-0058's "an un-counted game does not move the rating" principle).

**Decisions.** (Q-A/Q-H) A difficulty control with four modes — **Adaptive (default) · Easier (−200) ·
Harder (+200) · Fixed Elo** — applied to the bot's `targetElo` via the pure `difficultyTargetElo(mode,
adaptiveElo, fixedElo)` (clamped [1320,3190]) **before** `applyStrength()`. Adaptive reproduces today exactly
(`difficultyTargetElo('adaptive',…) === clampElo(adaptiveSeed)`, idempotent through `initOpponentState` →
zero regression, AP-OPPAGENCY-1). Persisted additively in `SettingsRecord.difficultyMode?`/`fixedElo?`
(read-site `?? 'adaptive'`), restored on mount like `lastTimeControl`; the Fixed input is seeded from the
current pool Elo so it is never blank (E4). (E1/AP-OPPAGENCY-14) Under an override the rating line shows the
**effective** bot Elo + a mode tag (`play.ratingLineOverride`) so it never misstates strength; the Adaptive
line stays byte-identical (`play.ratingLine` verbatim). (Q-B) **Bot resign**: a pure
`decideResign({botPovCp, consecutiveLostPlies, botElo})` true iff the bot is down past an **Elo-scaled**
threshold (`resignThreshold`: top bots resign at −900 cp, the gate widens to −1800 cp toward the 1600 floor,
sub-floor bots **never** resign) for ≥ `RESIGN_PLIES` (4) **consecutive** bot-decision plies — never on one
noisy swing (AP-OPPAGENCY-2). (Q-C) **Player draw-offer** the bot accepts via pure `decideAcceptDraw`
(|whiteCp| ≤ 30 for ≥ 4 plies AND not winning from its POV — AP-OPPAGENCY-4); a persistent "draw offered"
line shows until it resolves (E2); bot-initiated offers are **deferred** (AP-OPPAGENCY-12). (Q-D)
A post-game **adaptation line** from `prevOpp.targetElo` vs `nextOpp.targetElo` via pure
`adaptationDirection` (tougher/easier/unchanged + delta), suppressed for override games. (Q-E,
AP-OPPAGENCY-5 — **honesty**) `finishGame` branches on pure `gameAdaptsPool(mode)`: an **adaptive** game
folds (pool nudge + Glicko rating) as today; an **override** game **skips** the fold entirely but still
`putGame`s a `GameRecord` flagged `difficultyMode?` for history/analysis. (Q-F) `botMovetime` gains an
`incrementMs` param (default 0 → existing callers/tests byte-identical) folded into the budget before the
per-category clamp. (Q-G) `coachEvalBad`'s flat 250 → pure `coachedBlunderThreshold(botElo)` (≈250 at the
mid pool, tighter for a stronger chosen opponent). (Q-I) All decisions live in a new **pure, DOM-free**
module `src/engine/opponentAgency.ts` (no `Date`/`Math.random`/engine import — AP-OPPAGENCY-11); the
full-strength eval fetch (`EngineClient.evaluate(fen,{fullStrength:true}).whiteCp` — never the throttled
`UCI_Elo` search, AP-OPPAGENCY-3) and the consecutive-ply counters stay at the Play call site.

**Wiring discipline.** The resign/draw decision runs in `Play.engineMove`'s caller-orchestrated reply path
(F6 fallback call site — the controller was already built, ADR-0057), **not** by fusing
`applyPlayerMove`→`engineReply` (AP-OPPAGENCY-9). **One** full-strength eval per bot decision feeds **both**
`decideResign` and `decideAcceptDraw` (AP-OPPAGENCY-10). A throwing/failed eval resets the counters and lets
the bot play on — never a spurious resign/auto-accept, never a frozen hot path (E3/AP-OPPAGENCY-13, mirrors
`coachEvalBad`'s `catch → false`). `finishGame`'s `gameFinished` idempotency guard is preserved
(AP-CTRL-9). P3 reuses `ConfirmDialog` and does **not** touch P2's move-list/takeback/confirm-resign or
P4's opening book (single concern, AP-OPPAGENCY-7).

**Consequences.** Additive-optional fields only (`SettingsRecord.difficultyMode?`/`fixedElo?`,
`GameRecord.difficultyMode?`), all read-site defaulted, mirroring the
`opponentStyle?`/`unrated?`/`variant?` precedent — **no `DB_VERSION` bump** (AP-OPPAGENCY-8). Insights /
`buildStudyPlan` untouched (byte-identical). **Tests:** `opponentAgency.test.ts` (20) covers
`difficultyTargetElo`, `decideResign` (strong/weak/floor/transient-swing), `decideAcceptDraw`
(near-0/winning-declines/not-yet-stable), `coachedBlunderThreshold` (monotonic + mid-pool anchor),
`adaptationDirection`, `gameAdaptsPool`; `playSession.test.ts` adds the `botMovetime` increment-fold case.
**758 Vitest green** (757 baseline + 1; the core's 20 already counted), svelte-check **0/0** (415 files),
build green. **Rollback:** revert the P3 commit — `opponentAgency.ts` is deleted, Play returns to auto-only
strength / no resign-draw / flat coached threshold, `botMovetime` drops the increment param; the persisted
optional fields read fine under old code (`?? 'adaptive'`), no migration to unwind. Cross-links: ADR-0057
(F6 controller), ADR-0058 + AP-CHESS-13/24 (honesty / un-counted-game precedent), AP-CHESS-6 (adaptive
opponent), `specs/play-opponent-agency-spec.md` §0.5 / §4 / §9. Follow-ups (§11): bot-initiated draw offers
(deferred), Sparring/Comeback parity once F6 migrates them, resignation-as-teaching-moment (Play+F4),
difficulty as a coached program step, tuning `RESIGN_*`/`DRAW_*` curves against F5 telemetry, override-game
weighting in downstream analysis (E5 — P3 only flags the record).

---

## P4 — opening-steering-symmetry (no new ADR; extends AP-CHESS-22)

The weakness→opening steering (`selectOpening`) was sound but the book was asymmetric (10 White-bot /
4 Black-bot lines), so some `(botColor, dimension)` pairs had no line — the ~3:1 weighting silently
collapsed to uniform and `steeringNote` emitted the non-steering "Playing the X." Bidirectional gap:
Black-bot missed tactics + endgameConversion; White-bot missed resilience. Resolutions (Q-A..Q-D):
**Q-A=both** — add the minimal coverage lines AND a same-colour empty-pool fail-safe (AP-STEER-3, never
feed `nextBookMove` a wrong-colour line). **Q-B=3** — `sicilian-b` (tactics), `exchangeCaro-b`
(endgameConversion), `kingsGambitAccepted-w` (resilience); numeric 10/10 parity rejected as scope creep.
**Q-C=eco.json-grounded** (B50/B12/C30). **Q-D=extend `ECO_NAME_FR`** with the 3 FR names (parity).
Per-colour × per-dimension coverage is now a test (the union-only assertion masked the hole). Pure;
signatures unchanged; no `DB_VERSION` bump; Insights byte-identical (only `Play.svelte` reads the book).
775 tests green (758 + 17). Cross-links: ADR-0014/AP-CHESS-22, ADR-0053, `specs/opening-steering-symmetry-spec.md`.
Follow-ups (§11): localize `steeringNote` (F1), coverage CI-lint, C7 opening→repertoire consumes this book.

---

## C1 — coach-profile-persistence (no new ADR; extends ADR-0045)

The coach computed a `CoachProfile` + program and persisted `coachProfile`/`coachProfilePrev`/`assessedAt`
(ADR-0045) — then **never read any of it back** (`grep coachProfile` returned only the write site + the
type decl; `assessedAt` stored, read by nothing). Re-entering the coach showed only "Start the assessment",
the program was discarded on "Plus tard", and there was no trend or staleness signal. C1 stops the coach
discarding its own output. Resolutions (Q-A..Q-D): **Q-A** = an always-on intro **summary card** (radar +
strengths/weaknesses + trend) with `Start program` / `Re-assess` — the card **is** the view, so there is no
dead "View profile" button (enrich FOLD-1 / AP-CPROF-8). **Q-B** = trend on the **absolute** themed
`MotifScore.rating`, inner-joined on `theme`, **not** the baseline-relative `delta` (which is recomputed vs
the drifting `puzzleRating` each run and so is NOT cross-run-comparable — the CF5 fix / AP-CPROF-4).
**Q-C** = a **soft** staleness nudge at `COACH_STALE_DAYS=21` (ignorable; never gates a button — AP-CPROF-3).
**Q-D** = resume **rebuilds** the program from the saved profile via the pure `buildCoachProgram`
(reload-safe, deterministic) — **no** persisted `activeSession`, mirroring `startCoaching` (AP-CPROF-6).

**New pure core** `src/coach/coachTrend.ts` (`buildCoachTrend`/`trendDir`/`profileAgeDays`/`isStale`): no
`Date`/`Math.random` — `now` is injected, stamped once in `Coach.svelte`'s `onMount` (AP-CPROF-1). Trend is
**directional only** — arrows + absolute rating deltas + both sample sizes, explicit disclaimer, no aggregate
grade (AP-CPROF-2); low-sample rows (`nPrev≤2 && nCurrent≤2`) flagged by reusing the existing
`dashboard.lowData` key (enrich FOLD-2 — no new i18n / AP-CPROF-7). Rendered on the intro card **and** the
result screen via a small `TrendList.svelte`. **Additive, read-only over already-persisted data**: no new
field, **no `DB_VERSION`/`schemaRev` bump**, no migration; read sites guard `undefined` (legacy model / a
legacy profile lacking `assessedAt` → no nudge, no crash). `diagnostic.ts`/`program.ts`/`session.ts`/
`studyPlan.ts`/`db.ts`/`playerModel.ts` untouched — Insights / `buildStudyPlan` byte-identical (AP-COACH-1).
**Tests:** `coachTrend.test.ts` (18 — inner-join, the CF5 absolute-vs-delta guard, flat band, lowData,
tactics dim, age/staleness with injected `now`, resume-equivalence) + `coach-profile-wiring.test.ts` (7,
static seam guard, no component harness). **800 tests green** (775 + 25), svelte-check **0/0** (417 files),
build green. **Rollback:** revert the commit — `coachTrend.ts`/`TrendList.svelte`/the intro card/the new
i18n keys vanish; no migration ran, so stored `coachProfile`/`Prev`/`assessedAt` are simply unread again.
Cross-links: ADR-0045 (coach mode — extended), ADR-0048 (probe depth), ADR-0051 (Svelte 5 reactivity),
ADR-0053 (bilingual), `specs/coach-profile-persistence-spec.md` §4/§6/§9. Folds CF2/CO2/CF5/CO19 +
enrich FOLD-1/FOLD-2. Follow-ups: re-probing / à-la-carte scope (C2), blending played history (C4),
profile export (C8), multi-day calendar scheduling (portfolio §7).

---

## C2 — coach-probe-engine-v2 (no new ADR; extends ADR-0045, consumes ADR-0055)

The diagnostic probed a fixed 2 puzzles x 6 motifs + a coarse `phase:'endgame'` bucket, all-or-nothing.
C2 adds a pure `src/coach/probePlan.ts` (`buildProbePlan` replacing the inline THEMES array): adaptive
depth that extends ONLY borderline motifs, total capped (~20, length honesty); a-la-carte scope (user
picks which motifs/areas; empty = ALL, AP-CPROBE-4); endgame SUB-TYPES via real Lichess theme keys with
graceful fallback — the shipped seed set is mate-only, so a bucket with no in-band puzzle records n=0 and
is dropped, NEVER faked (invisible until the full puzzle DB ships). A short opt-in TIMED block
(`src/coach/timedProbe.ts`, reuses Clock) feeds a timeManagement DimensionScore into buildCoachProfile.
Probe attempts record via F3's path with NO rating-pool leak (AP-COACH-8). CO7: the radar is already
honest (collapses sampleSize:0) — untouched; only a "what skipping the game costs" nudge added. Pure
cores; no `DB_VERSION` bump; Insights byte-identical; bilingual FR+EN. The timed block adds a 3rd
interactive Coach board, wired with onMoveText (F2 a11y invariant preserved — wiring test 2->3). 834
tests green (800 + 34). Cross-links: ADR-0045/0048/0055, `specs/coach-probe-engine-v2-spec.md`.
Recovered + verified green after a mid-run process restart before commit.
