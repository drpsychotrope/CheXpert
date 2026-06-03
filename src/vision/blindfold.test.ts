import { describe, it, expect } from 'vitest';
import { pieceAt, genBlindfold } from './blindfold';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('pieceAt', () => {
  it('reads case-sensitive FEN chars (colour matters)', () => {
    expect(pieceAt(START, 'e1')).toBe('K'); // white king
    expect(pieceAt(START, 'e8')).toBe('k'); // black king
    expect(pieceAt(START, 'd1')).toBe('Q');
    expect(pieceAt(START, 'a1')).toBe('R');
    expect(pieceAt(START, 'h8')).toBe('r');
    expect(pieceAt(START, 'b8')).toBe('n');
  });
  it('returns null for empty squares', () => {
    expect(pieceAt(START, 'e4')).toBeNull();
    expect(pieceAt(START, 'd5')).toBeNull();
    expect(pieceAt(START, 'a3')).toBeNull();
  });
  it('returns null for an invalid square', () => {
    expect(pieceAt(START, 'z9')).toBeNull();
    expect(pieceAt(START, '')).toBeNull();
  });
});

describe('genBlindfold', () => {
  it('is deterministic for a given pick and answers with the truth', () => {
    const q = genBlindfold(START, 0.3);
    expect(genBlindfold(START, 0.3)).toEqual(q);
    expect(q.answer).toBe(pieceAt(START, q.square));
  });
  it('exercises both occupied and empty squares across the pick range', () => {
    const answers = new Set<string | null>();
    for (let i = 0; i < 64; i++) answers.add(genBlindfold(START, i / 64).answer);
    expect(answers.has(null)).toBe(true); // some empty
    expect([...answers].some((a) => a !== null)).toBe(true); // some occupied
  });
});
