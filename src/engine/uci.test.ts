import { describe, it, expect } from 'vitest';
import { parseInfo, parseBestmove, scoreToWhiteCp } from './uci';

describe('uci parsing', () => {
  it('parses a cp score info line', () => {
    const info = parseInfo('info depth 18 seldepth 24 score cp 34 nodes 1000 pv e2e4');
    expect(info).toEqual({ depth: 18, cp: 34 });
  });

  it('parses a mate score info line', () => {
    const info = parseInfo('info depth 10 score mate -3 pv a1a2');
    expect(info?.mate).toBe(-3);
  });

  it('returns null for non-info lines', () => {
    expect(parseInfo('readyok')).toBeNull();
  });

  it('parses bestmove and handles (none)', () => {
    expect(parseBestmove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestmove('bestmove (none)')).toBeNull();
    expect(parseBestmove('info depth 1')).toBeNull();
  });

  it('converts mover-POV score to White POV', () => {
    // +50 cp for the mover; if Black to move that is -50 for White.
    expect(scoreToWhiteCp({ cp: 50 }, false)).toBe(-50);
    expect(scoreToWhiteCp({ cp: 50 }, true)).toBe(50);
  });

  it('clamps mate scores to a large finite White-POV value', () => {
    const v = scoreToWhiteCp({ mate: 2 }, true);
    expect(v).toBeGreaterThan(50000);
  });
});
