// Heuristic motif tagger for the MISSED idea behind a mistake/blunder.
//
// Honesty (AP-CHESS-9 / AP-CHESS-13): tagging engine lines to the 64-theme Lichess
// taxonomy is the hardest part of Phase 2 and easy to get confidently wrong. So we
// detect only a SMALL set of high-confidence motifs (mate, hanging piece, fork) and
// otherwise FALL BACK to a phase + magnitude tag with confidence:'low'. We do NOT
// attempt pin/skewer/discovered-attack from scratch — mislabelling is worse than a
// generic tag. The taxonomy is extended in later passes, not faked here.

import { Chess, type Square } from 'chess.js';
import type { GamePhase, MotifResult, Severity } from './types';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Same position but with the side-to-move forced to `color` (for attack queries). */
function tweakTurn(fen: string, color: 'w' | 'b'): string {
  const f = fen.split(' ');
  f[1] = color;
  // Clear en-passant target; irrelevant to attack enumeration and may be illegal.
  f[3] = '-';
  return f.join(' ');
}

/** Captures available from `square` for its side, as {to, captured-value}. */
function captureTargetsFrom(fen: string, square: string, color: 'w' | 'b'): Array<{ to: string; value: number }> {
  try {
    const c = new Chess(tweakTurn(fen, color));
    const moves = c.moves({ square: square as Square, verbose: true }) as Array<{ to: string; captured?: string }>;
    return moves.filter((m) => m.captured).map((m) => ({ to: m.to, value: VALUE[m.captured!] ?? 0 }));
  } catch {
    return [];
  }
}

/** Is `square` defended by `color` (can `color` recapture on it)? */
function isDefendedBy(fen: string, square: string, color: 'w' | 'b'): boolean {
  try {
    const c = new Chess(tweakTurn(fen, color));
    const moves = c.moves({ verbose: true }) as Array<{ to: string; captured?: string }>;
    return moves.some((m) => m.to === square && m.captured);
  } catch {
    return false;
  }
}

export interface MotifContext {
  fenBefore: string;
  /** The engine's best (missed) move in UCI, or null. */
  bestUci: string | null;
  /** Mate distance at fenBefore from the mover POV, if a forced mate exists. */
  mate?: number;
  phase: GamePhase;
  severity: Severity;
}

/**
 * Detect the motif of the missed best move. Returns high-confidence tags when a
 * specific detector fires, else a low-confidence phase/magnitude fallback.
 */
export function detectMotif(ctx: MotifContext): MotifResult {
  const { fenBefore, bestUci, mate, phase, severity } = ctx;
  const tags: string[] = [];

  const moverColor: 'w' | 'b' = fenBefore.split(' ')[1] === 'b' ? 'b' : 'w';
  const oppColor: 'w' | 'b' = moverColor === 'w' ? 'b' : 'w';

  // --- Mate motifs (high confidence; the engine told us a forced mate exists) ---
  if (mate != null && mate > 0) {
    tags.push('mate');
    if (mate <= 3) tags.push(`mateIn${mate}`);
    if (bestUci && isBackRankMate(fenBefore, bestUci, oppColor)) tags.push('backRankMate');
    return { tag: tags[0], tags, confidence: 'high' };
  }

  if (bestUci && bestUci.length >= 4) {
    const from = bestUci.slice(0, 2);
    const to = bestUci.slice(2, 4);

    // Position after the missed best move (opponent to move).
    let fenAfter: string | null = null;
    let givesCheck = false;
    let movedPiece = '';
    try {
      const c = new Chess(fenBefore);
      const piece = c.get(from as Square);
      movedPiece = piece?.type ?? '';
      const m = c.move({ from: from as Square, to: to as Square, promotion: 'q' });
      if (m) {
        fenAfter = c.fen();
        givesCheck = c.inCheck(); // opponent to move; true => opponent in check
      }
    } catch {
      fenAfter = null;
    }

    if (fenAfter) {
      // --- Hanging piece: best move captures an undefended enemy piece ---
      const beforeChess = new Chess(fenBefore);
      const targetPiece = beforeChess.get(to as Square);
      if (targetPiece && targetPiece.color === oppColor) {
        const capturedValue = VALUE[targetPiece.type] ?? 0;
        const ourValue = VALUE[movedPiece] ?? 0;
        const defended = isDefendedBy(fenAfter, to, oppColor);
        // Free piece, or a clearly favourable capture (win > minor of material).
        if (capturedValue >= 3 && (!defended || capturedValue - ourValue >= 2)) {
          tags.push('hangingPiece');
        }
      }

      // --- Fork / double attack: landed piece hits >=2 valuable targets ---
      const targets = captureTargetsFrom(fenAfter, to, moverColor).filter((t) => t.value >= 3);
      const attackCount = targets.length + (givesCheck ? 1 : 0);
      if (attackCount >= 2 && (targets.length >= 1)) {
        tags.push('fork');
        if (movedPiece === 'n') tags.push('knightFork');
      }
    }
  }

  if (tags.length > 0) {
    // Add a coarse magnitude tag alongside specific motifs.
    if (severity === 'blunder') tags.push('crushing');
    else tags.push('advantage');
    return { tag: tags[0], tags, confidence: 'high' };
  }

  // --- Fallback: no specific detector fired. Tag by phase + magnitude (low). ---
  const fallback = `${phase}Mistake`;
  const mag = severity === 'blunder' ? 'crushing' : 'advantage';
  return { tag: fallback, tags: [fallback, mag], confidence: 'low' };
}

/** Crude back-rank check: opponent king on its back rank with the mating move a rook/queen. */
function isBackRankMate(fenBefore: string, bestUci: string, oppColor: 'w' | 'b'): boolean {
  try {
    const c = new Chess(fenBefore);
    const from = bestUci.slice(0, 2) as Square;
    const piece = c.get(from);
    if (!piece || (piece.type !== 'r' && piece.type !== 'q')) return false;
    // Opponent king square.
    const board = c.board();
    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === oppColor) {
          const rank = sq.square[1];
          return (oppColor === 'w' && rank === '1') || (oppColor === 'b' && rank === '8');
        }
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}
