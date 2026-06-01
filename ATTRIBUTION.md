# Attribution

This project builds on the following open-source software and open data.

## Software

| Component | Author | License | Use |
|---|---|---|---|
| [chess.js](https://github.com/jhlywa/chess.js) | Jeff Hlywa | BSD-2-Clause | Rules, move generation, FEN/PGN |
| [chessground](https://github.com/lichess-org/chessground) | Lichess | GPL-3.0-or-later | Board UI |
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) | nmrugg / Chess.com, based on the Stockfish team | GPL-3.0 | Analysis + opponent engine (WASM) |
| [Stockfish](https://github.com/official-stockfish/Stockfish) | T. Romstad, M. Costalba, J. Kiiski, G. Linscott, et al. | GPL-3.0 | Underlying engine |
| [Svelte](https://svelte.dev) | Svelte contributors | MIT | UI framework |
| [Vite](https://vite.dev) | Vite contributors | MIT | Build tooling |
| [idb](https://github.com/jakearchibald/idb) | Jake Archibald | ISC | IndexedDB wrapper |

The Stockfish.js loader wrapper (`index.js`) is MIT; the engine itself (the `.wasm` and its
generated `.js`) is GPL-3.0. Bundling it means the distributed app, if distributed, is governed
by GPL-3.0. See `README.md` → Licensing.

## Data (all CC0 — public domain)

- **Lichess puzzle database** — https://database.lichess.org/#puzzles
- **Lichess `chess-openings`** — https://github.com/lichess-org/chess-openings (ECO naming; seed in `public/openings/eco.json`, full set via `npm run etl:eco`)
- **Syzygy tablebases via the Lichess API** — https://tablebase.lichess.ovh (planned, Phase 3)

The hand-authored seed puzzles in `public/puzzles/seed-puzzles.json` are released CC0.
