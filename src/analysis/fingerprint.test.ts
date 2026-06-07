import { describe, it, expect } from 'vitest';
import { buildFingerprint, weaknessTrend, leakKey, leakTarget, type Leak } from './fingerprint';
import type { GameAnalysis, GamePhase, PhaseStat, PlyAnalysis, MotifResult } from './types';

function ply(p: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0, moveNumber: 1, color: 'w', san: 'x', uci: 'e2e4',
    fenBefore: 'f', fenAfter: 'f', bestUci: 'e2e4', bestWhiteCp: 0, playedWhiteCp: 0,
    cpLoss: 0, winProbLoss: 0, severity: 'good', phase: 'middlegame', ...p,
  };
}
const motif = (tag: string, confidence: 'high' | 'low' = 'high'): MotifResult => ({ tag, tags: [tag], confidence });
const PHASE: PhaseStat = { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 };
function game(plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w', analyzedAt = 0, gameId = 'g'): GameAnalysis {
  return {
    gameId, source: 'imported', playerColor, analyzedAt, movetimeMs: 100, plies,
    byPhase: { opening: PHASE, middlegame: PHASE, endgame: PHASE } as Record<GamePhase, PhaseStat>,
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}

describe('buildFingerprint', () => {
  it('clusters player mistakes by confident motif and ranks by impact (count × avgWpl)', () => {
    const g = game([
      ply({ ply: 0, severity: 'blunder', winProbLoss: 30, motif: motif('fork'), fenBefore: 'fork1' }),
      ply({ ply: 1, color: 'b', severity: 'blunder', winProbLoss: 90, motif: motif('pin') }), // opponent — ignored
      ply({ ply: 2, severity: 'mistake', winProbLoss: 15, motif: motif('fork'), fenBefore: 'fork2' }),
      ply({ ply: 3, severity: 'blunder', winProbLoss: 25, motif: motif('hangingPiece'), fenBefore: 'hang1' }),
    ]);
    const { leaks } = buildFingerprint([g]);
    expect(leaks[0].motif).toBe('fork'); // 2×~22 impact > hangingPiece 1×25
    expect(leaks[0].count).toBe(2);
    expect(leaks.find((l) => l.motif === 'hangingPiece')?.count).toBe(1);
    expect(leaks.some((l) => l.motif === 'pin')).toBe(false); // opponent move excluded
  });

  it('falls back to phase:severity for low-confidence motifs', () => {
    const g = game([ply({ severity: 'mistake', winProbLoss: 12, phase: 'endgame', motif: motif('x', 'low'), fenBefore: 'e1' })]);
    const { leaks } = buildFingerprint([g]);
    expect(leaks[0].key).toBe('endgame:mistake');
  });

  it('keeps up to 3 example FENs, highest win-prob loss first', () => {
    const g = game([
      ply({ ply: 0, severity: 'blunder', winProbLoss: 10, motif: motif('fork'), fenBefore: 'lo' }),
      ply({ ply: 1, severity: 'blunder', winProbLoss: 40, motif: motif('fork'), fenBefore: 'hi' }),
      ply({ ply: 2, severity: 'blunder', winProbLoss: 25, motif: motif('fork'), fenBefore: 'mid' }),
      ply({ ply: 3, severity: 'blunder', winProbLoss: 5, motif: motif('fork'), fenBefore: 'lowest' }),
    ]);
    const leak = buildFingerprint([g]).leaks[0];
    expect(leak.sampleFens).toEqual(['hi', 'mid', 'lo']); // top 3 by wpl, lowest dropped
  });

  it('caps at 8 leaks and returns empty for no analyses', () => {
    expect(buildFingerprint([]).leaks).toHaveLength(0);
    const many = game(Array.from({ length: 12 }, (_, i) => ply({ ply: i, severity: 'blunder', winProbLoss: 20, motif: motif(`m${i}`), fenBefore: `f${i}` })));
    expect(buildFingerprint([many]).leaks.length).toBeLessThanOrEqual(8);
  });
});

describe('weaknessTrend', () => {
  it('produces one snapshot per window of games', () => {
    const games = Array.from({ length: 10 }, (_, i) =>
      game([ply({ severity: 'blunder', winProbLoss: 25, phase: 'middlegame' })], 'w', i, `g${i}`),
    );
    const trend = weaknessTrend(games, { window: 5 });
    expect(trend).toHaveLength(2);
    expect(trend[0]).toHaveProperty('dims');
    expect(trend[0].dims).toHaveProperty('tactics');
  });
});

describe('leakKey', () => {
  it('uses the confident motif tag when confidence is high', () => {
    const p = ply({ motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } });
    expect(leakKey(p)).toBe('fork');
  });

  it('falls back to `${phase}:${severity}` for a low-confidence ply', () => {
    const p = ply({ phase: 'endgame', severity: 'blunder', motif: { tag: 'x', tags: ['x'], confidence: 'low' } });
    expect(leakKey(p)).toBe('endgame:blunder');
  });

  it('falls back when there is no motif at all', () => {
    const p = ply({ phase: 'opening', severity: 'mistake', motif: undefined });
    expect(leakKey(p)).toBe('opening:mistake');
  });

  it('agrees with the key buildFingerprint produces on the same fixture', () => {
    const confident = ply({ severity: 'blunder', winProbLoss: 20, motif: { tag: 'pin', tags: ['pin'], confidence: 'high' }, fenBefore: 'pin1' });
    const fallback = ply({ phase: 'endgame', severity: 'blunder', winProbLoss: 20, motif: undefined, fenBefore: 'eg1' });
    const { leaks } = buildFingerprint([game([confident, fallback])]);
    const keys = leaks.map((l) => l.key).sort();
    expect(keys).toEqual(['endgame:blunder', 'pin'].sort());
    expect(keys).toContain(leakKey(confident));
    expect(keys).toContain(leakKey(fallback));
  });
});

describe('leakTarget (W14)', () => {
  const leak = (key: string, motifLabel: string, phase: Leak['phase'] = 'middlegame'): Leak => ({
    key, motif: motifLabel, phase, count: 1, avgWpl: 10, sampleFens: [], severity: { mistake: 1, blunder: 0 },
  });
  it('routes opening leaks to the repertoire', () => {
    expect(leakTarget(leak('opening:mistake', 'opening mistake'))).toBe('repertoire');
  });
  it('routes endgame leaks to the endgames trainer', () => {
    expect(leakTarget(leak('endgame:blunder', 'endgame blunder', 'endgame'))).toBe('endgames');
  });
  it('routes tactical motifs to tactics', () => {
    expect(leakTarget(leak('fork', 'fork'))).toBe('tactics');
    expect(leakTarget(leak('pin', 'pin'))).toBe('tactics');
  });
});
