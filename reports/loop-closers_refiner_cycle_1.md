# Refiner cycle 1 — loop-closers (critical premise validation)

## Critical defects
**None blocking** — all targets exist, data present, AdaptiveOpponent usable. BUT:

## Scope finding (headline arbitrage, not a stop)
The invocation bundles **three separable concerns**:
- 3a missed-win mining (generatePuzzles.ts only) — small.
- 3b drill routing (Dashboard + state + timed Tactics) — small/moderate.
- 3c comeback drills (new view + resilience entry-FEN + engine loop) — large.
Single-concern doctrine (skill §3.4) ⇒ recommend **ROUTE B split into 3 PRs**, order 3a→3b→3c.
→ **arbitrage Q-A**. Spec written as a decomposing meta-spec so each sub-scope extracts cleanly.

## Non-critical patches → cycle 2
- P1: Missed-win trigger needs flood control (a permanently-winning game must not spawn dozens) → DECISIVE_CP + MISSED_WIN_MIN_WPL + per-game cap. **arbitrage Q-B**.
- P2: `resilienceScore` discards the entry FEN; 3c needs a sibling selector that returns it. (clarified §4.3)
- P3: Comeback grading method (outcome vs eval-recovery probe) → **arbitrage Q-C**.

## Verdict
Proceed (no hard stop; premise valid). 0 critical, scope-split + 3 non-critical.
