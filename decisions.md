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
