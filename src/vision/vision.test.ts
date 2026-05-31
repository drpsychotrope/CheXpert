import { describe, it, expect } from 'vitest';
import {
  isSquare, squareColor, allSquares, squareFrom,
  knightMovesFrom, isKnightMove, knightShortestPath, knightDistance,
} from './vision';

describe('square vision', () => {
  it('validates squares', () => {
    expect(isSquare('e4')).toBe(true);
    expect(isSquare('a1')).toBe(true);
    expect(isSquare('i9')).toBe(false);
    expect(isSquare('e')).toBe(false);
  });

  it('knows square colours (a1 dark, h1 light, a8 light, h8 dark)', () => {
    expect(squareColor('a1')).toBe('dark');
    expect(squareColor('h1')).toBe('light');
    expect(squareColor('a8')).toBe('light');
    expect(squareColor('h8')).toBe('dark');
    expect(squareColor('e4')).toBe('light');
    expect(squareColor('d4')).toBe('dark');
  });

  it('enumerates all 64 squares', () => {
    const all = allSquares();
    expect(all).toHaveLength(64);
    expect(all[0]).toBe('a1');
    expect(all[63]).toBe('h8');
    expect(new Set(all).size).toBe(64);
  });

  it('squareFrom is deterministic and in range', () => {
    expect(isSquare(squareFrom(0))).toBe(true);
    expect(squareFrom(0)).toBe('a1');
    expect(squareFrom(0.999999)).toBe('h8');
    expect(squareFrom(0.5)).toBe(squareFrom(0.5)); // deterministic
  });
});

describe('knight vision', () => {
  it('lists knight moves from a corner (2) and centre (8)', () => {
    expect(knightMovesFrom('a1').sort()).toEqual(['b3', 'c2'].sort());
    expect(knightMovesFrom('d4')).toHaveLength(8);
  });

  it('recognises a single knight move', () => {
    expect(isKnightMove('g1', 'f3')).toBe(true);
    expect(isKnightMove('g1', 'g3')).toBe(false);
  });

  it('finds the shortest knight path', () => {
    expect(knightShortestPath('a1', 'a1')).toEqual(['a1']);
    const p = knightShortestPath('g1', 'f3');
    expect(p).toEqual(['g1', 'f3']);
    // a1 -> h8 is a known 6-move knight journey.
    expect(knightDistance('a1', 'h8')).toBe(6);
    // a1 -> b3 is one move.
    expect(knightDistance('a1', 'b3')).toBe(1);
  });

  it('path endpoints are correct and each step is a legal knight hop', () => {
    const p = knightShortestPath('b1', 'g8')!;
    expect(p[0]).toBe('b1');
    expect(p[p.length - 1]).toBe('g8');
    for (let i = 1; i < p.length; i++) expect(isKnightMove(p[i - 1], p[i])).toBe(true);
  });

  it('returns null for invalid squares', () => {
    expect(knightShortestPath('z9', 'a1')).toBeNull();
    expect(knightDistance('a1', 'z9')).toBe(-1);
  });
});
