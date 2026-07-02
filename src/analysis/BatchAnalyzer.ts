// Batch analysis (spec §4.2). Runs the engine over every ply of a parsed game and
// produces per-ply analysis + aggregated player stats.
//
// Efficiency: each position is evaluated ONCE. The eval of the position AFTER move i
// equals the eval of the position BEFORE move i+1, so N plies need only N+1 evals
// (the +1 is the final position). This is what keeps a 40-move game under the 30s
// gate (Q-C=a). The evaluator is injectable so tests run without a real engine, and
// the real one (EngineClient) confines work to the Web Worker (AP-CHESS-11).

import { phaseOf } from '../trainer/puzzle';
import { cpLoss as cpLossOf, winProbLoss, classify, type GaffeThresholds, DEFAULT_THRESHOLDS } from './winProb';
import { detectMotif } from './motif';
import type { EngineClient } from '../engine/EngineClient';
import type {
  GameAnalysis,
  GamePhase,
  ParsedGame,
  PhaseStat,
  PlyAnalysis,
  Severity,
} from './types';

export interface PositionEval {
  whiteCp: number;
  bestUci: string | null;
  /** Mate distance from the mover POV, if any. */
  mate?: number;
}

export interface PositionEvaluator {
  evaluatePosition(fen: string): Promise<PositionEval>;
}

/** Wrap an EngineClient as a PositionEvaluator at a fixed per-ply movetime. */
export function engineEvaluator(engine: EngineClient, movetimeMs: number): PositionEvaluator {
  return {
    async evaluatePosition(fen: string): Promise<PositionEval> {
      const r = await engine.evaluate(fen, { movetime: movetimeMs, fullStrength: true });
      return { whiteCp: r.whiteCp, bestUci: r.bestmove, mate: r.score.mate };
    },
  };
}

export interface AnalyzeOptions {
  playerColor: 'w' | 'b';
  movetimeMs: number;
  source: 'imported' | 'played';
  thresholds?: GaffeThresholds;
  onProgress?: (done: number, total: number) => void;
}

const CP_LOSS_CAP = 1000; // cap per-move loss so mate-clamp doesn't dominate ACPL

function emptyPhaseStat(): PhaseStat {
  return { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 };
}

export async function analyzeGame(
  gameId: string,
  game: ParsedGame,
  evaluator: PositionEvaluator,
  opts: AnalyzeOptions,
): Promise<GameAnalysis> {
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const plies = game.plies;
  const n = plies.length;

  // Evaluate position before each ply, plus the final resulting position. PR-20 (ADR-0078):
  // a 960 ply carries an X-FEN engineFenBefore/After the engine needs; standard plies never
  // set it and behave byte-identically.
  const total = n + 1;
  const evals: PositionEval[] = [];
  for (let i = 0; i < n; i++) {
    evals.push(await evaluator.evaluatePosition(plies[i].engineFenBefore ?? plies[i].fenBefore));
    opts.onProgress?.(i + 1, total);
  }
  if (n > 0) {
    evals.push(await evaluator.evaluatePosition(plies[n - 1].engineFenAfter ?? plies[n - 1].fenAfter));
    opts.onProgress?.(total, total);
  }

  const analyzed: PlyAnalysis[] = plies.map((p, i) => {
    const whiteToMove = p.color === 'w';
    const bestWhiteCp = evals[i].whiteCp;
    const playedWhiteCp = evals[i + 1].whiteCp;
    const loss = Math.min(CP_LOSS_CAP, cpLossOf(bestWhiteCp, playedWhiteCp, whiteToMove));
    const wpLoss = winProbLoss(bestWhiteCp, playedWhiteCp, whiteToMove);
    const severity: Severity = classify(wpLoss, thresholds);
    const phase = phaseOf(p.fenBefore);

    const ply: PlyAnalysis = {
      ...p,
      bestUci: evals[i].bestUci,
      bestWhiteCp,
      playedWhiteCp,
      cpLoss: loss,
      winProbLoss: wpLoss,
      severity,
      phase,
      mate: evals[i].mate,
    };

    // Tag the missed motif only for significant player mistakes.
    if ((severity === 'mistake' || severity === 'blunder') && p.color === opts.playerColor) {
      ply.motif = detectMotif({
        fenBefore: p.fenBefore,
        bestUci: evals[i].bestUci,
        mate: evals[i].mate,
        phase,
        severity,
      });
    }
    return ply;
  });

  // Aggregate the PLAYER's moves.
  const byPhase: Record<GamePhase, PhaseStat> = {
    opening: emptyPhaseStat(),
    middlegame: emptyPhaseStat(),
    endgame: emptyPhaseStat(),
  };
  let lossSum = 0;
  let playerMoves = 0;
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;

  for (const ply of analyzed) {
    if (ply.color !== opts.playerColor) continue;
    playerMoves += 1;
    lossSum += ply.cpLoss;
    const ps = byPhase[ply.phase];
    ps.plies += 1;
    ps.acpl += ply.cpLoss;
    if (ply.severity === 'blunder') (blunders += 1), (ps.blunders += 1);
    else if (ply.severity === 'mistake') (mistakes += 1), (ps.mistakes += 1);
    else if (ply.severity === 'inaccuracy') (inaccuracies += 1), (ps.inaccuracies += 1);
  }
  for (const phase of ['opening', 'middlegame', 'endgame'] as GamePhase[]) {
    const ps = byPhase[phase];
    ps.acpl = ps.plies > 0 ? Math.round(ps.acpl / ps.plies) : 0;
  }

  return {
    gameId,
    source: opts.source,
    playerColor: opts.playerColor,
    analyzedAt: 0, // stamped by the caller (Date.now unavailable in some contexts)
    movetimeMs: opts.movetimeMs,
    plies: analyzed,
    byPhase,
    acpl: playerMoves > 0 ? Math.round(lossSum / playerMoves) : 0,
    blunders,
    mistakes,
    inaccuracies,
    puzzlesGenerated: 0, // filled by the generator
  };
}
