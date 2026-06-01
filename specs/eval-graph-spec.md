# Spec — `eval-graph`: win% curve + critical moments

**Scope:** feature · **Status:** V1 (V0 → cycles 1–4) · **Date:** 2026-06-01
**Spec 2 of 3.** Siblings: `motif-detectors`, `loop-closers`. UI-only; **no engine change**.

> **Decisions applied (user accepted all defaults + UX directive, 2026-06-01):** Q-A Import + read-only
> mini-board; Q-B top 5, `winProbLoss≥10`; Q-C both sides, distinguished; Q-D player-POV curve. ADR-0021.
>
> **UX directive — friendliest, no external manipulation:** the result panel (incl. `EvalGraph`) is
> extracted into a shared `AnalysisResult.svelte` (see `played-game-review-spec.md`) so the curve also
> appears after a game **played in-app**, one click, **without pasting a PGN**. Build `EvalGraph` here;
> `played-game-review` does the extraction + Play wiring.

> Changelog: V0 from locked brainstorm (curve + critical moments + per-phase ACPL, **no global
> Accuracy grade**). Cycles 1–4 settled placement/board, ranking thresholds, curve POV, and the
> dependency-free SVG decision. 4 cycles by user request.

---

## §0 Context
Today the only analysis output ([Import.svelte](../src/ui/Import.svelte)) is a stat row
(ACPL/blunders/mistakes/inaccuracies) + a list of the player's explained mistakes. There is no
game-shape visualization. This PR adds a **win-probability curve** across the game, **critical-moment**
highlighting (the biggest swings), and a **per-phase ACPL** panel — all from data **already on
`GameAnalysis`** (`ply.playedWhiteCp`, `ply.winProbLoss`, `byPhase`). The curve uses
`winPct()` from [winProb.ts](../src/analysis/winProb.ts); **no engine re-evaluation**. Per the locked
brainstorm decision and the README honesty notes, **no global Accuracy% grade is shown** (a single
"grade" number is exactly what ADR-0009 warns against).

## §1 Empirical baseline
- `winPct(whiteCp): 0..100` exists in winProb.ts. Each ply already has `playedWhiteCp` (White-POV) and `winProbLoss` (mover-POV points lost). `GameAnalysis.byPhase[phase].acpl` already computed.
- Analysis renders only in Import.svelte (no board). `Board.svelte` supports `viewOnly`+`fen`+`lastMove` → a static mini-board for a selected moment is cheap.
- No charting library in the stack → hand-rolled inline SVG (no new dependency).
- 135 tests baseline, `svelte-check` clean. AP-CHESS alloc 32–37, ADR-0021.

## §2 Scope
**In:**
- `src/analysis/criticalMoments.ts` — pure, unit-tested selectors:
  - `winCurve(analysis)` → `[{ ply, plyIndex, winPct }]` (POV per Q-D).
  - `criticalMoments(analysis, opts?)` → top-N plies by `winProbLoss`, filtered + capped (Q-B), each `{ ply, side: 'player'|'opponent', winPctBefore, winPctAfter, winProbLoss }`.
- `src/ui/EvalGraph.svelte` — inline-SVG sparkline of the curve (0–100, 50% midline, win/loss zones), severity-colored markers (player vs opponent distinguished), `onSelect(plyIndex)`.
- Wire into Import.svelte result panel: graph + critical-moment list + per-phase ACPL row (read `byPhase` directly). Selecting a moment renders a **read-only mini-board** of `ply.fenBefore` (`lastMove` highlighted) + the existing `explainPly` text (Q-A).
- Phase Z: ADR-0021.

**Deferred:** a dedicated full game-review view with movelist navigation (§11); any global accuracy score (permanently out, by doctrine).

## §3 Pre-flight gates
1. `winPct` signature unchanged; `PlyAnalysis.playedWhiteCp` + `winProbLoss` present.
2. `GameAnalysis.byPhase` present with `acpl`.
3. `Board.svelte` still exposes `viewOnly`/`fen`/`lastMove`.
4. `npm test` 135 green; `npm run check` clean.

## §4 Phase A — code
### §4.1 `criticalMoments.ts` (pure)
- `winCurve`: map each ply to `{ plyIndex, winPct: pov(ply.playedWhiteCp) }`. POV per Q-D (default player-POV: `playerColor==='w' ? winPct(cp) : 100-winPct(cp)`).
- `criticalMoments`: sort plies by `winProbLoss` desc; keep `winProbLoss >= threshold` (default 10 = mistake); cap at N (default 5); tag `side` by `ply.color === analysis.playerColor`. Deterministic tie-break by `plyIndex`.
- No engine calls, no chess.js — arithmetic over the stored analysis (AP-CHESS-35).

### §4.2 `EvalGraph.svelte`
- Inline SVG only (AP-CHESS-36). Props `{ analysis, selected?, onSelect }`.
- Polyline of `winCurve`; horizontal 50% line; subtle area fill above/below 50.
- Markers at mistakes/blunders: dot per such ply, colored by severity (`--bad` etc.), shape/stroke distinguishing player vs opponent (Q-C). `click`/keyboard → `onSelect(plyIndex)`. Accessible (`role`, `aria-label` per marker).
- POV label on the Y axis matches Q-D; never prints an "Accuracy" number (AP-CHESS-32).

### §4.3 Import.svelte wiring
- In the `status==='done'` panel, above the mistakes list: `<EvalGraph {analysis} selected={selectedPly} onSelect={…}/>`, a per-phase ACPL row from `result.byPhase`, and a critical-moments list (rows from `criticalMoments(result)`), each row selectable.
- A `selectedPly` state; when set, render `<Board fen={ply.fenBefore} viewOnly lastMove={uciToMove(ply.uci)} />` + `explainPly(ply)` (works for any ply, player or opponent).

## §5 Phase B — tests
- `criticalMoments.test.ts`: ranking order, threshold filtering, N cap, side tagging, player-POV vs White-POV curve values, empty/short-game (returns fewer, no crash), tie-break determinism.
- (Svelte components follow the repo's existing convention of logic-only unit tests; the selector carries the coverage.)

## §6 Phase C — verification
- `npm test` green incl. selector tests; `npm run check` clean.
- Manual: analyse the bundled SAMPLE PGN → curve renders, markers at the flagged moves, clicking a marker shows the mini-board at that position + explanation, per-phase ACPL matches the stat row totals.
- Grep diff: no `runAnalysis`/`analyzeLines`/engine import added; no new package in `package.json`; no "Accuracy" string.

## §7 Phase Z — docs
- Append **ADR-0021 — "Analysis visualization: win% curve + critical moments; no global accuracy grade"** to [decisions.md](../decisions.md). Cross-link ADR-0009 (directional benchmarks) + record Q-A/B/C/D. Append-only.
- README "Features → The differentiating loop / Analyse a game": add the curve + critical moments; restate that no single grade is shown.

## §8 Acceptance criteria
1. 135 baseline + new selector tests pass; `npm run check` clean.
2. Curve, markers, critical-moments list, per-phase ACPL all render in Import.svelte from existing data.
3. **No** global Accuracy/score number anywhere in the diff (AP-CHESS-32).
4. **No** engine re-eval and **no** new dependency (AP-CHESS-35/36).
5. Selecting a moment shows a **read-only** board at `fenBefore` + `explainPly` (AP-CHESS-37).
6. Per-phase ACPL equals `result.byPhase[phase].acpl` (no recomputation).
7. ADR-0021 appended; README updated.

## §9 Anti-patterns
- **AP-CHESS-32** — Showing a single Accuracy% "grade" (forbidden by doctrine / locked decision).
- **AP-CHESS-33** — Mixing White-POV and player-POV on the same curve → misleading shape.
- **AP-CHESS-34** — Flooding short games with "critical" moments; must apply threshold + cap.
- **AP-CHESS-35** — Re-running the engine to build the graph instead of reusing `playedWhiteCp`.
- **AP-CHESS-36** — Pulling in a charting library (bundle/license creep); inline SVG only.
- **AP-CHESS-37** — Mini-board accidentally interactive; must be `viewOnly`.

## §10 Rollback
Two new files + an additive block in Import.svelte + an ADR append. No data/schema/engine touched. Revert the three files and the ADR.

## §11 Follow-up
- Dedicated game-review view (board + movelist + curve + per-move nav), lichess-style — larger, deferred.
- Hook the same `EvalGraph` into the post-game screen of `Play` (played games), once played games persist an analysis.
