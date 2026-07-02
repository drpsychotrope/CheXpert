// Shared types for Phase 2 analysis (PGN import → batch analysis → diagnosis).

export type Severity = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export type GamePhase = 'opening' | 'middlegame' | 'endgame';

/** A single parsed ply from a PGN, before any engine work. */
export interface ParsedPly {
  ply: number; // 0-based
  moveNumber: number; // 1-based full move number
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  captured?: string; // piece type captured, if any
  /** Remaining clock for the mover after this move, in ms (if PGN had %clk). */
  clockMs?: number;
  /** Seconds the mover spent on this move (needs clocks + increment). */
  secondsSpent?: number;
  /** PR-20 (ADR-0078): engine-facing FENs for Chess960 plies (X-FEN castling the UI FENs can't
   *  carry — fenBefore/fenAfter stay chess.js/chessground-safe). The evaluator prefers these
   *  when present; standard games never set them. Additive optional. */
  engineFenBefore?: string;
  engineFenAfter?: string;
}

export interface ParsedGame {
  plies: ParsedPly[];
  headers: Record<string, string>;
  /** Increment in seconds parsed from the TimeControl header, if any. */
  incrementSec: number;
}

/** Motif tagging result for a significant mistake. */
export interface MotifResult {
  /** Primary tag (taxonomy aligned with the Lichess puzzle themes). */
  tag: string;
  /** All applicable tags, primary first. */
  tags: string[];
  /** 'high' = a specific detector fired; 'low' = phase/magnitude fallback. */
  confidence: 'high' | 'low';
}

/** Per-ply analysis after engine evaluation. */
export interface PlyAnalysis extends ParsedPly {
  /** Engine best move at fenBefore (UCI). */
  bestUci: string | null;
  /** Eval of fenBefore under best play, White POV (cp; mate clamped). */
  bestWhiteCp: number;
  /** Eval of fenAfter (the actual result), White POV. */
  playedWhiteCp: number;
  /** Centipawns the mover lost vs best (>= 0). */
  cpLoss: number;
  /** Win-probability points the mover lost (0..100). */
  winProbLoss: number;
  severity: Severity;
  phase: GamePhase;
  /** Mate distance at fenBefore (mover POV), if any. */
  mate?: number;
  /** PR-21 (ADR-0079, Q-E=c): White-POV eval of the SECOND-best line at fenBefore, persisted by
   *  a targeted MultiPV=2 re-pass over the player's mistake/blunder plies only. Additive; absent
   *  on every other ply and on pre-PR-21 analyses (no measurement → no only-move claim). */
  secondBestCp?: number;
  /** Motif of the MISSED idea, present on mistakes/blunders. */
  motif?: MotifResult;
}

export interface PhaseStat {
  plies: number;
  acpl: number; // average centipawn loss for the player's moves in this phase
  blunders: number;
  mistakes: number;
  inaccuracies: number;
}

export interface GameAnalysis {
  gameId: string;
  source: 'imported' | 'played';
  playerColor: 'w' | 'b';
  analyzedAt: number;
  /** Engine budget used (ms per ply) — for reproducibility/benchmarking. */
  movetimeMs: number;
  plies: PlyAnalysis[];
  /** Player-move stats per phase. */
  byPhase: Record<GamePhase, PhaseStat>;
  /** Overall player ACPL across the game. */
  acpl: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  /** Count of significant mistakes converted to personal puzzles. */
  puzzlesGenerated: number;
}
