# Spec — `chess960`: play Fischer-Random vs the adaptive bot, own rating pool

**Scope:** feature (the user's "wild" mode) · **Status:** V1 (3 cycles) · **Date:** 2026-06-02
Batch 3, spec 2 of 6 (the heavy one). Drafted via `/draft-general`. Provisional ADR at implementation
time: **ADR-0041**. Single concern: **play Chess960 vs the adaptive bot, with its own `chess960`
rating pool.** **Not auto-analyzed in v1** (§11). Cross-spec dependency on `time-controls` for the
`RatingPool` union (§0.5 Q-F).

---

## §0 Context

The user wants a "wild" mode: **Chess960 / Fischer-Random** — the 8 back-rank pieces are shuffled to
one of 960 legal start positions (same for both sides), castling generalised. It is the one variant
worth adding because it trains *understanding over memorisation* (no opening theory), which is exactly
the app's "stronger per hour" doctrine. Play it out vs the existing adaptive bot, tracked in a separate
`chess960` rating pool (orthogonal to time category — the Lichess model).

**README override (call out explicitly — this spec reverses a stated non-goal).** README line 5 reads:
> "Not a Chess.com clone: no online matchmaking, no social ranking, **no variant catalogue**."

This spec deliberately **overrides the "no variant catalogue" clause** — but narrowly. We add **exactly
one** variant (Chess960), chosen because it is anti-memorisation and thus *on-doctrine*, not a step
toward a Chess.com-style variant menu. The README line is amended in Phase Z (§7) to say so, and
**ADR-0041 records the override and its rationale** so the reversal is auditable. (The other two
non-goals — no matchmaking, no social ranking — stand untouched.)

**Critical empirical fact (verified this session — it drives the whole design).** chess.js 1.4.0:
- **Loads** a scrambled 960 start FEN fine and generates all the normal (non-castling) moves.
- Generates **ZERO castling moves** in a 960 back-rank layout. Tested: FEN
  `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RKR1BNQB w KQkq - 0 1` (king b1, rooks a1/c1, full `KQkq` rights)
  → 19 legal moves, **0** with `O-O`/`O-O-O` or a castling flag.
- In a **standard** a1/e1/h1 layout (`r3k2r/8/8/8/8/8/8/R3K2R w KQkq -`) it generates both castles
  normally. So castling is hardcoded to the **standard king/rook files** (king e1/e8 → g/c, rooks
  a/h); it does not consult the actual king/rook squares.
- chess.js **rejects Shredder-FEN / X-FEN file-letter castling rights**: `... w ACac -` throws
  `Invalid FEN: castling availability is invalid`. It accepts **only** `KQkq`-style rights.

Consequences that shape §4:
1. **A castling shim is mandatory.** chess.js cannot generate, validate, or apply a 960 castle. We add
   the shim **in/around `ChessGame`** (the wrapper, per the scan's anchor note) — never by forking
   chess.js. For all *non-castling* moves chess.js remains the rules authority.
2. **chess.js stays on `KQkq` rights internally.** The shim cannot hand chess.js a Shredder/X-FEN
   castling field. We keep `KQkq` in the chess.js FEN and **track 960 castling rights by rook file in
   the shim's own state**, derived from the start position. (For the *standard* SP-518 the two notations
   coincide, so nothing changes there.)
3. **The engine needs the real notation.** Stockfish with `UCI_Chess960 true` expects X-FEN or
   Shredder castling rights and returns a castle bestmove as **king-to-rook UCI** (e.g. `e1h1`). So
   there is a **FEN-translation boundary** between chess.js (`KQkq`) and the engine (X-FEN/Shredder),
   plus a **UCI-routing boundary** (king-to-rook bestmove → route through the shim, not chess.js).

Anchors (verified present): `src/game/ChessGame.ts` (shim point), `src/engine/EngineClient.ts`
(generic `setOption` → `UCI_Chess960` works; `evaluate`/`analyzeLines` take a raw FEN),
`src/engine/AdaptiveOpponent.ts` (`pickMove`/`pickHumanMove`, reused), `src/ui/Board.svelte`
(chessground `dests` + `onMove`), `src/ui/Play.svelte` (the live loop), `src/store/db.ts` (`GameRecord`,
`PlayerModel`), `src/rating/glicko2.ts` (`Rating`, `updateRating`). No existing `variant`/`chess960`/
`UCI_Chess960`/`startFen` symbols in `src` (scan §2.1; re-confirmed). Net-new throughout.

---

## §0.5 Arbitrages (decide before/at implementation — recommendations in **bold**; full bundle in `reports/chess960_arbitrages.md`)

- **Q-A — Start-position selection UX.** (a) random only · (b) SP-ID picker (0–959) only · (c) **both:
  default "Random 960", plus an optional numeric SP-ID field for a specific position (and for
  reproducible study).** → **(c)**: cheap once the generator is SP-ID-addressable, and SP-ID is the
  standard way to name/replay 960 positions.
- **Q-B — Castle UX (how the human inputs a castle).** (a) **drag the king onto its own rook**
  (Lichess/unambiguous in 960 — the only encoding that never collides with a normal king step or an
  adjacent-rook capture) · (b) drag king to the g/c target square · (c) both. → **(a)**: unambiguous in
  every layout (king-to-g can equal a one-square king move; king-onto-own-rook can't be anything else).
  Render a hint ("drag the king onto the rook to castle"). Revisit (c) only if testers fumble it.
- **Q-C — Timed vs untimed first.** (a) **untimed-only in v1** (no dependency on `time-controls`) ·
  (b) ship 960 timed (requires `time-controls`' `Clock`). → **(a)**: ship 960 untimed first to decouple
  from `time-controls`; the `GameRecord.timeControl` field is written as `untimed:true` (or omitted).
  Timed 960 is a one-line follow-up once both ship (§11).
- **Q-D — v1 has no auto-analysis for 960.** (a) **accept the limitation, defer analysis (§11)** ·
  (b) block 960 until analysis supports it. → **(a)**: the analysis pipeline (`runAnalysis`, motif
  tagging, opening/ECO naming, win% curve) assumes **standard** rules and standard castling — feeding
  it a 960 game would produce wrong/misleading output (a worse honesty violation than offering none).
  "Analyse this game" is **hidden/disabled** for 960 games; the limitation is stated in-UI and in §11.
- **Q-E — The `UCI_Chess960` acceptance gate on the lite build.** (a) **G-gate (in-browser) both
  builds** — verify the **lite single-thread AND the multi-thread** Stockfish accept `UCI_Chess960` and
  return a *legal* 960 castle (`e1h1`-style) routed through the shim · (b) trust the option, skip the
  gate. → **(a)**: the whole feature rests on the engine speaking 960; an unattended unit test can't
  prove a vendored WASM build honours a UCI option. Lite is the universal fallback (ADR-0004), so it
  must pass too, not just MT.
- **Q-F — Define `RatingPool` here, or depend on `time-controls`.** (a) **`time-controls` owns the union
  (incl. `'chess960'`) per the scan contract; `chess960` only populates the `chess960` pool** · (b) if
  `chess960` ships first, define the union + the `PlayerModel` reshape here. → **(a)**: avoids a
  migration conflict. **Fallback baked in (see §4.6):** if `time-controls` is unshipped at 960's
  implementation, 960 defines the union + reshape itself, and `time-controls` later no-ops that part.

---

## §1 Empirical baseline

References the shared pre-V0 scan (`reports/specs-batch-3_scan.md`) — consumed verbatim, not restated.
Salient points for this spec:

- **Data-model contract (authoritative, scan §"contract"):** `RatingPool =
  'bullet'|'blitz'|'rapid'|'classical'|'chess960'`. `PlayerModel.gameRating` → `gameRatings:
  Partial<Record<RatingPool, Rating>>` and `opponentByPool` (OWNED by `time-controls`). `GameRecord`
  gains `variant?: 'standard'|'chess960'` + `startFen?: string` (**OWNED by this spec**). `chess960` is
  its own pool, **orthogonal** to time category. **Adding fields to existing records needs NO
  `DB_VERSION` bump** (migrate in the load path); **only a new object store bumps v4→v5** — this spec
  adds **no** store, so **DB stays v4**.
- **chess.js castling facts** (the §0 verification) — the load-bearing constraint.
- **No new dependency** (scan §2.5): chess.js 1.4.0, chessground 9.2.1, Stockfish 18 (+ `UCI_Chess960`)
  all installed; the castling shim is local, not a library swap.
- Engine: `EngineClient.setOption(name,value)` is generic → `setOption('UCI_Chess960', true)` works
  today; `evaluate(fen,…)`/`analyzeLines(fen,…)` pass the FEN through unmodified. Interrupt =
  terminate+respawn (so the 960 option must be **re-applied on every (re)boot**, exactly like
  `UCI_LimitStrength`/`UCI_Elo` already are — see `AdaptiveOpponent.applyStrength`).
- `Play.svelte` is the loop (Board + `onMove` + `AdaptiveOpponent`); `opponentStyle` selectable
  (ADR-0035). 135 tests passing, type-clean, build green (scan §2.2). Next free anti-pattern ids start
  **AP-960-1** (this spec namespaces its own; the AP-CHESS-NN series is untouched).

---

## §2 Scope

**In:**
- `src/variant/chess960.ts` — **pure** 960 start-position generator. Legal back-rank only; rand
  **injected** (no `Math.random` inside). SP-ID 0–959 addressable. Emits the back-rank + the full start
  FEN (chess.js-compatible `KQkq` rights) **and** the 960 castling metadata (rook files). Unit-tested.
- **Castling shim** in/around `src/game/ChessGame.ts` — detect a 960 castle intent, validate legality,
  apply the king+rook relocation manually, track 960 rights by rook file, emit dests for the UI, and
  translate FEN castling-rights notation at the engine boundary. Standard play unchanged when
  `variant==='standard'`. Table-tested.
- `src/ui/Play.svelte` (or a thin `Play960` path) — a **variant toggle** (Standard / Chess960), 960
  start-position selection (Random / SP-ID per Q-A), the adaptive bot reused, the castle-via-shim wiring
  for both the human (chessground drop) and the engine (king-to-rook bestmove). 960 games update the
  **`chess960`** rating pool. "Analyse this game" **disabled** for 960 (Q-D) with a one-line honesty
  note.
- `GameRecord.variant + startFen` written for 960 games (no schema bump); `chess960` rating pool
  populated. **(Fallback only, if `time-controls` unshipped — §4.6:)** the `RatingPool` union + the
  `PlayerModel` `gameRatings`/`opponentByPool` reshape + load-path migration.

**Out / deferred (→ §11):**
- **Auto-analysis of 960 games** (Q-D) — the pipeline assumes standard rules; defer.
- **Timed 960** (Q-C) — depends on `time-controls`; untimed first.
- 960 puzzles, 960 SRS/Woodpecker, 960 opening/ECO naming, 960 endgame drills, double-castling-rights
  edge UIs beyond standard 960, multi-960-game "ladders".
- En-passant/promotion are **unchanged** (chess.js handles them; only the back-rank and castling differ
  in 960).

---

## §3 Pre-flight gates (must hold before Phase A; STOP + escalate if any fails)

1. **chess.js castling fact still holds** on the installed 1.4.0 (re-run the §0 probe: 960 layout → 0
   castles; standard layout → 2 castles; Shredder rights rejected). If a chess.js bump has since fixed
   960 castling natively, **STOP** — the shim scope collapses to a thin adapter; re-scope.
2. **`UCI_Chess960` is a real option on both vendored builds** — confirmed at the §6 G-gate, but a quick
   pre-flight `setOption('UCI_Chess960', true)` + `isready` must not error on lite. If the option is
   unknown, **STOP** (Q-E moot; feature can't ship honestly).
3. **`RatingPool` source decided (Q-F).** If `time-controls` is shipped, import its union + use the
   migrated `PlayerModel`. If not, this spec's §4.6 fallback is in scope. Confirm which before coding to
   avoid a double-definition.
4. Baseline green: 135 tests pass, svelte-check clean, build OK (scan §2.2). Establish the count this
   spec must not regress.

---

## §4 Phase A — code (code → tests → verify → docs; docs LAST)

### §4.1 `src/variant/chess960.ts` — pure start-position generator
- `chess960Position(rand: number): Chess960Position` and `chess960PositionById(id: number /* 0..959 */):
  Chess960Position`, where `rand ∈ [0,1)` is **injected** (no `Math.random` inside the core — caller
  injects, per doctrine). `Chess960Position = { id: number; backRank: string /* 8 chars, e.g. "rkrbbnqn"
  lowercased piece letters */; startFen: string; castle: { whiteKingFile: number; whiteRookFiles:
  [number, number]; blackKingFile: number; blackRookFiles: [number, number] } }`.
- **Legality** (the standard Chess960 constraints): two bishops on **opposite-colour** squares; the king
  **strictly between** the two rooks; (queen + two knights fill the rest). Use the canonical
  **SP-ID → arrangement** numbering (Scharnagl/Lichess scheme) so id 518 == standard
  `RNBQKBNR` and ids round-trip. Implementation may use the standard lookup-table/derivation; the
  *contract* is: every id 0..959 yields a legal back-rank, and `byId(id).id === id`.
- `startFen` is the full FEN with both sides mirrored, `w KQkq - 0 1`, **`KQkq` rights** (chess.js
  accepts these; we are NOT emitting file-letter rights). The `castle` block carries the true rook/king
  files for the shim.
- **No** chess.js dependency inside the generator beyond optionally validating its own output in tests.

### §4.2 Castling shim — in/around `ChessGame`
The shim is the heart of the spec. `ChessGame` gains a 960 mode and an internal castling-rights model.

- **Construction.** `new ChessGame(fen?, opts?: { variant?: 'standard'|'chess960'; castle?:
  Chess960Position['castle'] })`. Standard mode (default) is **byte-for-byte the current behaviour** —
  no new branches on the hot path. 960 mode stores the `castle` files + initialises 960 rights
  (`whiteShort/whiteLong/blackShort/blackLong` booleans, derived from which rook files are present with
  rights). The underlying chess.js still holds a `KQkq` FEN.
- **chess.js `KQkq` is IGNORED as a rights source in 960 (verified — AP-960-11).** Probe this session:
  chess.js accepts `KQkq` on layouts with **two rooks on the same side of the king** (e.g. `RKR1BNQB`,
  king b1, rooks a1 *and* c1) and echoes `KQkq` back verbatim — so its castling field cannot say which
  rook backs the K-side vs Q-side right. In 960 the field is **decorative**. The **shim's rook-file
  rights model is the sole source of truth**; the shim never reads castling state back out of chess.js.
  (This is also *why* the §4.2 `fenForEngine()` X-FEN→Shredder split is necessary: the ambiguous
  inner-rook case genuinely needs Shredder file-letters for the engine.)
- **`dests()` in 960.** Start from chess.js `dests()` (all normal moves — correct in 960 except
  castling). **Add** castle destinations the shim computes: for each side-to-move castle right still
  available and **legal right now** (see legality below), add a dest **from the king square to the
  king's own rook square** (Q-B encoding: king-onto-own-rook). This never collides with a normal king
  move (a king never legally lands on its own rook unless castling) — the disambiguation argument that
  makes Q-B=(a) safe.
- **Castle detection on a move `(from,to)`.** It's a 960 castle iff `variant==='chess960'`, `from` is the
  side-to-move king square, and `to` is one of that side's **own rook squares** with the matching right
  available. (Also accept the king's g/c *target* square only if Q-B=(c) is chosen — default does not.)
- **Castle legality (validate BEFORE applying — mirror standard castling rules, generalised):**
  1. the right is present (rook on its original file, neither king nor that rook has moved);
  2. **all squares the king passes** (king-start through king-target inclusive) are **not attacked** by
     the opponent, and the king is **not currently in check** (use chess.js attack info on a probe);
  3. the squares between **king-start↔king-target** and **rook-start↔rook-target** are **empty except
     for the two castling pieces themselves** (in 960 the king and rook can start adjacent, overlap
     their paths, or the rook can be "passed through" — the standard "all empty" test is wrong; only the
     king and the castling rook may occupy the union of the two paths);
  4. king-target/rook-target are the **fixed 960 targets**: short → king g-file, rook f-file; long →
     king c-file, rook d-file (same as standard, independent of start files).
- **Apply.** Manually relocate king→target and rook→target on the board, flip turn, clear that side's
  castling rights, push the move onto the shim's history with SAN `O-O`/`O-O-O`, and **re-sync chess.js**
  to the resulting position (load the post-castle FEN with whatever `KQkq` subset remains). The shim
  must keep chess.js and its own rights model consistent after every move (castle or normal): on a
  **normal** king move or a rook leaving its home file, clear the corresponding 960 right too.
- **`moveUci` routing.** When the engine returns a king-to-rook UCI (e.g. `e1h1`) — or any UCI whose
  `from` is the king square and `to` is an own-rook square — `moveUci` must route it through the **castle
  apply** path, NOT chess.js's `move()` (which would reject it). Normal UCIs pass through unchanged.
- **FEN for the engine.** Add `fenForEngine(): string` (or have callers request it): same board/turn/
  ep/clocks as `fen`, but with castling rights in the notation Stockfish-960 expects. **Decision:**
  emit **X-FEN** (KQkq when the castling rook is the outermost on its side — the common 960 case
  collapses to KQkq) and **Shredder file-letters** only when X-FEN is ambiguous (inner-rook rights).
  Keep `fen` (chess.js, `KQkq`) as the wrapper's default getter; `fenForEngine()` is the engine-only
  variant. **Round-trip is internal to the shim** (chess.js never parses `fenForEngine`).

> **Hot-path guarantee:** every 960 branch is gated on `variant==='chess960'`. With `variant` absent/
> `'standard'`, `ChessGame` behaves exactly as today (regression-tested in §5).

### §4.3 chessground wiring (UI)
- `Board.svelte` already takes `dests` + `onMove(from,to)` and renders any FEN. **No Board API change**
  is required: the shim supplies a `dests` map that includes the king-onto-own-rook castle dest, and
  `Play` intercepts the drop. Verify the scrambled 960 start **renders** and pieces **drag** (G-gate).
- `Play.onMove`: before calling chess.js, ask the shim "is this a 960 castle?"; if yes, apply via the
  shim (which produces the king+rook relocation) and update `fen`/`lastMove` from the post-castle
  position. `lastMove` highlight = `[kingStart, kingTarget]` (chessground highlights two squares; the
  rook jump is visible from the FEN re-render).

### §4.4 Stockfish 960 wiring
- On 960 game start: `engine.setOption('UCI_Chess960', true)`. Because interrupt = respawn, the option
  is **re-applied on every (re)boot** — fold it into the opponent's `applyStrength()` path (or a small
  `apply960()` the Play loop calls after every `init`), exactly as `UCI_LimitStrength`/`UCI_Elo` are
  re-applied. (Standard games must **reset `UCI_Chess960` false** when the engine is later reused — e.g.
  the analyse path already resets `UCI_LimitStrength`; add a `UCI_Chess960 false` reset there and on a
  standard `newGame`.)
- Send the engine `position fen <fenForEngine()>` (X-FEN/Shredder rights). The bot's castle bestmove
  comes back as **king-to-rook UCI** (`e1h1`) → route through the shim (§4.2 `moveUci`).
- The adaptive bot (`pickMove`/`pickHumanMove`) is **reused unchanged** — it already passes the FEN
  through; we only ensure the FEN it gets is `fenForEngine()` and the returned UCI is shim-routed.
  `pickHumanMove`'s MultiPV lines in 960 may include castle UCIs; routing handles them.

### §4.5 `GameRecord` + rating pool
> Presupposes the reshaped `PlayerModel` (`gameRatings`/`opponentByPool`) from `time-controls` **or**
> §4.6's fallback (Q-F). Until the reshape exists, the `chess960` pool has nowhere to live, so §4.6 is a
> hard precondition for this section.
- On finishing a 960 game, write `GameRecord` with `variant:'chess960'`, `startFen:<the 960 start FEN>`,
  and `timeControl:{ …, untimed:true }` (Q-C=a — untimed). No `DB_VERSION` bump (additive fields).
- Update the **`chess960`** rating pool only: `gameRatings.chess960 = updateRating(gameRatings.chess960
  ?? seed, [{ opponentRating: botElo, opponentRd: 60, score }])`. Seed `chess960` **lazily** on the
  first 960 game (from the standard rating or a neutral prior — scan contract: "chess960 seeded lazily
  on first 960 game"). The standard pools are untouched by a 960 game and vice-versa (orthogonal).
- The adaptive **opponent** state for 960 uses `opponentByPool.chess960` (its own targetElo + recent),
  so 960 difficulty adapts independently of standard games.

### §4.6 `RatingPool` union + `PlayerModel` reshape — **fallback ONLY if `time-controls` is unshipped** (Q-F)
- If `time-controls` already shipped: **skip this section entirely** — import its `RatingPool`, use the
  migrated `PlayerModel` (`gameRatings`/`opponentByPool`), populate the `chess960` slot.
- If `chess960` ships first: define `RatingPool =
  'bullet'|'blitz'|'rapid'|'classical'|'chess960'` (in `rating/` or `db`), reshape `PlayerModel`
  (`gameRating → gameRatings`; `opponentTargetElo`+`recentOutcomes → opponentByPool`), and add the
  **load-path migration** (`store/playerModel.ts`): old `gameRating` present + `gameRatings` absent →
  seed the 4 standard pools from it (RD widened); `chess960` lazy. **No version bump.** Update consumers
  (onboarding seeds, `Play.svelte`, Dashboard/Insights "which rating"). `time-controls` later **no-ops**
  this (idempotent migration; same field names per the contract) — no conflict.

---

## §5 Phase B — tests (Vitest; pure cores have NO `Date.now`/`Math.random` inside — caller injects)

### §5.1 `chess960.test.ts` — legal-start generator
- **All 960 ids legal:** for every `id` in `0..959`, `chess960PositionById(id)` yields a back-rank with
  (a) bishops on opposite colours, (b) king strictly between the two rooks, (c) exactly 2 rooks/2
  bishops/2 knights/1 queen/1 king. Assert across the full range (cheap, deterministic).
- **Round-trip:** `byId(id).id === id` for all ids; **id 518 === standard** `RNBQKBNR`.
- **Rand mapping:** `chess960Position(rand)` with injected `rand ∈ {0, 0.5, 0.999…}` maps into
  `0..959` deterministically and yields legal positions (no `Math.random` reachable — grep the file).
- **Generated `startFen` is chess.js-loadable** (`new Chess(startFen)` does not throw; turn = white).
- **`castle` metadata matches the back-rank** (rook/king files equal the letter positions).

### §5.2 Castling-shim **table test** (the centrepiece) — `chessGame960.test.ts`
A table across **many king/rook configurations** (drive it from a set of SP-IDs spanning the edge cases:
rooks adjacent to king, king on a/h-adjacent files, rook on the b-file, the standard 518, a position
where king-start and rook-target overlap, where the rook passes through the king's path, etc.). For each
case, set up a position where castling is *just* legal and assert:
- **Castle generated:** `dests()` contains the king→own-rook dest for the available side(s).
- **Castle applied correctly:** after the castle, king on g/c-file, rook on f/d-file, side flipped,
  that side's 960 rights cleared; the resulting `fen` is legal (chess.js re-loads it).
- **Negative cases (must NOT castle):**
  - a square on the king's path is **attacked** → no castle dest;
  - the king is **in check** → no castle dest;
  - a non-castling piece occupies the king/rook path → no castle dest;
  - the right was already **spent** (king or that rook moved) → no castle dest;
  - **king-side vs queen-side independence** (spending one right leaves the other).
- **UCI routing:** `moveUci('e1h1')`-style king-to-rook input on a legal-castle position applies the
  castle (SAN `O-O`/`O-O-O`); a king-to-rook UCI on an illegal-castle position returns `null` (rejected,
  not mis-applied).
- **Rights bookkeeping:** a normal king move clears both that side's rights; a rook leaving its home
  file clears that side's matching right; capturing a rook on its home square clears the opponent's.

### §5.3 Standard-mode regression
- A focused test that `new ChessGame()` (no opts) and the standard start FEN behave **identically to
  today**: standard castling (`e1g1`/`e1c1`) still works through chess.js, `dests()`/`move()`/
  `terminal()` unchanged. (Guards the hot-path guarantee.)

### §5.4 FEN-translation unit test
- `fenForEngine()` emits valid X-FEN for outer-rook 960 rights (collapses to `KQkq` for SP-518 and any
  outermost-rook case) and Shredder file-letters for inner-rook rights; board/turn/ep/clocks are
  preserved. (No chess.js parse of `fenForEngine` — assert string shape against known fixtures.)

> Engine I/O and chessground rendering/drag are **not** unit-tested (WASM worker + DOM) — they're the
> §6 in-browser gates. Pure cores (generator, shim legality/apply, FEN translate) carry the unit burden.

---

## §6 Phase C — verification

`npm test` green incl. `chess960.test.ts` + `chessGame960.test.ts` + the FEN-translate test; svelte-check
clean; build OK; the §3 baseline test count not regressed.

**G-gate (in-browser, mandatory — Q-E=a). The feature does not ship until this passes:**
1. **Render + drag.** Start a 960 game (Random and a specific SP-ID, e.g. 0 and 959): the scrambled
   back-rank renders correctly on chessground; pieces drag; legal non-castle moves work.
2. **Human castle.** In a position where castling is legal, drag the king onto its own rook → the shim
   castles (king to g/c, rook to f/d); an illegal castle (path attacked / in check / blocked) is
   refused.
3. **Engine speaks 960 — BOTH builds.** With `UCI_Chess960 true`, confirm in the app console that **the
   lite single-thread build AND the multi-thread build** (a) accept the option without error and (b)
   from a position where the bot *should* castle, return a **king-to-rook bestmove** (`e1h1`-style) that
   the shim applies as a **legal** 960 castle. (Force lite via the existing `forceLiteFallback`; force
   MT under crossOriginIsolated.) **If either build fails to play a legal 960 castle → STOP and
   escalate** (the feature cannot ship honestly on that build).
4. **Full game + rating.** Play a 960 game to a result vs the adaptive bot; confirm a `GameRecord` with
   `variant:'chess960'` + `startFen` is stored, and the **`chess960`** rating pool (only) updates.
5. **Standard regression.** Play a normal standard game after a 960 game (engine reused): confirm
   `UCI_Chess960` was reset to false and standard castling still works (no leakage).
6. **Analysis correctly disabled.** "Analyse this game" is hidden/disabled on the 960 game-over screen,
   with the honesty note shown.

---

## §7 Phase Z — docs (LAST)

- **ADR-0041 — Chess960 ("wild" mode): castling shim + own rating pool; README variant-catalogue
  override.** Record: the **README override** (we add exactly one variant, Chess960, because it is
  anti-memorisation and thus on-doctrine — not a Chess.com-style variant menu; the matchmaking/social
  non-goals stand). The **chess.js castling finding** (loads 960, generates 0 castles, rejects Shredder
  rights — the reason for the shim). The **shim design** (detect king-onto-own-rook intent, generalised
  legality, manual king+rook relocation, 960 rights by rook file, `fenForEngine()` X-FEN/Shredder
  translation, king-to-rook UCI routing). **`UCI_Chess960` on engine boot + re-apply on respawn + reset
  for standard reuse.** **`chess960` is its own rating pool, orthogonal to time category** (depends on
  `time-controls`' `RatingPool`; or §4.6 fallback). **v1 limitations: untimed-only (Q-C) and
  no-auto-analysis (Q-D).** The **G-gate result** (both builds verified). Q-A..Q-F dispositions.
- **README:** amend line 5 — change "no variant catalogue" to note the **one deliberate exception**
  (e.g. "no variant *catalogue* — with one on-doctrine exception, Chess960, which trains understanding
  over memorisation"). Add Chess960 to the Play section; state the v1 limits (untimed, not yet
  auto-analysed). **README edit is part of this spec's acceptance** (the override must be visible where
  the original non-goal was stated).

---

## §8 Acceptance criteria

1. Pure `chess960.ts` generator: all 960 ids legal, SP-ID round-trips, id 518 == standard, rand
   injected (no `Math.random`/`Date.now` inside), `startFen` chess.js-loadable — unit-tested.
2. Castling shim in/around `ChessGame`: detects king-onto-own-rook (Q-B=a), validates generalised 960
   legality (king-path-not-attacked, not-in-check, paths empty except the two castling pieces, rights
   present), applies the king+rook relocation, tracks 960 rights by rook file, routes king-to-rook UCI,
   and emits `fenForEngine()` (X-FEN/Shredder) — **table-tested across many king/rook configs**;
   standard mode byte-identical (regression test).
3. chessground renders the 960 start and drags; the human castles by dragging the king onto its rook
   (G-gate).
4. Stockfish plays 960: `UCI_Chess960` set on boot (and re-applied on respawn, reset for standard
   reuse); **both the lite AND multi-thread builds verified in-browser to play a legal 960 castle**
   (Q-E=a G-gate).
5. 960 games store `GameRecord.variant='chess960'` + `startFen` and update **only** the `chess960`
   rating pool (orthogonal to time category); **no `DB_VERSION` bump** (DB stays v4).
6. v1 limitations honoured: **untimed-only** (Q-C); **"Analyse this game" disabled for 960** with an
   in-UI honesty note (Q-D).
7. `RatingPool`: imported from `time-controls` if shipped; else this spec's §4.6 fallback (union +
   reshape + idempotent load-path migration, no bump).
8. `npm test` green (incl. the two new suites + FEN-translate), svelte-check clean, build OK, baseline
   count not regressed; standard play unaffected (G-gate #5).
9. ADR-0041 records the design + the README override + Q-A..Q-F; README line 5 amended; v1 limits
   documented.

---

## §9 Anti-patterns (namespaced `AP-960-N`)

- **AP-960-1 — Forking/patching chess.js for 960.** The shim wraps chess.js; chess.js stays the rules
  authority for all non-castling moves and keeps a `KQkq` FEN. Never edit the vendored chess.js or hand
  it Shredder rights (it rejects them — §0).
- **AP-960-2 — Hardcoding standard castling geometry in the shim.** In 960, king and rook start on
  arbitrary files and their paths overlap; the standard "squares between are empty" / "king moves two
  squares" assumptions are wrong. Validate against the actual start files; only the king + the castling
  rook may occupy the union of the king-path and rook-path.
- **AP-960-3 — Trusting `UCI_Chess960` without the in-browser gate.** A unit test cannot prove a vendored
  WASM build honours the option; verify **both** builds play a legal castle in-browser (Q-E=a). Lite is
  the universal fallback — it must pass too.
- **AP-960-4 — Castle option not re-applied after engine respawn (or not reset for standard).** Interrupt
  = terminate+respawn drops UCI options; `UCI_Chess960` must be re-set on every boot during a 960 game,
  and reset to **false** when the engine is reused for a standard game/analysis (else standard castling/
  analysis misbehaves).
- **AP-960-5 — Mis-routing the engine's king-to-rook castle UCI through chess.js.** chess.js will reject
  `e1h1` in 960; it must go through the shim's castle-apply path. Same for the human's king-onto-rook
  drop.
- **AP-960-6 — Feeding a 960 game to the standard analysis pipeline.** Motif tagging, ECO/opening naming,
  win% curve and standard-castling assumptions produce wrong/misleading output for 960 — a worse honesty
  violation than offering no analysis. Disable analysis for 960 in v1 (Q-D); state it.
- **AP-960-7 — Cross-contaminating rating pools.** A 960 result updates **only** `gameRatings.chess960`
  (and `opponentByPool.chess960`); standard pools are untouched, and standard games never touch
  `chess960`. The pool is orthogonal to time category (Lichess model) — do not fold 960 into a time
  pool.
- **AP-960-8 — Bumping `DB_VERSION` for the additive fields.** `variant`/`startFen` on `GameRecord` and
  the `PlayerModel` reshape are migrated in the **load path**; this spec adds **no object store**, so DB
  **stays v4** (scan contract).
- **AP-960-9 — Ambiguous castle UX.** King-to-g-square can equal a normal one-square king move and can
  collide with capturing an adjacent piece; king-onto-own-rook is the only unambiguous encoding in every
  960 layout (Q-B=a). Don't ship king-to-target as the *only* input.
- **AP-960-10 — `Math.random`/`Date.now` inside the pure generator/shim cores.** The 960 generator takes
  an injected `rand`; the shim is deterministic. Randomness/time live in the caller (`Play.svelte`),
  matching every other core in the repo.
- **AP-960-11 — Reading castling rights back out of chess.js in 960.** chess.js accepts and echoes
  `KQkq` even when both rooks sit on the same side of the king (verified), so its castling field cannot
  identify which rook backs which right — it's decorative in 960. The shim's rook-file rights model is
  the sole source of truth; never derive 960 rights from the chess.js FEN.

---

## §10 Rollback

Net-new module (`src/variant/chess960.ts`) + additive `ChessGame` 960 branches (all gated on
`variant==='chess960'`) + `Play` variant toggle/wiring + two new test suites + the `GameRecord`
fields/pool population + (only if `time-controls` unshipped) the §4.6 union/reshape/migration. **No new
object store; DB stays v4.** Rollback = revert those files and the `Play` arm; standard play is
unaffected by construction (the 960 branches are dead when `variant!=='chess960'`). The additive
`GameRecord` fields on any already-stored 960 games are inert under standard code (ignored), so a revert
leaves the DB readable. ADR-0041 marked superseded/withdrawn if reverted.

---

## §11 Follow-up

- **960 auto-analysis** (lifts Q-D): a 960-aware path through `runAnalysis` — engine with `UCI_Chess960`,
  motif tagging that doesn't assume standard castling, **suppress ECO/opening naming** (no 960 theory),
  win% curve recomputed with the shim's legal-move generation. The biggest single follow-up; closes the
  play→analyse→puzzles loop for 960.
- **Timed 960** (lifts Q-C): once `time-controls` ships, allow a 960 game under a `Clock` (the
  `GameRecord.timeControl` already carries category; 960 stays its own rating pool, orthogonal to the
  time category — Lichess model).
- **SP-ID picker polish:** a "position of the day", recently-played SP-IDs, share/replay by id.
- **960 puzzles / endgames / scenario sparring** from played 960 games (after 960 analysis exists).
- **King-to-target castle input** as an optional second encoding (Q-B=c) if testers prefer it.
- **Double-rook-rights edge UI:** explicit affordance when both castles are available from unusual files
  (the dests already encode both; a hint could disambiguate visually).
