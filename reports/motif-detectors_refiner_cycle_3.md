# Refiner cycle 3 — motif-detectors (second-order / edge cases)

(Cycle 3 not skipped — user forced 4 cycles.)

- P9: Promotion edge — if `bestUci` promotes (e.g. a pawn becomes a queen that pins), the moved-piece
  type must be read from `fenAfter@to`, not `fenBefore@from` → §4 preamble + **AP-CHESS-28**.
- P10: Castling/en-passant as `bestUci`: the king's `from` won't reveal the teleported rook;
  en-passant removes a pawn off the `to` square. Documented as non-detection (rare as a "missed
  tactic"), must not crash or mis-tag → **AP-CHESS-30**.
- P11: Performance — confirmed detectors add **no** engine calls (run on already-flagged plies, pure
  chess.js geometry). No movetime budget impact.
- P12: Added **AP-CHESS-31** — a new detector must never bypass/downgrade the low-confidence fallback
  for positions it can't classify.

## Counters
critical = 0, polish = 4 (mostly edge-case guards). Delta vs cycle 2 ≈ flat.
