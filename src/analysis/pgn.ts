// PGN → ParsedGame. Uses chess.js verbose history (Move objects carry `before`/
// `after` FEN, `san`, `lan`, `captured`), and extracts %clk clock annotations +
// the TimeControl increment so the time-management diagnosis can run.

import { Chess } from 'chess.js';
import type { ParsedGame, ParsedPly } from './types';

/** Parse "300+3" / "600" / "-" TimeControl into an increment in seconds. */
export function parseIncrement(timeControl: string | undefined): number {
  if (!timeControl) return 0;
  const m = timeControl.match(/(\d+)\+(\d+)/);
  return m ? Number(m[2]) : 0;
}

/** Convert a clock string "H:MM:SS" or "M:SS" or "SS" to milliseconds. */
export function clockToMs(clk: string): number | undefined {
  const parts = clk.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return Math.round(s * 1000);
}

/**
 * Parse a PGN. Throws if chess.js cannot load it. Returns plies with before/after
 * FENs and (when present) per-move remaining clock + seconds spent.
 */
export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(pgn); // throws on malformed PGN

  const headers = chess.header() as Record<string, string>;
  const incrementSec = parseIncrement(headers.TimeControl);

  // Verbose history gives before/after FENs and captured info.
  const verbose = chess.history({ verbose: true }) as Array<{
    san: string;
    lan: string;
    from: string;
    to: string;
    promotion?: string;
    color: 'w' | 'b';
    captured?: string;
    before: string;
    after: string;
  }>;

  // Map a position-after FEN to its %clk (chess.js attaches comments by fen).
  const clockByFen = new Map<string, number>();
  const comments = chess.getComments() as Array<{ fen: string; comment: string }>;
  for (const c of comments) {
    const m = c.comment.match(/\[%clk\s+([\d:]+)\]/);
    if (m) {
      const ms = clockToMs(m[1]);
      if (ms != null) clockByFen.set(c.fen, ms);
    }
  }

  // Track previous remaining clock per color to derive seconds spent.
  const prevClock: Record<'w' | 'b', number | undefined> = { w: undefined, b: undefined };

  const plies: ParsedPly[] = verbose.map((mv, i) => {
    const uci = mv.from + mv.to + (mv.promotion ?? '');
    const clockMs = clockByFen.get(mv.after);
    let secondsSpent: number | undefined;
    if (clockMs != null && prevClock[mv.color] != null) {
      // spent = previous remaining - current remaining + increment
      secondsSpent = Math.max(0, (prevClock[mv.color]! - clockMs) / 1000 + incrementSec);
    }
    if (clockMs != null) prevClock[mv.color] = clockMs;

    return {
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      color: mv.color,
      san: mv.san,
      uci,
      fenBefore: mv.before,
      fenAfter: mv.after,
      captured: mv.captured,
      clockMs,
      secondsSpent,
    };
  });

  return { plies, headers, incrementSec };
}

/** Best-effort: which color did `playerName` play? Falls back to white. */
export function inferPlayerColor(headers: Record<string, string>, playerName?: string): 'w' | 'b' {
  if (!playerName) return 'w';
  const lc = playerName.toLowerCase();
  if ((headers.Black ?? '').toLowerCase().includes(lc)) return 'b';
  return 'w';
}
