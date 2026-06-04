# Refiner cycle 2 — `calc-drill-redesign`

**Focus:** integrate cycle-1 patches; second-order (consistency, cross-refs, measurable gates, reproducibility).

## Cycle-1 patches applied
- **P1** — fixed garbled SAN build; added pure `formatSanLine` + sequential loop (`§4 A1`, `A3 revealSolution`).
- **P2** — enumerated every `TacticalTrainer` removal (import, `trainer` state, `$effect !trainer→!puzzle`,
  `elapsedMs→startedAt`, status gates→`phase`, `onMove` deleted) (`§4 A3`, AP-CALC-8).
- **P3** — pending-from highlight resolved to chessground native selection; fallback documented (`§4 A3`, Q-A).
- **P4** — `autoShapes` `Key` cast noted (`§4 A2`).
- **P5** — expected-move-in-SAN folded into Q-C (`§4 A3`).
- **P6** — `fmtUci` promotion-drop documented (`§4 A3`).

## Second-order findings (patched this cycle)
- **S4 (completeness)** — reveal `setTimeout` chain could fire onto the next puzzle. Added **Timers &
  guards**: hold the handle, clear in `load()` + `onDestroy` (cf. Vision `blindTimer`). ✔ patched.
- **S3 (correctness)** — `submit()` must ignore/clear a dangling `pendingFrom`. ✔ patched.
- **S1 (cosmetic)** — `formatSanLine` numbers White-first; Black-to-move reveal reads `1.x` not `1...x`.
  Grading unaffected → logged in §11. ✔ noted.

## Consistency / cross-ref audit
| Check | Result |
|---|---|
| §9 anti-patterns referenced by §4 (AP-CALC-6, -8) defined | ✔ |
| §6 gates verify §4 claims (read-only, whole-line grade, undo, reveal, 1 row, rating) | ✔ |
| §8 acceptance ⊇ §6 gates | ✔ |
| Helpers (`firstWrongUserMove`, `formatSanLine`, `fmtUci`) have §5 tests / placement | ✔ |
| Every `Q-?` reference resolved in arbitrages | ✔ (Q-A, Q-B, Q-C) |

## Counts
- Critical defects: **0**
- Polish applied: **6 (cycle 1) + 3 (cycle 2 second-order) = 9**, all integrated.
- Open items: **0 defects** — remaining decisions are user arbitrages (Q-A/B/C), not defects.

## Cycle-3 skip evaluation
`skip_cycle_3 = (cycle_2_critical == 0) AND (cycle_2_open_polish <= 8)` → `(0==0) AND (0<=8)` → **SKIP**.
All polish was applied in-cycle; nothing residual to justify a third pass. Ship V0.2 as **V1**.
