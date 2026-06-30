# Refiner — i18n-label-routing — cycles 1-4

(User requested 4 cycles; `--force` past the cycle-3 skip + decreasing-returns early-stop. Honest note:
yield collapsed after cycle 2 — recorded per cycle below, consistent with the degressive doctrine.)

## Cycle 1 — critical premise validation

| Check | Verdict |
|---|---|
| Leak sites real? | Coach:260 ✓, Tactics:399 ✓ — **Play opponent-style ✗ already translated** |
| Scope obsolete? | Partial: 1 of 3 claimed sites (Play) is a non-leak → **scope corrected, not a full STOP** |
| Foundation premise | Valid: raw keys do reach the UI; resolvers exist (`gt`/`motifLabelOrRaw`) |
| Hidden requirement | `activity.*` / `focus.*` namespaces **missing** → PR must CREATE labels, not only route |

**No critical STOP.** Patches → cycle 2: (P1) drop Play from scope; (P2) reframe scope as "add activity.* + route"; (P3) `focus` is a mixed key/prose field — needs a decision.
Defect count: 3 (all non-critical).

## Cycle 2 — polish + cross-axis

- **Cross-axis catch:** `insights.planItem` (`'{minutes}m · {activity}'`) also renders raw `activity` → **4th site**, folds in (Q-C). Replaces the dropped Play site — net scope stays ~3 sites.
- **`focus` messiness:** values mix motif keys with English prose (`'defend & recover'`, `'opening lines'`) → `motifLabelOrRaw` can't clean it → **arbitrage Q-A** (drop focus from display vs build a focus-label map vs normalize upstream).
- **Theme open-vocabulary:** only 7 `motif.*` exist; trainer themes are dozens → **arbitrage Q-B** (common set + raw fallback vs full vocab vs raw-only).
- **Closed-union completeness:** `activity.*` must cover all 7 union values or a new raw leak appears → AP-I18N-4.
- **Parity gate:** new keys need FR+EN + parity-test extension.
- **Insights byte-identity:** label swap must not touch study-plan data (AP-COACH-1 / AP-I18N-5).

Defect/patch count: 6 (2 arbitrages, 4 auto-folded into spec). All applied to V0.2.

## Cycle 3 — reproducibility (low yield)

- Added the explicit `activity.*` FR/EN value table to §8 so the executor doesn't invent strings.
- Added pre-flight to verify `insights.planItem` actually passes raw `activity` (else drop #4) — avoids a phantom edit.
- Confirmed `tactics.themesEmpty` already guards the empty-themes case (no new edge needed).
Defect count: 2 (polish only). Δ vs cycle 2 ≈ 33% → above the 10% early-stop, continue to 4 as requested.

## Cycle 4 — diminishing returns (as predicted)

- Single nit: clarify `motif.endgame` (a motif key) vs the `focus` string `'endgame conversion'` are distinct — handled by Q-A dropping focus display.
- No new defects; no scope change.
Defect count: 1 (nit). Δ vs cycle 3 ≈ 50% of a tiny base = negligible absolute. **Early-stop criterion met; cycle 4 confirms convergence.** Per §4.4 this is the point /draft-general would normally have stopped at cycle 2 (skip evaluator: cycle-2 critical=0, polish≤8 → would skip 3). Ran 4 by request; documented low yield.

## Summary
- Cycles run: 4/4 (requested). Natural stop would have been cycle 2 (skip evaluator).
- Critical defects: 0. Scope corrections: Play dropped, Insights added.
- Open arbitrages: Q-A (focus), Q-B (theme coverage), Q-C (Insights fold), Q-D (Play drop confirm).
- Spec: `specs/i18n-label-routing-spec.md` V0.4, ready for ratification → V1.
