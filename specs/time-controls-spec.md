# Spec — `time-controls`: chess clocks + per-time-control ratings on the Play screen

**Scope:** feature · **Status:** V1 (2 refiner cycles; cycle 3 skipped — 0 critical) · **Date:** 2026-06-02
Batch 3, spec 1 of 6 (ship first — see `reports/specs-batch-3_scan.md`). Provisional **ADR-0036**.

## §0 Context (baseline cited)
`Play.svelte` plays the adaptive Stockfish bot with **no clock**: the bot's move budget is a hardcoded
`movetime` (`pickMove(fen, 500)` / `pickHumanMove(fen)` → 300 ms default), there is no per-side time, and
no time pressure. The `PlayerModel` carries **one** game rating (`gameRating: Rating`), **one** adaptive
opponent target (`opponentTargetElo: number`), and **one** rolling outcome window (`recentOutcomes[]`) —
so a 1+0 bullet result and a 30+0 classical result move the *same* number, conflating very different
skills. This spec adds chess clocks + Lichess-style time-control **categories** to Play, and splits the
single game rating / single adaptive bot into **per-time-control pools** (`RatingPool`), with a load-path
migration that needs **no `DB_VERSION` bump** (field reshape only, per the shared contract).

Anchors (read): `src/ui/Play.svelte`, `src/engine/AdaptiveOpponent.ts` (`pickMove`/`pickHumanMove`/
`recordGame`/`finishGame`), `src/engine/EngineClient.ts` (`evaluate(fen,{movetime})` already takes a
movetime — clock-aware budget plumbs cleanly), `src/rating/glicko2.ts` (`updateRating`), `src/store/db.ts`
(schema v4; `GameRecord`/`PlayerModel`/`SettingsRecord`), `src/store/playerModel.ts` (load path =
migration point), `src/state/app.svelte.ts`, `src/calibration/Calibration.ts` + `src/ui/Onboarding.svelte`
(`seedGameRating` → `commit()` seeds the rating, a migration consumer), `src/game/ChessGame.ts`
(`terminal()` + `chess.js` `isInsufficientMaterial`). Doctrine + ADR style from `decisions.md` (last:
ADR-0035 selectable opponent style; ADR-0034 human-like opponent; ADR-0026 onboarding seed path).

**This spec OWNS** (per `reports/specs-batch-3_scan.md` "Authoritative shared data-model contract"):
the `RatingPool` union *including* the `chess960` member (populated later by the `chess960` spec), the
`PlayerModel` reshape (`gameRating`→`gameRatings`, `opponentTargetElo`+`recentOutcomes`→`opponentByPool`)
and its load-path migration, plus the `GameRecord.timeControl` field and `SettingsRecord.lastTimeControl`.
The `chess960` spec only *consumes* `RatingPool` and *adds* `variant`/`startFen`; if both ship there is no
migration conflict.

## §0.5 Arbitrages flagged (recommend; user decides — full text in `reports/time-controls_arbitrages.md`)
- **Q-A — Exact preset list.** Recommend the seed in this spec (Bullet 1+0 / 2+1 · Blitz 3+2 / 5+0 ·
  Rapid 10+0 / 15+10 · Classical 30+0 · No clock · Custom). Lichess-aligned; covers each band.
- **Q-B — "No clock" pool.** (a) classical pool + `untimed:true` flag on the game vs (b) a separate
  `'unlimited'` pool. **Recommend (a)** — keeps `RatingPool` to the 5 contract members; preserves today's
  untimed-game behavior exactly; honesty (don't invent a 6th rating from a different skill).
- **Q-C — Flag with insufficient mating material.** (a) FIDE: flag vs a side that cannot mate = **draw**
  vs (b) always-loss (simpler). **Recommend (a)** — correct chess; small pure helper, fully testable.
- **Q-D — `movesLeftEstimate`** for the bot's per-move budget. Recommend a phase-aware estimate (see §4.3)
  rather than a fixed constant, clamped by `[floorMs, ceilMs]` per category.
- **Q-E — Switching time control resets the bot pool's Elo?** (a) No — each pool keeps its own learned Elo
  (persisted) vs (b) reset to the player's pool rating on switch. **Recommend (a)** — pools are
  independent; that's the point.
- **Q-F — Which rating Play header / Dashboard show.** Recommend Play header shows the **selected pool's**
  rating (falls back to the nearest seeded pool); Dashboard keeps showing one headline number = the
  **classical** pool (closest to today's single `gameRating`) to avoid a UI redesign in this spec.

## §1 Empirical baseline (reference the shared scan — do NOT re-measure)
Per `reports/specs-batch-3_scan.md` §2.1–§2.6: `gameRatings`, `class Clock`, `whiteMs`, `incrementSec`
all **absent** in `src/`; `timeControl` matches only the PGN `TimeControl` header parser (reuse the
string convention, do not collide). DB schema **v4**, additive fallthrough ladder. `AdaptiveOpponent`
uses fixed movetime, no clock. 135 tests passing, type-clean, build green. **No new external dependency**
(chess.js 1.4.0 already gives `isInsufficientMaterial`; clock is pure TS). No source divergence, no
collision (local-only repo).

## §2 Scope
**In:**
1. `src/clock/Clock.ts` — pure chess-clock core. State `{ whiteMs, blackMs, incMs, side, running }`;
   `tick(elapsedMs)`, `press(side)` (Fischer increment added to the **side that just moved** on press),
   `flagged(): 'w'|'b'|null`. **No `Date` / no `Math.random` inside** — caller passes `elapsedMs`.
2. `src/clock/categories.ts` — pure `categoryFor(initialSec, incrementSec): 'bullet'|'blitz'|'rapid'|
   'classical'` (band on estimate `initialSec + 40·incrementSec`), the `TIME_CONTROL_PRESETS` table, and
   an `insufficientMatingMaterial(fen, side): boolean` helper for the FIDE flag rule (Q-C).
3. `RatingPool` union (**owned here**) + `PlayerModel` reshape + **load-path migration** (no `DB_VERSION`
   bump): `gameRatings: Partial<Record<RatingPool, Rating>>`, `opponentByPool: Partial<Record<RatingPool,
   { targetElo: number; recent: GameOutcome[] }>>`.
4. `GameRecord.timeControl` + `SettingsRecord.lastTimeControl` fields.
5. `Play.svelte`: time-control selector (beside the opponent-style dropdown); a rAF/interval loop driving
   `tick`; `press()` on **every** move (player AND bot); clock display for both sides; clock-aware bot
   movetime; flag → game over (loss, or draw under Q-C); on finish, rate into the **selected pool** and
   nudge that pool's adaptive bot; persist `lastTimeControl`. "No clock" preserves today's behavior.
6. Migration consumers updated (read/write the right pool): `playerModel.ts` (`freshPlayerModel` +
   migrate), `Onboarding.svelte` `commit()` (seed **all 4 standard pools** from the calibration seed),
   `Comeback.svelte` / `Sparring.svelte` (read a pool's `targetElo`), `Dashboard.svelte` / `Home.svelte` /
   `Insights.svelte` (read a pool's `.rating`), `db.test.ts`.

**Deferred (§11):** Chess960 / the `chess960` pool population (separate `chess960` spec — this spec only
defines the union member); delay/Bronstein increments (Fischer only); per-pool rating history charts /
multi-rating Dashboard redesign; sound/low-time warnings; clock for the onboarding calibration game (stays
untimed); time-odds handicaps; `PGN TimeControl` header emitted on export.

## §3 Pre-flight gates
1. `EngineClient.evaluate(fen,{movetime})`, `AdaptiveOpponent.pickMove(fen, movetime)` and
   `pickHumanMove(fen, movetime)` all accept a movetime argument (confirmed — Play can pass a computed
   budget without engine changes).
2. `AdaptiveOpponent.recordGame(state, outcome)` is pure and reusable per pool (confirmed — module fn,
   not instance-bound); `initOpponentState(seedElo)` available.
3. `chess.js` exposes `isInsufficientMaterial()`; `ChessGame.terminal()` reports `'insufficient'`. The
   FIDE flag rule needs the **flagged side's opponent** material specifically → new pure helper (§4.2).
4. `PlayerModel` is read/written through `loadPlayerModel`/`savePlayerModel` and the consumers enumerated
   in §2.6 of the scan (grep-confirmed list in §4.4) — migration is centralizable in the load path.
5. 135 tests green, `svelte-check` clean, build green (baseline to preserve).

## §4 Phase A — code (pure cores first, then UI)

### §4.1 `src/clock/Clock.ts` (pure, no Date/Math.random)
```ts
export type Side = 'w' | 'b';
export interface ClockState {
  whiteMs: number; blackMs: number; incMs: number;
  side: Side;          // whose clock is currently running
  running: boolean;
}
export function initClock(initialMs: number, incMs: number, side: Side = 'w'): ClockState;
/** Subtract elapsed from the running side; clamps at 0 (never negative). No-op if !running. */
export function tick(s: ClockState, elapsedMs: number): ClockState;
/** The side that just moved presses: add Fischer increment to THAT side, switch side to the other.
 *  `mover` must equal s.side (the side on the move); ignored otherwise. Increment is NOT added if the
 *  mover is already flagged (you cannot gain time after flagging). */
export function press(s: ClockState, mover: Side): ClockState;
/** Returns the flagged side ('w'|'b') if its time is ≤ 0, else null. */
export function flagged(s: ClockState): Side | null;
export function startClock(s: ClockState): ClockState; // running = true
export function stopClock(s: ClockState): ClockState;  // running = false (game over / paused)
```
Rules: `tick` only decrements the `side` whose clock runs, clamped to `≥ 0`. `flagged` returns a side
once that side's ms `≤ 0` (the side that ran out). `press(mover)` is the move-completion event: it adds
`incMs` to `mover` then flips `side`. Increment-on-press matches Fischer (Bullet 1+0 has `incMs = 0`, a
pure no-increment clock). All transitions return a **new** object (immutable, like `recordGame`).
**No `Date.now()` and no `Math.random()` inside** — the Play loop measures elapsed via `performance.now()`
deltas and passes them in (mirrors the `rand`-injection discipline in `humanMove.ts`).

### §4.2 `src/clock/categories.ts` (pure)
```ts
import type { Side } from './Clock';
export type Category = 'bullet' | 'blitz' | 'rapid' | 'classical';
/** Lichess-style band on the estimate = initialSec + 40*incrementSec. */
export function categoryFor(initialSec: number, incrementSec: number): Category;
//   est < 179      -> 'bullet'      (e.g. 1+0=60, 2+1=120)
//   179 <= est<479 -> 'blitz'       (3+2=180, 5+0=300)
//   479 <= est<1499-> 'rapid'       (10+0=600, 15+10=1000)
//   est >= 1499    -> 'classical'   (30+0=1800)
export interface TimeControlPreset {
  id: string; label: string; initialSec: number; incrementSec: number; untimed?: boolean;
}
export const TIME_CONTROL_PRESETS: TimeControlPreset[]; // Q-A seed (see §0.5)
/** FIDE Art. 6.9 helper for the flag rule (Q-C): true if `side` (the side that did NOT flag)
 *  has no possible mating material — bare king, or K + single bishop/knight, or K+ only same-colour
 *  bishops. Pure: derives solely from the FEN's piece placement. Then a flag = DRAW, not a loss. */
export function insufficientMatingMaterial(fen: string, side: Side): boolean;
```
`categoryFor` thresholds are chosen so every preset lands in its intended band (verified in §5). The
`untimed` preset ("No clock") carries `untimed: true` and is **not** passed to `categoryFor` at play time;
its games are stored with `category: 'classical', untimed: true` and rated into the **classical** pool
(Q-B=a). `insufficientMatingMaterial` enumerates the bare cases above; for anything richer it returns
false (conservative — only declare a draw when provably no mate, honesty doctrine).

### §4.3 Clock-aware bot budget (in `Play.svelte`, computed from clock state)
A pure local helper keeps the formula testable-by-inspection (no engine call):
```ts
// remainingMs = the BOT's own clock; movesLeftEstimate per Q-D.
function botMovetime(remainingMs: number, ply: number, cat: Category): number {
  const movesLeft = Math.max(8, 40 - Math.floor(ply / 2)); // Q-D: ~40-move horizon, floor 8
  const raw = remainingMs / movesLeft;
  const [floor, ceil] = BUDGET_BOUNDS[cat]; // bullet [40,250] blitz [80,500] rapid [150,1200] classical [200,2000]
  return Math.round(Math.min(ceil, Math.max(floor, raw)));
}
```
Untimed → keep today's fixed budget (`pickMove(fen,500)` / `pickHumanMove(fen)` defaults). The bot's own
clock **runs** while it thinks and is `press()`ed when it moves, so it can flag too (rare, but correct).
The budget is fed to `pickMove(fen, ms)` / `pickHumanMove(fen, ms)` — no `EngineClient` change.

### §4.4 `RatingPool` + `PlayerModel` reshape + load-path migration (no `DB_VERSION` bump)
Define **once** (in `src/rating/glicko2.ts` or a sibling `src/rating/pools.ts` — recommend `pools.ts` to
avoid bloating glicko2; re-export from db is fine):
```ts
export type RatingPool = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'chess960';
export const STANDARD_POOLS = ['bullet','blitz','rapid','classical'] as const; // chess960 seeded lazily
```
`db.ts` `PlayerModel` (field reshape; IndexedDB stores arbitrary shapes — **no version bump**):
```ts
gameRatings: Partial<Record<RatingPool, Rating>>;
opponentByPool: Partial<Record<RatingPool, { targetElo: number; recent: GameOutcome[] }>>;
// REMOVED: gameRating, opponentTargetElo, recentOutcomes
```
**Migration** in `store/playerModel.ts` `loadPlayerModel` (a `migratePlayerModel(raw)` pure-ish step on
the loaded record): if a record has legacy `gameRating` and lacks `gameRatings`, seed all 4
`STANDARD_POOLS` from it with **RD widened** (`max(rd, 150)` — per-pool evidence is thinner than the old
single rating); seed `opponentByPool[pool] = { targetElo: legacy.opponentTargetElo ?? round(gameRating),
recent: legacy.recentOutcomes ?? [] }` for the 4 standard pools. `chess960` stays absent (seeded lazily
on the first 960 game by that spec). Persist the migrated shape on next save (no eager rewrite required;
fresh records already have the new shape via `freshPlayerModel`). Drop the legacy fields after migrating.
`freshPlayerModel(now)` seeds the 4 standard pools at `defaultRating()` and `opponentByPool` at
`{ targetElo: 1500, recent: [] }`.

**Helper for "the rating to show / seed a bot from"** (handles a pool not yet seeded):
```ts
export function poolRating(m: PlayerModel, pool: RatingPool): Rating;       // fallback: nearest seeded standard pool, else defaultRating()
export function poolOpponent(m: PlayerModel, pool: RatingPool): { targetElo: number; recent: GameOutcome[] };
```

**Consumers to update (grep-confirmed):**
- `store/playerModel.ts` — `freshPlayerModel` + `migratePlayerModel`.
- `ui/Onboarding.svelte` `commit()` (line ~199–203) — seed `gameRatings` for **all 4 standard pools**
  from `gameR`; set each `opponentByPool[pool] = { targetElo: round(gameR.rating), recent: [] }`.
  (Calibration seeds all standard pools, per the contract.)
- `ui/Play.svelte` — read `poolOpponent(m, selectedPool).targetElo` for `initOpponentState`; on finish,
  write `updateRating` into `gameRatings[selectedPool]` and `recordGame` into `opponentByPool[selectedPool]`.
- `ui/Comeback.svelte` (line ~52) + `ui/Sparring.svelte` (line ~43) — `initOpponentState(poolOpponent(m,
  'classical').targetElo)` (these drills are untimed → classical pool; documented).
- `ui/Dashboard.svelte` (~27), `ui/Home.svelte` (~15–16), `ui/Insights.svelte` (~30) — read
  `poolRating(m,'classical').rating` (Q-F: classical = the headline number nearest today's behavior).
- `store/db.test.ts` (~52) — assert `gameRatings.classical` defined (was `gameRating`).

### §4.5 `GameRecord` + `SettingsRecord` fields (additive — no bump)
```ts
// GameRecord +=
timeControl: { initialSec: number; incrementSec: number; category: Category; untimed?: boolean };
// SettingsRecord +=
lastTimeControl?: { initialSec: number; incrementSec: number };
```
`Play.finishGame` writes `timeControl` (category via `categoryFor`, or `classical`+`untimed` for No
clock). Existing `GameRecord`s without `timeControl` are read tolerantly (optional at read sites; treat
absent as untimed classical). `lastTimeControl` is persisted on selection (`app.persistSettings`) and
restored as the default selection on mount (fallback: first non-untimed preset, or No clock).

### §4.6 `Play.svelte` wiring (the clock loop)
- State: `clock = $state<ClockState|null>(null)`, `selectedTC = $state<TimeControlPreset>`, derived
  `selectedPool: RatingPool` (`untimed ? 'classical' : categoryFor(...)`).
- Selector `<select>` beside the opponent-style dropdown; disabled while a game is live (`status` is
  `'playing'` **or** `'thinking'`), re-enabled at `'idle'`/`'over'`.
- On `newGame`: build `clock = startClock(initClock(initialSec*1000, incrementSec*1000, 'w'))` (skip if
  untimed → `clock = null`, today's path verbatim). Seed the bot from `poolOpponent(m, selectedPool)`.
- The tick loop: a `requestAnimationFrame` (or `setInterval(100)`) running whenever a game is live —
  `status` is `'playing'` **or** `'thinking'` (the bot's clock MUST keep decrementing while it thinks, so
  the bot can flag — AP-TC-4; `tick` decrements only `clock.side`, which is Black during the bot's turn).
  Each frame computes `elapsed = now - lastTs` via `performance.now()`, calls `clock = tick(clock,
  elapsed)`, and checks `flagged(clock)`. On flag → stop loop, `onFlag(side)`. The loop is the **only**
  place time is read; `Clock` stays Date-free. (`press` flips `clock.side`, so during `'thinking'` the
  running side is correctly the bot's.)
- `onMove` (player) and `engineMove` (bot): after a successful move, `clock = press(clock, mover)`
  (mover = the side that just moved). Bot's `engineMove` first computes `botMovetime(clock[botSide],
  ply, cat)` where `botSide = playerColor === 'white' ? 'blackMs' : 'whiteMs'` (the bot's own remaining
  time), and passes the result to `pickMove`/`pickHumanMove`.
- `onFlag(side)`: `status='over'`; if `insufficientMatingMaterial(game.fen, otherSide)` → draw (Q-C),
  else the side that flagged **loses** (the other side wins). Route through `finishGame(outcome)`.
- `finishGame`: rate into `gameRatings[selectedPool]`; `recordGame` the `opponentByPool[selectedPool]`;
  store the `GameRecord` with `timeControl`; persist model + settings (`lastTimeControl`).
- Header (Q-F): "Your {category} rating {round(poolRating(m,selectedPool).rating)} · bot ≈ {targetElo}".
- Clock display: two read-outs (top = bot/opponent, bottom = player), `mm:ss` (or `ss.s` under 20 s),
  the running side highlighted, flagged side shown 0:00. Pure formatting helper `fmtClock(ms)`.

## §5 Phase B — tests (Vitest; cores only — UI/loop is manual)
- `src/clock/Clock.test.ts`: `initClock` sets both sides + side/running; `tick` decrements only the
  running side, clamps at 0 (never negative), no-op when `!running`; `press(mover)` adds `incMs` to the
  mover and flips `side`, adds **0** when `incMs=0` (bullet), and does **not** add increment if the mover
  is already at 0 (flagged); `flagged` returns the side at/below 0 and null otherwise; sequence test:
  init 1+0 → several ticks/presses → correct flag side. Determinism: identical inputs → identical state.
- `src/clock/categories.test.ts`: `categoryFor` maps **every** `TIME_CONTROL_PRESETS` entry (except
  untimed) into its intended band (1+0/2+1→bullet, 3+2/5+0→blitz, 10+0/15+10→rapid, 30+0→classical) and
  the band boundaries (178/179, 478/479, 1498/1499); `insufficientMatingMaterial` true for K-vs-K,
  K+B-vs-K, K+N-vs-K, K+same-colour-Bs, false for K+R, K+P, K+2N (FIDE: mate possible/forced-by-rule),
  evaluated for the **named** side from FEN.
- `src/rating/pools.test.ts` (or in `playerModel.test.ts`): `migratePlayerModel` — legacy record
  (`gameRating`+`opponentTargetElo`+`recentOutcomes`, no `gameRatings`) → all 4 standard pools seeded,
  RD widened to ≥150, `opponentByPool` carries `targetElo`/`recent`, `chess960` absent, legacy fields
  gone; a record already in new shape is untouched; `poolRating`/`poolOpponent` fall back to nearest
  seeded pool then `defaultRating()`/1500 when the requested pool is empty. `freshPlayerModel` has the
  new shape.
- Budget: `botMovetime` is exercised by inspection in `categories.test.ts` or a small `budget.test.ts`
  (clamps to floor/ceil per category; decreases as `remainingMs` falls; `movesLeft` floor 8). (Optional —
  it is a few lines; include if extracted to a pure module.)
- Engine-driven clock play and the rAF loop = **manual verification** (§6), consistent with how Play /
  Comeback engine loops are verified in prior specs.

## §6 Phase C — verification (acceptance gates)
1. `npm test` green **including** `Clock.test.ts`, `categories.test.ts`, the migration tests; no
   regression in the 135 existing tests.
2. `svelte-check` clean; production build green.
3. **Migration smoke (manual):** load the app with a pre-existing v4 `playerModel` (legacy single
   `gameRating`) → no crash; Home/Dashboard still show a number; Play seeds a bot; after one game the
   correct pool moved and the legacy fields are gone on next persist.
4. **Manual play:** pick Blitz 3+2 → both clocks count down, increment is added on each move, the bot
   plays noticeably faster than in Classical; let the bot flag (or self-flag in bullet) → game ends with
   the right result; flag vs a lone king → **draw** (Q-C); win/lose a Rapid game → only the **rapid** pool
   rating + rapid bot Elo change (bullet/blitz/classical untouched); "No clock" → identical to today
   (no clock UI, untimed game stored, classical pool moves).
5. Re-select a time control → `lastTimeControl` persists across reload (default restored).

## §7 Phase Z — docs (specify only; do NOT edit `decisions.md`/README in the spec)
- **ADR-0036 — Time controls: clocks + per-time-control ratings (batch 3, spec 1).** To be appended at
  implementation time. Content to record: pure `Clock` core (Date-free, increment-on-press Fischer,
  caller injects elapsed); `categoryFor` band on `initial + 40·inc`; **`RatingPool` union owned here**
  (incl. the `chess960` member, populated by the `chess960` spec); `PlayerModel` reshape
  (`gameRatings`/`opponentByPool`) with a **load-path migration and NO `DB_VERSION` bump** (field reshape
  only); per-pool Glicko + per-pool adaptive bot (`recordGame` mirrored per pool); clock-aware bot
  movetime budget; "No clock" → classical pool + `untimed` flag (Q-B=a); flag-vs-insufficient-material =
  draw (Q-C=a, FIDE). Cross-link: **supersedes the single-`gameRating` model** referenced in ADR-0005 /
  ADR-0026 (onboarding now seeds all standard pools); the `chess960` spec/ADR consumes this union.
- **README** "Play" / "Train & retain": note clocks + time-control categories + per-TC ratings (and that
  Comeback/Sparring drills remain untimed = classical pool). Defer the multi-rating Dashboard.

## §8 Acceptance criteria
- Pure `Clock` core (Date-free, Math.random-free) with `tick`/`press`/`flagged` + immutable transitions,
  fully unit-tested.
- `categoryFor(initial,inc)` band function + presets (Bullet 1+0/2+1, Blitz 3+2/5+0, Rapid 10+0/15+10,
  Classical 30+0, No clock, Custom) — every preset lands in its intended category (tested).
- `RatingPool` union (incl. `chess960`) defined **once** and owned here; `PlayerModel` reshaped to
  `gameRatings` + `opponentByPool`; load-path migration seeds the 4 standard pools from a legacy record,
  widens RD, **no `DB_VERSION` bump**; all grep-listed consumers updated; `chess960` seeded lazily.
- Play screen: time-control selector beside the opponent-style dropdown; both clocks display + tick;
  `press()` on every move (player AND bot); clock-aware bot budget (fast in bullet/blitz); flag ends the
  game (loss, or draw with insufficient mating material); on finish the **selected pool's** rating +
  adaptive bot update (other pools untouched); `lastTimeControl` persisted; "No clock" preserves today's
  behavior exactly.
- ADR-0036 specified (not written here); README note specified. `npm test` + `svelte-check` + build green.

## §9 Anti-patterns
- **AP-TC-1** — `Date.now()` / `Math.random()` / `performance.now()` **inside** `Clock.ts` or
  `categories.ts`. Cores stay pure; the Play loop measures elapsed and injects it (mirrors `humanMove.ts`
  `rand` injection). Violating this breaks deterministic unit tests.
- **AP-TC-2** — Bumping `DB_VERSION` (or adding an object store) for the `PlayerModel` reshape. The
  contract is explicit: **field reshape migrates in the load path, no bump**. Only a *new store* bumps v4.
- **AP-TC-3** — A finished game updating the **single/old** rating, or **every** pool, instead of exactly
  the selected `RatingPool`. Conflating a bullet result with a classical rating is the core problem this
  spec fixes; cross-contaminating pools reintroduces it.
- **AP-TC-4** — Bot ignores its clock: fixed movetime in bullet (bot never flags / plays too slow and
  flags every bullet game), or the bot's clock not running / not `press()`ed. Budget must scale with the
  bot's remaining time; the bot can flag.
- **AP-TC-5** — Increment applied to the wrong side, or on `tick` instead of on `press` (move
  completion), or gained *after* flagging. Fischer adds time to the mover when the move is completed.
- **AP-TC-6** — Flag-loss asserted while the winner has no mating material (should be a FIDE draw, Q-C=a);
  or over-claiming a draw when mate is still possible (e.g. K+R) — `insufficientMatingMaterial` must be
  conservative (only the provably-no-mate cases).
- **AP-TC-7** — Migration drops or mis-seeds pools: losing the legacy rating, seeding `chess960` eagerly,
  not widening RD, or leaving stale `gameRating`/`opponentTargetElo` fields that desync from the pools.
- **AP-TC-8** — "No clock" silently changing today's untimed behavior (showing a clock, taking a different
  finish path, or rating into a phantom `'unlimited'` pool). Untimed = classical pool + `untimed:true`,
  no clock UI, today's loop verbatim.

## §10 Rollback
All net-new files (`src/clock/Clock.ts`, `src/clock/categories.ts`, optional `src/rating/pools.ts`) +
field-only edits to `db.ts`/`playerModel.ts`/consumers + the Play clock UI. No new object store, no
`DB_VERSION` bump. **Rollback = revert the files**; the `PlayerModel` migration is forward-additive
(legacy records are read by the migration), but reverting after a user has games in non-classical pools
loses those per-pool ratings (the legacy single rating is regenerable from `classical`). To fully revert
post-ship, a down-migration would collapse `gameRatings.classical`→`gameRating`; document but don't build
(YAGNI). Reverting `categoryFor`/`Clock` is free (pure, no persisted state of their own).

## §11 Follow-up
Per-pool rating history + a multi-rating Dashboard (this spec keeps one headline number, Q-F); clock for
the onboarding calibration game (seed each pool from its own measured game later); delay/Bronstein/
simple-delay clocks; low-time sound/visual warnings; time-odds handicaps; emit a PGN `TimeControl` header
on export (reuse the existing parser's string format); a per-pool "your fast vs slow gap" insight; let
Comeback/Sparring optionally run timed (they currently default to the classical pool). The `chess960`
spec consumes `RatingPool` and populates the `chess960` pool + `variant`/`startFen` (no migration conflict
by construction).
