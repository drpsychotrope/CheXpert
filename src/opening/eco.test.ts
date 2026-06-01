import { describe, it, expect } from 'vitest';
import { nameOpening, firstOutOfBook, type EcoEntry } from './eco';

const TABLE: EcoEntry[] = [
  { eco: 'B20', name: 'Sicilian Defence', uci: ['e2e4', 'c7c5'] },
  { eco: 'B90', name: 'Sicilian, Najdorf', uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'] },
  { eco: 'C50', name: 'Italian Game', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
];

describe('nameOpening (longest-prefix)', () => {
  it('names the deepest matching line', () => {
    const najdorf = ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1g5'];
    const r = nameOpening(najdorf, TABLE);
    expect(r?.name).toBe('Sicilian, Najdorf');
    expect(r?.eco).toBe('B90');
    expect(r?.plyInBook).toBe(10);
  });

  it('falls back to the shallower line when the game deviates early', () => {
    const r = nameOpening(['e2e4', 'c7c5', 'b1c3'], TABLE); // not Najdorf
    expect(r?.name).toBe('Sicilian Defence');
    expect(r?.plyInBook).toBe(2);
  });

  it('returns null for an unknown / empty opening', () => {
    expect(nameOpening(['a2a3'], TABLE)).toBeNull();
    expect(nameOpening([], TABLE)).toBeNull();
  });
});

describe('firstOutOfBook', () => {
  it('is the depth of the deepest matching named line', () => {
    expect(firstOutOfBook(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'], TABLE)).toBe(5); // Italian = 5 plies
    expect(firstOutOfBook(['a2a3'], TABLE)).toBe(0);
  });
});
