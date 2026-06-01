// Comeback drills (loop-closers 3c): replay positions where YOU fell behind, against
// the adaptive opponent, to train recovery instead of collapse. Pure selector over
// stored analyses — mirrors resilienceScore's behind-episode detection but returns the
// player-to-move entry position (ADR-0025). Derives on the fly, no IndexedDB schema.

import type { GameAnalysis } from './types';

export interface ComebackPosition {
  /** Player-to-move FEN at the moment they first fell behind. */
  fen: string;
  gameId: string;
  ply: number;
  playerColor: 'w' | 'b';
  /** Player-POV centipawns entering the position (negative = losing). */
  cpAtEntry: number;
}

const BEHIND = -200; // clearly worse
const RECOVERED = -100; // back toward equality
const HOPELESS = -900; // lost beyond a realistic save → skip (not demoralising drills)

/** One drill per behind-episode: the player-to-move position where they fell to losing. */
export function comebackPositions(analyses: GameAnalysis[]): ComebackPosition[] {
  const out: ComebackPosition[] = [];
  for (const a of analyses) {
    const white = a.playerColor === 'w';
    let inBehind = false;
    for (let i = 1; i < a.plies.length; i++) {
      const ply = a.plies[i];
      if (ply.color !== a.playerColor) continue; // want a PLAYER-to-move position
      const prev = a.plies[i - 1];
      const entryCp = white ? prev.playedWhiteCp : -prev.playedWhiteCp;

      if (!inBehind && entryCp <= BEHIND) {
        inBehind = true;
        if (entryCp > HOPELESS) {
          out.push({ fen: ply.fenBefore, gameId: a.gameId, ply: ply.ply, playerColor: a.playerColor, cpAtEntry: entryCp });
        }
        // entryCp <= HOPELESS → mark behind but emit nothing (a lost cause).
      } else if (inBehind && entryCp >= RECOVERED) {
        inBehind = false;
      }
    }
  }
  return out.reverse(); // most-recent games first
}
