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
