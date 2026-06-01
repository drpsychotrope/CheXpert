# Specs batch 2 — index (6 specs, 3 cycles each)

From "what else to add" → 11 proposals consolidated into **6 domain specs**. Maia-WASM **deferred**
(your choice; ADR-0019 stays — spike on request). 3 refiner cycles each. ADR 0027–0032, AP-CHESS 48–67.

## Specs (dependency order)
| # | Spec | Bundles | ADR | Key arbitrage |
|---|---|---|---|---|
| A | [weakness-intelligence](../specs/weakness-intelligence-spec.md) · [arb](weakness-intelligence_arbitrages.md) | #1 fingerprint + #2 plan + #10 trend | 0027 | leak→activity map; trend windowing |
| B | [openings](../specs/openings-spec.md) · [arb](openings_arbitrages.md) | #3 repertoire-gap + explorer | 0028 | ECO footprint; explorer depth |
| C | [practice-mechanics](../specs/practice-mechanics-spec.md) · [arb](practice-mechanics_arbitrages.md) | #4 calc + #5 vision + #6 scheduler | 0029(+) | **split 3a/3b/3c**; calc grading |
| D | [scenario-sparring](../specs/scenario-sparring-spec.md) · [arb](scenario-sparring_arbitrages.md) | #7 | 0030 | sources (library + your games) |
| E | [analysis-board](../specs/analysis-board-spec.md) · [arb](analysis-board_arbitrages.md) | #8 MultiPV + positional | 0031 | engine budget; variation model |
| F | [engine-perf](../specs/engine-perf-spec.md) · [arb](engine-perf_arbitrages.md) | #9 multi-thread | 0032 | **AGPL decision (prereq)** |

Execution order: **A → B → C → D → E → F** (D reuses A's fingerprint; F has the AGPL prerequisite Q-A; C recommended split into 3 PRs).

## Cross-cutting (held throughout)
Local-only · no-LLM · no backend · reuse existing infra (analyzeLines, AdaptiveOpponent, Board, FSRS, weakness.ts, Comeback loop) · honesty doctrine (assert only what's proven). Only F bends a constraint (MT engine = AGPL) — gated by Q-A.

## Decisions needed
Each spec's arbitrages bundle has its Q's with recommendations. Fastest: reply **`accept all reco`** (incl. F Q-A=a: adopt MT, AGPL dormant under local-only), or per-spec e.g. `A: all reco · F: Q-A b (stay lite)`.

## Notable forks to actually decide
- **C-Q-A**: split practice-mechanics into 3 PRs (reco yes).
- **F-Q-A**: adopt multi-thread engine = accept AGPL-3.0 obligation *if ever distributed* (reco yes — dormant under ADR-0002 local-only). If no → F drops to docs-only.
- **Maia-WASM**: deferred; say "spike Maia" to spec a feasibility spike.

## Status
All 6 specs V1, decisions surfaced. No code written. On your decisions → I apply final V1 patches (+ split C if chosen), then execute in order with TDD (as batch 1).
