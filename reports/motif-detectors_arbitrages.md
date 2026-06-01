# Arbitrages: motif-detectors

## Critical structural defects (cycle 1 stops)
None. Premise validated — ADR-0007 explicitly sanctions this as the "later pass" extension.

## Decisions requested from user

### Q-A: Primary-tag precedence when several detectors fire
A single best move can be (say) both a fork and a discovered attack. `tags[0]` drives the headline.
**Options**
- (a) `mate > doubleCheck > fork > skewer > pin > discoveredAttack > hangingPiece` — most-forcing first.
- (b) Order by material won (re-rank by captured value) — needs the Q-B re-check.
- (c) Keep insertion order (hanging → fork → pin → skewer → discovered → double).
**Refiner recommendation**: (a) — forcing-ness is a stable, engine-free proxy for "the point"; cheap and predictable.

### Q-B: Material-relevance gate
**Options**
- (a) Geometric presence + valuable-target (≥3) / king filter is enough — matches the existing fork/hanging precedent (no engine).
- (b) Additionally re-evaluate with MultiPV to confirm the motif actually wins, before tagging — fewer "motif present but not the point" cases, but couples motif.ts to the engine and adds latency.
**Refiner recommendation**: (a) — keeps motif.ts pure/synchronous and consistent with fork/hanging; the MultiPV uniqueness gate in generatePuzzles already filters unscoreable puzzles downstream.

### Q-C: Relative pins
**Options**
- (a) Tag relative pins when `VALUE[back] > VALUE[front]` **and** `VALUE[back] >= 5` (rook/queen behind) — plus all absolute pins.
- (b) Absolute pins only (back == king) — maximally conservative, zero false "soft pin".
**Refiner recommendation**: (a) — a minor pinned in front of a rook/queen is a real, certain, instructive pin; the `>=5` floor avoids noisy pawn-level "pins".

## Auto-applied patches (no user input needed)
- Tag strings = exact Lichess theme keys (AP-CHESS-29).
- `doubleCheck` = direct + discovered composition, not chess.js `attackers()` (1.4.0).
- Clear-ray + `attacksSquare` geometry helpers (§4.1).
- Moved-piece type read from `fenAfter@to` (promotion-safe, AP-CHESS-28).
- Castling/en-passant documented as non-detection (AP-CHESS-30).
- Low-confidence fallback path provably untouched (AP-CHESS-31, AC#4).
- Phase Z appends ADR-0020 cross-linking ADR-0007 (append-only).

## Stop status
- Cycles run: 4/4 (user-forced `--max-cycles 4 --force-cycle-3`)
- Stop reason: cycles complete; decreasing returns reached at cycle 4 (skip evaluator would have stopped at cycle 2)
- Final spec: `specs/motif-detectors-spec.md`

## Next steps
1. Read Q-A / Q-B / Q-C above.
2. Reply with decisions (e.g. `motif Q-A: a, Q-B: a, Q-C: a`).
3. Drafter applies them as a final V1 patch (ADR-0020 records the choices).
4. Spec is then ready to execute.
