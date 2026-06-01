// Endgame drill catalogue (Phase 3). Each drill is a position the player plays out
// against the engine, with Syzygy giving perfect feedback (DTZ/WDL). Positions are
// <= 7 pieces so the tablebase covers them.

export interface EndgameDrill {
  id: string;
  name: string;
  category: 'basic-mate' | 'pawn' | 'rook' | 'minor-piece' | 'queen';
  /** Side to move and the side the player drives. */
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
  {
    id: 'kq-vs-k-2',
    name: 'King + Queen vs King (corner drive)',
    category: 'basic-mate',
    fen: '8/8/8/8/8/5k2/8/Q3K3 w - - 0 1',
    goal: 'Use the knight-move technique to walk the king to the corner without stalemate.',
  },
  {
    id: 'two-rooks-mate',
    name: 'Two Rooks vs King',
    category: 'basic-mate',
    fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1',
    goal: 'The ladder mate: roll the king to the edge with two rooks, no king help needed.',
  },
  {
    id: 'kq-vs-kr',
    name: 'Queen vs Rook',
    category: 'queen',
    fen: '8/8/8/4k3/8/8/4r3/4K1Q1 w - - 0 1',
    goal: 'Win the rook (or mate) — the hardest "basic" win. Pin and zugzwang the defender.',
  },
  {
    id: 'kbn-vs-k',
    name: 'Bishop + Knight mate',
    category: 'minor-piece',
    fen: '8/8/8/4k3/8/8/3BN3/4K3 w - - 0 1',
    goal: 'The famous tricky mate: drive the king to the corner of the bishop’s colour.',
  },
  {
    id: 'kp-vs-k-outside',
    name: 'K+P vs K — key squares',
    category: 'pawn',
    fen: '8/8/8/3k4/8/3P4/3K4/8 w - - 0 1',
    goal: 'Reach a key square in front of the pawn before pushing — opposition decides it.',
  },
  {
    id: 'kp-vs-kp-passed',
    name: 'Pawn race',
    category: 'pawn',
    fen: '8/6p1/8/8/8/8/1P6/k6K w - - 0 1',
    goal: 'Both sides race to queen. Count tempi — who promotes first, and does it matter?',
  },
  {
    id: 'rook-vs-pawn',
    name: 'Rook vs Pawn',
    category: 'rook',
    fen: '8/8/8/8/8/2k5/2p5/2K3R1 w - - 0 1',
    goal: 'Stop the pawn with the rook and king. Mind the Réti-style king walk.',
  },
  {
    id: 'rook-pawn-vs-rook',
    name: 'Rook + Pawn vs Rook (Lucena setup)',
    category: 'rook',
    fen: '3K4/3P4/8/8/8/8/5k2/3r4 w - - 0 1',
    goal: 'Convert the extra pawn — build a bridge once the king is boxed out.',
  },
  {
    id: 'q-vs-p-7th',
    name: 'Queen vs Pawn on the 7th',
    category: 'queen',
    fen: '8/8/8/8/8/5K2/1k4p1/8 w - - 0 1',
    goal: 'Against a far-advanced pawn, walk the king in using check-and-block tempi.',
  },
];

export function drillById(id: string): EndgameDrill | undefined {
  return ENDGAME_DRILLS.find((d) => d.id === id);
}
