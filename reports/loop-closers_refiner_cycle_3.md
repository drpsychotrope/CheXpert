# Refiner cycle 3 — loop-closers (second-order / edge cases)

- P8: Missed-win + existing-mistake dedup — a ply could match both filters; the shared `seen`/`fenBefore` set already dedups, but the `meta.kind` should prefer 'mistake' when severity is mistake/blunder (only tag 'missed-win' for the *newly added* decisive-but-not-flagged plies). (clarified §4.1)
- P9: Comeback "playable dip" selection — exclude positions already lost beyond recovery (e.g. cp ≤ −900 / forced mate against) so the drill isn't hopeless; pick dips in a defensible band. → refine `comebackPositions` filter (AP-CHESS-40).
- P10: Shared file `app.svelte.ts` touched by both 3b and 3c (state field + View union) → if split, 3b lands the state field, 3c lands the View arm; sequence to avoid churn (noted in collision.json).
- P11: Timed-Tactics countdown must pause/stop on solve and not double-grade with the FSRS `finish()` path. (clarified §4.2)

## Counters
critical 0, polish 4 (edge/sequencing). Delta ≈ flat.
