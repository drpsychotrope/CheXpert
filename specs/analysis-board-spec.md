# Spec — `analysis-board`: interactive MultiPV board + positional explanations

**Scope:** feature (#8) · **Status:** V1 (3 cycles) · **Date:** 2026-06-01
Batch 2, spec E of 6.

## §0 Context
Analysis today is one-shot: a fixed best line + a win% loss per move. There's no way to *explore*
("what if I play this?") and explanations name only tactical motifs. Add (1) an **interactive analysis
board** — move pieces freely, the engine evaluates on demand with **MultiPV** alternatives, with a
**variation walker** (back/forward, try lines) — and (2) **positional explanations** derived honestly
from the FEN (king safety, pawn structure, activity, material) so quiet positions get a "why," not just
tactics. No LLM, no new engine; `analyzeLines` runs in the existing worker.

## §1 Empirical baseline
- `analyzeLines(fen,{multipv,movetime})` → ranked PV lines (White-POV cp + mate). `winPct` for display.
- `Board.svelte` is interactive (movable + dests); `ChessGame` has move/undo/fen/dests/history.
- `explain.ts` is rule-based, gated on high-confidence motif; positional reasons would extend it.
- 162 tests, svelte-check clean. AP-CHESS 62-64. ADR-0031.

## §2 Scope
**In:**
- `src/ui/AnalysisBoard.svelte` — a board you can play moves on; after each position, request `analyzeLines(multipv=3)`; show the top 3 lines (eval + SAN PV), click a line to play its first move, back/forward through your variation, "reset to game." Eval bar / win% from `winPct`. Throttled engine calls (interrupt previous via `EngineClient.interrupt`).
- `src/analysis/positional.ts` (pure) — `positionalFeatures(fen)` → `{ kingSafety, pawnStructure: {doubled, isolated, passed}, mobility, material }` (chess.js + geometry, all deterministic). `explainPositional(features, deltaCp)` → honest phrases ("isolated d-pawn", "your king is exposed", "your pieces are more active"), used by `explain.ts` when no high-confidence tactical motif fired.
- Wire: reachable from a critical-moment / mistake ("explore this position") and as a standalone view; integrate positional phrases into existing explanations.
**Deferred:** full PGN variation tree editor with branches/annotations; engine arrows; opening-explorer merge.

## §3 Pre-flight gates
1. `analyzeLines`/`interrupt` signatures unchanged; Board interactive; ChessGame undo/history present.
2. `explain.ts` extension is additive (tactical path unchanged; positional only fills the "can't name a tactic" branch).
3. 162 tests green; svelte-check clean.

## §4 Phase A
### §4.1 `positional.ts` (pure, tested)
- `positionalFeatures(fen)`: pawn structure via file occupancy (doubled = ≥2 same-file pawns; isolated = no friendly pawn on adjacent files; passed = no enemy pawn ahead on same/adjacent files); king safety (pawn shield + open files near king); mobility (legal-move count per side, or piece activity heuristic); material balance.
- `explainPositional(features, deltaCp)`: emit the 1–2 most salient honest phrases for the side that's worse; conservative (only assert features actually present). Returns `string[]`.
### §4.2 `explain.ts` integration
In the "we can't name a specific tactical pattern" branch, append `explainPositional(...)` phrases (so the explanation becomes "no forced tactic — but your king is exposed and the d-pawn is isolated"). Tactical/mate branches unchanged.
### §4.3 `AnalysisBoard.svelte`
- Interactive board + variation walker (ChessGame stack). On each position: debounce → `interrupt()` prior → `analyzeLines(multipv=3, movetime~600)`; render top-3 (eval, SAN line, click-to-play-first-move). Eval bar via `winPct`. "Back / Forward / Reset to game." Engine depth/movetime/multipv → **Q-A**. Add `'analysis-board'` to the View union + an "Explore" link from AnalysisResult moments.

## §5 Phase B — tests
- `positional.test.ts`: doubled/isolated/passed detection on hand FENs; king-safety flag on an exposed king; mobility sign; `explainPositional` asserts only present features (no fabrication); empty when balanced/quiet.
- (Interactive board = manual verification.)

## §6 Phase C — verification
`npm test` green incl. `positional.test.ts`; svelte-check clean; manual: explore a position → 3 lines update on each move, click-to-play works, eval bar moves, "reset to game" restores; a quiet mistake now gets a positional "why."

## §7 Phase Z — docs
ADR-0031 (interactive MultiPV exploration + honest FEN-derived positional explanations, no LLM; extends ADR-0007/AP-CHESS-19's "say what you can prove" doctrine to positional features). README "Analyse a game": add the exploration board + positional explanations.

## §8 Acceptance
Interactive board with live top-3 MultiPV + variation walk + eval bar; positional features detected (unit-tested) and surfaced only when present; explanations gain positional reasons for non-tactical mistakes; no new engine/LLM/schema; ADR/README updated.

## §9 Anti-patterns
- **AP-CHESS-62** — Engine calls piling up as the user moves fast (must `interrupt()` + debounce; one analysis at a time).
- **AP-CHESS-63** — Positional claims not grounded in the FEN (e.g. "passed pawn" that isn't) — assert only verified features (honesty doctrine).
- **AP-CHESS-64** — Breaking the existing tactical-explanation path; positional phrases only fill the no-motif branch.

## §10 Rollback
New `positional.ts` + `AnalysisBoard.svelte` + an additive `explain.ts` branch + View-union arm. No schema. Revert files; explanations fall back to current behaviour.

## §11 Follow-up
Branching variation tree + PGN export with comments; engine arrows/heatmap; merge with the opening explorer (spec B); "best practical move" hints.
