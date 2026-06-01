# Refiner — engine-perf (3 cycles)

## Cycle 1 — critical premise + licensing
0 code-critical, but **1 decision-critical**: adopting the MT build escalates GPL-3.0 → **AGPL-3.0**
(ADR-0004), which matters if the app is distributed/hosted (ADR-0002 = local-only). Surfaced as the
headline **arbitrage Q-A** (accept AGPL for speed vs stay lite). Not a code defect — a user call.
- P1: MT must be a runtime fallback, never hard-required (no SharedArrayBuffer ⇒ lite) → AP-CHESS-65.
- P2: verify the `stockfish` package contains an MT build before relying on it (pre-flight gate).

## Cycle 2 — polish + cross-axis
- P3: COEP `require-corp` can break the cross-origin **Syzygy fetch** (lichess tablebase) → must verify/handle → AP-CHESS-66, §4.4.
- P4: dev/preview also need the headers (vite.config) or MT only works in the .exe → **arbitrage Q-B**.
- critical 0, polish 2.

## Cycle 3 — second-order
- P5: ADR-0032 MUST record the AGPL distribution obligation explicitly → AP-CHESS-67.
- P6: use MT for analysis; opponent moves are already snappy on lite — MT helps batch analysis most → **arbitrage Q-C** (MT for both vs analysis-only).
- Decreasing returns. V1 ready pending Q-A..Q-C. **Q-A is a prerequisite** (if "stay lite", the spec is a no-op / docs-only).
