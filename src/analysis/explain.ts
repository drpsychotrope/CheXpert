// Natural-language move explanations — rule-based templates ONLY (Q-J, ADR-0015,
// AP-CHESS-19). A "light DecodeChess": every sentence is DERIVED from engine facts
// already on the PlyAnalysis (severity, win-prob loss, motif, phase, mate, the
// best move). NO LLM, no invented reasons — if we don't have a fact, we don't
// assert it. This keeps explanations faithful and the app fully local/offline.
//
// V2-W18 (F3): bilingual. Phrases live in the i18n generator catalogue; this pure
// core resolves them via an INJECTED `locale` (gt), so it stays pure/testable and
// every case is a complete per-locale template (never concatenated fragments).

import { Chess, type Square } from 'chess.js';
import type { PlyAnalysis } from './types';
import { explainPositional } from './positional';
import { gt, gtHas } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

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
 * Explain a single analysed ply in `locale`. Only meaningful for mistakes/blunders/
 * inaccuracies; for good/best moves it returns a short affirmation. Everything is
 * fact-derived. SAN moves stay as-is (international notation, ADR-0052 Q4).
 */
export function explainPly(ply: PlyAnalysis, locale: Locale): Explanation {
  const sev = gt('severity.' + ply.severity, locale);
  const wp = Math.round(ply.winProbLoss);

  if (ply.severity === 'good' || ply.severity === 'best') {
    return {
      headline: gt('explain.headlineGood', locale, { n: ply.moveNumber, san: ply.san, sev }),
      reasons: [],
      better: null,
    };
  }

  const headline = gt('explain.headline', locale, {
    n: ply.moveNumber,
    san: ply.san,
    sev,
    wp,
    phase: gt('phase.' + ply.phase, locale),
  });
  const reasons: string[] = [];

  // 1) Magnitude, from the win-probability delta (a real number we computed).
  if (wp >= 20) reasons.push(gt('explain.magLarge', locale, { wp }));
  else if (wp >= 10) reasons.push(gt('explain.magMed', locale, { wp }));
  else reasons.push(gt('explain.magSmall', locale, { wp }));

  // 2) The missed idea, ONLY if a motif detector fired with confidence.
  const bestSan = ply.bestUci ? uciToSan(ply.fenBefore, ply.bestUci) : null;
  if (ply.motif && ply.motif.confidence === 'high') {
    const tag = ply.motif.tags.find((t) => gtHas('motifExpl.' + t)) ?? ply.motif.tag;
    if (gtHas('motifExpl.' + tag)) {
      const what = gt('motifExpl.' + tag, locale);
      reasons.push(
        bestSan
          ? gt('explain.missedTacticSan', locale, { san: bestSan, what })
          : gt('explain.missedTacticNoSan', locale, { what }),
      );
    }
  } else if (ply.mate != null && ply.mate > 0) {
    const from = bestSan ? gt('explain.forcedMateFrom', locale, { san: bestSan }) : '';
    reasons.push(gt('explain.forcedMate', locale, { from }));
  } else {
    // Honest fallback: we don't claim a specific pattern we didn't detect.
    const alt = bestSan ? gt('explain.altWithSan', locale, { san: bestSan }) : gt('explain.altNoSan', locale);
    reasons.push(gt('explain.fallback', locale, { alt }));
    // Add honest, FEN-derived positional context for the player's side (no tactic to name).
    for (const phrase of explainPositional(ply.fenAfter, ply.color, locale).slice(0, 2)) reasons.push(phrase);
  }

  // 3) Material capture cue, if the played move dropped something (from cpLoss).
  if (ply.severity === 'blunder' && ply.cpLoss >= 300) {
    reasons.push(gt('explain.materialCue', locale));
  }

  const better = bestSan
    ? gt('explain.betterSan', locale, { san: bestSan })
    : ply.bestUci
      ? gt('explain.betterSan', locale, { san: ply.bestUci })
      : null;

  return { headline, reasons, better };
}

/** Convenience: explain only the player's significant mistakes in a game, in `locale`. */
export function explainMistakes(
  plies: PlyAnalysis[],
  playerColor: 'w' | 'b',
  locale: Locale,
): Array<{ ply: PlyAnalysis; explanation: Explanation }> {
  return plies
    .filter((p) => p.color === playerColor && (p.severity === 'mistake' || p.severity === 'blunder'))
    .map((p) => ({ ply: p, explanation: explainPly(p, locale) }));
}
