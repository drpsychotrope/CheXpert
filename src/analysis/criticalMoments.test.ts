import { describe, it, expect } from 'vitest';
import { winCurve, criticalMoments } from './criticalMoments';
import type { GameAnalysis, GamePhase, PhaseStat, PlyAnalysis, Severity } from './types';

function mkPly(i: number, color: 'w' | 'b', playedWhiteCp: number, winProbLoss: number, severity: Severity): PlyAnalysis {
  return {
    ply: i, moveNumber: Math.floor(i / 2) + 1, color, san: 'x', uci: 'e2e4',
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    bestUci: 'e2e4', bestWhiteCp: playedWhiteCp, playedWhiteCp, cpLoss: 0, winProbLoss, severity, phase: 'middlegame',
  };
}

const PHASE: PhaseStat = { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 };

function mkAnalysis(plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w'): GameAnalysis {
  const byPhase = { opening: PHASE, middlegame: PHASE, endgame: PHASE } as Record<GamePhase, PhaseStat>;
  return {
    gameId: 't', source: 'imported', playerColor, analyzedAt: 0, movetimeMs: 200,
    plies, byPhase, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}

const PLIES = [
  mkPly(0, 'w', 50, 2, 'good'),
  mkPly(1, 'b', -300, 25, 'blunder'),
  mkPly(2, 'w', 280, 12, 'mistake'),
  mkPly(3, 'b', 270, 1, 'best'),
];

describe('winCurve', () => {
  it('has one point per ply, player-POV for White', () => {
    const c = winCurve(mkAnalysis(PLIES, 'w'));
    expect(c).toHaveLength(4);
    expect(c[0].plyIndex).toBe(0);
    expect(c[0].winPct).toBeCloseTo(54.6, 0); // winPct(50)
  });

  it('inverts the curve for a Black player', () => {
    const w = winCurve(mkAnalysis(PLIES, 'w'))[0].winPct;
    const b = winCurve(mkAnalysis(PLIES, 'b'))[0].winPct;
    expect(b).toBeCloseTo(100 - w, 5);
  });
});

describe('criticalMoments', () => {
  it('ranks by win-prob loss, filters by threshold, tags the side', () => {
    const m = criticalMoments(mkAnalysis(PLIES, 'w'));
    expect(m).toHaveLength(2); // only the two plies with winProbLoss >= 10
    expect(m[0].plyIndex).toBe(1);
    expect(m[0].winProbLoss).toBe(25);
    expect(m[0].side).toBe('opponent'); // black move, white player
    expect(m[1].plyIndex).toBe(2);
    expect(m[1].side).toBe('player');
  });

  it('caps at max', () => {
    expect(criticalMoments(mkAnalysis(PLIES, 'w'), { max: 1 })).toHaveLength(1);
  });

  it('returns none when nothing clears the threshold', () => {
    expect(criticalMoments(mkAnalysis(PLIES, 'w'), { minLoss: 30 })).toHaveLength(0);
  });

  it('tie-breaks deterministically by ply index', () => {
    const tied = [mkPly(0, 'w', 0, 15, 'mistake'), mkPly(1, 'b', 0, 15, 'mistake')];
    const m = criticalMoments(mkAnalysis(tied, 'w'));
    expect(m.map((x) => x.plyIndex)).toEqual([0, 1]);
  });
});
