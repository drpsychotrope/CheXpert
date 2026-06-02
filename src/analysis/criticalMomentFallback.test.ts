import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { fallbackDrillItems } from './criticalMomentFallback';
import { labelPly } from './criticalMomentDrill';

describe('fallbackDrillItems', () => {
  const items = fallbackDrillItems();

  it('is non-empty and contains both labels', () => {
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.some((it) => it.label === 'critical')).toBe(true);
    expect(items.some((it) => it.label === 'routine')).toBe(true);
  });

  it('every FEN is legal and has at least one legal move', () => {
    for (const it of items) {
      // chess.js throws on an invalid FEN — a typo can't ship.
      const c = new Chess(it.fenBefore);
      expect(c.moves().length).toBeGreaterThan(0);
      expect(it.fenBefore).toBe(it.ply.fenBefore); // mirror invariant
    }
  });

  it('each bundled winProbLoss agrees with the item label under default thresholds', () => {
    for (const it of items) {
      expect(it.winProbLoss).toBe(it.ply.winProbLoss);
      expect(labelPly(it.ply)).toBe(it.label);
    }
  });

  it('gives every item a stable, unique gameId/fen so dedup and keys are safe', () => {
    const fens = items.map((it) => it.fenBefore);
    expect(new Set(fens).size).toBe(fens.length);
    expect(items.every((it) => it.gameId.startsWith('fallback'))).toBe(true);
  });
});
