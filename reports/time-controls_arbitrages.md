# Arbitrages — `time-controls` (user decisions)

Spec: `specs/time-controls-spec.md` · Date: 2026-06-02 · 2 refiner cycles (cycle 3 skipped, 0 critical).
Each item: the open question, the options, and the spec's recommendation with rationale. The spec is
written to the recommended option; switching to the alternative is a localized change noted per item.

---

## Q-A — Exact preset list
**Options:**
- (a) Bullet 1+0 / 2+1 · Blitz 3+2 / 5+0 · Rapid 10+0 / 15+10 · Classical 30+0 · No clock · Custom. *(seed)*
- (b) Fewer (one per band) or more (add 0.5+0 hyperbullet, 60+0 classical, etc.).

**Recommend (a).** Lichess-aligned, exactly two presets across the speed bands users actually play, one
classical, plus No clock + Custom. Each lands cleanly in its `categoryFor` band (tested). Easy to extend
later (the table is data). *Switch cost:* edit `TIME_CONTROL_PRESETS` only.

## Q-B — "No clock" pool model
**Options:**
- (a) Store untimed games as `category:'classical', untimed:true`; rate into the **classical** pool.
- (b) Add a 6th `'unlimited'` RatingPool member; untimed games get their own rating.

**Recommend (a).** Keeps `RatingPool` to the 5 contract members (the contract names exactly
`bullet|blitz|rapid|classical|chess960`); preserves today's untimed-Play behavior and rating continuity
(today's single rating ≈ "classical/untimed"); avoids inventing a rating for a skill we don't separately
measure (honesty doctrine). *Switch cost:* (b) means amending the **contract-owned** union (coordinate
with `chess960`), the migration, and `poolRating` fallbacks — heavier; not recommended.

## Q-C — Flag when the other side has insufficient mating material
**Options:**
- (a) **FIDE Art. 6.9:** flag vs a side that cannot possibly mate = **draw**.
- (b) Always-loss on flag (simpler; ignores material).

**Recommend (a).** Correct chess; the cost is one small pure helper `insufficientMatingMaterial(fen,side)`
(bare K, K+single minor, K+same-colour bishops) that is fully unit-tested and conservative (only
provably-no-mate cases → draw; richer material → loss). *Switch cost:* (b) drops the helper + its test
and makes `onFlag` always a loss — trivial but less correct.

## Q-D — `movesLeftEstimate` for the bot's per-move budget
**Options:**
- (a) Phase-aware: `movesLeft = max(8, 40 - floor(ply/2))`, `budget = clamp(remainingMs/movesLeft,
  floorMs, ceilMs)` with per-category bounds (bullet [40,250], blitz [80,500], rapid [150,1200],
  classical [200,2000] ms).
- (b) A fixed constant (e.g. `movesLeft = 30`) regardless of phase.

**Recommend (a).** Mimics a real engine time-manager (spend less as moves accrue, never burn the whole
clock), keeps the bot snappy in bullet/blitz and thoughtful in classical, and the bounds prevent both
flag-by-slowness and instant moves. These are **directional** constants (not correctness-load-bearing) —
tune by feel during manual verification. *Switch cost:* either is a one-line change in `botMovetime`.

## Q-E — Switching time control mid-session: reset the bot pool's Elo?
**Options:**
- (a) **No** — each pool keeps its own persisted `opponentByPool[pool].targetElo`/`recent`.
- (b) Reset the new pool's bot Elo to the player's pool rating on switch.

**Recommend (a).** Per-pool independence is the whole point: your blitz bot and classical bot should
diverge with experience. A fresh/unseeded pool already falls back via `poolOpponent` (nearest seeded pool
→ then 1500). *Switch cost:* (b) adds a reset call in `newGame` — small, but discards learned per-pool
calibration; not recommended.

## Q-F — Which rating(s) the Play header / Dashboard show
**Options:**
- (a) Play header shows the **selected pool's** rating; Dashboard/Home/Insights show **one headline
  number = the classical pool** (no multi-rating UI redesign in this spec).
- (b) Dashboard shows all pools (mini rating table) now.

**Recommend (a).** The selected-pool number in Play is the contextually right one; mapping the three
existing single-rating read sites (`Dashboard.svelte:27`, `Home.svelte:15-16`, `Insights.svelte:30`) to
`poolRating(m,'classical')` is a clean 1:1 swap and keeps this spec scoped to clocks + the rating split,
not a dashboard redesign (deferred §11). *Switch cost:* (b) is a Dashboard/Home layout change — defer to
the follow-up multi-rating view.

---

## Cross-spec dependency
`time-controls` **owns** and defines the `RatingPool` union (incl. the `chess960` member, left
unpopulated here) + the `PlayerModel` reshape/migration + `GameRecord.timeControl` +
`SettingsRecord.lastTimeControl`. The **`chess960` spec consumes** `RatingPool` and only *populates* the
`chess960` pool (lazily, on the first 960 game) and *adds* `variant`/`startFen` to `GameRecord`. Because
ownership is split this way, shipping both produces **no migration conflict** (per the authoritative
contract in `reports/specs-batch-3_scan.md`). Recommended ship order keeps `time-controls` **first**.

## Note on doctrine
No backend, no LLM, no new dependency (chess.js already provides material checks; `Clock` is pure TS).
Pure cores (`Clock`, `categories`, migration helpers, `botMovetime`) carry no `Date.now`/`Math.random`;
the Play loop injects elapsed via `performance.now()`. The per-TC rating is honest directional signal —
no fake accuracy grade. New ADR is **ADR-0036**, appended at implementation time (not by this spec).
