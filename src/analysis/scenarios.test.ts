import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { IMBALANCE_LIBRARY, scenariosFromWeakness } from './scenarios';
import type { GameAnalysis, GamePhase, PhaseStat, PlyAnalysis } from './types';

describe('IMBALANCE_LIBRARY', () => {
  it('every scenario FEN is legal and the side to move is the side to train', () => {
    expect(IMBALANCE_LIBRARY.length).toBeGreaterThan(0);
    for (const s of IMBALANCE_LIBRARY) {
      const c = new Chess(s.fen); // throws on a malformed FEN
      expect(c.turn()).toBe(s.sideToTrain);
      expect(s.goal.length).toBeGreaterThan(0);
    }
  });

  it('includes the C3 coach:defend-worse seed (resilience probe) with bilingual name/goal', () => {
    const s = IMBALANCE_LIBRARY.find((x) => x.id === 'coach:defend-worse');
    expect(s).toBeDefined();
    expect(s!.nameFr).toBeTruthy();
    expect(s!.goalFr).toBeTruthy();
    expect(s!.category).toBe('imbalance');
  });
});

const PHASE: PhaseStat = { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 };
function ply(p: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0, moveNumber: 1, color: 'w', san: 'x', uci: 'e2e4', fenBefore: 'f', fenAfter: 'f',
    bestUci: 'e2e4', bestWhiteCp: 0, playedWhiteCp: 0, cpLoss: 0, winProbLoss: 0, severity: 'good', phase: 'middlegame', ...p,
  };
}
function game(plies: PlyAnalysis[]): GameAnalysis {
  return {
    gameId: 'g', source: 'imported', playerColor: 'w', analyzedAt: 0, movetimeMs: 100, plies,
    byPhase: { opening: PHASE, middlegame: PHASE, endgame: PHASE } as Record<GamePhase, PhaseStat>,
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}

describe('scenariosFromWeakness', () => {
  it('builds scenarios from fingerprint leak positions', () => {
    const g = game([
      ply({ severity: 'blunder', winProbLoss: 30, motif: { tag: 'fork', tags: ['fork'], confidence: 'high' }, fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1' }),
    ]);
    const scen = scenariosFromWeakness([g]);
    expect(scen.length).toBeGreaterThan(0);
    expect(scen[0].category).toBe('weakness');
    expect(scen[0].sideToTrain).toBe('b'); // side-to-move parsed from the FEN
  });

  it('returns nothing without analyses', () => {
    expect(scenariosFromWeakness([])).toHaveLength(0);
  });
});
