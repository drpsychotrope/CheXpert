# Refiner — `time-controls` — cycle 2 (consistency / measurability / reproducibility)

**Date:** 2026-06-02 · Spec: `specs/time-controls-spec.md` · Carry-in from cycle 1: 0 critical, 4 minor.

## Consistency
- **C2-1 (CRITICAL→FIXED): tick-loop vs bot "thinking".** §4.3 + AP-TC-4 require the **bot's clock to run
  while it thinks**, but §4.6's loop guard said the loop runs only while `status==='playing'`. In
  `Play.svelte` the bot moves during `status==='thinking'` — so as written the bot's clock would freeze
  during its own turn, contradicting §4.3/AP-TC-4 and making "the bot can flag" impossible.
  **Fix applied:** loop now runs while `status` is `'playing'` **or** `'thinking'`; added the rationale
  (`tick` decrements only `clock.side`, which `press` flips to the bot's side on the player's move). This
  was the one internal contradiction that would have produced a wrong implementation; resolved.
- **C2-2 (minor→FIXED): selector enable window.** Selector said "disabled mid-game (`status==='playing'`)"
  — but a game is also live during `'thinking'`. Changed to disable while `'playing'` **or** `'thinking'`,
  re-enable at `'idle'`/`'over'`. Consistent with C2-1.
- **C2-3 (minor→FIXED): `flagged` wording.** JSDoc said "time has hit 0"; the rule text and tests use
  `≤ 0`. Aligned the JSDoc to `≤ 0` (a single deep tick can overshoot to negative before clamp, and
  `tick` clamps to ≥0, so `≤ 0` ≡ `=== 0` post-clamp, but the spec is now unambiguous).
- **C2-4 (minor→FIXED): `botMovetime` arg ambiguity.** `clock.blackMs|whiteMs` read like bitwise-OR.
  Replaced with explicit `clock[botSide]`, `botSide = playerColor==='white' ? 'blackMs' : 'whiteMs'`.
- **Ownership/contract consistency re-checked:** `RatingPool` (incl. `chess960`), the reshape field names
  (`gameRatings` / `opponentByPool`), the value shapes, the GameRecord/Settings additions, and "no
  `DB_VERSION` bump" all match `reports/specs-batch-3_scan.md` verbatim. `opponentByPool` value
  `{ targetElo, recent }` ≡ `OpponentState` → `recordGame`/`initOpponentState` reused unmodified. ✔
- **Q-F read sites re-verified against code:** `Dashboard.svelte:27`, `Home.svelte:15-16`,
  `Insights.svelte:30`, `db.test.ts:52` all reference `model.gameRating(.rating/.rd)` → the spec's 1:1
  swaps to `poolRating(m,'classical')` are exact and complete. ✔

## Measurability
- §6 acceptance gates are objective: `npm test` green incl. the 3 named test files, no regression vs the
  135 baseline, `svelte-check` clean, build green, plus 5 reproducible manual checks (migration smoke,
  per-pool isolation, flag-draw, untimed-unchanged, lastTimeControl persistence). ✔
- §5 unit assertions are concrete (decrement-only-running-side, clamp-at-0, increment-on-press,
  no-increment-after-flag, per-band `categoryFor` mapping incl. boundary values 178/179, 478/479,
  1498/1499, the `insufficientMatingMaterial` truth table, migration RD-widen ≥150). All checkable. ✔
- §8 acceptance criteria each map to a §5 test or §6 gate. ✔

## Reproducibility
- Every new file path, function signature, and the migration algorithm are spelled out; an implementer
  can build without re-deriving. The `categoryFor` thresholds + the preset list make the band test
  reproducible. `botMovetime` constants are explicit (and flagged Q-D). ✔
- The pure cores carry no hidden time/random source (AP-TC-1); the Play loop is the sole `performance.now`
  reader. Deterministic tests reproduce on any machine. ✔

## Defects remaining after cycle 2
- **0 critical.** Polish-level (not requiring an edit): C1-2 (`botMovetime` constants are directional, not
  load-bearing — Q-D), C1-1 (Play is White-only; clock labels assume it — acceptable, documented),
  the optional `budget.test.ts` (spec marks it optional). Count of open polish items: **3**.

## Cycle-2 verdict
1 critical consistency defect found **and fixed** (C2-1 tick-loop) plus 3 minor fixes (C2-2/3/4). After
fixes: **0 critical, 3 polish**. Per the stop rule (cycle 2 ends with 0 critical AND ≤8 polish) → **skip
cycle 3**. Spec is V1-ready.
