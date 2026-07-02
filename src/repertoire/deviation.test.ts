import { describe, it, expect } from 'vitest';
import { findDeviation, MIN_MATCHED_PLIES } from './deviation';
import type { RepertoireLine } from './types';

const line = (id: string, color: 'w' | 'b', moves: string[], san: string[]): RepertoireLine => ({
  id, color, name: id, moves, san, createdAt: 1,
});

// Italian: 1. e4 e5 2. Nf3 Nc6 3. Bc4
const ITALIAN = line('italian', 'w', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
// Short white line: 1. e4 e5 2. Nf3
const SHORT = line('short', 'w', ['e2e4', 'e7e5', 'g1f3'], ['e4', 'e5', 'Nf3']);

describe('findDeviation (PR-13)', () => {
  it('reports the PLAYER leaving their own line (white deviates at ply 4)', () => {
    const d = findDeviation([ITALIAN], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'w')!;
    expect(d).toMatchObject({ lineId: 'italian', ply: 4, moveNumber: 3, expectedSan: 'Bc4', playedSan: 'Bb5', byPlayer: true });
  });

  it('reports the OPPONENT leaving the line (black deviates at ply 3 → extension opportunity)', () => {
    const d = findDeviation([ITALIAN], ['e2e4', 'e7e5', 'g1f3', 'g8f6'], ['e4', 'e5', 'Nf3', 'Nf6'], 'w')!;
    expect(d.byPlayer).toBe(false);
    expect(d.ply).toBe(3);
    expect(d.expectedSan).toBe('Nc6');
  });

  it('prefers the DEEPEST matching line', () => {
    const d = findDeviation([SHORT, ITALIAN], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'w')!;
    expect(d.lineId).toBe('italian'); // SHORT fully matched (no deviation); ITALIAN matched deeper then diverged
  });

  it('null when the whole line was followed, when the game ends inside it, or when nothing is in play', () => {
    expect(findDeviation([ITALIAN], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], 'w')).toBeNull();
    expect(findDeviation([ITALIAN], ['e2e4', 'e7e5'], ['e4', 'e5'], 'w')).toBeNull(); // ended inside
    expect(findDeviation([ITALIAN], ['d2d4', 'd7d5'], ['d4', 'd5'], 'w')).toBeNull(); // < MIN_MATCHED_PLIES
    expect(MIN_MATCHED_PLIES).toBe(2);
  });

  it('ignores lines of the other colour', () => {
    const black = line('caro', 'b', ['e2e4', 'c7c6'], ['e4', 'c6']);
    expect(findDeviation([black], ['e2e4', 'e7e5', 'g1f3'], ['e4', 'e5', 'Nf3'], 'w')).toBeNull();
  });
});
