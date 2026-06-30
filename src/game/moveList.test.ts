import { describe, it, expect } from 'vitest';
import { toMovePairs } from './moveList';

describe('toMovePairs (P2 move-list formatter — single numbering authority)', () => {
  it('empty history → []', () => {
    expect(toMovePairs([])).toEqual([]);
  });

  it('standard start: pairs and numbers white-first', () => {
    expect(toMovePairs(['e4', 'e5', 'Nf3'])).toEqual([
      { no: 1, white: 'e4', whitePly: 0, black: 'e5', blackPly: 1 },
      { no: 2, white: 'Nf3', whitePly: 2 },
    ]);
  });

  it('even ply count yields full pairs (no trailing white-only)', () => {
    const pairs = toMovePairs(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(pairs).toHaveLength(2);
    expect(pairs[1]).toEqual({ no: 2, white: 'Nf3', whitePly: 2, black: 'Nc6', blackPly: 3 });
  });

  it('odd ply count yields a trailing white-only pair', () => {
    const pairs = toMovePairs(['e4', 'e5', 'Nf3']);
    expect(pairs).toHaveLength(2);
    expect(pairs[1].black).toBeUndefined();
    expect(pairs[1].blackPly).toBeUndefined();
    expect(pairs[1]).toEqual({ no: 2, white: 'Nf3', whitePly: 2 });
  });

  it('Black-first start (loaded mid-game / 960): leading row has no white ply', () => {
    // startSide='b' means ply 0 is Black to move → "1... e5  2. Nf3 …".
    expect(toMovePairs(['e5', 'Nf3', 'Nc6'], 'b')).toEqual([
      { no: 1, black: 'e5', blackPly: 0 },
      { no: 2, white: 'Nf3', whitePly: 1, black: 'Nc6', blackPly: 2 },
    ]);
  });

  it('honours a non-1 starting move number', () => {
    expect(toMovePairs(['Qd8', 'Ke2'], 'b', 14)).toEqual([
      { no: 14, black: 'Qd8', blackPly: 0 },
      { no: 15, white: 'Ke2', whitePly: 1 },
    ]);
  });

  it('960 castle SAN (O-O / O-O-O) passes through verbatim', () => {
    const pairs = toMovePairs(['O-O', 'O-O-O', 'Rfe1']);
    expect(pairs[0]).toEqual({ no: 1, white: 'O-O', whitePly: 0, black: 'O-O-O', blackPly: 1 });
    expect(pairs[1]).toEqual({ no: 2, white: 'Rfe1', whitePly: 2 });
  });

  it('whitePly/blackPly indices map back to the right sanHistory slots', () => {
    const san = ['e4', 'c5', 'Nf3', 'd6', 'd4'];
    const pairs = toMovePairs(san);
    for (const p of pairs) {
      if (p.whitePly !== undefined) expect(san[p.whitePly]).toBe(p.white);
      if (p.blackPly !== undefined) expect(san[p.blackPly]).toBe(p.black);
    }
    // The latest ply (index 4) is the white ply of the final pair.
    expect(pairs.at(-1)?.whitePly).toBe(4);
    expect(pairs.at(-1)?.white).toBe('d4');
  });
});
