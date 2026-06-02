# Refiner cycle 1 — `critical-moment-drill`

**Date:** 2026-06-02 · **Focus:** §4.1 premise/foundation validation (critical-defect detection).
**Verdict:** No critical (STOP-level) defect. Premise is sound on the available stored data. 1 patch
applied, 1 precision patch applied, 6 items propagated to cycle 2.

## Critical-defect scan (§4.1 table)
| Defect class | Finding | Verdict |
|---|---|---|
| Scope obsolete | `whenToThink` absent in `src/` (batch scan §2.1); net-new selector + view. | PASS |
| Path stale | All anchors exist and expose the cited APIs (`criticalMoments.ts`, `explain.ts`, `EvalGraph.svelte`, `app.svelte.ts`, `Dashboard.svelte`, `weakness.ts`, `guess/games.ts`). | PASS |
| Foundation premise wrong | **Verified** the load-bearing claim: `BatchAnalyzer` calls `engine.evaluate()` once per position (ADR-0006) → stored `PlyAnalysis` has `bestWhiteCp`/`playedWhiteCp` but **no second-best line**. `analyzeLines` confirmed present only in `AnalysisBoard.svelte`, `EngineClient.ts`, `AdaptiveOpponent.ts`, `generatePuzzles.ts` — **not** in `BatchAnalyzer.ts`. The "uniquely-best margin" idea is therefore not computable from stored data; spec is (correctly) drafted on `winProbLoss`. Documented as §0.5 + Q-B, not silently assumed. | PASS (constraint, not defect) |
| Schema/metric non-canonical | Uses `winProbLoss` exactly as defined (winProb.ts, mover-POV) and the existing `side` tagging from `criticalMoments.ts`. Consistent with the authoritative data-model contract (batch scan): no schema bump. | PASS |
| Inferred values w/o empirical block | All numbers (`minLoss=10` default, thresholds, `View` count, `drillTarget` shape, `MASTER_GAMES` un-analysed) cite §1 baseline / anchor reads. | PASS |

No `reports/critical-moment-drill_critical_escalation.md` written — loop continues to cycle 2.

## Patches applied this cycle
1. **Recapture heuristic precision (P1, applied).** §4.1 ROUTINE filter said "the immediately preceding
   ply also captured on the same square." Verified `uci = from+to+promo` (pgn.ts) so `uci.slice(2,4)` is
   the destination, and `captured` is populated from chess.js verbose history (reliable). The sound test
   is: this player ply has `captured != null` **and** `plies[i-1].uci.slice(2,4) === ply.uci.slice(2,4)`
   (the opponent's prior move *landed on* the square we now take back). Edited wording to "the
   immediately preceding ply **moved to** the same square" and noted `plies[i-1]` is in scope because
   `buildDrillSet` holds the full `plies` array while iterating player plies. (Applied to the spec.)

## Non-critical → propagate to cycle 2
- **C2-1** `labelPly` returns `DrillLabel | null` but §4.1 types only declare `DrillLabel`; the `null`
  (ambiguous-band) return must be reflected in the signature/return type for a fresh reader.
- **C2-2** §4.2 mount path: `buildDrillSet(analyses, Math.random, {})` — confirm the fallback (Q-E)
  branch also injects rand consistently, and state the order (own-games first, fallback only if empty).
- **C2-3** Cross-check §6 grep guard vs §4.3 *replace* variant (Q-G=b): if `weakness.ts` is edited, the
  "no engine import added" guard is fine, but the diff *does* touch `weakness.ts` — make the rollback +
  acceptance wording handle both Q-G branches without contradiction.
- **C2-4** `excludeRecaptures` only filters ROUTINE; confirm it never drops a CRITICAL recapture
  (a recapture *can* be a blunder). State explicitly that the filter applies to ROUTINE candidates only.
- **C2-5** Balance math: with `max=12` and `ceil(max/2)=6` per side, but a player who only has CRITICAL
  data (rare) yields an unbalanced set — confirm graceful degrade (fill from whichever side has items,
  still shuffled) and that AP-CMD-7 is satisfied "best-effort" not "hard 50/50 or empty."
- **C2-6** Reveal copy for a ROUTINE truth must avoid implying the position was *trivial* when the
  exclusion is off (a near-threshold ROUTINE at `winProbLoss≈3` still had a little at stake) — tighten
  §4.2 wording.

## Decreasing-returns tracker
Cycle 1 defect count: 0 critical, 1 applied patch, 1 precision, 6 propagated. Proceed to cycle 2.
