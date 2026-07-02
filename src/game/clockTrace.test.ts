import { describe, it, expect } from 'vitest';
import { msToClk, timeControlTag, pgnWithClocks, type PlyClockSnap } from './clockTrace';
import { parsePgn } from '../analysis/pgn';
import { Chess } from 'chess.js';

describe('msToClk (I4 defensive formatting)', () => {
  it('formats H:MM:SS with floor-to-second', () => {
    expect(msToClk(0)).toBe('0:00:00');
    expect(msToClk(59_400)).toBe('0:00:59');
    expect(msToClk(303_000)).toBe('0:05:03');
    expect(msToClk(3_600_000)).toBe('1:00:00');
  });
  it('clamps negative / non-finite to 0:00:00 (never a corrupt clock)', () => {
    expect(msToClk(-5)).toBe('0:00:00');
    expect(msToClk(Number.NaN)).toBe('0:00:00');
    expect(msToClk(Number.POSITIVE_INFINITY)).toBe('0:00:00');
  });
});

describe('timeControlTag', () => {
  it('emits the "init+inc" shape parseIncrement reads back', () => {
    expect(timeControlTag(300, 3)).toBe('300+3');
    expect(timeControlTag(600, 0)).toBe('600+0');
  });
});

function pgnOf(sans: string[]): string {
  const c = new Chess();
  for (const s of sans) c.move(s);
  return c.pgn();
}

describe('pgnWithClocks → parsePgn round-trip (gate vague 0, PR-02)', () => {
  it('annotates every ply and the existing parser reads clockMs + derives secondsSpent', () => {
    const pgn = pgnOf(['e4', 'e5', 'Nf3', 'Nc6']);
    const trace: PlyClockSnap[] = [
      { side: 'w', remainingMs: 300_000 }, // after 1. e4 (inc already applied by press)
      { side: 'b', remainingMs: 298_000 },
      { side: 'w', remainingMs: 295_000 }, // white spent 300-295+3(inc) = 8s
      { side: 'b', remainingMs: 290_000 }, // black spent 298-290+3 = 11s
    ];
    const out = pgnWithClocks(pgn, trace, timeControlTag(300, 3));

    const parsed = parsePgn(out);
    expect(parsed.incrementSec).toBe(3);
    expect(parsed.plies.map((p) => p.clockMs)).toEqual([300_000, 298_000, 295_000, 290_000]);
    expect(parsed.plies[2].secondsSpent).toBe(8);
    expect(parsed.plies[3].secondsSpent).toBe(11);
  });

  it('tolerates a trace shorter than the game (annotates the prefix only)', () => {
    const out = pgnWithClocks(pgnOf(['e4', 'e5', 'Nf3']), [{ side: 'w', remainingMs: 60_000 }], '60+0');
    const parsed = parsePgn(out);
    expect(parsed.plies[0].clockMs).toBe(60_000);
    expect(parsed.plies[1].clockMs).toBeUndefined();
    expect(parsed.plies[2].clockMs).toBeUndefined();
  });

  it('skips a snapshot whose side does not match the mover (desync → absent beats wrong)', () => {
    const trace: PlyClockSnap[] = [
      { side: 'b', remainingMs: 55_000 }, // wrong: ply 0 is white's move
      { side: 'b', remainingMs: 54_000 },
    ];
    const parsed = parsePgn(pgnWithClocks(pgnOf(['e4', 'e5']), trace, '60+0'));
    expect(parsed.plies[0].clockMs).toBeUndefined();
    expect(parsed.plies[1].clockMs).toBe(54_000);
  });

  it('preserves existing headers and the moves themselves', () => {
    const c = new Chess();
    c.header('Event', 'Casual');
    c.move('e4');
    const out = pgnWithClocks(c.pgn(), [{ side: 'w', remainingMs: 1_000 }], '300+0');
    const parsed = parsePgn(out);
    expect(parsed.headers.Event).toBe('Casual');
    expect(parsed.headers.TimeControl).toBe('300+0');
    expect(parsed.plies.map((p) => p.san)).toEqual(['e4']);
  });

  it('throws on a malformed PGN (caller guards with try/catch, AP-TELEM-1)', () => {
    expect(() => pgnWithClocks('not a pgn at all }{', [], '300+0')).toThrow();
  });
});
