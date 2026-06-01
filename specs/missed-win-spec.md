# Spec — `missed-win` (loop-closers 3a)

**Scope:** feature · **Status:** V1 (decisions accepted) · **Date:** 2026-06-01
Split from [loop-closers-spec.md](loop-closers-spec.md) per accepted Q-A=a. See it for full context.

## Decisions baked (accepted defaults)
- Q-B trigger: `mate>0` **OR** `moverPOV(bestWhiteCp) ≥ 500`, with `winProbLoss ≥ 3`, per-game cap **3**.

## §0 Context
[generatePuzzles.ts](../src/analysis/generatePuzzles.ts) only mines player `mistake`/`blunder` plies, so
a *missed forced win while already ahead* (low win% loss, high rating value — converting won games)
never becomes a puzzle. Widen the candidate net; reuse the existing MultiPV uniqueness gate.

## §1 Baseline
`PlyAnalysis` already has `mate?`, `bestWhiteCp`, `cpLoss`, `winProbLoss` → free pre-filter, no new
eval pass. `Puzzle.meta` is freeform. 135 tests. AP-CHESS 38/39/44; ADR-0023.

## §2 Scope
**In:** widen candidate filter in `generatePuzzlesFromAnalysis`; tag missed-wins; per-game cap.
**Out:** UI badge/filter for missed-win puzzles (§11 of meta).

## §3 Pre-flight gates
1. `generatePuzzlesFromAnalysis` signature + `LineEvaluator` MultiPV gate unchanged.
2. The shared `seen`/`fenBefore` dedup still in place.
3. 135 tests green.

## §4 Phase A — `generatePuzzles.ts`
```
moverPOV(p) = p.color==='w' ? p.bestWhiteCp : -p.bestWhiteCp
isMissedWin(p) =
  p.color === playerColor && p.cpLoss > 0 &&
  ( (p.mate != null && p.mate > 0) || moverPOV(p) >= 500 ) &&
  p.winProbLoss >= 3
```
- Candidates = existing mistakes/blunders ∪ missed-wins, deduped by `fenBefore`/`seen`.
- Same MultiPV uniqueness re-check (already treats "only best is mate" as unique).
- Set `meta.kind = 'missed-win'` ONLY for newly-added decisive plies; mistakes/blunders keep `meta.kind = 'mistake'` (default). **Do not** invent a non-Lichess theme string (AP-CHESS-29/44) — themes still come from `p.motif.tags`.
- Cap missed-win puzzles at **3 per game** (AP-CHESS-38).

## §5 Phase B — tests (`generatePuzzles.test.ts`)
- Missed forced mate while winning → puzzle with `meta.kind:'missed-win'`.
- "Still winning, `winProbLoss<3`" → NOT a puzzle (flood control).
- Per-game cap respected; existing mistake/blunder puzzles unchanged; dedup holds.

## §6 Verification
`npm test` green; grep diff confirms **no new engine eval pass** (only the existing `lines.evaluateLines`).

## §7 Phase Z
ADR-0023 (missed-win mining); README "differentiating loop" adds missed-win puzzles (honesty framing kept).

## §8 Acceptance
Missed wins become capped, deduped, `meta.kind:'missed-win'` puzzles; no invented themes; no extra eval; tests green; ADR/README updated.

## §9 Anti-patterns
- **AP-CHESS-38** — flood: gate on `winProbLoss`/mate + per-game cap.
- **AP-CHESS-44** — `meta.kind` must not break `PuzzleRepo` filters or collide with existing meta fields.

## §10 Rollback
Revert generatePuzzles.ts; `meta.kind` is additive (old readers ignore it); puzzles regenerate next analysis.
