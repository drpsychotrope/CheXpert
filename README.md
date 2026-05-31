# Chess Trainer — progression first

A client-side chess app whose only job is to make you stronger per hour of practice.
Not a Chess.com clone: no online matchmaking, no social ranking, no variants. One closed
improvement loop instead:

> play → auto-analysis → weakness diagnosis → personalised puzzles → spaced repetition →
> an opponent that probes your gaps → play

**This repo has Phases 1–3.** See `specs/` for the full four-phase plan.

## Retention + endgames (Phase 3)

- **Review** — every puzzle you attempt becomes an FSRS spaced-repetition card; the Review view
  resurfaces your weakest patterns right before you'd forget them.
- **Endgame trainer** — play fundamental endgames (K+Q vs K, K+R vs K, K+P opposition, Lucena,
  Philidor) against the engine, with perfect feedback from the Lichess **Syzygy** tablebase
  (≤7 pieces). The one network feature — off by default, consent-gated, cache-first.
- **Opening repertoire** — build lines (validated by chess.js), drill them under FSRS until automatic.

## The differentiating loop (Phase 2)

Import a PGN → the engine reviews every move locally (~20s for a 40-move game) → your mistakes are
classified by win-probability loss and tagged with the missed motif → the worst, *uniquely
punishable* ones become personalised puzzles served in Tactics → a weakness radar benchmarks you per
dimension (tactics / opening / endgame / time / resilience) with one-click drill-through to the
matching puzzles. Your losses train you. Everything stays local.

## What works now (Phase 1)

- **Launch-time skill evaluation** — an adaptive puzzle ladder seeds your *puzzle rating*, and
  an optional short calibration game (live per-move centipawn-loss) seeds your *game rating*
  (they are not the same thing). Skippable; re-runnable from Settings.
- **Adaptive opponent** — Stockfish via `UCI_LimitStrength` + `UCI_Elo`, nudged ±50–100 per
  game toward a ~55% player win-rate band (your zone of proximal development).
- **Tactical trainer** — active recall (you play the move; the solution is never auto-played),
  Glicko-2 ratings for you *and* each puzzle, theme/phase filtering.
- **Player model** — everything in IndexedDB, on your device.

## Stack

- [chess.js](https://github.com/jhlywa/chess.js) — rules / move-gen / FEN / PGN (BSD-2)
- [chessground](https://github.com/lichess-org/chessground) — board UI (GPL-3.0)
- [Stockfish](https://github.com/nmrugg/stockfish.js) lite single-thread WASM, in a Web Worker (GPL-3.0)
- [Svelte](https://svelte.dev) 5 + [Vite](https://vite.dev) + TypeScript, [idb](https://github.com/jakearchibald/idb) for IndexedDB
- Puzzles: the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0)

## Run

```bash
npm install          # also vendors the ~7MB lite engine into public/stockfish (postinstall)
npm run dev          # http://localhost:5173
npm test             # Vitest
npm run check        # svelte-check (type check)
npm run build        # production build
```

### Engine asset

`npm install` runs `scripts/copy-engine.mjs`, which copies **only** the lite single-thread
build (~7 MB) out of the `stockfish` package (which unpacks to ~251 MB of all variants) into
`public/stockfish/`. The lite single-thread build needs **no** COOP/COEP headers, so it works
on any static host. Multi-thread (faster, needs those headers, AGPL) remains an unused opt-in.

### Puzzles

A small verified seed set ships in `public/puzzles/seed-puzzles.json`. For the real curated
subset, download the CC0 Lichess puzzle DB and run the ETL:

```bash
# get lichess_db_puzzle.csv.zst from https://database.lichess.org/#puzzles, decompress, then:
npm run etl:puzzles  path/to/lichess_db_puzzle.csv  80000
```

This writes `public/puzzles/puzzles.json` (preferred over the seed set when present).

## Privacy

Everything stays on your device. Games, puzzle history, and your player model live in your
browser's IndexedDB. Nothing is sent anywhere by default. The **only** feature that makes a network
call is the endgame trainer's Syzygy tablebase lookup (Lichess API) — off by default, enabled only
with your explicit consent in Settings, and cached so each position is fetched at most once.

## Licensing

Built for **local / personal use** (decision Q-A=b, `decisions.md` ADR-0002). chessground and
Stockfish are GPL-3.0, so **if you distribute or host this app publicly**, GPL-3.0's
source-publication obligations apply — at which point a `LICENSE` file should be added and the
posture revisited (and if the multi-thread engine is adopted, AGPL-3.0 applies). Data from
Lichess (puzzles, openings) is CC0. See `ATTRIBUTION.md`.
