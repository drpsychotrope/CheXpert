// Curated static fallback for the "when to think" drill (Q-E, ADR-0038): a small
// in-repo set so the drill works BEFORE any of the player's games are analysed.
// Each entry is a fully-formed DrillItem with a synthetic PlyAnalysis whose
// fenBefore is a LEGAL position and whose winProbLoss matches its label under the
// default thresholds (asserted by criticalMomentFallback.test.ts — the MASTER_GAMES
// legality-test precedent). No engine, no chess.js, no injected-rand calls here.

import type { DrillItem, DrillLabel } from './criticalMomentDrill';
import type { GamePhase, PlyAnalysis, Severity } from './types';

interface FallbackSeed {
  id: string;
  fen: string; // legal FEN, player to move
  label: DrillLabel;
  winProbLoss: number; // must satisfy the label under default thresholds
  san: string; // the move actually played from this position (for explain text)
  uci: string;
  bestUci: string | null;
  severity: Severity;
  phase: GamePhase;
  moveNumber: number;
  color: 'w' | 'b'; // side to move in `fen`
}

// Hand-picked, hand-balanced. CRITICAL = a moment where a wrong move proved
// expensive (not "the only move" — honest framing, AP-CMD-2). ROUTINE = a quiet
// position where almost anything reasonable keeps the eval.
const SEEDS: FallbackSeed[] = [
  // --- CRITICAL (winProbLoss >= 15) ---
  {
    id: 'fallback-legalls-mate',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    label: 'critical',
    winProbLoss: 28,
    san: 'Ng5',
    uci: 'f3g5',
    bestUci: 'b1c3',
    severity: 'mistake',
    phase: 'opening',
    moveNumber: 4,
    color: 'w',
  },
  {
    id: 'fallback-fried-liver',
    fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
    label: 'critical',
    winProbLoss: 22,
    san: 'Nxf7',
    uci: 'g5f7',
    bestUci: 'e1g1',
    severity: 'mistake',
    phase: 'opening',
    moveNumber: 6,
    color: 'w',
  },
  {
    id: 'fallback-greek-gift',
    fen: 'rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 3 7',
    label: 'critical',
    winProbLoss: 18,
    san: 'Bd3',
    uci: 'd2d3',
    bestUci: 'f1d3',
    severity: 'inaccuracy',
    phase: 'middlegame',
    moveNumber: 7,
    color: 'w',
  },
  {
    id: 'fallback-back-rank',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    label: 'critical',
    winProbLoss: 35,
    san: 'Rd8+',
    uci: 'd1d8',
    bestUci: 'd1d8',
    severity: 'mistake',
    phase: 'endgame',
    moveNumber: 1,
    color: 'w',
  },
  // --- ROUTINE (winProbLoss <= 3) ---
  {
    id: 'fallback-start',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    label: 'routine',
    winProbLoss: 1,
    san: 'e4',
    uci: 'e2e4',
    bestUci: 'e2e4',
    severity: 'good',
    phase: 'opening',
    moveNumber: 1,
    color: 'w',
  },
  {
    id: 'fallback-italian-quiet',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    label: 'routine',
    winProbLoss: 2,
    san: 'Bc5',
    uci: 'f8c5',
    bestUci: 'f8c5',
    severity: 'good',
    phase: 'opening',
    moveNumber: 3,
    color: 'b',
  },
  {
    id: 'fallback-symmetric-middlegame',
    fen: 'r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R2Q1RK1 w - - 0 9',
    label: 'routine',
    winProbLoss: 0,
    san: 'Re1',
    uci: 'f1e1',
    bestUci: 'f1e1',
    severity: 'good',
    phase: 'middlegame',
    moveNumber: 9,
    color: 'w',
  },
  {
    id: 'fallback-king-pawn-endgame',
    fen: '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1',
    label: 'routine',
    winProbLoss: 2,
    san: 'Kd4',
    uci: 'e3d4',
    bestUci: 'e3d4',
    severity: 'good',
    phase: 'endgame',
    moveNumber: 1,
    color: 'w',
  },
];

function seedToItem(s: FallbackSeed): DrillItem {
  const ply: PlyAnalysis = {
    ply: 0,
    moveNumber: s.moveNumber,
    color: s.color,
    san: s.san,
    uci: s.uci,
    fenBefore: s.fen,
    fenAfter: s.fen, // unused by the reveal; explainPly's positional fallback tolerates it
    bestUci: s.bestUci,
    bestWhiteCp: 0,
    playedWhiteCp: 0,
    cpLoss: 0,
    winProbLoss: s.winProbLoss,
    severity: s.severity,
    phase: s.phase,
  };
  return {
    gameId: s.id,
    plyIndex: 0,
    ply,
    fenBefore: s.fen,
    label: s.label,
    winProbLoss: s.winProbLoss,
  };
}

/** The curated fallback drill items (fixed order; the view shuffles them). */
export function fallbackDrillItems(): DrillItem[] {
  return SEEDS.map(seedToItem);
}
