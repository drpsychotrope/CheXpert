import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { IMBALANCE_LIBRARY, scenariosFromWeakness, scenariosFromFailedEndgames, ENDG_WINNING_CP } from './scenarios';
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

describe('scenariosFromFailedEndgames (PR-16)', () => {
  const ENTRY_FEN = '8/5pk1/6p1/8/8/1R3PKP/r5P1/8 w - - 0 1'; // white to move
  const endgGame = (id: string, cp: number, color: 'w' | 'b' = 'w', at = 1): GameAnalysis => ({
    ...game([ply({ phase: 'endgame', color, bestWhiteCp: cp, fenBefore: ENTRY_FEN })]),
    gameId: id,
    playerColor: color,
    analyzedAt: at,
  });

  it("flags 'convert' (winning entry, not won) and 'hold' (equal entry, lost) — nothing between", () => {
    const results = new Map<string, 'win' | 'loss' | 'draw'>([
      ['a', 'draw'], // entry +200 → failed conversion
      ['b', 'loss'], // entry 0 → failed hold
      ['c', 'win'],  // entry +200, won → clean, no scenario
      ['d', 'loss'], // entry -300 (already lost) → no claim
    ]);
    const scen = scenariosFromFailedEndgames(
      [endgGame('a', 200), endgGame('b', 0), endgGame('c', 200), endgGame('d', -300)],
      results,
    );
    expect(scen.map((s) => s.id).sort()).toEqual(['endg:a', 'endg:b']);
    expect(scen.every((s) => s.sideToTrain === 'w' && s.fen === ENTRY_FEN)).toBe(true);
  });

  it('uses player-POV eval for Black and skips games without a result', () => {
    // bestWhiteCp -200 = +200 for Black → failed conversion when Black only drew.
    const scen = scenariosFromFailedEndgames([endgGame('bk', -ENDG_WINNING_CP - 50, 'b')], new Map([['bk', 'draw']]));
    expect(scen.length).toBe(1);
    expect(scenariosFromFailedEndgames([endgGame('x', 200)], new Map()).length).toBe(0); // no result, no claim
  });

  it('caps the list and prefers the newest analyses', () => {
    const games = Array.from({ length: 9 }, (_, i) => endgGame(`g${i}`, 200, 'w', i));
    const results = new Map(games.map((g) => [g.gameId, 'draw' as const]));
    const scen = scenariosFromFailedEndgames(games, results, 'fr', 6);
    expect(scen.length).toBe(6);
    expect(scen[0].id).toBe('endg:g8'); // newest first
  });
});

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
