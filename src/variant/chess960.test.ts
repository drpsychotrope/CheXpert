import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { chess960Position, chess960PositionById, type Chess960Position } from './chess960';

const isDark = (file: number) => file % 2 === 0; // a=0 dark, b=1 light, ... (rank 1)

function checkLegal(p: Chess960Position) {
  const r = p.backRank;
  expect(r).toHaveLength(8);
  // exactly the right piece multiset
  const count = (ch: string) => [...r].filter((x) => x === ch).length;
  expect(count('r')).toBe(2);
  expect(count('b')).toBe(2);
  expect(count('n')).toBe(2);
  expect(count('q')).toBe(1);
  expect(count('k')).toBe(1);
  // bishops on opposite colours
  const bishops = [...r].map((ch, i) => (ch === 'b' ? i : -1)).filter((i) => i >= 0);
  expect(isDark(bishops[0])).not.toBe(isDark(bishops[1]));
  // king strictly between the two rooks
  const rooks = [...r].map((ch, i) => (ch === 'r' ? i : -1)).filter((i) => i >= 0);
  const king = r.indexOf('k');
  expect(king).toBeGreaterThan(Math.min(...rooks));
  expect(king).toBeLessThan(Math.max(...rooks));
}

describe('chess960 generator', () => {
  it('every id 0..959 yields a legal back-rank', () => {
    for (let id = 0; id < 960; id++) checkLegal(chess960PositionById(id));
  });

  it('round-trips id and id 518 is the standard position', () => {
    for (let id = 0; id < 960; id++) expect(chess960PositionById(id).id).toBe(id);
    expect(chess960PositionById(518).backRank).toBe('rnbqkbnr');
  });

  it('maps injected rand into 0..959 deterministically and legally', () => {
    for (const rand of [0, 0.25, 0.5, 0.7777, 0.999999]) {
      const p = chess960Position(rand);
      expect(p.id).toBeGreaterThanOrEqual(0);
      expect(p.id).toBeLessThan(960);
      checkLegal(p);
      // deterministic
      expect(chess960Position(rand).id).toBe(p.id);
    }
    expect(chess960Position(0).id).toBe(0);
    expect(chess960Position(0.999999).id).toBe(959);
  });

  it('startFen is chess.js-loadable, white to move, KQkq rights', () => {
    for (const id of [0, 518, 959, 1, 400]) {
      const p = chess960PositionById(id);
      const c = new Chess(p.startFen);
      expect(c.turn()).toBe('w');
      expect(p.startFen.split(' ')[2]).toBe('KQkq');
      // both sides mirror the same back-rank
      expect(p.startFen.split(' ')[0]).toBe(`${p.backRank}/pppppppp/8/8/8/8/PPPPPPPP/${p.backRank.toUpperCase()}`);
    }
  });

  it('castle metadata matches the back-rank letter positions', () => {
    for (const id of [0, 518, 959, 200]) {
      const p = chess960PositionById(id);
      const rooks = [...p.backRank].map((ch, i) => (ch === 'r' ? i : -1)).filter((i) => i >= 0);
      const king = p.backRank.indexOf('k');
      expect(p.castle.whiteKingFile).toBe(king);
      expect(p.castle.blackKingFile).toBe(king);
      expect([...p.castle.whiteRookFiles].sort((a, b) => a - b)).toEqual(rooks);
      expect([...p.castle.blackRookFiles].sort((a, b) => a - b)).toEqual(rooks);
    }
  });

  it('has no Math.random / Date.now in the source (pure core)', async () => {
    // @ts-ignore — 'fs'/'path' are available in the Vitest/Node runtime but not in the
    // browser-oriented tsconfig (no @types/node); suppress the module-not-found diagnostic.
    const { readFileSync } = (await import('fs')) as { readFileSync: (p: string, enc: string) => string };
    // @ts-ignore
    const { resolve } = (await import('path')) as { resolve: (...p: string[]) => string };
    // import.meta.url may not be a file: URL in jsdom env; resolve relative to cwd instead.
    const src = readFileSync(resolve(process.cwd(), 'src/variant/chess960.ts'), 'utf8');
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
  });
});
