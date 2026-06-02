# Refiner cycle 2 — `critical-moment-drill`

**Date:** 2026-06-02 · **Focus:** integration consistency, cross-references, measurability,
reproducibility. **Verdict:** 0 critical defects; 6 polish patches applied (≤ 8). **Cycle 3 skipped.**

## Cycle-1 propagated items — resolution
| Id | Item | Resolution |
|---|---|---|
| C2-1 | `labelPly` `null` return not in signature | **Applied** — signature now `DrillLabel \| null` in §2 bullet, §4.1 fn doc, and the `routineLoss` JSDoc names the ambiguous band. |
| C2-2 | Mount/fallback rand consistency + order | **Applied** — §4.2 now states own-games-first, fallback only on **0 items**, fallback fed through the **same** `buildDrillSet`/`scoreCall` path with `Math.random` injected identically. |
| C2-3 | Grep guard vs Q-G *replace* (weakness.ts edit) | **Verified consistent** — §6 guard targets engine/dep/schema only (weakness.ts edit is allowed); §4.3, §8 (acceptance) + §10 (rollback) already branch on Q-G. No edit needed. |
| C2-4 | `excludeRecaptures` must not drop CRITICAL | **Applied** — filter now explicitly "drop a **ROUTINE** ply (never a CRITICAL one — a recapture can itself be a blunder)." |
| C2-5 | Balance graceful-degrade | **Applied** — §4.1 now "best-effort, never empty-on-imbalance": top up from the larger side; AP-CMD-7 reworded to "balance when possible + always shuffle." |
| C2-6 | ROUTINE reveal copy honesty | **Applied** — §4.2 reveal states the small swing as a number, doesn't call near-threshold ROUTINE "trivial." |

## Cross-axis checks (cycle-2 native)
- **§3↔§4 coverage:** every pre-flight gate maps to a §4 dependency (`criticalMoments`/`PlyAnalysis`
  fields → §4.1; `explainPly` → §4.2; `Board viewOnly` → §4.2; `View`/App route → §4.3; fallback pure
  import → §4.2/Q-E). PASS.
- **§4↔§5 coverage:** every selector behaviour in §4.1 has a §5 test (labelPly thresholds + null band;
  player-to-move-only; balance + top-up; shuffle determinism via seeded rand; recapture filter on/off;
  dedup; scoreCall both directions; no-`Math.random`/`Date.now` source guard). PASS.
- **§4↔§6/§8 guards:** "no engine / no dep / no schema / read-only board / no accuracy grade" each map
  to an AP-CMD and an acceptance line. PASS.
- **Anti-patterns ↔ body:** AP-CMD-1..8 each trace to a concrete §4 decision or §6 guard. AP-CMD-2
  (no "only-move" claim) is reinforced in §0.5, §4.1, §4.2 reveal copy. PASS.
- **Honesty doctrine:** no global grade; tally framed as practice (mirrors comeback AP-CHESS-43 /
  ADR-0021 no-accuracy-grade). PASS.
- **Schema:** confirmed zero `DB_VERSION`/store changes; positions derive on the fly (matches the
  authoritative data-model contract in the batch scan). PASS.
- **Reproducibility:** a fresh executor can build the selector from §4.1 alone (types + the three fn
  contracts), and the seeded-rand test makes the shuffle deterministic. PASS.

## Residual (deferred to user as arbitrages, not defects)
All seven open arbitrages (Q-A..Q-G) are *value judgements*, correctly surfaced rather than decided.
None block execution; each has a recommendation in the arbitrages bundle.

## Cycle-3 skip evaluation
```
skip_cycle_3 = (cycle_2_critical_count == 0) AND (cycle_2_polish_count <= 8)
             = (0 == 0) AND (6 <= 8) = TRUE
```
Cycle 2 surfaced 0 critical defects and 6 polish patches (all applied). Decreasing-returns also met
(cycle 1 → cycle 2 introduced no new critical findings). **Cycle 3 skipped** — see
`reports/critical-moment-drill_cycle_3_skipped.json`. Spec promoted V0.2 → **V1**.
