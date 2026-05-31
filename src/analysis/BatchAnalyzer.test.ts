import { describe, it, expect } from 'vitest';
import { parsePgn } from './pgn';
import { analyzeGame, type PositionEvaluator } from './BatchAnalyzer';

describe('analyzeGame', () => {
  it('flags a player blunder and aggregates per-phase stats', async () => {
    const game = parsePgn('1. e4 e5 2. Nf3 Nc6 *');

    // Script evals by FEN: everything ~+30 for White, except the position right
    // after White's first move craters to -300 → White's 1st move is a blunder.
    const afterWhite1 = game.plies[0].fenAfter;
    const evaluator: PositionEvaluator = {
      async evaluatePosition(fen: string) {
        const whiteCp = fen === afterWhite1 ? -300 : 30;
        return { whiteCp, bestUci: 'e2e4' };
      },
    };

    const a = await analyzeGame('g1', game, evaluator, {
      playerColor: 'w',
      movetimeMs: 50,
      source: 'imported',
    });

    expect(a.plies[0].color).toBe('w');
    expect(a.plies[0].severity).toBe('blunder');
    expect(a.plies[0].cpLoss).toBeGreaterThan(200);
    expect(a.blunders).toBeGreaterThanOrEqual(1);
    expect(a.byPhase.opening.blunders).toBeGreaterThanOrEqual(1);
    // A blunder by the player gets a motif tagged.
    expect(a.plies[0].motif).toBeDefined();
  });

  it('reports zero loss when every move is best', async () => {
    const game = parsePgn('1. d4 d5 *');
    const evaluator: PositionEvaluator = {
      async evaluatePosition() {
        return { whiteCp: 20, bestUci: 'd2d4' };
      },
    };
    const a = await analyzeGame('g2', game, evaluator, {
      playerColor: 'w',
      movetimeMs: 50,
      source: 'imported',
    });
    expect(a.blunders).toBe(0);
    expect(a.acpl).toBe(0);
  });

  it('calls onProgress n+1 times', async () => {
    const game = parsePgn('1. e4 e5 *'); // 2 plies → 3 evals
    let calls = 0;
    const evaluator: PositionEvaluator = {
      async evaluatePosition() {
        return { whiteCp: 0, bestUci: null };
      },
    };
    await analyzeGame('g3', game, evaluator, {
      playerColor: 'w',
      movetimeMs: 10,
      source: 'imported',
      onProgress: () => (calls += 1),
    });
    expect(calls).toBe(3);
  });
});
