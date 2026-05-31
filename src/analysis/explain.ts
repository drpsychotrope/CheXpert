// Natural-language move explanations — rule-based templates ONLY (Q-J, ADR-0015,
// AP-CHESS-19). A "light DecodeChess": every sentence is DERIVED from engine facts
// already on the PlyAnalysis (severity, win-prob loss, motif, phase, mate, the
// best move). NO LLM, no invented reasons — if we don't have a fact, we don't
// assert it. This keeps explanations faithful and the app fully local/offline.

import { Chess, type Square } from 'chess.js';
import type { PlyAnalysis, Severity } from './types';

const SEVERITY_PHRASE: Record<Severity, string> = {
  blunder: 'a blunder',
  mistake: 'a mistake',
  inaccuracy: 'an inaccuracy',
  good: 'fine',
  best: 'the best move',
};

const PHASE_PHRASE = {
  opening: 'in the opening',
  middlegame: 'in the middlegame',
  endgame: 'in the endgame',
} as const;

// Plain-language description of what the missed motif accomplishes.
const MOTIF_EXPLANATION: Record<string, string> = {
  mate: 'forces checkmate',
  mateIn1: 'delivers mate in one',
  mateIn2: 'forces mate in two',
  mateIn3: 'forces mate in three',
  backRankMate: 'exploits the weak back rank',
  hangingPiece: 'wins an undefended piece',
  fork: 'forks two targets at once',
  knightFork: 'lands a knight fork',
};

/** Turn a UCI move into a readable SAN in the given position (best-effort).
 * Only pass `promotion` when the UCI actually carries one — chess.js 1.4.0
 * rejects a promotion field on a non-promoting move (e.g. d2d4), which would
 * otherwise drop us back to raw UCI in the explanation. */
function uciToSan(fen: string, uci: string): string | null {
  if (!uci || uci.length < 4) return null;
  try {
    const c = new Chess(fen);
    const move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' } = {
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
    };
    if (uci.length >= 5) move.promotion = uci[4] as 'q' | 'r' | 'b' | 'n';
    const m = c.move(move);
    return m ? m.san : null;
  } catch {
    return null;
  }
}

export interface Explanation {
  /** One-line headline, e.g. "Move 12 Nxe5 — a blunder (−34% winning chances)." */
  headline: string;
  /** The "why" sentences, each derived from a known fact. */
  reasons: string[];
  /** What to do instead, if a best move is known. */
  better: string | null;
}

/**
 * Explain a single analysed ply. Only meaningful for mistakes/blunders/inaccuracies;
 * for good/best moves it returns a short affirmation. Everything is fact-derived.
 */
export function explainPly(ply: PlyAnalysis): Explanation {
  const sev = SEVERITY_PHRASE[ply.severity];
  const wp = Math.round(ply.winProbLoss);

  if (ply.severity === 'good' || ply.severity === 'best') {
    return {
      headline: `Move ${ply.moveNumber} ${ply.san} — ${sev}.`,
      reasons: [],
      better: null,
    };
  }

  const headline = `Move ${ply.moveNumber} ${ply.san} — ${sev} (−${wp}% winning chances) ${PHASE_PHRASE[ply.phase]}.`;
  const reasons: string[] = [];

  // 1) Magnitude, from the win-probability delta (a real number we computed).
  if (wp >= 20) reasons.push(`This swing is large: it hands the opponent roughly ${wp}% in winning chances.`);
  else if (wp >= 10) reasons.push(`It costs about ${wp}% in winning chances.`);
  else reasons.push(`A smaller slip — about ${wp}% in winning chances.`);

  // 2) The missed idea, ONLY if a motif detector fired with confidence.
  const bestSan = ply.bestUci ? uciToSan(ply.fenBefore, ply.bestUci) : null;
  if (ply.motif && ply.motif.confidence === 'high') {
    const tag = ply.motif.tags.find((t) => MOTIF_EXPLANATION[t]) ?? ply.motif.tag;
    const what = MOTIF_EXPLANATION[tag];
    if (what) {
      reasons.push(bestSan ? `You missed a tactic: ${bestSan} ${what}.` : `You missed a tactic that ${what}.`);
    }
  } else if (ply.mate != null && ply.mate > 0) {
    reasons.push(`A forced mate was available${bestSan ? ` starting with ${bestSan}` : ''}.`);
  } else {
    // Honest fallback: we don't claim a specific pattern we didn't detect.
    reasons.push(
      `We can't name a specific tactical pattern here with confidence — the engine simply evaluates ${
        bestSan ? `${bestSan} and other moves` : 'another move'
      } as clearly better.`,
    );
  }

  // 3) Material capture cue, if the played move dropped something (from cpLoss).
  if (ply.severity === 'blunder' && ply.cpLoss >= 300) {
    reasons.push('In practical terms this is around a piece (or more) of value swung to your opponent.');
  }

  const better = bestSan
    ? `Better was ${bestSan}.`
    : ply.bestUci
      ? `Better was ${ply.bestUci}.`
      : null;

  return { headline, reasons, better };
}

/** Convenience: explain only the player's significant mistakes in a game. */
export function explainMistakes(plies: PlyAnalysis[], playerColor: 'w' | 'b'): Array<{ ply: PlyAnalysis; explanation: Explanation }> {
  return plies
    .filter((p) => p.color === playerColor && (p.severity === 'mistake' || p.severity === 'blunder'))
    .map((p) => ({ ply: p, explanation: explainPly(p) }));
}
