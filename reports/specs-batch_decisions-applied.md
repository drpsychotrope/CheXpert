# Decisions applied — specs batch (2026-06-01)

User: **all default arbitrages accepted**; UI integration must be simplest / most user-friendly;
**avoid external manipulations**.

## Cross-cutting UX ruling
The only external manipulation in the loop was **copy PGN → paste into Import** (Play.svelte:217 tip).
Eliminated by a new enabler spec **`played-game-review`** — one-click "Analyse this game" on Play's
game-over screen, reusing the existing `runAnalysis` pipeline (`source:'played'`), via a shared
`AnalysisResult.svelte` (which embeds `eval-graph`'s `EvalGraph`). Paste-import stays only for external games.

## Final spec set + execution order
| # | Spec | ADR | Notes |
|---|---|---|---|
| 1 | [motif-detectors](../specs/motif-detectors-spec.md) | 0020 | foundation; richer puzzle themes |
| 2 | [eval-graph](../specs/eval-graph-spec.md) | 0021 | build `EvalGraph`; player-POV curve, top-5 moments, mini-board |
| 3 | [played-game-review](../specs/played-game-review-spec.md) | 0022 | extract `AnalysisResult`, one-click in-app analysis (no paste) |
| 4 | [missed-win](../specs/missed-win-spec.md) | 0023 | `mate OR bestCp≥500, wpl≥3, cap 3`; `meta.kind:'missed-win'` |
| 5 | [drill-routing](../specs/drill-routing-spec.md) | 0024 | every dim one-click to right view; timed Tactics |
| 6 | [comeback](../specs/comeback-spec.md) | 0025 | outcome-graded vs adaptive bot; Dashboard-Drill entry |

`loop-closers-spec.md` retained as shared-context reference (split into 4–6).

## Catalogs
- AP-CHESS: motif 25–31 · eval-graph 32–37 · missed-win 38/44 · time/drill 39/42 · comeback 40/41/43 · played-game-review 45–47.
- ADR: 0020–0025.

## Accepted decision values
- motif: Q-A precedence `mate>double>fork>skewer>pin>discovered>hanging` · Q-B geometric (no re-eval) · Q-C relative pins (`back>front`, `back≥5`) + absolute.
- eval-graph: Import + read-only mini-board · top 5 (`wpl≥10`) · both sides distinguished · player-POV.
- missed-win: `mate OR moverPOV bestCp≥500`, `wpl≥3`, cap 3/game.
- comeback: outcome vs adaptive bot · Dashboard-Drill access (no top-nav).

## Status
All specs V1, decisions baked, ready to execute. No code written yet.
