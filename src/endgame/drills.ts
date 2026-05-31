// Endgame drill catalogue (Phase 3). Each drill is a position the player plays out
// against the engine, with Syzygy giving perfect feedback (DTZ/WDL). Positions are
// <= 7 pieces so the tablebase covers them.

export interface EndgameDrill {
  id: string;
  name: string;
  category: 'basic-mate' | 'pawn' | 'rook';
  /** Player to move and win (these are all wins for the side to move). */
  fen: string;
  /** One-line teaching goal. */
  goal: string;
}

export const ENDGAME_DRILLS: EndgameDrill[] = [
  {
    id: 'kq-vs-k',
    name: 'King + Queen vs King',
    category: 'basic-mate',
    fen: '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1',
    goal: 'Mate with king and queen. Box the king to the edge — avoid stalemate.',
  },
  {
    id: 'kr-vs-k',
    name: 'King + Rook vs King',
    category: 'basic-mate',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: 'Mate with king and rook using the box/ladder method.',
  },
  {
    id: 'kp-vs-k-opposition',
    name: 'K+P vs K — opposition',
    category: 'pawn',
    fen: '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1',
    goal: 'Promote the pawn. Take the opposition to escort it home.',
  },
  {
    id: 'kp-vs-k-rook-pawn',
    name: 'K+P vs K — rook pawn',
    category: 'pawn',
    fen: '8/8/8/8/8/k7/P7/K7 w - - 0 1',
    goal: 'The rook pawn is tricky — can White even win this? Find out with perfect play.',
  },
  {
    id: 'lucena',
    name: 'Rook ending — Lucena (building a bridge)',
    category: 'rook',
    fen: '1K6/1P6/8/8/8/8/r7/2k4R w - - 0 1',
    goal: 'The fundamental winning rook endgame. Build a bridge to shelter your king.',
  },
  {
    id: 'philidor',
    name: 'Rook ending — Philidor (third-rank defence)',
    category: 'rook',
    fen: '8/8/8/8/3k4/8/3K1p2/5r2 b - - 0 1',
    goal: 'The fundamental drawing technique when defending a rook endgame a pawn down.',
  },
];

export function drillById(id: string): EndgameDrill | undefined {
  return ENDGAME_DRILLS.find((d) => d.id === id);
}
