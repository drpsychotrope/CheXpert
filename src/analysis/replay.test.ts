import { describe, it, expect } from 'vitest';
import { nagFor, evalLabel, moveRows, clampIndex } from './replay';
import type { PlyAnalysis } from './types';

const ply = (i: number, color: 'w' | 'b', san: string, over: Partial<PlyAnalysis> = {}): PlyAnalysis => ({
  ply: i, moveNumber: Math.floor(i / 2) + 1, color, san, uci: 'e2e4',
  fenBefore: 'f0', fenAfter: 'f1', bestUci: 'e2e4', bestWhiteCp: 20, playedWhiteCp: 15,
  cpLoss: 5, winProbLoss: 0.5, severity: 'good', phase: 'opening', ...over,
});

describe('nagFor / evalLabel (PR-08)', () => {
  it('maps severities to standard NAGs, silent on fine moves', () => {
    expect(nagFor('best')).toBe('');
    expect(nagFor('good')).toBe('');
    expect(nagFor('inaccuracy')).toBe('?!');
    expect(nagFor('mistake')).toBe('?');
    expect(nagFor('blunder')).toBe('??');
  });
  it('labels the post-move eval in pawns, White POV, signed', () => {
    expect(evalLabel(ply(0, 'w', 'e4', { playedWhiteCp: 150 }))).toBe('+1.5');
    expect(evalLabel(ply(0, 'w', 'e4', { playedWhiteCp: -80 }))).toBe('-0.8');
    expect(evalLabel(ply(0, 'w', 'e4', { playedWhiteCp: 0 }))).toBe('0.0');
  });
});

describe('moveRows', () => {
  it('pairs W/B halves under one move number and flags the analysed player', () => {
    const rows = moveRows(
      [ply(0, 'w', 'e4'), ply(1, 'b', 'e5', { severity: 'mistake' }), ply(2, 'w', 'Nf3')],
      'b',
    );
    expect(rows.length).toBe(2);
    expect(rows[0].white?.san).toBe('e4');
    expect(rows[0].white?.mine).toBe(false);
    expect(rows[0].black?.nag).toBe('?');
    expect(rows[0].black?.mine).toBe(true);
    expect(rows[1].white?.i).toBe(2);
    expect(rows[1].black).toBeUndefined();
  });
});

describe('clampIndex', () => {
  it('clamps into [-1, n-1]', () => {
    expect(clampIndex(-5, 10)).toBe(-1);
    expect(clampIndex(3, 10)).toBe(3);
    expect(clampIndex(99, 10)).toBe(9);
    expect(clampIndex(2.7, 10)).toBe(2);
  });
});
