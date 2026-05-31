// Repertoire builder + FSRS drilling (Phase 3).
//
// Build a line from SAN/UCI moves (validated through chess.js), persist it, and
// drill it: the player must PLAY their own move at each of their turns (active
// recall, AP-CHESS-15), opponent replies auto-play. One FSRS card per line keyed
// by the line id — graded on whether the whole line was recalled without error.

import { Chess } from 'chess.js';
import { openTrainerDB } from '../store/db';
import type { RepertoireLine } from './types';

export interface BuildResult {
  ok: boolean;
  line?: RepertoireLine;
  error?: string;
}

/** Validate a sequence of SAN moves and build a RepertoireLine. */
export function buildLine(
  id: string,
  name: string,
  color: 'w' | 'b',
  sanMoves: string[],
  now: number,
  opening?: string,
): BuildResult {
  const chess = new Chess();
  const uci: string[] = [];
  const san: string[] = [];
  for (const m of sanMoves) {
    const move = m.trim();
    if (!move) continue;
    try {
      const made = chess.move(move);
      if (!made) return { ok: false, error: `Illegal move: ${move}` };
      uci.push(made.from + made.to + (made.promotion ?? ''));
      san.push(made.san);
    } catch {
      return { ok: false, error: `Illegal or unparseable move: ${move}` };
    }
  }
  if (uci.length === 0) return { ok: false, error: 'No moves provided' };
  return { ok: true, line: { id, color, name, opening, moves: uci, san, createdAt: now } };
}

export async function saveLine(line: RepertoireLine): Promise<void> {
  const db = await openTrainerDB();
  await db.put('repertoire', line);
}

export async function listLines(color?: 'w' | 'b'): Promise<RepertoireLine[]> {
  const db = await openTrainerDB();
  if (color) return db.getAllFromIndex('repertoire', 'color', color);
  return db.getAll('repertoire');
}

export async function getLine(id: string): Promise<RepertoireLine | undefined> {
  const db = await openTrainerDB();
  return db.get('repertoire', id);
}

export async function deleteLine(id: string): Promise<void> {
  const db = await openTrainerDB();
  await db.delete('repertoire', id);
  // Also drop its SRS card.
  await db.delete('srsCards', `repertoire:${id}`);
}

/**
 * Drill driver for one line. Tracks position and which ply the player must play.
 * The player trains the moves of their own color; the other color auto-plays.
 */
export class RepertoireDrill {
  private chess = new Chess();
  /** Index into line.moves of the next move to be made (either side). */
  index = 0;
  mistakes = 0;
  done = false;

  constructor(public line: RepertoireLine) {
    this.autoPlayOpponentUntilPlayerTurn();
  }

  fen(): string {
    return this.chess.fen();
  }

  /** Whose move is it now in the line. */
  private sideToMove(): 'w' | 'b' {
    return this.chess.turn();
  }

  private autoPlayOpponentUntilPlayerTurn(): void {
    while (this.index < this.line.moves.length && this.sideToMove() !== this.line.color) {
      this.chess.move(uciToMove(this.line.moves[this.index]));
      this.index += 1;
    }
    if (this.index >= this.line.moves.length) this.done = true;
  }

  /** The move the player is expected to play next (UCI), or null if done. */
  expected(): string | null {
    if (this.index >= this.line.moves.length) return null;
    return this.line.moves[this.index];
  }

  /**
   * Try the player's move. Returns 'correct' (line continues), 'done' (line
   * complete), or 'wrong' (mismatch — counts a mistake, line position unchanged).
   */
  play(uci: string): 'correct' | 'done' | 'wrong' {
    const expected = this.expected();
    if (!expected) return 'done';
    if (!sameMove(uci, expected)) {
      this.mistakes += 1;
      return 'wrong';
    }
    this.chess.move(uciToMove(expected));
    this.index += 1;
    this.autoPlayOpponentUntilPlayerTurn();
    if (this.index >= this.line.moves.length) {
      this.done = true;
      return 'done';
    }
    return 'correct';
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
