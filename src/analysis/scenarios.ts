// Scenario sparring (spec D / ADR-0030): targeted positions to play out vs the
// adaptive bot — a curated imbalance library, plus positions drawn from your own
// recurring leaks (fingerprint). Pure; the FENs are validated in tests.

import type { GameAnalysis } from './types';
import { buildFingerprint } from './fingerprint';
import { gt, motifLabelOrRaw } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

export interface Scenario {
  id: string;
  name: string;
  category: 'imbalance' | 'weakness';
  /** Position to play from; side to move == sideToTrain. */
  fen: string;
  sideToTrain: 'w' | 'b';
  goal: string;
  /** French name/goal for the static library (V2-W18); weakness-derived scenarios localize at build. */
  nameFr?: string;
  goalFr?: string;
}

export const IMBALANCE_LIBRARY: Scenario[] = [
  {
    id: 'iqp', name: 'Isolated Queen Pawn', nameFr: 'Pion dame isolé', category: 'imbalance',
    fen: 'r1bqkb1r/pp3ppp/2n1pn2/8/3P4/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 1', sideToTrain: 'w',
    goal: 'Play with the IQP: piece activity and a d4–d5 break or a kingside attack before it becomes a weakness.',
    goalFr: "Jouez avec le PDI : activité des pièces et une poussée d4–d5 ou une attaque à l'aile roi avant qu'il ne devienne une faiblesse.",
  },
  {
    id: 'opp-castle', name: 'Opposite-side castling attack', nameFr: 'Attaque aux roques opposés', category: 'imbalance',
    fen: '2kr3r/pppb1ppp/2n1pn2/3p4/3P4/2NBPN2/PPP1QPPP/2KR3R w - - 0 1', sideToTrain: 'w',
    goal: 'Race your pawns at the enemy king. Speed beats material — open a file first.',
    goalFr: "Lancez vos pions sur le roi adverse. La vitesse prime sur le matériel — ouvrez d'abord une colonne.",
  },
  {
    id: 'bishop-pair', name: 'The bishop pair', nameFr: 'La paire de fous', category: 'imbalance',
    fen: 'r2qk2r/ppp2ppp/2n2n2/3pp3/1b6/2NP1NP1/PPP1PPBP/R1BQ1RK1 w kq - 0 1', sideToTrain: 'w',
    goal: 'Open the position so the two bishops dominate; trade off the enemy minor that defends.',
    goalFr: 'Ouvrez la position pour que les deux fous dominent ; échangez la mineure adverse qui défend.',
  },
  {
    id: 'rook-up', name: 'Rook ending, a pawn up', nameFr: 'Finale de tours, un pion de plus', category: 'imbalance',
    fen: '8/5pk1/6p1/8/8/1R3PKP/r5P1/8 w - - 0 1', sideToTrain: 'w',
    goal: 'Convert the extra pawn: active rook, push the passer, keep your king in front of it.',
    goalFr: 'Convertissez le pion de plus : tour active, poussez le passé, gardez votre roi devant lui.',
  },
  {
    // C3 resilience probe seed (the library had no passive/worse position — opp-castle is an ATTACK).
    // A same-wing 4-vs-3 rook ending: the side to train is a PAWN DOWN and to move, a textbook
    // theoretical DRAW (clearly worse but holdable — honest "defend", not a lost position). The mirror
    // of `rook-up`: convert a pawn up there, hold a pawn down here. FEN validated legal + side-to-move
    // == worse side in scenarios.test.ts.
    id: 'coach:defend-worse', name: 'Defend a worse rook ending', nameFr: 'Défendre une finale de tours inférieure', category: 'imbalance',
    fen: 'r5k1/5p1p/4p1p1/8/8/5P1P/6P1/R5K1 w - - 0 1', sideToTrain: 'w',
    goal: 'Hold the worse side: a pawn down, activate your rook, keep your king near the pawns, and trade into a drawn ending — don\'t panic.',
    goalFr: 'Tenez le côté inférieur : un pion de moins, activez votre tour, gardez votre roi près des pions et simplifiez vers une finale nulle — ne paniquez pas.',
  },
  // ── PR-12 (ADR-0070, Q-D=a): eight authored expansions, 5 → 13. Every FEN is validated by
  // scenarios.test.ts (legal + side-to-move == sideToTrain + playable). Classic instructive
  // imbalances, deliberately sparse structures so the theme — not a tactic — is the lesson.
  {
    id: 'knight-vs-bad-bishop', name: 'Good knight vs bad bishop', nameFr: 'Bon cavalier contre mauvais fou', category: 'imbalance',
    fen: '8/2b2pk1/4p1p1/4P2p/3N3P/5PP1/6K1/8 w - - 0 1', sideToTrain: 'w',
    goal: 'The knight owns the light squares and the bishop bites on e5\'s granite. Improve the king, probe both wings, win a pawn.',
    goalFr: "Le cavalier règne sur les cases claires, le fou mord le granit d'e5. Améliorez le roi, sondez les deux ailes, gagnez un pion.",
  },
  {
    id: 'queen-vs-rooks', name: 'Queen vs two rooks', nameFr: 'Dame contre deux tours', category: 'imbalance',
    fen: '6k1/5ppp/8/8/8/1r3r2/5PPP/3Q2K1 w - - 0 1', sideToTrain: 'w',
    goal: 'The queen loves loose pieces and an exposed king: fork threats every move, never let the rooks coordinate on one target.',
    goalFr: "La dame adore les pièces en l'air et le roi exposé : menacez une fourchette à chaque coup, n'accordez jamais aux tours une cible commune.",
  },
  {
    id: 'outside-majority', name: 'Outside pawn majority', nameFr: 'Majorité de pions extérieure', category: 'imbalance',
    fen: '8/1pp2kpp/8/8/8/8/PPP1K1PP/8 w - - 0 1', sideToTrain: 'w',
    goal: 'Three vs two on the far wing: create the outside passer, use it as a decoy, and collect the other side with your king.',
    goalFr: "Trois contre deux à l'aile éloignée : créez le pion passé extérieur, utilisez-le comme leurre, et récoltez l'autre aile avec le roi.",
  },
  {
    id: 'exchange-up', name: 'Convert an exchange up', nameFr: "Convertir une qualité d'avance", category: 'imbalance',
    fen: '6k1/3b1ppp/4p3/8/8/8/5PPP/3R2K1 w - - 0 1', sideToTrain: 'w',
    goal: 'Rook vs bishop for a pawn: open a file, target the pawns the bishop cannot defend, and remember rook endings win by activity.',
    goalFr: "Tour contre fou pour un pion : ouvrez une colonne, visez les pions que le fou ne défend pas — une tour gagne par l'activité.",
  },
  {
    id: 'opposite-bishops-attack', name: 'Opposite-colored bishops: attack', nameFr: 'Fous de couleurs opposées : attaque', category: 'imbalance',
    fen: '2r3k1/5ppp/4p3/8/2b5/4B3/5PPP/2R3K1 w - - 0 1', sideToTrain: 'w',
    goal: 'With rooks on, opposite bishops favour the ATTACKER: your bishop hits squares theirs can never defend. Aim everything at one color complex.',
    goalFr: "Avec les tours, les fous opposés favorisent l'ATTAQUANT : votre fou vise des cases que le leur ne défendra jamais. Concentrez tout sur un complexe de cases.",
  },
  {
    id: 'space-advantage', name: 'Play with a space advantage', nameFr: "Jouer avec l'avantage d'espace", category: 'imbalance',
    fen: 'r3r1k1/1pp1qppp/p1n1p3/3pP3/3P4/2N1Q3/PPP2PPP/R3R1K1 w - - 0 1', sideToTrain: 'w',
    goal: 'The e5 wedge cramps Black. Do NOT release the tension: improve pieces behind the chain, then break with f4–f5 at the right moment.',
    goalFr: "Le coin e5 étouffe les Noirs. Ne relâchez PAS la tension : améliorez vos pièces derrière la chaîne, puis cassez par f4–f5 au bon moment.",
  },
  {
    id: 'two-minors-vs-rook', name: 'Two minors vs rook', nameFr: 'Deux mineures contre une tour', category: 'imbalance',
    fen: '5rk1/5ppp/8/8/8/2N2B2/5PPP/6K1 w - - 0 1', sideToTrain: 'w',
    goal: 'Bishop and knight outnumber the rook on any single square: coordinate them on one weakness and keep the rook passive.',
    goalFr: "Fou et cavalier surpassent la tour sur chaque case isolée : coordonnez-les sur une faiblesse et gardez la tour passive.",
  },
  {
    id: 'minority-attack', name: 'The minority attack', nameFr: "L'attaque de minorité", category: 'imbalance',
    fen: 'r4rk1/pp3ppp/2p2n2/8/1P6/P1N1P3/5PPP/R4RK1 w - - 0 1', sideToTrain: 'w',
    goal: 'Push b4–b5 against the c6 chain: trade into a lasting weakness on c6/b7, then besiege it with rooks and knight.',
    goalFr: 'Poussez b4–b5 contre la chaîne c6 : échangez vers une faiblesse durable en c6/b7, puis assiégez-la avec tours et cavalier.',
  },
];

/** Positions from your own recurring leaks (most-impactful first); empty if no analyses.
 * Names/goals are localized at build time in `locale` (V2-W18). */
export function scenariosFromWeakness(analyses: GameAnalysis[], locale: Locale = 'fr'): Scenario[] {
  const out: Scenario[] = [];
  for (const leak of buildFingerprint(analyses).leaks) {
    const motif = motifLabelOrRaw(leak.motif, locale);
    for (const fen of leak.sampleFens) {
      const side = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      out.push({
        id: `weak:${leak.key}:${fen.slice(0, 16)}`,
        name: gt('scenario.weakName', locale, { motif }),
        category: 'weakness',
        fen,
        sideToTrain: side,
        goal: gt('scenario.weakGoal', locale, { motif }),
      });
    }
  }
  return out;
}
