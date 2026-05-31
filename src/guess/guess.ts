// Guess-the-Move driver (active recall on master games). Steps through a game; on
// the guess side's turns the player must produce the move that was actually played.
// The other side's moves auto-play. Scoring is honest: a guess is "correct" only
// if it matches the played move (we don't claim engine-grade partial credit we
// haven't computed).

import { Chess } from 'chess.js';
import { parsePgn } from '../analysis/pgn';
import type { ParsedPly } from '../analysis/types';

export type GuessResult = 'correct' | 'wrong';

export class GuessGame {
  private chess = new Chess();
  private plies: ParsedPly[];
  /** Index of the next ply to be played (either side). */
  index = 0;
  score = 0;
  guesses = 0;
  done = false;

  constructor(
    pgn: string,
    public guessColor: 'w' | 'b',
  ) {
    this.plies = parsePgn(pgn).plies;
    this.autoPlayUntilGuessTurn();
  }

  fen(): string {
    return this.chess.fen();
  }

  /** Total moves the player will be asked to guess. */
  totalGuesses(): number {
    return this.plies.filter((p) => p.color === this.guessColor).length;
  }

  private autoPlayUntilGuessTurn(): void {
    while (this.index < this.plies.length && this.plies[this.index].color !== this.guessColor) {
      this.chess.move(uciToMove(this.plies[this.index].uci));
      this.index += 1;
    }
    if (this.index >= this.plies.length) this.done = true;
  }

  /** The move the player must guess next (for hints / reveal), or null if done. */
  expected(): ParsedPly | null {
    return this.index < this.plies.length ? this.plies[this.index] : null;
  }

  /**
   * Submit a guess (UCI). On correct: applies it, auto-plays the reply, advances.
   * On wrong: the position does NOT advance — the player can try again. Both are
   * counted in `guesses` so accuracy reflects first-try success.
   */
  guess(uci: string): GuessResult {
    const exp = this.expected();
    if (!exp) return 'wrong';
    if (!sameMove(uci, exp.uci)) {
      this.guesses += 1;
      return 'wrong';
    }
    this.guesses += 1;
    this.score += 1;
    this.chess.move(uciToMove(exp.uci));
    this.index += 1;
    this.autoPlayUntilGuessTurn();
    return 'correct';
  }

  /** Reveal + play the expected move without crediting score (a "show me"). */
  reveal(): ParsedPly | null {
    const exp = this.expected();
    if (!exp) return null;
    this.chess.move(uciToMove(exp.uci));
    this.index += 1;
    this.autoPlayUntilGuessTurn();
    return exp;
  }

  accuracy(): number {
    return this.guesses === 0 ? 0 : this.score / this.guesses;
  }
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined };
}

function sameMove(a: string, b: string): boolean {
  if (a === b) return true;
  const norm = (m: string) => (m.length === 4 ? m + 'q' : m);
  return norm(a) === norm(b);
}
