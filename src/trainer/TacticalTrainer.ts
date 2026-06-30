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
  /** Wrong attempts so far (a single wrong move records the miss; T1/TR6: a granted retry
   *  does NOT erase it — `mistakes >= 1` ⇒ the attempt is a miss regardless of the retry). */
  mistakes: number;
  /** On-board second tries still available before the fail locks (T1/TR6, Q-B; default 1). */
  retriesLeft: number;
}

/** Default on-board second-try budget (T1/TR6, Q-B = (b) one retry). */
export const DEFAULT_RETRIES = 1;

export class TacticalTrainer {
  private game: ChessGame;
  private startedAt: number;
  state: SolveState;

  constructor(
    public puzzle: Puzzle,
    now: number,
    /** On-board retry budget before a wrong move locks the fail (Q-B). Pass 0 for the
     *  pre-T1 instant-fail behaviour. */
    retries: number = DEFAULT_RETRIES,
  ) {
    this.game = new ChessGame(puzzle.fen);
    this.startedAt = now;
    this.state = { status: 'solving', userMoveIndex: 0, mistakes: 0, retriesLeft: retries };
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
   *  - 'retry'        move did not match BUT a second try is available (T1/TR6): the miss is
   *                   recorded (`mistakes++`) and `status` stays 'solving'; the board is NOT
   *                   advanced. The caller leaves the wrong move visible and lets the user move
   *                   again. A retry is practice, not a re-score (AP-TFEED-2).
   *  - 'wrong'        move did not match and no retry remains → puzzle failed
   */
  playUserMove(uci: string): 'correct' | 'solved' | 'retry' | 'wrong' {
    if (this.state.status !== 'solving') return this.state.status === 'solved' ? 'solved' : 'wrong';

    const expected = this.expectedMove();
    if (!expected || !sameMove(uci, expected)) {
      // Honesty (AP-TFEED-2): every wrong move records the miss, whether or not a retry is granted.
      const mistakes = this.state.mistakes + 1;
      if (this.state.retriesLeft > 0) {
        // Grant one on-board second try: stay 'solving', don't advance the board (Q-B).
        this.state = { ...this.state, mistakes, retriesLeft: this.state.retriesLeft - 1 };
        return 'retry';
      }
      this.state = { ...this.state, status: 'failed', mistakes };
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

  /**
   * Accept an OFF-LINE move that the caller's engine check confirmed is an alternate win
   * (T1, Q-A/Q-H). Applies the played move and the scripted opponent reply EXACTLY like the
   * matched path, advancing the line, then continues from the next scripted user move. The
   * trainer stays engine-free (AP-CHESS-1/AP-TFEED-6): the accept decision is made outside
   * (acceptAltMove) and only the board bookkeeping happens here.
   *
   * Returns 'solved' if the alternate ended the line (mate / last move), else 'correct'.
   * Returns 'wrong' if the move is illegal in the current position (defensive — the caller
   * already validated it) without changing state, so the caller can fall back to the miss path.
   */
  acceptUserMove(uci: string): 'correct' | 'solved' | 'wrong' {
    if (this.state.status !== 'solving') return this.state.status === 'solved' ? 'solved' : 'wrong';
    if (this.game.moveUci(uci) == null) return 'wrong';

    let idx = this.state.userMoveIndex + 1;
    // Auto-play the scripted opponent reply if the line continues (mirrors playUserMove).
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
