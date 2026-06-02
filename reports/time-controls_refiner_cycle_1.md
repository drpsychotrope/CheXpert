# Refiner — `time-controls` — cycle 1 (premise / critical defects)

**Date:** 2026-06-02 · Spec: `specs/time-controls-spec.md` · Reviewer pass: self-read against the
authoritative contract (`reports/specs-batch-3_scan.md`) and the code anchors.

## Premise check (is the spec solving the right problem the right way?)
- **Premise sound.** The single `gameRating`/`opponentTargetElo`/`recentOutcomes` model genuinely
  conflates bullet and classical skill; per-pool ratings + a per-pool adaptive bot is the correct fix and
  matches the Lichess model named in the brainstorm (scan §2.3). Confirmed net-new (scan §2.1).
- **Ownership boundary correct.** Spec defines `RatingPool` (incl. `chess960`) + the `PlayerModel`
  migration here, leaves `variant`/`startFen` + `chess960`-pool population to the `chess960` spec — exactly
  the contract's ownership split. No migration conflict by construction. ✔
- **No-bump migration correct.** Field reshape on an existing store → migrate in the load path, no
  `DB_VERSION` bump (contract rule). Spec states this in §0, §4.4, AP-TC-2. ✔
- **Pure-core discipline honored.** `Clock`/`categories` are Date-/Math.random-free; the caller (Play
  loop) injects elapsed via `performance.now()`. Mirrors the existing `humanMove.ts` `rand` injection. ✔
- **Engine plumbing verified against code.** `EngineClient.evaluate(fen,{movetime})`,
  `pickMove(fen, movetime)`, `pickHumanMove(fen, movetime)` already accept a movetime → clock-aware budget
  needs **no** engine change. `recordGame`/`initOpponentState` are module functions and
  `OpponentState = { targetElo, recent }` is byte-for-byte the contract's `opponentByPool` value shape →
  per-pool reuse is free. ✔

## Critical defects
**None.** No premise-breaking or structural defect. Proceed to cycle 2 (no escalation).

## Defects / fixes (this cycle)
- **C1-1 (minor → fixed inline mentally; confirm in cycle 2):** §4.6 says the player clock display is
  "bottom = player" but Play hardcodes `playerColor = 'white'`. Since the player is always White today and
  the bot Black, "top = bot (black), bottom = player (white)" is consistent — **but** the spec should not
  imply colour-flips it doesn't support. *Resolution:* acceptable as-is (Play is White-only); noted so
  cycle 2 doesn't re-flag. No spec edit needed.
- **C1-2 (minor):** The `botMovetime` floor/ceil bounds and `movesLeft` floor (8) are invented constants.
  Spec correctly frames them as Q-D arbitrage and tunable; they are directional, not load-bearing for
  correctness. No fix; surfaced as Q-D.
- **C1-3 (clarity):** `insufficientMatingMaterial` lists "K + same-colour bishops" as a draw. FIDE Art.
  6.9 is "cannot be checkmated by **any** series of legal moves" — K+2 same-colour B is indeed
  no-mate; K+B+N **can** mate (correctly excluded by returning false for anything richer). The spec's
  conservative "only provably-no-mate cases" framing is correct. No fix.
- **C1-4 (consistency, defer to cycle 2):** Q-F says Dashboard/Home/Insights read the **classical** pool.
  Verified the three exact read sites (`Dashboard.svelte:27`, `Home.svelte:15-16`, `Insights.svelte:30`)
  all read `model.gameRating.rating` today → mapping each to `poolRating(m,'classical').rating` is a clean
  1:1 swap. List is accurate. ✔ (re-confirm measurability in cycle 2).

## Cycle-1 verdict
Premise solid, ownership + migration + purity all consistent with the contract and the code. **0
critical**, 4 minor/clarity (none requiring a spec edit this cycle). Continue to cycle 2.
