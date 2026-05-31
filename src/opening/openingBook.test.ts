import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { OPENING_BOOK, selectOpening, nextBookMove, steeringNote } from './openingBook';

describe('opening book integrity', () => {
  it('every line is legal from the start position', () => {
    for (const o of OPENING_BOOK) {
      const c = new Chess();
      for (const uci of o.moves) {
        const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as never });
        expect(m, `${o.id}: illegal ${uci}`).toBeTruthy();
      }
    }
  });

  it('covers both bot colours and all five dimensions', () => {
    expect(OPENING_BOOK.some((o) => o.botColor === 'w')).toBe(true);
    expect(OPENING_BOOK.some((o) => o.botColor === 'b')).toBe(true);
    const dims = new Set(OPENING_BOOK.map((o) => o.targets));
    for (const d of ['tactics', 'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience']) {
      expect(dims.has(d as never)).toBe(true);
    }
  });
});

describe('selectOpening (weakness steering, AP-CHESS-22)', () => {
  it('only returns openings of the requested bot colour', () => {
    for (let i = 0; i < 20; i++) {
      const o = selectOpening('w', 'tactics', i / 20);
      expect(o.botColor).toBe('w');
    }
  });

  it('biases toward the weak dimension ~3:1 but keeps variety', () => {
    const N = 1000;
    let weakPicks = 0;
    let otherPicks = 0;
    const weak = 'tactics' as const;
    for (let i = 0; i < N; i++) {
      const o = selectOpening('w', weak, i / N);
      if (o.targets === weak) weakPicks++;
      else otherPicks++;
    }
    // Weak area dominates...
    expect(weakPicks).toBeGreaterThan(otherPicks);
    // ...but other openings still appear (not a one-note machine).
    expect(otherPicks).toBeGreaterThan(0);
  });

  it('with no weakness, returns a valid opening (pure variety)', () => {
    const o = selectOpening('w', null, 0.5);
    expect(o.botColor).toBe('w');
  });
});

describe('nextBookMove', () => {
  it('feeds the bot its book moves while on the line (bot=White)', () => {
    const italian = OPENING_BOOK.find((o) => o.id === 'italian-w')!;
    expect(nextBookMove(italian, [])).toBe('e2e4'); // bot White move 1
    expect(nextBookMove(italian, ['e2e4'])).toBeNull(); // player's turn (Black)
    expect(nextBookMove(italian, ['e2e4', 'e7e5'])).toBe('g1f3');
  });

  it('returns null once the player leaves the book', () => {
    const italian = OPENING_BOOK.find((o) => o.id === 'italian-w')!;
    // Player answered 1.e4 with c5 instead of the book's e5 → off book.
    expect(nextBookMove(italian, ['e2e4', 'c7c5'])).toBeNull();
  });

  it('returns null when the book line is exhausted', () => {
    const italian = OPENING_BOOK.find((o) => o.id === 'italian-w')!;
    expect(nextBookMove(italian, italian.moves)).toBeNull();
  });

  it('feeds book moves for a Black bot (player moves first)', () => {
    const scandi = OPENING_BOOK.find((o) => o.id === 'scandi-b')!;
    expect(nextBookMove(scandi, [])).toBeNull(); // White (player) to move
    expect(nextBookMove(scandi, ['e2e4'])).toBe('d7d5'); // bot Black reply
  });
});

describe('steeringNote', () => {
  it('names the weakness when the opening targets it', () => {
    const italian = OPENING_BOOK.find((o) => o.id === 'italian-w')!;
    expect(steeringNote(italian, 'tactics')).toContain('weakest area');
    expect(steeringNote(italian, 'endgameConversion')).not.toContain('weakest area');
  });
});
