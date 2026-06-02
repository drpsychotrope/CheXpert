// Time-control categories + presets + clock formatting (spec §4.2, §4.6, Q-A).
// Pure: no Date / Math.random inside.

import type { Side } from './Clock';

export type Category = 'bullet' | 'blitz' | 'rapid' | 'classical';

/**
 * Lichess-style band on the estimate = initialSec + 40 * incrementSec.
 *   est < 179        -> 'bullet'    (1+0 = 60, 2+1 = 160)
 *   179 <= est < 479 -> 'blitz'     (3+2 = 260, 5+0 = 300)
 *   479 <= est < 1499-> 'rapid'     (10+0 = 600, 15+10 = 1300)
 *   est >= 1499      -> 'classical' (30+0 = 1800)
 */
export function categoryFor(initialSec: number, incrementSec: number): Category {
  const est = initialSec + 40 * incrementSec;
  if (est < 179) return 'bullet';
  if (est < 479) return 'blitz';
  if (est < 1499) return 'rapid';
  return 'classical';
}

export interface TimeControlPreset {
  id: string;
  label: string;
  initialSec: number;
  incrementSec: number;
  /** "No clock" — preserves today's untimed Play behavior; rated into the classical pool (Q-B=a). */
  untimed?: boolean;
}

/** Q-A seed (see spec §0.5). "Custom" is a sentinel the UI expands into initial/increment inputs. */
export const TIME_CONTROL_PRESETS: TimeControlPreset[] = [
  { id: 'bullet-1-0', label: 'Bullet 1+0', initialSec: 60, incrementSec: 0 },
  { id: 'bullet-2-1', label: 'Bullet 2+1', initialSec: 120, incrementSec: 1 },
  { id: 'blitz-3-2', label: 'Blitz 3+2', initialSec: 180, incrementSec: 2 },
  { id: 'blitz-5-0', label: 'Blitz 5+0', initialSec: 300, incrementSec: 0 },
  { id: 'rapid-10-0', label: 'Rapid 10+0', initialSec: 600, incrementSec: 0 },
  { id: 'rapid-15-10', label: 'Rapid 15+10', initialSec: 900, incrementSec: 10 },
  { id: 'classical-30-0', label: 'Classical 30+0', initialSec: 1800, incrementSec: 0 },
  { id: 'no-clock', label: 'No clock', initialSec: 0, incrementSec: 0, untimed: true },
  { id: 'custom', label: 'Custom', initialSec: 300, incrementSec: 0 },
];

/** Format remaining ms: mm:ss above 20 s, ss.s at/below 20 s, 0:00 at/below zero. */
export function fmtClock(ms: number): string {
  if (ms <= 0) return '0:00';
  if (ms <= 20_000) return (Math.ceil(ms / 100) / 10).toFixed(1);
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * FIDE Art. 6.9 helper for the flag rule (Q-C): true if `side` has no possible
 * mating material — bare king, or K + a single bishop/knight, or K + only
 * same-colour bishops (no other pieces). Pure: derives solely from the FEN's
 * piece-placement field. A flag against a side with insufficient mating
 * material is a DRAW, not a loss. Conservative: for anything richer (a pawn,
 * rook, queen, two knights, opposite-colour bishops) it returns false — only
 * declare a draw when provably no mate (honesty doctrine, AP-TC-6).
 */
export function insufficientMatingMaterial(fen: string, side: Side): boolean {
  const placement = fen.split(' ')[0];
  let bishops = 0;
  let knights = 0;
  let bishopSquaresLight = false;
  let bishopSquaresDark = false;
  let file = 0; // 0-based file as we scan a rank left→right
  let rank = 8; // FEN ranks run 8 down to 1, top row first

  for (const ch of placement) {
    if (ch === '/') {
      rank -= 1;
      file = 0;
      continue;
    }
    if (ch >= '1' && ch <= '8') {
      file += Number(ch);
      continue;
    }
    const isWhitePiece = ch === ch.toUpperCase();
    const mine = side === 'w' ? isWhitePiece : !isWhitePiece;
    const type = ch.toLowerCase();
    if (mine) {
      if (type === 'q' || type === 'r' || type === 'p') return false; // mate possible
      if (type === 'n') knights += 1;
      if (type === 'b') {
        bishops += 1;
        // Square colour: (file + rank) parity. file is 0-based here, rank is 1..8.
        const light = (file + rank) % 2 === 1;
        if (light) bishopSquaresLight = true;
        else bishopSquaresDark = true;
      }
    }
    file += 1;
  }

  // Two or more knights → mate is not impossible (FIDE: only force-impossible is a draw,
  // but Art. 6.9 draws on "cannot checkmate by ANY series of legal moves"; K+N+N CAN, so false).
  if (knights >= 2) return false;
  if (knights >= 1 && bishops >= 1) return false; // K+B+N can force mate
  // Bishops: insufficient only if all on a single colour.
  if (bishops >= 1 && bishopSquaresLight && bishopSquaresDark) return false;
  // Remaining cases: bare K, K+1N, K+1B, K + only same-colour bishops → insufficient.
  return true;
}
