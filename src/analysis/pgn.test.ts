import { describe, it, expect } from 'vitest';
import { parsePgn, parseIncrement, clockToMs } from './pgn';

describe('pgn parsing', () => {
  it('parses increment and clock strings', () => {
    expect(parseIncrement('300+3')).toBe(3);
    expect(parseIncrement('600')).toBe(0);
    expect(parseIncrement(undefined)).toBe(0);
    expect(clockToMs('0:05:00')).toBe(300000);
    expect(clockToMs('1:30')).toBe(90000);
  });

  it('parses a simple PGN into plies with before/after FENs', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 *';
    const g = parsePgn(pgn);
    expect(g.plies).toHaveLength(4);
    expect(g.plies[0].san).toBe('e4');
    expect(g.plies[0].color).toBe('w');
    expect(g.plies[0].uci).toBe('e2e4');
    expect(g.plies[0].fenBefore).toContain('w KQkq');
    expect(g.plies[1].moveNumber).toBe(1);
    expect(g.plies[2].moveNumber).toBe(2);
  });

  it('captures clock annotations and seconds spent', () => {
    const pgn =
      '[TimeControl "300+0"]\n\n' +
      '1. e4 { [%clk 0:05:00] } e5 { [%clk 0:05:00] } ' +
      '2. Nf3 { [%clk 0:04:50] } Nc6 { [%clk 0:04:55] } *';
    const g = parsePgn(pgn);
    // White's 2nd move: 5:00 -> 4:50 = 10s spent.
    const whiteSecond = g.plies.find((p) => p.color === 'w' && p.moveNumber === 2);
    expect(whiteSecond?.secondsSpent).toBeCloseTo(10, 0);
  });

  it('throws on malformed PGN', () => {
    expect(() => parsePgn('1. e4 e5 2. Qxz9')).toThrow();
  });
});
