// Board-vision micro-drill generators (spec C / 3b): all checks, all captures, and
// hanging pieces in a position. Pure (chess.js). Used by timed "find them all" drills.

import { Chess } from 'chess.js';

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
interface VMove { from: string; to: string; san: string; captured?: string; piece: string; promotion?: string }

function verbose(fen: string): VMove[] {
  try {
    return new Chess(fen).moves({ verbose: true }) as unknown as VMove[];
  } catch {
    return [];
  }
}
const uci = (m: VMove) => m.from + m.to + (m.promotion ?? '');

/** All moves by the side to move that give check (UCI). */
export function allChecks(fen: string): string[] {
  return verbose(fen).filter((m) => m.san.includes('+') || m.san.includes('#')).map(uci);
}

/** All capture moves available to the side to move (UCI). */
export function allCaptures(fen: string): string[] {
  return verbose(fen).filter((m) => m.captured).map(uci);
}

/** Squares of enemy pieces the side to move can win (free, or a net-winning capture). */
export function hangingPieces(fen: string): string[] {
  const out = new Set<string>();
  for (const m of verbose(fen)) {
    if (!m.captured) continue;
    const gain = (VAL[m.captured] ?? 0) - (VAL[m.piece] ?? 0);
    let recapture = false;
    try {
      const c = new Chess(fen);
      c.move({ from: m.from as never, to: m.to as never, promotion: 'q' });
      recapture = (c.moves({ verbose: true }) as unknown as VMove[]).some((r) => r.to === m.to && r.captured);
    } catch {
      /* ignore */
    }
    if (!recapture || gain >= 2) out.add(m.to);
  }
  return [...out];
}
