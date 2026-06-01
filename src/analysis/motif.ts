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

// --- Geometric helpers for pin / skewer / discovered attack (high confidence) ---
const FILES = 'abcdefgh';
function fileRank(sq: string): { f: number; r: number } {
  return { f: FILES.indexOf(sq[0]), r: Number(sq[1]) - 1 };
}
function toSquare(f: number, r: number): string | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return FILES[f] + (r + 1);
}
const ROOK_DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
function sliderDirs(type: string): Array<[number, number]> {
  if (type === 'r') return ROOK_DIRS;
  if (type === 'b') return BISHOP_DIRS;
  if (type === 'q') return [...ROOK_DIRS, ...BISHOP_DIRS];
  return [];
}
interface Occ { square: string; type: string; color: 'w' | 'b'; }
/** First `max` occupied squares walking from `from` along (df,dr), nearest first. */
function occupiedAlong(c: Chess, from: string, df: number, dr: number, max: number): Occ[] {
  const out: Occ[] = [];
  let { f, r } = fileRank(from);
  while (out.length < max) {
    f += df;
    r += dr;
    const s = toSquare(f, r);
    if (!s) break;
    const p = c.get(s as Square);
    if (p) out.push({ square: s, type: p.type, color: p.color });
  }
  return out;
}
/** Is `x` strictly between `a` and `b` along their straight ray? */
function isStrictlyBetween(a: string, b: string, x: string): boolean {
  const A = fileRank(a), B = fileRank(b), X = fileRank(x);
  const sf = Math.sign(B.f - A.f), sr = Math.sign(B.r - A.r);
  let f = A.f + sf, r = A.r + sr;
  while (toSquare(f, r) && !(f === B.f && r === B.r)) {
    if (f === X.f && r === X.r) return true;
    f += sf;
    r += sr;
  }
  return false;
}
/** Are all squares strictly between `a` and `b` empty? */
function rayClear(c: Chess, a: string, b: string): boolean {
  const A = fileRank(a), B = fileRank(b);
  const sf = Math.sign(B.f - A.f), sr = Math.sign(B.r - A.r);
  let f = A.f + sf, r = A.r + sr;
  while (!(f === B.f && r === B.r)) {
    const s = toSquare(f, r);
    if (!s) return false;
    if (c.get(s as Square)) return false;
    f += sf;
    r += sr;
  }
  return true;
}
/** Geometric: does the piece on `fromSq` attack `target` (its own movement rules)? */
function pieceAttacksSquare(c: Chess, fromSq: string, target: string): boolean {
  const p = c.get(fromSq as Square);
  if (!p) return false;
  const A = fileRank(fromSq), T = fileRank(target);
  const df = T.f - A.f, dr = T.r - A.r, adf = Math.abs(df), adr = Math.abs(dr);
  switch (p.type) {
    case 'n': return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case 'k': return adf <= 1 && adr <= 1 && adf + adr > 0;
    case 'p': return adf === 1 && dr === (p.color === 'w' ? 1 : -1);
    case 'b': return adf === adr && adf > 0 && rayClear(c, fromSq, target);
    case 'r': return ((df === 0) !== (dr === 0)) && rayClear(c, fromSq, target);
    case 'q': return ((adf === adr && adf > 0) || ((df === 0) !== (dr === 0))) && rayClear(c, fromSq, target);
  }
  return false;
}
function findKing(c: Chess, color: 'w' | 'b'): string | null {
  for (const row of c.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === color) return sq.square;
  return null;
}
function pushUnique(tags: string[], t: string): void {
  if (!tags.includes(t)) tags.push(t);
}

/**
 * Detect pin / skewer / discovered attack / double check created by the move that
 * produced `fenAfter`. High confidence only — every relation is verified by clear-ray
 * geometry (ADR-0020, extends ADR-0007). Pushes Lichess theme keys into `tags`.
 */
function detectGeometric(
  fenAfter: string,
  from: string,
  to: string,
  moverColor: 'w' | 'b',
  oppColor: 'w' | 'b',
  tags: string[],
): void {
  let after: Chess;
  try {
    after = new Chess(fenAfter);
  } catch {
    return; // unusual FEN (castling/en-passant edge) → no tag rather than a wrong one
  }

  // Pin / skewer: the moved slider on `to` lines up two enemy pieces on one ray.
  // Read the moved piece from `to` (post-move) so promotions are seen correctly.
  const moved = after.get(to as Square);
  if (moved && (moved.type === 'b' || moved.type === 'r' || moved.type === 'q')) {
    for (const [df, dr] of sliderDirs(moved.type)) {
      const occ = occupiedAlong(after, to, df, dr, 2);
      if (occ.length < 2) continue;
      const [front, back] = occ;
      if (front.color !== oppColor || back.color !== oppColor) continue;
      const fv = VALUE[front.type] ?? 0;
      const bv = VALUE[back.type] ?? 0;
      if (back.type === 'k') {
        pushUnique(tags, 'pin');
        pushUnique(tags, 'absolutePin');
      } else if (front.type === 'k') {
        pushUnique(tags, 'skewer');
      } else if (bv > fv && bv >= 5) {
        pushUnique(tags, 'pin');
        pushUnique(tags, 'relativePin');
      } else if (fv > bv && bv >= 3) {
        pushUnique(tags, 'skewer');
      }
    }
  }

  // Discovered attack: vacating `from` unveils a friendly slider onto an enemy target.
  const enemyKing = findKing(after, oppColor);
  let discoveredCheck = false;
  for (const row of after.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== moverColor || sq.square === to) continue;
      if (sq.type !== 'b' && sq.type !== 'r' && sq.type !== 'q') continue;
      for (const [df, dr] of sliderDirs(sq.type)) {
        const occ = occupiedAlong(after, sq.square, df, dr, 1);
        if (occ.length < 1 || occ[0].color !== oppColor) continue;
        const t = occ[0];
        if (!isStrictlyBetween(sq.square, t.square, from)) continue; // `from` was the blocker
        if (t.type === 'k') {
          pushUnique(tags, 'discoveredAttack');
          pushUnique(tags, 'discoveredCheck');
          discoveredCheck = true;
        } else if ((VALUE[t.type] ?? 0) >= 3) {
          pushUnique(tags, 'discoveredAttack');
        }
      }
    }
  }

  // Double check is only ever a direct + a discovered check (no chess.js attackers() needed).
  if (discoveredCheck && enemyKing && pieceAttacksSquare(after, to, enemyKing)) {
    pushUnique(tags, 'doubleCheck');
  }
}

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

      // --- Pin / skewer / discovered attack / double check (geometric) ------
      detectGeometric(fenAfter, from, to, moverColor, oppColor, tags);
    }
  }

  if (tags.length > 0) {
    // Add a coarse magnitude tag alongside specific motifs.
    if (severity === 'blunder') tags.push('crushing');
    else tags.push('advantage');
    // Primary tag by precedence (most forcing first) — Q-A accepted default.
    const PRECEDENCE = ['doubleCheck', 'fork', 'skewer', 'pin', 'discoveredAttack', 'hangingPiece'];
    const primary = PRECEDENCE.find((t) => tags.includes(t)) ?? tags[0];
    return { tag: primary, tags, confidence: 'high' };
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
