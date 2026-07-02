// Chess960 PGN → ParsedGame (PR-20 chess960-first-class, ADR-0078 — lifts ADR-0041 Q-D).
// chess.js cannot replay 960 castling, so the STANDARD parsePgn was the real analysis blocker.
// This parser replays the movetext through the app's own ChessGame 960 shim (the rules truth
// that played the game in the first place): SAN tokens resolved via the shim's resolveMove
// (which understands king-onto-rook castling), UI-safe FENs from `fen` (chess.js/chessground-
// compatible decorative rights) and ENGINE FENs from `fenForEngine` (X-FEN) carried on the
// additive engineFenBefore/After fields the evaluator prefers.

import { ChessGame } from '../game/ChessGame';
import { castleFromStartFen } from '../variant/chess960';
import type { ParsedGame, ParsedPly } from './types';

/** Header lines → map (same shape parsePgn returns). */
function parseHeaders(pgn: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of pgn.matchAll(/^\[(\w+)\s+"([^"]*)"\]\s*$/gm)) out[m[1]] = m[2];
  return out;
}

/** Movetext → SAN tokens: strip brace comments, move numbers, NAGs, and result markers. */
export function sanTokens(pgn: string): string[] {
  const movetext = pgn.replace(/^\[[^\]]*\]\s*$/gm, '').replace(/\{[^}]*\}/g, ' ');
  return movetext
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/\$\d+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && t !== '*' && t !== '1-0' && t !== '0-1' && t !== '1/2-1/2');
}

function pieceCount(fen: string): number {
  let n = 0;
  for (const ch of fen.split(' ')[0]) if (/[a-zA-Z]/.test(ch)) n++;
  return n;
}

/**
 * Parse a played 960 game. Throws on an unresolvable SAN (a desynced record must fail loudly,
 * never produce a silently-wrong analysis — the audit C-3 doctrine). `startFen` comes from the
 * persisted GameRecord (ADR-0041 stores it for replay/audit — this is that audit path).
 */
export function parse960Pgn(pgn: string, startFen: string): ParsedGame {
  const headers = parseHeaders(pgn);
  const castle = castleFromStartFen(startFen);
  const game = new ChessGame(startFen, { variant: 'chess960', castle });
  const plies: ParsedPly[] = [];

  for (const [i, san] of sanTokens(pgn).entries()) {
    const fenBefore = game.fen;
    const engineFenBefore = game.fenForEngine();
    const color = game.turn;
    const before = pieceCount(fenBefore);
    const r = game.resolveMove(san);
    if (!r || !game.move(r.from, r.to, r.promo ?? 'q')) {
      throw new Error(`chess960 replay failed at ply ${i} ('${san}')`);
    }
    const fenAfter = game.fen;
    plies.push({
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      color,
      san,
      uci: r.from + r.to + (r.promo ?? ''),
      fenBefore,
      fenAfter,
      captured: pieceCount(fenAfter) < before ? 'x' : undefined,
      engineFenBefore,
      engineFenAfter: game.fenForEngine(),
    });
  }

  return { plies, headers, incrementSec: 0 };
}
