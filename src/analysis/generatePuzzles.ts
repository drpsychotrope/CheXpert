// "From your games" generator (spec §4 item 5 — the most differentiating feature).
//
// For each significant PLAYER mistake where a clearly better, reasonably UNIQUE move
// existed, emit a personal puzzle: FEN before the best move, solution = the engine's
// move. Uniqueness is enforced with a MultiPV re-check (AP-CHESS-10): if the second-
// best line is nearly as good, the position has no single "right answer" and is
// skipped (it would be unscoreable and frustrating).

import type { LineResult } from '../engine/EngineClient';
import type { Puzzle } from '../trainer/puzzle';
import type { GameAnalysis, PlyAnalysis } from './types';

export interface LineEvaluator {
  evaluateLines(fen: string, multipv: number): Promise<LineResult[]>;
}

export interface GenerateOptions {
  /** Baseline rating for generated puzzles (kept near the player's zone). */
  baseRating: number;
  /** Min mover-POV cp gap from best to 2nd-best to count as unique. */
  uniqueGapCp?: number;
  /** FENs already turned into puzzles (dedup across games + re-runs). */
  seenFens?: Set<string>;
  movetimeMs?: number;
}

const DEFAULT_UNIQUE_GAP = 80;

/** Mover-POV cp from a White-POV cp. */
function moverCp(whiteCp: number, whiteToMove: boolean): number {
  return whiteToMove ? whiteCp : -whiteCp;
}

/**
 * Generate personal puzzles from a finished analysis. Returns the puzzles (the
 * caller persists them via PuzzleRepo.addPuzzles) and mutates analysis.puzzlesGenerated.
 */
export async function generatePuzzlesFromAnalysis(
  analysis: GameAnalysis,
  lines: LineEvaluator,
  opts: GenerateOptions,
): Promise<Puzzle[]> {
  const gap = opts.uniqueGapCp ?? DEFAULT_UNIQUE_GAP;
  const seen = opts.seenFens ?? new Set<string>();
  const out: Puzzle[] = [];

  // Candidates: the player's mistakes/blunders, PLUS "missed wins" — plies where a
  // clearly decisive best move existed but wasn't played, even if the move was
  // labelled 'good'/'inaccuracy' (you stayed winning but missed the clean kill).
  // A forced mate always qualifies; a material win is gated by a win-prob floor so a
  // one-sided game isn't flooded. Missed wins are capped per game (AP-CHESS-38).
  const DECISIVE_CP = 500;
  const MAX_MISSED_WIN = 3;

  function kindOf(p: PlyAnalysis): 'mistake' | 'missed-win' | null {
    if (p.color !== analysis.playerColor || !p.bestUci || seen.has(p.fenBefore)) return null;
    if (p.severity === 'mistake' || p.severity === 'blunder') return 'mistake';
    if (p.cpLoss > 0) {
      const white = p.color === 'w';
      if (p.mate != null && p.mate > 0) return 'missed-win';
      if (moverCp(p.bestWhiteCp, white) >= DECISIVE_CP && p.winProbLoss >= 3) return 'missed-win';
    }
    return null;
  }

  let missedWinCount = 0;

  for (const p of analysis.plies) {
    const kind = kindOf(p);
    if (!kind) continue;
    if (kind === 'missed-win' && missedWinCount >= MAX_MISSED_WIN) continue; // flood control

    const whiteToMove = p.color === 'w';
    let top: LineResult[];
    try {
      top = await lines.evaluateLines(p.fenBefore, 2);
    } catch {
      continue;
    }
    if (top.length === 0 || !top[0].uci) continue;

    // Uniqueness: best clearly beats second-best (or best is a forced mate alone).
    const unique =
      top.length < 2 ||
      (top[0].mate != null && top[1].mate == null) ||
      moverCp(top[0].whiteCp, whiteToMove) - moverCp(top[1].whiteCp, whiteToMove) >= gap;
    if (!unique) continue;

    seen.add(p.fenBefore);
    if (kind === 'missed-win') missedWinCount += 1;
    const themes = p.motif ? p.motif.tags.slice() : [`${p.phase}Mistake`];
    out.push({
      id: `personal:${analysis.gameId}:${p.ply}`,
      fen: p.fenBefore,
      moves: [top[0].uci],
      rating: opts.baseRating,
      ratingDeviation: 120,
      themes,
      source: 'personal',
      meta: {
        sourceGameId: analysis.gameId,
        moveNumber: String(p.moveNumber),
        playedMove: p.san,
        severity: p.severity,
        motifConfidence: p.motif?.confidence ?? 'low',
        kind,
      },
    });
  }

  analysis.puzzlesGenerated = out.length;
  return out;
}

/** Wrap an EngineClient as a LineEvaluator for the uniqueness re-check. */
export function engineLineEvaluator(
  engine: { analyzeLines: (fen: string, opts: { multipv: number; movetime?: number }) => Promise<LineResult[]> },
  movetimeMs = 300,
): LineEvaluator {
  return {
    evaluateLines: (fen, multipv) => engine.analyzeLines(fen, { multipv, movetime: movetimeMs }),
  };
}
