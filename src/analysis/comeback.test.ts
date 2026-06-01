import { describe, it, expect } from 'vitest';
import { comebackPositions } from './comeback';
import type { GameAnalysis, GamePhase, PhaseStat, PlyAnalysis } from './types';

function mkPly(i: number, color: 'w' | 'b', playedWhiteCp: number, fenBefore = 'f'): PlyAnalysis {
  return {
    ply: i, moveNumber: Math.floor(i / 2) + 1, color, san: 'x', uci: 'e2e4',
    fenBefore, fenAfter: 'f', bestUci: 'e2e4', bestWhiteCp: playedWhiteCp, playedWhiteCp,
    cpLoss: 0, winProbLoss: 0, severity: 'good', phase: 'middlegame',
  };
}
const PHASE: PhaseStat = { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 };
function mkGame(plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w', gameId = 'g'): GameAnalysis {
  return {
    gameId, source: 'played', playerColor, analyzedAt: 0, movetimeMs: 200, plies,
    byPhase: { opening: PHASE, middlegame: PHASE, endgame: PHASE } as Record<GamePhase, PhaseStat>,
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}

describe('comebackPositions', () => {
  it('captures the player-to-move position where they first fell behind', () => {
    // White player. After Black's move (ply1) White is -250; ply2 is White to move.
    const g = mkGame([
      mkPly(0, 'w', 0),
      mkPly(1, 'b', -250),
      mkPly(2, 'w', -240, 'recoverHere'),
    ]);
    const pos = comebackPositions([g]);
    expect(pos).toHaveLength(1);
    expect(pos[0].fen).toBe('recoverHere');
    expect(pos[0].cpAtEntry).toBe(-250);
    expect(pos[0].playerColor).toBe('w');
  });

  it('excludes hopeless positions (already lost beyond saving)', () => {
    const g = mkGame([mkPly(0, 'w', 0), mkPly(1, 'b', -1000), mkPly(2, 'w', -990, 'lost')]);
    expect(comebackPositions([g])).toHaveLength(0);
  });

  it('returns nothing when the player was never clearly behind', () => {
    const g = mkGame([mkPly(0, 'w', 30), mkPly(1, 'b', 10), mkPly(2, 'w', 40)]);
    expect(comebackPositions([g])).toHaveLength(0);
  });

  it('captures one entry per behind-episode, not every losing ply', () => {
    // Behind at ply2, recover by ply4, behind again at ply6 → two episodes.
    const g = mkGame([
      mkPly(0, 'w', 0),
      mkPly(1, 'b', -300),
      mkPly(2, 'w', -290, 'first'),
      mkPly(3, 'b', -50),
      mkPly(4, 'w', -40),
      mkPly(5, 'b', -350),
      mkPly(6, 'w', -340, 'second'),
    ]);
    const pos = comebackPositions([g]);
    expect(pos.map((p) => p.fen).sort()).toEqual(['first', 'second']);
  });
});
