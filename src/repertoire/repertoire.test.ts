import { describe, it, expect } from 'vitest';
import { buildLine, RepertoireDrill } from './repertoire';

const T0 = Date.UTC(2026, 4, 31);

describe('buildLine', () => {
  it('builds a valid line from SAN moves', () => {
    const r = buildLine('l1', 'Italian', 'w', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], T0);
    expect(r.ok).toBe(true);
    expect(r.line?.moves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']);
    expect(r.line?.san).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
  });

  it('rejects an illegal move', () => {
    const r = buildLine('l2', 'Bad', 'w', ['e4', 'e5', 'Ke2??no'], T0);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Illegal');
  });

  it('rejects an empty line', () => {
    expect(buildLine('l3', 'Empty', 'w', [], T0).ok).toBe(false);
  });
});

describe('RepertoireDrill', () => {
  it('auto-plays opponent moves and accepts the player line (white)', () => {
    const line = buildLine('l1', 'Italian', 'w', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], T0).line!;
    const drill = new RepertoireDrill(line);
    // White to move first → player plays e4.
    expect(drill.expected()).toBe('e2e4');
    expect(drill.play('e2e4')).toBe('correct'); // opponent e5 auto-plays
    expect(drill.expected()).toBe('g1f3');
    expect(drill.play('g1f3')).toBe('correct'); // opponent Nc6 auto-plays
    expect(drill.play('f1c4')).toBe('done');
    expect(drill.done).toBe(true);
    expect(drill.mistakes).toBe(0);
  });

  it('counts a mistake on a wrong move without advancing', () => {
    const line = buildLine('l1', 'Italian', 'w', ['e4', 'e5', 'Nf3'], T0).line!;
    const drill = new RepertoireDrill(line);
    expect(drill.play('d2d4')).toBe('wrong');
    expect(drill.mistakes).toBe(1);
    expect(drill.expected()).toBe('e2e4'); // unchanged
    expect(drill.play('e2e4')).toBe('correct'); // opp e5 auto-plays; player's Nf3 still pending
    expect(drill.play('g1f3')).toBe('done'); // last ply of the line
    expect(drill.done).toBe(true);
  });

  it('drills a black repertoire (opponent moves first)', () => {
    // Line: 1.e4 e5 2.Nf3 Nc6 — player is Black, trains e5 and Nc6.
    const line = buildLine('lb', 'Open', 'b', ['e4', 'e5', 'Nf3', 'Nc6'], T0).line!;
    const drill = new RepertoireDrill(line);
    // White e4 auto-plays; Black to move.
    expect(drill.expected()).toBe('e7e5');
    expect(drill.play('e7e5')).toBe('correct'); // white Nf3 auto-plays
    expect(drill.play('b8c6')).toBe('done');
  });
});
