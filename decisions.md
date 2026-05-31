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
