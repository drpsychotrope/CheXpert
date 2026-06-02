import { describe, it, expect } from 'vitest';
import { motifEfficacy } from './efficacy';
import { buildFingerprint } from './fingerprint';
import type { GameAnalysis, PlyAnalysis } from './types';

function ply(p: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0, moveNumber: 1, color: 'w', san: 'Nf3', uci: 'g1f3',
    fenBefore: 'fen', fenAfter: 'fen2',
    bestUci: null, bestWhiteCp: 0, playedWhiteCp: 0, cpLoss: 0,
    winProbLoss: 10, severity: 'good', phase: 'middlegame',
    ...p,
  } as PlyAnalysis;
}

function game(analyzedAt: number, plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w'): GameAnalysis {
  return {
    gameId: `g${analyzedAt}`, source: 'played', playerColor, analyzedAt, movetimeMs: 100,
    plies,
    byPhase: {
      opening: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      middlegame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    },
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}

const fork = (sev: PlyAnalysis['severity']): PlyAnalysis =>
  ply({ severity: sev, phase: 'middlegame', motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } });
const clean = (): PlyAnalysis => ply({ severity: 'good', phase: 'middlegame' });

/** A game with `misses` fork-mistakes and `clean` good middlegame moves. */
function mg(at: number, misses: number, cleanMoves: number): GameAnalysis {
  const plies = [
    ...Array.from({ length: misses }, () => fork('mistake')),
    ...Array.from({ length: cleanMoves }, () => clean()),
  ];
  return game(at, plies);
}

describe('motifEfficacy', () => {
  it('reports a negative deltaPct when fork-misses fall from early→recent', () => {
    // early (at 1,2): high miss density; recent (at 3,4): low.
    const analyses = [mg(1, 8, 12), mg(2, 8, 12), mg(3, 2, 18), mg(4, 2, 18)];
    const r = motifEfficacy(analyses, 'fork', { minMoves: 5 });
    expect(r.early.missRate).toBeGreaterThan(r.recent.missRate);
    expect(r.deltaPct).toBeLessThan(0); // improved
    expect(r.enoughData).toBe(true);
    expect(r.motifKey).toBe('fork');
  });

  it('reports a positive deltaPct when misses rise', () => {
    const analyses = [mg(1, 2, 18), mg(2, 2, 18), mg(3, 8, 12), mg(4, 8, 12)];
    const r = motifEfficacy(analyses, 'fork', { minMoves: 5 });
    expect(r.deltaPct).toBeGreaterThan(0);
  });

  it('keys exactly like buildFingerprint (parity)', () => {
    const analyses = [mg(1, 4, 8), mg(2, 4, 8)];
    const topKey = buildFingerprint(analyses).leaks[0].key;
    const r = motifEfficacy(analyses, topKey, { minMoves: 1 });
    expect(r.motifKey).toBe(topKey);
    expect(r.early.misses + r.recent.misses).toBeGreaterThan(0);
  });

  it('uses a phase-scoped denominator: unrelated-phase moves do not move the rate', () => {
    const base = [mg(1, 4, 6), mg(2, 4, 6)];
    const r1 = motifEfficacy(base, 'fork', { minMoves: 1 });
    // Add many clean ENDGAME player moves — different phase than the fork misses.
    const withEndgame = [
      game(1, [...base[0].plies, ...Array.from({ length: 50 }, () => ply({ phase: 'endgame', severity: 'good' }))]),
      base[1],
    ];
    const r2 = motifEfficacy(withEndgame, 'fork', { minMoves: 1 });
    expect(r2.early.missRate).toBeCloseTo(r1.early.missRate, 5);
  });

  it('ignores opponent plies (player-moves only)', () => {
    const playerForks = [fork('mistake'), fork('mistake'), clean(), clean()];
    const oppForks = [
      ply({ color: 'b', severity: 'mistake', motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } }),
    ];
    const analyses = [game(1, [...playerForks, ...oppForks], 'w'), game(2, [...playerForks], 'w')];
    const r = motifEfficacy(analyses, 'fork', { minMoves: 1 });
    // 4 player misses total across two windows; opponent fork excluded.
    expect(r.early.misses + r.recent.misses).toBe(4);
  });

  it('gates enoughData=false below minMoves and suppresses no data via zeros, never a verdict string', () => {
    const r = motifEfficacy([mg(1, 1, 1), mg(2, 1, 1)], 'fork', { minMoves: 20 });
    expect(r.enoughData).toBe(false);
    // Type guarantee: the readout exposes numbers, never a verdict label.
    expect(typeof r.deltaPct).toBe('number');
    expect((r as unknown as Record<string, unknown>).verdict).toBeUndefined();
  });

  it('returns a zeroed readout for empty input without throwing', () => {
    const r = motifEfficacy([], 'fork');
    expect(r.early).toEqual({ missRate: 0, playerMoves: 0, misses: 0 });
    expect(r.recent).toEqual({ missRate: 0, playerMoves: 0, misses: 0 });
    expect(r.deltaPct).toBe(0);
    expect(r.enoughData).toBe(false);
  });

  it('is deterministic (no Date/random)', () => {
    const a = [mg(1, 4, 8), mg(2, 4, 8), mg(3, 2, 10), mg(4, 2, 10)];
    expect(motifEfficacy(a, 'fork')).toEqual(motifEfficacy(a, 'fork'));
  });
});
