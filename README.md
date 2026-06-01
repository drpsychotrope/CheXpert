# Chess Trainer — progression first

A client-side chess app whose **only** job is to make you stronger per hour of practice.

Not a Chess.com clone: no online matchmaking, no social ranking, no variant catalogue. Just one
closed improvement loop, fully integrated:

```
   play (slow games)
        ↓
   auto-analysis (Stockfish, local)
        ↓
   weakness diagnosis (missed motif · phase · time)
        ↓
   personalised puzzles (from YOUR mistakes)
        ↓
   spaced repetition (FSRS)
        ↓
   an opponent that steers its openings toward your gaps
        ↓
   …back to play
```

Every existing tool does a slice of this — Lichess has puzzles, Chessable has spaced repetition,
Aimchess has weakness analytics — but none wires *your losses → your puzzles → your weakness profile
→ an opponent that probes the same gaps*, end to end, on your own machine. That closed loop is the
whole point.

Everything runs in the browser. Nothing leaves your device by default.

---

## Features

### Play & calibrate
- **Launch-time skill evaluation** — an adaptive puzzle ladder seeds your *puzzle rating*; an
  optional short calibration game (live per-move centipawn-loss → ACPL) seeds your *game rating*.
  They're deliberately separate numbers: puzzle rating measures pattern recognition, not playing
  strength. Skippable, re-runnable from Settings.
- **Adaptive opponent** — Stockfish via `UCI_LimitStrength` + `UCI_Elo`, nudged ±50–100 Elo per
  game toward a ~55% player win-rate band (your zone of proximal development). Instructive, not just
  hard. Plays **human-like**: among the engine's top moves it samples one weighted by evaluation
  (temperature set by its Elo) — varied, plausible moves rather than always the best — but **never a
  catastrophic blunder** (nothing more than ~1.5 pawns below best). No random blunder injection.
- **Coached mode** — optional engine check that warns before an obvious blunder while you play.
- **One-click review** — after a game, *Analyse this game* runs the full local analysis (puzzles +
  weakness dashboard) with no PGN to copy or paste.

### The differentiating loop
- **Analyse a game** — paste a PGN; the engine reviews every move locally (~20 s for a 40-move
  game), classifies each by **win-probability loss** (inaccuracy / mistake / blunder), and tags the
  missed motif and phase. A **win-probability curve** plots the game's shape and surfaces its
  **critical moments** (biggest swings, either side) — click one to see the position and the
  explanation. No single "accuracy" grade is shown — only directional pointers.
- **From your games** — significant mistakes with a *uniquely* better move (verified by a MultiPV
  re-check) become personalised puzzles, served in Tactics. **Missed wins** count too: forced mates
  and decisive shots you had but didn't play (even while already winning), so you drill converting
  won positions. Your games train you.
- **Weakness dashboard** — a radar across five dimensions (tactics · opening accuracy · endgame
  conversion · time management · resilience), benchmarked against your level band. **Every** dimension
  is one-click drillable to the right training: tactics → Tactics, opening → Repertoire, endgame →
  Endgames, time → timed Tactics, resilience → comeback drills.
- **Insights** — your recurring **leaks** (mistakes clustered across all games, ranked by impact, with
  example positions), a deterministic **study plan** for a chosen daily time budget, and a **progress**
  trend per dimension over time. Recomputed locally from your analyses; no grade, just where to focus.
- **Openings** — every analysed game is named (ECO) and flagged with where you **left book**; one click
  adds that line to your repertoire. A local **explorer** names typed lines. Seed openings ship; the
  full CC0 set is one `npm run etl:eco` away.
- **Analysis explained** — plain-language *why this was a mistake + what was better*, rule-based and
  derived only from the engine's own evaluation. No LLM; when it can't name a specific tactical
  pattern, it says so — and adds honest **positional** context (isolated/doubled/passed pawns) read
  from the position itself.
- **Analysis board** — an interactive board with the engine's top lines (MultiPV): move freely, follow
  a line, walk back, with an eval bar. Explore any critical moment in one click.

### Train & retain
- **Tactics** — active recall (you play the move; the solution is never auto-played), Glicko-2
  ratings for both you and each puzzle, theme/phase filtering. Prefers your personal puzzles, then a
  curated subset in your rating zone.
- **Review (FSRS)** — every puzzle you attempt becomes a spaced-repetition card; the Review queue
  resurfaces your weakest patterns right before you'd forget them, **interleaved** by theme. One click
  builds a *"your misses"* Woodpecker set from the puzzles you fail most.
- **Calculation** — solve tactics with **no hints**: you must see the whole forcing line before you move.
- **Woodpecker** — a *fixed* puzzle set, solved again and again, faster each cycle, to automaticity.
  Complements Review (which spreads an expanding pool over time).
- **Opening repertoire** — build lines (validated by chess.js), drill them under FSRS until they're
  automatic.
- **Comeback drills** — replay the moments you fell behind in your own games against a bot at your
  level, and practise holding the draw or turning them around (reached from the weakness dashboard).
- **Scenario sparring** — play out a targeted position vs the adaptive bot: a curated imbalance
  (IQP, opposite-side castling, bishop pair, rook-up ending) or one of your own recurring leaks.

### Endgames & vision
- **Endgame trainer** — fundamental endgames (K+Q vs K, K+R vs K, K+P opposition, Lucena, Philidor)
  played against the engine, with perfect feedback from the Lichess **Syzygy** tablebase (≤ 7
  pieces). This is the one network feature — see [Privacy](#privacy).
- **Guess the move** — active recall on annotated master games (the Opera, Immortal, and Evergreen
  games). Predict what was played; trains the same prediction you do over the board.
- **Calculation & vision** — board-free drills: instant square colours, shortest knight-path
  distance, and a timed **find-them-all** (count every check, capture, or hanging piece).

*Maia (the human-like sparring engine) is **deliberately not shipped**: it needs a backend, and this
build is local-only with no backend in scope. See `decisions.md` ADR-0019.*

---

## Stack

| Concern | Choice | License |
|---|---|---|
| Rules / move-gen / FEN / PGN | [chess.js](https://github.com/jhlywa/chess.js) 1.4.0 | BSD-2-Clause |
| Board UI | [chessground](https://github.com/lichess-org/chessground) 9.2.1 | GPL-3.0 |
| Engine (analysis + opponent) | [Stockfish.js](https://github.com/nmrugg/stockfish.js) 18 — lite single-thread WASM, in a Web Worker | GPL-3.0 |
| Spaced repetition | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 5 | MIT |
| Storage | [idb](https://github.com/jakearchibald/idb) 8 (IndexedDB) | ISC |
| Build / UI | [Svelte](https://svelte.dev) 5 + [Vite](https://vite.dev) 6 + TypeScript (strict) | MIT |
| Puzzles | [Lichess puzzle database](https://database.lichess.org/#puzzles) | CC0 |
| Endgame truth | [Lichess Syzygy API](https://tablebase.lichess.ovh) | — |

No backend. No account. No telemetry.

---

## Run

Requires **Node ≥ 18** (developed on 20.x).

```bash
npm install      # also vendors the ~7 MB lite engine into public/stockfish (postinstall)
npm run dev      # http://localhost:5173
npm test         # Vitest — 135 tests
npm run check    # svelte-check (type check)
npm run build    # type-check + production build
```

### Desktop launcher (.exe)

```bash
npm run build:exe   # → build/ChessTrainer.exe + build/dist/
```

Ships the whole `build/` folder. Double-click **ChessTrainer.exe**: it starts a tiny local server
(127.0.0.1, random port) for the bundled app and opens it in a borderless app window (Edge/Chrome
`--app=` mode, falling back to the default browser). No install, no admin, no network — everything
stays local, IndexedDB persistence works.

Why a local server and not `file://`: the app uses module Web Workers + WASM `fetch` + IndexedDB,
which browsers block under `file://`. The launcher is built with Node's built-in **SEA** (Single
Executable Application) — it copies your own `node.exe` and injects the launcher, so building needs
**no compiler and no extra toolchain**. The exe (~69 MB, mostly the Node runtime) sits beside
`build/dist/` (the app + engine + puzzles). `npm run launch` runs the same launcher under plain Node
for development.

For a true native window with a much smaller binary, **Tauri** (Windows WebView2, ~10 MB) is the
upgrade path — but it requires the Rust + MSVC toolchain to build, which the SEA approach avoids.

### Engine asset

`npm install` runs `scripts/copy-engine.mjs`, which copies the lite single-thread build (~7 MB) **and**
the multi-thread build (`stockfish-mt.*`) out of the `stockfish` npm package (which unpacks to ~251 MB
of all variants) into `public/stockfish/`. The launcher + vite send COOP/COEP headers, so the app is
cross-origin isolated and uses the faster **multi-thread** engine (`Threads` set to cores−1); on any
host that can't set those headers it **falls back to the lite single-thread** build automatically
(needs no headers). See `decisions.md` ADR-0032. The multi-thread build is **AGPL-3.0** (see Licensing).

### Puzzles

A small, hand-verified seed set ships in `public/puzzles/seed-puzzles.json` so the app works out of
the box. For the real curated subset, download the CC0 Lichess puzzle DB and run the ETL:

```bash
# get lichess_db_puzzle.csv.zst from https://database.lichess.org/#puzzles, decompress, then:
npm run etl:puzzles  path/to/lichess_db_puzzle.csv  80000
```

This writes `public/puzzles/puzzles.json` (a curated ~80k subset spread across rating bands), which
the app prefers over the seed set when present.

---

## Architecture

Client-only PWA. The engine runs in a Web Worker (it never blocks the UI); everything else is plain
TypeScript with a thin Svelte 5 layer on top. ~63 TS modules + 16 Svelte components, 23 test files.

```
src/
  engine/        Stockfish Web Worker + promise-based UCI client; adaptive opponent
  game/          chess.js wrapper (legal dests, promotion, terminal state, FEN/PGN)
  rating/        Glicko-2 (player + puzzle ratings, kept separate)
  trainer/       puzzle model + repo (IndexedDB-seeded) + active-recall tactical trainer
  calibration/   launch-time skill evaluation (puzzle ladder + ACPL game)
  analysis/      PGN parse · batch analysis · win-prob gaffe classify · motif tag ·
                 from-your-games generator · weakness radar · NL explanations
  srs/           FSRS scheduling wrapper + due-queue store
  repertoire/    opening line builder + FSRS-drilled lines
  endgame/       Syzygy client (consent-gated, cache-first) + drill catalogue
  opening/       opening book used to steer the opponent toward your weakness
  woodpecker/    fixed-set speed-drill cycle logic
  guess/         master games + guess-the-move driver
  vision/        pure square-colour + knight-distance primitives
  store/         IndexedDB schema (v4) + player model + privacy wipe
  state/         global app state (Svelte runes)
  ui/            Svelte components, one per view
```

### Data model (IndexedDB, schema v4)

All local. Migrations are additive — each schema bump only adds stores, never drops data.

- **v1** — `games`, `puzzleAttempts`, `puzzles`, `playerModel`, `settings`
- **v2** — `importedGames`, `gameAnalyses`
- **v3** — `srsCards`, `repertoire`
- **v4** — `woodpeckerSets`

The Syzygy tablebase cache lives in a separate IndexedDB (`chess-trainer-tbcache`) so each position
is fetched at most once. Settings → *Delete all my data* wipes every store plus that cache.

---

## Privacy

Everything stays on your device. Your games, puzzle history, ratings, and player model live in your
browser's IndexedDB. Nothing is sent anywhere by default.

The **only** feature that makes a network call is the endgame trainer's Syzygy tablebase lookup
(Lichess API). It is **off by default**, enabled only with your explicit consent in Settings, sends
only the board position (a FEN — no identity, no account), and caches every result so a position is
fetched at most once. With it off, endgame drills still work against the engine.

---

## Licensing

Built for **local / personal use** (`decisions.md` ADR-0002). chessground and Stockfish are
GPL-3.0, so **if you distribute or host this app publicly**, GPL-3.0's source-publication
obligations apply — at which point you should add a `LICENSE` file and revisit the posture (and if
the multi-thread engine is ever adopted, AGPL-3.0 applies). Data from Lichess (puzzles, openings,
tablebase) is CC0. Full credits in [`ATTRIBUTION.md`](ATTRIBUTION.md).

---

## Honesty notes

The brief this was built from asked for intellectual honesty in the product, so:

- **"Personalised beats generic" is plausible, not proven.** The loop is built because the mechanism
  is sound (you train your actual weaknesses), not because a controlled study proves it. The model
  stays local so the effect could one day be measured for real.
- **Puzzle rating ≠ playing strength.** They're tracked as separate numbers and the UI says so.
- **Weakness benchmarks are directional.** The radar uses rough community ACPL anchors, presented as
  "where to focus", never as a precise grade.
- **Motif tags are conservative.** Only patterns we can verify geometrically (mate, hanging piece,
  fork, pin, skewer, discovered attack, double check) are detected with confidence; anything else is
  a low-confidence phase/magnitude fallback, marked as such, rather than a guessed tactic.

---

## Project history

Built in four phases (see `specs/` for the per-phase specs and `decisions.md` for the ADRs behind
every non-obvious choice):

1. **Backbone** — adaptive opponent, tactical trainer, ratings, onboarding, storage.
2. **The loop** — PGN import → analysis → personal puzzles → weakness dashboard.
3. **Retention** — FSRS review, Syzygy endgames, opening repertoire.
4. **Closing the loop** — weakness-steering opponent, NL explanations, Woodpecker, guess-the-move,
   calculation/vision drills.

Status: **135 tests passing**, type-clean (`svelte-check` 0 errors), production build green.
