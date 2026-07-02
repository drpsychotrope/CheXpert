# Chess Trainer — progression first

A client-side chess app whose **only** job is to make you stronger per hour of practice.

Not a Chess.com clone: no online matchmaking, no social ranking, no variant *catalogue* — with one
on-doctrine exception, **Chess960**, which trains understanding over memorisation (ADR-0041).
(Matchmaking and social ranking remain out.) Just one closed improvement loop, fully integrated:

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
  hard. **Selectable style** on the Play screen: *Human-like* samples among the engine's top moves
  weighted by evaluation (temperature set by its Elo) — varied, plausible moves, but **never a
  catastrophic blunder** (nothing >~1.5 pawns below best); or *Engine* — always the best move at the
  current Elo. No random blunder injection.
- **Time controls** — pick a clock on the Play screen (Bullet 1+0/2+1, Blitz 3+2/5+0, Rapid 10+0/15+10,
  Classical 30+0, or No clock). Both sides have a Fischer-increment clock; flag and you lose on time —
  unless your opponent has no mating material, which is a draw (FIDE Art. 6.9). The bot plays to its own
  clock (snappy in bullet, deliberate in classical). Timed games persist **per-move clocks** (`%clk`,
  like a Lichess export) so your own games feed the time-management diagnosis, and every counted game
  records your **rating before/after** (ADR-0060). Your **game rating is per time control** — a bullet
  result no longer moves your classical number. The headline rating shown elsewhere is your classical pool;
  the practice drills (Comeback/Sparring) remain untimed = classical.
- **Coached mode** — optional engine check that flags an apparent blunder right after you play it and offers a take-back (best-effort; pre-move alerts come in Phase 2).
- **Chess960 (Wild)** — play a random Fischer-random position or a specific SP-ID (0–959) against
  the adaptive bot. Castle by dragging the king onto its own rook. v1 is untimed and not yet
  auto-analysed (the standard analysis pipeline assumes opening theory; see ADR-0041).
- **One-click review** — after a game, *Analyse this game* runs the full local analysis (puzzles +
  weakness dashboard) with no PGN to copy or paste.
- **Post-game debrief & progress** — every game ends on a debrief card (rating before→after,
  recent form vs the ~55% target band, the opening you actually played, per-side time), and
  Insights draws your **rating over time** per pool plus a day-bucketed puzzle-rating curve
  (internal scale, honestly labeled). Subtle **synthesized sounds** (moves, game end, personal
  bests, streak milestones) ship on by default with a one-click kill-switch (ADR-0061/0062/0063).
- **In-game move list, rematch, confirm-resign, opt-in takeback, on-demand move check** — a
  scrollable, auto-following SAN move list reads the game back as you play; *Rematch* restarts with the
  same color/clock/variant; *Resign* asks first; an opt-in *Take back* (Settings) undoes your move and
  the bot's reply — but a takeback in a rated game makes it **not count** (ADR-0058); *Check this move*
  gives a quick, best-effort "looks risky/fine" hint before you commit.

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
  Endgames, time → timed Tactics or the "when to think" drill, resilience → comeback drills.
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
- **Calculation** — the board stays **frozen** while you tap out your whole forcing line; Submit grades
  the full line and replays the real solution. Trains visualization, not reaction.
- **Woodpecker** — a *fixed* puzzle set, solved again and again, faster each cycle, to automaticity.
  Complements Review (which spreads an expanding pool over time).
- **Metacognition (opt-in):** optional confidence (before the reveal) and error-cause self-report (after a miss) on puzzles, with a descriptive calibration readout in Insights — how your confidence lines up with your results. Descriptive, not a grade.
- **Opening repertoire** — build lines (validated by chess.js), drill them under FSRS until they're
  automatic.
- **Comeback drills** — replay the moments you fell behind in your own games against a bot at your
  level, and practise holding the draw or turning them around (reached from the weakness dashboard).
- **Scenario sparring** — play out a targeted position vs the adaptive bot: a curated imbalance
  (IQP, opposite-side castling, bishop pair, rook-up ending) or one of your own recurring leaks.
- **When to think** — a recognition drill: call positions from your own games CRITICAL (invest time) or ROUTINE (play fast) and see the real win-probability swing that hung on the move. Recognition practice, not a graded method (no clock, no accuracy %).
- **Concept cards** — curated, offline worked examples for the tactics we detect (fork, pin, skewer,
  back-rank mate, …). See the pattern the first time it bites you in Tactics, and again when a puzzle
  keeps beating you — an optional, non-blocking "Learn the pattern" link, plus a browsable Concepts
  library. Content is hand-authored and CC0, consistent with the puzzle/ECO assets (no LLM).
- **Personal coaching** — a re-runnable adaptive assessment (the launch-eval method, run across tactical
  motifs + an optional short game) that maps your strengths and weak spots, then builds a dedicated
  program of drills **and** game modes targeting them. Directional pointers, not a grade.

### Endgames & vision
- **Endgame trainer** — fundamental endgames (K+Q vs K, K+R vs K, K+P opposition, Lucena, Philidor)
  played against the engine, with perfect feedback from the Lichess **Syzygy** tablebase (≤ 7
  pieces). This is the one network feature — see [Privacy](#privacy).
- **Guess the move** — active recall on annotated master games (the Opera, Immortal, and Evergreen
  games). Predict what was played; trains the same prediction you do over the board.
- **Calculation & vision** — drills that need real board vision, not arithmetic: **coordinate↔square**
  (click the named square on a blank board, or name the lit one), **blindfold** (recall a piece from
  memory), **lines & diagonals**, shortest **knight-path** distance, and a timed **find-them-all**
  (count every check, capture, or hanging piece). Per-square recall is spaced-repeated (FSRS) and weak
  squares feed the practice session (ADR-0043).

*Maia (the human-like sparring engine) is **deliberately not shipped**: it needs a backend, and this
build is local-only with no backend in scope. See `decisions.md` ADR-0019.*

---

## Stack

| Concern | Choice | License |
|---|---|---|
| Rules / move-gen / FEN / PGN | [chess.js](https://github.com/jhlywa/chess.js) 1.4.0 | BSD-2-Clause |
| Board UI | [chessground](https://github.com/lichess-org/chessground) 9.2.1 | GPL-3.0 |
| Engine (analysis + opponent) | [Stockfish.js](https://github.com/nmrugg/stockfish.js) 18 — multi-thread WASM (lite single-thread fallback), in a Web Worker; `UCI_Chess960` for wild | GPL-3.0 / AGPL-3.0 (MT) |
| Spaced repetition | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 5 | MIT |
| Storage | [idb](https://github.com/jakearchibald/idb) 8 (IndexedDB) | ISC |
| Build / UI | [Svelte](https://svelte.dev) 5 + [Vite](https://vite.dev) 6 + TypeScript (strict) | MIT |
| Puzzles | [Lichess puzzle database](https://database.lichess.org/#puzzles) | CC0 |
| Endgame truth | [Lichess Syzygy API](https://tablebase.lichess.ovh) | — |

No backend. No account. No telemetry.

---

## Run

Requires **Node ≥ 18** to run the app (developed on 20.x). The one-shot `npm install` below
also **downloads + unpacks the puzzle DB**, which needs **Node ≥ 22.15** for built-in
Zstandard — on older Node that single step is skipped and the app uses its seed puzzles.

```bash
npm install      # one-shot setup: engine + puzzles + .exe launcher (see below)
npm run dev      # http://localhost:5173
npm test         # Vitest (full suite)
npm run check    # svelte-check (type check)
npm run build    # type-check + production build
```

### What `npm install` sets up

`postinstall` runs `scripts/postinstall.mjs`, which does **everything needed to play and to
ship the desktop app**, in order — each step **idempotent** (skipped when its output already
exists) and **non-fatal** (a failure warns, never breaks the install):

1. **Engine** — vendors the Stockfish lite + multi-thread builds into `public/stockfish/`.
2. **Puzzles** — downloads the CC0 Lichess puzzle DB (~286 MB, one-time, cached under
   `scripts/.cache/`), stream-decompresses it (Zstd, no multi-GB CSV touches disk), and writes
   the curated `public/puzzles/puzzles.json` (~80k, spread across rating bands).
3. **Launcher** — production-builds the app (`dist/`) and the single-file
   `build/ChessTrainer.exe` desktop launcher.

The **first** install is heavy (a big download + a full build); **later** installs reuse the
cached download and existing build, so they're quick. Opt-outs (env vars):

| Variable | Effect |
|---|---|
| `SKIP_INSTALL_EXTRAS=1` | skip puzzles **and** the launcher build (engine still vendored) — handy in CI |
| `CHESS_SKIP_PUZZLES=1` | skip only the puzzle download/unpack |
| `CHESS_SKIP_EXE=1` | skip only the app + `.exe` build |
| `CHESS_FORCE=1` | rebuild even when outputs already exist |

Re-run the whole chain any time with `npm run setup`, or a single piece with
`npm run copy:engine`, `npm run fetch:puzzles`, or `npm run build:exe`.

### Desktop launcher (.exe)

`npm install` already builds this (step 3 above). To rebuild it on its own after changing the app:

```bash
npm run build:exe   # → build/ChessTrainer.exe + build/dist/
```

Ships the whole `build/` folder. Double-click **ChessTrainer.exe**: it starts a tiny local server
(127.0.0.1 on **fixed port 7424**) for the bundled app and opens it in a borderless app window
(Edge/Chrome `--app=` mode, falling back to the default browser). No install, no admin, no network —
everything stays local. The port is fixed on purpose: browser storage (your profile, ratings, SRS
cards) is keyed to the origin `http://127.0.0.1:7424`, so a **stable** port is what makes IndexedDB
persist across launches (ADR-0049). Set `CHESS_TRAINER_PORT` if 7424 is already taken — but note a
different port is a different origin, hence a separate profile. `CHESS_TRAINER_NO_OPEN=1` serves
without opening a window (headless / bring-your-own-tab).

Why a local server and not `file://`: the app uses module Web Workers + WASM `fetch` + IndexedDB,
which browsers block under `file://`. The launcher is built with Node's built-in **SEA** (Single
Executable Application) — it copies your own `node.exe` and injects the launcher, so building needs
**no compiler and no extra toolchain**. The exe (the size of your `node.exe` — ~70–100 MB,
mostly the Node runtime) sits beside `build/dist/` (the app + engine + puzzles). `npm run launch`
runs the same launcher under plain Node for development.

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

`npm install` already downloads the CC0 Lichess puzzle DB and unpacks the curated
`public/puzzles/puzzles.json` subset (~80k, spread across rating bands), which the app prefers over
the seed set. Re-run just that step with `npm run fetch:puzzles` (`CHESS_FORCE=1` to rebuild,
`PUZZLE_MAX=N` to resize, `PUZZLE_DB_URL=…` for a mirror). A small, hand-verified seed set in
`public/puzzles/seed-puzzles.json` is the fallback when the subset is absent (older Node, offline
install, or `CHESS_SKIP_PUZZLES=1`).

Already have the CSV — or on Node < 22.15, which lacks built-in Zstd? Decompress it and run the ETL
directly:

```bash
# get lichess_db_puzzle.csv.zst from https://database.lichess.org/#puzzles, decompress, then:
npm run etl:puzzles  path/to/lichess_db_puzzle.csv  80000
```

---

## Architecture

Client-only PWA. The engine runs in a Web Worker (it never blocks the UI); everything else is plain
TypeScript with a thin Svelte 5 layer on top. ~62 TS modules + 28 Svelte components, 51 test files.

```
src/
  engine/        Stockfish Web Worker + promise-based UCI client; adaptive opponent (per-pool Elo, UCI_Chess960)
  game/          chess.js wrapper (legal dests, promotion, FEN/PGN) + Chess960 castling shim
  clock/         pure Fischer chess-clock core + time-control categories (bullet…classical)
  rating/        Glicko-2 + per-time-control rating pools (bullet/blitz/rapid/classical/chess960)
  variant/       Chess960 start-position generator (SP-ID 0–959, rand injected)
  trainer/       puzzle model + repo (IndexedDB-seeded) + active-recall tactical trainer
  calibration/   launch-time skill evaluation (puzzle ladder + ACPL game)
  analysis/      PGN parse · batch analysis · win-prob gaffe classify · motif tag ·
                 from-your-games generator · weakness radar · NL explanations ·
                 critical-moment drill · efficacy readout · deliberate-practice session
  metacog/       confidence + self-diagnosis calibration (pure, descriptive — not a grade)
  concepts/      curated teach-before-test concept cards (loader + lookup, no LLM)
  srs/           FSRS scheduling wrapper + due-queue store + leech detection
  repertoire/    opening line builder + FSRS-drilled lines
  endgame/       Syzygy client (consent-gated, cache-first) + drill catalogue
  opening/       opening book used to steer the opponent toward your weakness
  woodpecker/    fixed-set speed-drill cycle logic
  guess/         master games + guess-the-move driver
  vision/        pure board-vision primitives (geometry, blindfold, knight, per-square mastery)
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

Recent features are **additive fields on existing v4 stores**, migrated in the load path with **no
`DB_VERSION` bump** (schema stays v4, old data preserved): per-time-control + Chess960 rating pools and
per-pool opponent state on `playerModel`; `confidence`/`selfTag` on `puzzleAttempts`;
`timeControl`/`variant`/`startFen` on `games`; opt-in `metacogEnabled` and `conceptSeen`.

The Syzygy tablebase cache lives in a separate IndexedDB (`chess-trainer-tbcache`) so each position
is fetched at most once. Settings → *Delete all my data* wipes every store plus that cache.

---

## Privacy

Everything stays on your device. Your games, puzzle history, ratings, and player model live in your
browser's IndexedDB. Nothing is sent anywhere by default.

Exactly **two** features make network calls, both behind the same **off-by-default** consent
switch in Settings: the endgame trainer's Syzygy tablebase lookup (sends only the board position —
a FEN — and caches every result so a position is fetched at most once), and the optional **Lichess
games fetch** on the Import screen (sends only the username you type to the public export API — no
account, no token; ADR-0065). With the switch off, endgame drills still work against the engine and
importing still works by file or paste.

Because everything lives in browser storage, Settings → *Your data* offers a full local
**backup/restore**: one JSON file with every store (games, analyses, ratings, SRS, repertoire,
settings). The bundled puzzle set and the Syzygy cache are excluded — both re-download automatically.
Restoring replaces all current data after an explicit confirmation (ADR-0059).

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
  is sound (you train your actual weaknesses), not because a controlled study proves it. Insights now
  shows a **descriptive** local before/after miss-rate per leak ("did drilling forks move my fork-miss
  rate?") so you can watch the effect for yourself — but it is **not** a controlled study and makes no
  causal claim. The model stays local.
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
5. **Guided improvement** (ADR-0036…0041) — time controls + per-time-control ratings; Chess960
   ("wild"); opt-in metacognition (confidence + self-diagnosis calibration); the "when to think"
   critical-moment drill; a descriptive efficacy readout + a guided practice-**session** runner that
   walks the study plan end-to-end through the real trainers, ending in a reflection; and curated
   teach-before-test concept cards.

Status: **all tests green** (Vitest full suite), type-clean (`svelte-check` 0 errors), production build green.
