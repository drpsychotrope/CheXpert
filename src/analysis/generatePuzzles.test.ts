import { describe, it, expect } from 'vitest';
import { generatePuzzlesFromAnalysis, type LineEvaluator } from './generatePuzzles';
import type { GameAnalysis, PlyAnalysis } from './types';

function ply(partial: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0,
    moveNumber: 1,
    color: 'w',
    san: 'Qd2',
    uci: 'd1d2',
    fenBefore: 'startpos-fen',
    fenAfter: 'after-fen',
    bestUci: 'a1a8',
    bestWhiteCp: 500,
    playedWhiteCp: 0,
    cpLoss: 500,
    winProbLoss: 40,
    severity: 'blunder',
    phase: 'middlegame',
    ...partial,
  };
}

function analysis(plies: PlyAnalysis[]): GameAnalysis {
  return {
    gameId: 'g1',
    source: 'imported',
    playerColor: 'w',
    analyzedAt: 0,
    movetimeMs: 100,
    plies,
    byPhase: {
      opening: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      middlegame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    },
    acpl: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    puzzlesGenerated: 0,
  };
}

describe('generatePuzzlesFromAnalysis', () => {
  it('keeps positions with a unique best move, drops ambiguous ones', async () => {
    const a = analysis([
      ply({ ply: 0, fenBefore: 'fenUnique', bestUci: 'a1a8' }),
      ply({ ply: 1, fenBefore: 'fenAmbiguous', bestUci: 'b1b8' }),
    ]);

    const lines: LineEvaluator = {
      async evaluateLines(fen: string) {
        if (fen === 'fenUnique') {
          return [
            { uci: 'a1a8', whiteCp: 600 },
            { uci: 'c1c2', whiteCp: 100 }, // 500cp gap → unique
          ];
        }
        return [
          { uci: 'b1b8', whiteCp: 320 },
          { uci: 'd1d2', whiteCp: 300 }, // 20cp gap → not unique
        ];
      },
    };

    const puzzles = await generatePuzzlesFromAnalysis(a, lines, { baseRating: 1400 });
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].fen).toBe('fenUnique');
    expect(puzzles[0].moves).toEqual(['a1a8']);
    expect(puzzles[0].source).toBe('personal');
    expect(a.puzzlesGenerated).toBe(1);
  });

  it('skips opponent moves and non-mistakes', async () => {
    const a = analysis([
      ply({ ply: 0, color: 'b', severity: 'blunder' }), // opponent
      ply({ ply: 1, color: 'w', severity: 'good' }), // fine move
    ]);
    const lines: LineEvaluator = { async evaluateLines() { return [{ uci: 'a1a8', whiteCp: 900 }]; } };
    const puzzles = await generatePuzzlesFromAnalysis(a, lines, { baseRating: 1400 });
    expect(puzzles).toHaveLength(0);
  });

  it('dedups against already-seen FENs', async () => {
    const a = analysis([ply({ ply: 0, fenBefore: 'dup' })]);
    const lines: LineEvaluator = {
      async evaluateLines() {
        return [
          { uci: 'a1a8', whiteCp: 600 },
          { uci: 'c1c2', whiteCp: 0 },
        ];
      },
    };
    const seen = new Set(['dup']);
    const puzzles = await generatePuzzlesFromAnalysis(a, lines, { baseRating: 1400, seenFens: seen });
    expect(puzzles).toHaveLength(0);
  });

  it('treats a unique forced mate as generatable', async () => {
    const a = analysis([ply({ ply: 0, fenBefore: 'mateFen', bestUci: 'a1a8' })]);
    const lines: LineEvaluator = {
      async evaluateLines() {
        return [
          { uci: 'a1a8', whiteCp: 99999, mate: 1 },
          { uci: 'c1c2', whiteCp: 300 }, // not mate → unique by mate rule
        ];
      },
    };
    const puzzles = await generatePuzzlesFromAnalysis(a, lines, { baseRating: 1400 });
    expect(puzzles).toHaveLength(1);
  });
});
