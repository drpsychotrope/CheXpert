// Scenario sparring (spec D / ADR-0030): targeted positions to play out vs the
// adaptive bot — a curated imbalance library, plus positions drawn from your own
// recurring leaks (fingerprint). Pure; the FENs are validated in tests.

import type { GameAnalysis } from './types';
import { buildFingerprint } from './fingerprint';

export interface Scenario {
  id: string;
  name: string;
  category: 'imbalance' | 'weakness';
  /** Position to play from; side to move == sideToTrain. */
  fen: string;
  sideToTrain: 'w' | 'b';
  goal: string;
}

export const IMBALANCE_LIBRARY: Scenario[] = [
  {
    id: 'iqp', name: 'Isolated Queen Pawn', category: 'imbalance',
    fen: 'r1bqkb1r/pp3ppp/2n1pn2/8/3P4/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 1', sideToTrain: 'w',
    goal: 'Play with the IQP: piece activity and a d4–d5 break or a kingside attack before it becomes a weakness.',
  },
  {
    id: 'opp-castle', name: 'Opposite-side castling attack', category: 'imbalance',
    fen: '2kr3r/pppb1ppp/2n1pn2/3p4/3P4/2NBPN2/PPP1QPPP/2KR3R w - - 0 1', sideToTrain: 'w',
    goal: 'Race your pawns at the enemy king. Speed beats material — open a file first.',
  },
  {
    id: 'bishop-pair', name: 'The bishop pair', category: 'imbalance',
    fen: 'r2qk2r/ppp2ppp/2n2n2/3pp3/1b6/2NP1NP1/PPP1PPBP/R1BQ1RK1 w kq - 0 1', sideToTrain: 'w',
    goal: 'Open the position so the two bishops dominate; trade off the enemy minor that defends.',
  },
  {
    id: 'rook-up', name: 'Rook ending, a pawn up', category: 'imbalance',
    fen: '8/5pk1/6p1/8/8/1R3PKP/r5P1/8 w - - 0 1', sideToTrain: 'w',
    goal: 'Convert the extra pawn: active rook, push the passer, keep your king in front of it.',
  },
];

/** Positions from your own recurring leaks (most-impactful first); empty if no analyses. */
export function scenariosFromWeakness(analyses: GameAnalysis[]): Scenario[] {
  const out: Scenario[] = [];
  for (const leak of buildFingerprint(analyses).leaks) {
    for (const fen of leak.sampleFens) {
      const side = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      out.push({
        id: `weak:${leak.key}:${fen.slice(0, 16)}`,
        name: `Your leak: ${leak.motif}`,
        category: 'weakness',
        fen,
        sideToTrain: side,
        goal: `You went wrong here (${leak.motif}). Find the right continuation against a bot at your level.`,
      });
    }
  }
  return out;
}
