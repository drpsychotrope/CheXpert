# Refiner — metacognition · cycle 2 (polish + cross-axis)

**Verdict: 0 critical, 4 polish applied.** Cross-spec axis clean. Cycle-3 skip-check: see foot.

## Applied (from cycle-1 carry + new)
- **P1 → fixed.** Review-writer hedges replaced with grep-verified fact: only `Tactics.svelte` writes
  `puzzleAttempts`; Review only reads it. "Review chips deferred" is now a firm default, not conditional
  prose. (§4 Review bullet rewritten.)
- **P2 → fixed.** Calculate's Q-C=a side effect (calc attempts begin to be logged for the first time) is
  now explicit in §8 acceptance with a one-attempt/no-duplicate guard. ADR §7 already records it. (§8.)
- **P3 (verdict well-definedness).** The four verdict branches were not provably mutually exclusive (a
  `sure`-accuracy-0.85 AND high-`guess` case could match both `well-calibrated` and `underconfident`).
  Rewrote as an **ordered** decision (overconfident → well-calibrated → underconfident → mixed) with
  precedence stated, and §5 will assert each branch independently. (§4 verdict block.)
- **P4 (test alignment).** §5 verdict test already says "use exactly the Q-B thresholds, assert each
  branch" — now matches the ordered ruleset. No further change needed; flagged for the implementer to
  follow branch order.

## Cross-axis (batch-3 shared contract)
- **Ownership clean.** `metacognition` owns ONLY the two optional `PuzzleAttemptRecord` fields +
  `metacogEnabled` on `SettingsRecord`. It does NOT touch `PlayerModel`/`RatingPool` (owned by
  `time-controls`), `GameRecord`, or any object store. Zero overlap with the other 5 specs. No migration
  conflict regardless of ship order.
- **No DB_VERSION contention.** This spec adds no store → does not participate in the v4→v5 bump that
  `efficacy-session` might trigger. Independent. (AP-META-7.)
- **SettingsRecord additivity** shares the ADR-0035 `opponentStyle` pattern (`?? default`). If
  `time-controls` also adds `lastTimeControl?` to `SettingsRecord`, both are additive optional fields —
  no conflict (same as the existing precedent).
- **No new dependency** (scan §2.5) — pure TS + existing idb reads. Confirmed.

## Polish-count this cycle: 4 (0 critical).
## Cycle-3 skip evaluator: cycle 2 had 0 critical AND polish ≤ 8 → **cycle 3 SKIPPED** per
draft-general stop rule (skip-cycle-3 if cycle 2 clean ≤ 8 polish). V1 ready pending Q-A..Q-H.
