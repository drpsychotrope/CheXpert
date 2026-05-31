import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { MASTER_GAMES } from './games';
import { GuessGame } from './guess';

describe('master games integrity', () => {
  it('every built-in game PGN is legal and finished', () => {
    for (const g of MASTER_GAMES) {
      const c = new Chess();
      expect(() => c.loadPgn(g.pgn), `${g.id} should load`).not.toThrow();
      expect(c.history().length, `${g.id} should have moves`).toBeGreaterThan(10);
    }
  });
});

describe('GuessGame', () => {
  const SHORT = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'; // guess White: e4, Nf3, Bb5

  it('auto-plays opponent moves; asks for the guess side first move', () => {
    const g = new GuessGame(SHORT, 'w');
    expect(g.expected()?.uci).toBe('e2e4');
    expect(g.totalGuesses()).toBe(3);
  });

  it('credits a correct guess and advances past the reply', () => {
    const g = new GuessGame(SHORT, 'w');
    expect(g.guess('e2e4')).toBe('correct'); // black e5 auto-plays
    expect(g.score).toBe(1);
    expect(g.expected()?.uci).toBe('g1f3');
  });

  it('a wrong guess does not advance and is counted', () => {
    const g = new GuessGame(SHORT, 'w');
    expect(g.guess('d2d4')).toBe('wrong');
    expect(g.score).toBe(0);
    expect(g.guesses).toBe(1);
    expect(g.expected()?.uci).toBe('e2e4'); // unchanged
  });

  it('completes the game and reports accuracy', () => {
    const g = new GuessGame(SHORT, 'w');
    g.guess('e2e4');
    g.guess('g1f3');
    g.guess('f1b5');
    expect(g.done).toBe(true);
    expect(g.score).toBe(3);
    expect(g.accuracy()).toBe(1);
  });

  it('reveal plays the move without crediting score', () => {
    const g = new GuessGame(SHORT, 'w');
    const shown = g.reveal();
    expect(shown?.uci).toBe('e2e4');
    expect(g.score).toBe(0);
    expect(g.expected()?.uci).toBe('g1f3'); // advanced past reply
  });

  it('guesses Black when guessColor is b (White auto-plays first)', () => {
    const g = new GuessGame(SHORT, 'b');
    expect(g.expected()?.uci).toBe('e7e5'); // after white e4 auto-plays
    expect(g.guess('e7e5')).toBe('correct');
  });

  it('the Opera Game is fully guessable for White', () => {
    const opera = MASTER_GAMES.find((m) => m.id === 'opera')!;
    const g = new GuessGame(opera.pgn, 'w');
    let safety = 0;
    while (!g.done && safety < 100) {
      const exp = g.expected();
      if (!exp) break;
      expect(g.guess(exp.uci)).toBe('correct');
      safety += 1;
    }
    expect(g.done).toBe(true);
    expect(g.accuracy()).toBe(1);
  });
});
