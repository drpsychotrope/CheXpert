// Endgame drill catalogue (Phase 3). Each drill is a position the player plays out
// against the engine, with Syzygy giving perfect feedback (DTZ/WDL). Positions are
// <= 7 pieces so the tablebase covers them.
//
// EVERY fen here is validated by scripts/validate-endgames.mjs: legal, the side NOT
// to move is not in check (Syzygy rejects "opposite check" with HTTP 400), <= 7
// pieces, and not already game-over. Run that script before adding drills.

export interface EndgameDrill {
  id: string;
  name: string;
  /** French drill name (SAN/notation stays English). */
  nameFr: string;
  category: 'basic-mate' | 'pawn' | 'rook' | 'minor-piece' | 'queen';
  /** Side to move drives; chosen so the position is legal for the tablebase. */
  fen: string;
  /** One-line teaching goal. */
  goal: string;
  /** French teaching goal. */
  goalFr: string;
}

export const ENDGAME_DRILLS: EndgameDrill[] = [
  // --- basic mates ---------------------------------------------------------
  {
    id: 'kq-vs-k',
    name: 'King + Queen vs King',
    nameFr: 'Roi + Dame contre Roi',
    category: 'basic-mate',
    fen: '4k3/8/8/8/8/8/5Q2/4K3 w - - 0 1',
    goal: 'Mate with king and queen. Box the king to the edge — avoid stalemate.',
    goalFr: 'Matez avec le roi et la dame. Encagez le roi vers le bord — évitez le pat.',
  },
  {
    id: 'kq-vs-k-2',
    name: 'King + Queen vs King (corner drive)',
    nameFr: 'Roi + Dame contre Roi (vers le coin)',
    category: 'basic-mate',
    fen: '8/8/8/8/5k2/8/8/Q3K3 w - - 0 1',
    goal: 'Use the knight-move technique to walk the king to the corner without stalemate.',
    goalFr: 'Utilisez la technique du saut de cavalier pour mener le roi dans le coin sans faire pat.',
  },
  {
    id: 'kr-vs-k',
    name: 'King + Rook vs King',
    nameFr: 'Roi + Tour contre Roi',
    category: 'basic-mate',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: 'Mate with king and rook using the box / ladder method.',
    goalFr: 'Matez avec le roi et la tour par la méthode de l’encagement / de l’escalier.',
  },
  {
    id: 'kr-vs-k-2',
    name: 'King + Rook vs King (cut off)',
    nameFr: 'Roi + Tour contre Roi (en barrage)',
    category: 'basic-mate',
    fen: '8/8/4k3/8/8/8/R7/4K3 w - - 0 1',
    goal: 'Cut the king off on a file, then bring your king up to drive it back.',
    goalFr: 'Coupez le roi sur une colonne, puis avancez votre roi pour le repousser.',
  },
  {
    id: 'two-rooks-mate',
    name: 'Two Rooks vs King',
    nameFr: 'Deux Tours contre Roi',
    category: 'basic-mate',
    fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1',
    goal: 'The ladder mate: roll the king to the edge with two rooks, no king help needed.',
    goalFr: 'Le mat de l’escalier : repoussez le roi vers le bord avec les deux tours, sans l’aide du roi.',
  },
  {
    id: 'kbn-vs-k',
    name: 'Bishop + Knight mate',
    nameFr: 'Mat du Fou et du Cavalier',
    category: 'minor-piece',
    fen: '8/8/8/4k3/8/8/3BN3/4K3 w - - 0 1',
    goal: 'The famously tricky mate: drive the king to the corner of the bishop’s colour.',
    goalFr: 'Le mat réputé délicat : menez le roi dans le coin de la couleur du fou.',
  },
  {
    id: 'two-bishops-mate',
    name: 'Two Bishops vs King',
    nameFr: 'Deux Fous contre Roi',
    category: 'minor-piece',
    fen: '8/8/8/4k3/8/8/2BB4/4K3 w - - 0 1',
    goal: 'Use both bishops to build a wall and herd the king into a corner.',
    goalFr: 'Servez-vous des deux fous pour former un mur et pousser le roi dans un coin.',
  },

  // --- queen vs lone material ---------------------------------------------
  {
    id: 'kq-vs-kr',
    name: 'Queen vs Rook',
    nameFr: 'Dame contre Tour',
    category: 'queen',
    fen: '8/8/8/4k3/8/4r3/8/4K1Q1 w - - 0 1',
    goal: 'Win the rook (or mate) — the hardest "basic" win. Pin and zugzwang the defender.',
    goalFr: 'Gagnez la tour (ou matez) — le gain « élémentaire » le plus dur. Clouez et mettez le défenseur en zugzwang.',
  },
  {
    id: 'q-vs-p-7th',
    name: 'Queen vs Pawn on the 7th',
    nameFr: 'Dame contre pion à la 7e',
    category: 'queen',
    fen: '8/8/8/8/8/5K2/1k4p1/8 w - - 0 1',
    goal: 'Against a far-advanced pawn, walk the king in using check-and-block tempi.',
    goalFr: 'Face à un pion très avancé, rapprochez le roi en gagnant des tempi par échec et blocage.',
  },
  {
    id: 'q-vs-rook-pawn',
    name: 'Queen vs rook-pawn on the 7th (draw trap)',
    nameFr: 'Dame contre pion-tour à la 7e (piège de nulle)',
    category: 'queen',
    fen: '8/8/8/8/8/4K3/kp6/8 w - - 0 1',
    goal: 'A rook or bishop pawn on the 7th can draw — see why the king can’t arrive in time.',
    goalFr: 'Un pion-tour ou pion-fou à la 7e peut faire nulle — voyez pourquoi le roi n’arrive pas à temps.',
  },

  // --- king + pawn ---------------------------------------------------------
  {
    id: 'kp-vs-k-opposition',
    name: 'K+P vs K — opposition',
    nameFr: 'R+P contre R — opposition',
    category: 'pawn',
    fen: '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1',
    goal: 'Promote the pawn. Take the opposition to escort it home.',
    goalFr: 'Promouvez le pion. Prenez l’opposition pour l’escorter à dame.',
  },
  {
    id: 'kp-vs-k-key-squares',
    name: 'K+P vs K — key squares',
    nameFr: 'R+P contre R — cases clés',
    category: 'pawn',
    fen: '8/8/8/3k4/8/3P4/3K4/8 w - - 0 1',
    goal: 'Reach a key square in front of the pawn before pushing — opposition decides it.',
    goalFr: 'Atteignez une case clé devant le pion avant de pousser — l’opposition tranche.',
  },
  {
    id: 'kp-vs-k-rook-pawn',
    name: 'K+P vs K — rook pawn',
    nameFr: 'R+P contre R — pion-tour',
    category: 'pawn',
    fen: '8/8/8/8/8/k7/P7/K7 w - - 0 1',
    goal: 'The rook pawn is tricky — can White even win this? Find out with perfect play.',
    goalFr: 'Le pion-tour est délicat — les Blancs peuvent-ils seulement gagner ? Découvrez-le avec un jeu parfait.',
  },
  {
    id: 'kp-vs-k-defend',
    name: 'K vs K+P — drawing defence',
    nameFr: 'R contre R+P — défense pour la nulle',
    category: 'pawn',
    fen: '8/8/8/3k4/3p4/8/3K4/8 b - - 0 1',
    goal: 'You are Black, a pawn up. As White’s side it’s a draw — but can you find the win attempt?',
    goalFr: 'Vous jouez les Noirs, un pion de plus. Côté blanc c’est nulle — saurez-vous trouver la tentative de gain ?',
  },
  {
    id: 'kp-vs-kp-passed',
    name: 'Pawn race',
    nameFr: 'Course de pions',
    category: 'pawn',
    fen: '8/6p1/8/8/8/8/1P6/k6K w - - 0 1',
    goal: 'Both sides race to queen. Count tempi — who promotes first, and does it matter?',
    goalFr: 'Les deux camps courent à dame. Comptez les tempi — qui promeut le premier, et est-ce déterminant ?',
  },
  {
    id: 'kp-vs-kp-outside',
    name: 'Outside passed pawn',
    nameFr: 'Pion passé extérieur',
    category: 'pawn',
    fen: '8/8/p7/8/8/7P/8/k6K w - - 0 1',
    goal: 'The outside passer decoys the enemy king — then your king cleans up.',
    goalFr: 'Le pion passé extérieur attire le roi adverse — puis votre roi fait le ménage.',
  },

  // --- rook endings --------------------------------------------------------
  {
    id: 'lucena',
    name: 'Rook ending — Lucena (build a bridge)',
    nameFr: 'Finale de tours — Lucena (construire un pont)',
    category: 'rook',
    fen: '2K5/2P5/8/8/8/8/6R1/2k4r w - - 0 1',
    goal: 'The fundamental winning rook endgame. Build a bridge to shelter your king.',
    goalFr: 'La finale de tours gagnante fondamentale. Construisez un pont pour abriter votre roi.',
  },
  {
    id: 'philidor',
    name: 'Rook ending — Philidor (third-rank defence)',
    nameFr: 'Finale de tours — Philidor (défense de la 3e rangée)',
    category: 'rook',
    fen: '8/8/8/8/3k4/8/3K1p2/5r2 b - - 0 1',
    goal: 'The fundamental drawing technique when defending a rook endgame a pawn down.',
    goalFr: 'La technique de nulle fondamentale pour défendre une finale de tours avec un pion de moins.',
  },
  {
    id: 'rook-pawn-vs-rook',
    name: 'Rook + Pawn vs Rook (Lucena setup)',
    nameFr: 'Tour + Pion contre Tour (dispositif Lucena)',
    category: 'rook',
    fen: '3K4/3P4/8/8/8/8/5k2/3r4 w - - 0 1',
    goal: 'Convert the extra pawn — box the king out, then build a bridge.',
    goalFr: 'Convertissez le pion de plus — tenez le roi à l’écart, puis construisez un pont.',
  },
  {
    id: 'rook-vs-pawn',
    name: 'Rook vs Pawn',
    nameFr: 'Tour contre Pion',
    category: 'rook',
    fen: '8/8/8/8/8/2k5/2p5/2K3R1 w - - 0 1',
    goal: 'Stop the pawn with the rook and king. Mind the Réti-style king walk.',
    goalFr: 'Arrêtez le pion avec la tour et le roi. Attention à la marche de roi à la Réti.',
  },
  {
    id: 'rook-vs-two-pawns',
    name: 'Rook vs two connected pawns',
    nameFr: 'Tour contre deux pions liés',
    category: 'rook',
    fen: '8/8/8/8/2k5/2p5/2p5/R3K3 w - - 0 1',
    goal: 'Two connected passers on the 6th can beat a rook — judge whether you hold.',
    goalFr: 'Deux pions passés liés à la 6e peuvent battre une tour — jugez si vous tenez.',
  },
  {
    id: 'rook-pawn-7th-vs-rook',
    name: 'Rook + far pawn — short-side defence',
    nameFr: 'Tour + pion avancé — défense du petit côté',
    category: 'rook',
    fen: '5k2/5P2/5K2/8/8/8/8/r6R w - - 0 1',
    goal: 'Far-advanced pawn, kings close — the defender needs checking distance to hold.',
    goalFr: 'Pion très avancé, rois proches — le défenseur a besoin de la distance d’échec pour tenir.',
  },
];

export function drillById(id: string): EndgameDrill | undefined {
  return ENDGAME_DRILLS.find((d) => d.id === id);
}
