// Weak-square selection + board-mastery, over a list of FSRS cards (ADR-0043). Pure — the caller
// fetches the cards (e.g. dueCards(now,'vision-square')); no DB access here.

import type { SrsCardRecord } from '../srs/types';

/** FSRS stability (in days) at/above which a square counts as retained. Tunable. */
export const MASTERY_STABILITY_DAYS = 21;
const REVIEW_STATE = 2; // ts-fsrs State.Review

/** Weakest vision squares: due before not-due, then ascending stability. Returns squares. */
export function weakSquares(cards: SrsCardRecord[], now: number, limit: number): string[] {
  return cards
    .filter((c) => c.kind === 'vision-square')
    .slice()
    .sort((a, b) => {
      const ad = a.due <= now ? 0 : 1;
      const bd = b.due <= now ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.stability - b.stability;
    })
    .slice(0, limit)
    .map((c) => c.refId);
}

/** Fraction of the 64 squares whose vision card is in a stable Review state. */
export function visionMastery(cards: SrsCardRecord[]): number {
  const mastered = new Set(
    cards
      .filter((c) => c.kind === 'vision-square' && c.state === REVIEW_STATE && c.stability >= MASTERY_STABILITY_DAYS)
      .map((c) => c.refId),
  );
  return mastered.size / 64;
}
