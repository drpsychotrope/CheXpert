import { describe, it, expect } from 'vitest';
import { ownOpeningStats, type OwnOpeningInput } from './ownStats';
import type { GameAnalysis } from '../analysis/types';
import type { EcoEntry } from './eco';

const TABLE: EcoEntry[] = [
  { eco: 'B20', name: 'Sicilian Defence', uci: ['e2e4', 'c7c5'] } as EcoEntry,
  { eco: 'C50', name: 'Italian Game', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] } as EcoEntry,
];

const game = (uci: string[], openingAcpl: number): GameAnalysis =>
  ({
    gameId: 'g', source: 'played', playerColor: 'w', analyzedAt: 1, movetimeMs: 200,
    plies: uci.map((u, i) => ({ ply: i, uci: u }) as never),
    byPhase: { opening: { plies: 4, acpl: openingAcpl, blunders: 0, mistakes: 0, inaccuracies: 0 }, middlegame: {}, endgame: {} } as never,
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  }) as GameAnalysis;

const item = (uci: string[], result: OwnOpeningInput['result'], acpl = 40): OwnOpeningInput => ({ analysis: game(uci, acpl), result });

describe('ownOpeningStats (PR-15)', () => {
  it('groups by named opening with score %, n, and mean opening ACPL, most-played first', () => {
    const stats = ownOpeningStats(
      [
        item(['e2e4', 'c7c5', 'g1f3'], 'win', 30),
        item(['e2e4', 'c7c5'], 'loss', 50),
        item(['e2e4', 'c7c5', 'b1c3'], 'draw', 40),
        item(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'], 'win', 20),
      ],
      TABLE,
    );
    expect(stats.length).toBe(2);
    expect(stats[0]).toMatchObject({ eco: 'B20', n: 3, wins: 1, draws: 1, losses: 1, scorePct: 50, avgOpeningAcpl: 40 });
    expect(stats[1]).toMatchObject({ eco: 'C50', n: 1, scorePct: 100, avgOpeningAcpl: 20 });
  });

  it('skips unnamed lines by default (1. a3 says nothing about repertoire choices)', () => {
    expect(ownOpeningStats([item(['a2a3', 'a7a6'], 'win')], TABLE).length).toBe(0);
    expect(ownOpeningStats([item(['a2a3', 'a7a6'], 'win')], TABLE, { includeUnnamed: true })[0].eco).toBe('—');
  });

  it('empty input → empty output', () => {
    expect(ownOpeningStats([], TABLE)).toEqual([]);
  });
});
