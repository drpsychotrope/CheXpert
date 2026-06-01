# Refiner cycle 2 — loop-closers (polish + cross-axis)

- P4: Missed-win tag must NOT invent a non-Lichess theme string (consistency with spec 1 AP-CHESS-29) → use `meta.kind:'missed-win'`, keep themes from motif. (auto-applied §4.1, AP-CHESS-44)
- P5: `tacticsTimed` is a new global-state flag like `tacticsFilterThemes`; must reset on `clearDrill` or it leaks into normal play → **AP-CHESS-39** + §4.2.
- P6: Comeback must play vs the player's **ZPD Elo**, not full-strength — defending −3 vs perfect play is just lost and demoralising → **AP-CHESS-40/41** + §4.3.
- P7: The current code routes opening/endgame weakness into Tactics; this PR's whole point is fixing that → encode as **AP-CHESS-42** so it isn't "simplified" back.

## Cross-axis
- §4 sub-scopes ↔ §8 acceptance: each of 3a/3b/3c has its own AC line. §5 splits tests by sub-scope.
- §10 rollback split per sub-scope; confirmed **no IndexedDB migration** (comeback positions derive from stored analyses).

## Counters
critical 0, polish 4. (Skip-3 overridden — user wants 4.)
