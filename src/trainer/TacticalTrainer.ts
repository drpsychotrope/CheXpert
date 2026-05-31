// Active-recall tactical solver (spec AP-CHESS-2: the player PLAYS the move; the
// solution is NEVER auto-played). Opponent replies in the line ARE auto-played.
//
// This class is UI-agnostic: it tracks solve state and validates user moves. The
// Svelte component drives the board from getFen() and feeds user moves into
// playUserMove(). Glicko updates happen in the caller via gradeAttempt().

import { ChessGame } from '../game/ChessGame';
import type { Puzzle } from './puzzle';
import { updateRating, type Rating, type MatchResult } from '../rating/glicko2';

export interface SolveState {
  status: 'solving' | 'solved' | 'failed';
  /** Index into puzzle.moves of the next expected USER move. */
  userMoveIndex: number;
  /** Wrong attempts so far (a single wrong move fails the puzzle). */
  mistakes: number;
}

export class TacticalTrainer {
  private game: ChessGame;
  private startedAt: number;
  state: SolveState = { status: 'solving', userMoveIndex: 0, mistakes: 0 };

  constructor(
    public puzzle: Puzzle,
    now: number,
  ) {
    this.game = new ChessGame(puzzle.fen);
    this.startedAt = now;
  }

  getFen(): string {
    return this.game.fen;
  }

  /** The expected next user move in UCI form (for hints / coached mode). */
  expectedMove(): string | null {
    return this.puzzle.moves[this.state.userMoveIndex] ?? null;
  }

  /**
   * Try a user move (UCI). Returns:
   *  - 'correct'      move matched; puzzle continues (opponent reply applied)
   *  - 'solved'       move matched and was the last user move
   *  - 'wrong'        move did not match the solution → puzzle failed
   */
  playUserMove(uci: string): 'correct' | 'solved' | 'wrong' {
    if (this.state.status !== 'solving') return this.state.status === 'solved' ? 'solved' : 'wrong';

    const expected = this.expectedMove();
    if (!expected || !sameMove(uci, expected)) {
      this.state = { ...this.state, status: 'failed', mistakes: this.state.mistakes + 1 };
      return 'wrong';
    }

    this.game.moveUci(expected);
    let idx = this.state.userMoveIndex + 1;

    // Auto-play the opponent's reply if the line continues.
    const opponentMove = this.puzzle.moves[idx];
    if (opponentMove) {
      this.game.moveUci(opponentMove);
      idx += 1;
    }

    if (idx >= this.puzzle.moves.length) {
      this.state = { ...this.state, status: 'solved', userMoveIndex: idx };
      return 'solved';
    }
    this.state = { ...this.state, userMoveIndex: idx };
    return 'correct';
  }

  elapsedMs(now: number): number {
    return now - this.startedAt;
  }
}

/** Compare two UCI moves, tolerating a missing/explicit promotion suffix. */
export function sameMove(a: string, b: string): boolean {
  if (a === b) return true;
  // e7e8 vs e7e8q — treat a bare move as queen-promotion equivalent.
  const norm = (m: string) => (m.length === 4 ? m + 'q' : m);
  return norm(a) === norm(b);
}

/**
 * Grade a finished attempt: update the player's puzzle rating and the puzzle's
 * own rating via Glicko-2 (spec §4.5 — resolving a puzzle raises the player and
 * lowers the puzzle, keeping the player in their zone).
 */
export function gradeAttempt(
  playerRating: Rating,
  puzzle: Puzzle,
  solved: boolean,
): { player: Rating; puzzle: Rating } {
  const puzzleRating: Rating = { rating: puzzle.rating, rd: puzzle.ratingDeviation, vol: 0.06 };

  const playerMatch: MatchResult = {
    opponentRating: puzzle.rating,
    opponentRd: puzzle.ratingDeviation,
    score: solved ? 1 : 0,
  };
  const puzzleMatch: MatchResult = {
    opponentRating: playerRating.rating,
    opponentRd: playerRating.rd,
    score: solved ? 0 : 1,
  };

  return {
    player: updateRating(playerRating, [playerMatch]),
    puzzle: updateRating(puzzleRating, [puzzleMatch]),
  };
}
