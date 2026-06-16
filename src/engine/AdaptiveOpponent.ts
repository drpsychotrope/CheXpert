// Adaptive Stockfish opponent (spec §4.4, AP-CHESS-6).
//
// Strength is set with UCI_LimitStrength + UCI_Elo (NOT random blunder injection
// and NOT Skill Level — UCI_Elo takes precedence and is instructive). After each
// game we nudge the target Elo by ±STEP toward a player win-rate band around 55%,
// so the opponent stays in the player's zone of proximal development.

import type { EngineClient } from './EngineClient';
import { sampleHumanMove, temperatureForElo } from './humanMove';

export const ELO_MIN = 1320;
export const ELO_MAX = 3190;
export const TARGET_WINRATE = 0.55;
const STEP_MIN = 50;
const STEP_MAX = 100;
const WINDOW = 8; // games considered for the rolling win-rate

export type GameOutcome = 'win' | 'loss' | 'draw';

export interface OpponentState {
  targetElo: number;
  /** Most-recent outcomes, newest last, capped at WINDOW. */
  recent: GameOutcome[];
}

export function clampElo(elo: number): number {
  return Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(elo)));
}

export function initOpponentState(seedElo: number): OpponentState {
  return { targetElo: clampElo(seedElo), recent: [] };
}

/** Player win-rate over the rolling window (draws count as 0.5). */
export function rollingWinRate(recent: GameOutcome[]): number {
  if (recent.length === 0) return TARGET_WINRATE;
  const pts = recent.reduce((s, o) => s + (o === 'win' ? 1 : o === 'draw' ? 0.5 : 0), 0);
  return pts / recent.length;
}

/**
 * Fold a finished game into opponent state and return the NEW state.
 * If the player is winning too often, raise the bot's Elo; if losing too often,
 * lower it. Step size scales with how far we are from the target band.
 */
export function recordGame(state: OpponentState, outcome: GameOutcome): OpponentState {
  const recent = [...state.recent, outcome].slice(-WINDOW);
  const wr = rollingWinRate(recent);
  const diff = wr - TARGET_WINRATE; // >0 → player winning too much → bot too weak

  // Only adjust once we have a little signal, but always nudge on a single
  // decisive result so the very first games still move toward the band.
  const magnitude = Math.min(STEP_MAX, Math.max(STEP_MIN, Math.round(Math.abs(diff) * 400)));
  const direction = diff > 0 ? 1 : diff < 0 ? -1 : 0;
  const targetElo = clampElo(state.targetElo + direction * magnitude);

  return { targetElo, recent };
}

export class AdaptiveOpponent {
  constructor(
    private engine: EngineClient,
    public state: OpponentState,
    /** Chess960 (ADR-0041): when true, set UCI_Chess960 on every (re)boot. */
    private chess960 = false,
  ) {}

  /** Apply the current target Elo to the engine. Call after init / after changes.
   *  Options are written serialized w.r.t. the search queue so they never change mid-search
   *  (audit v2 L8). UCI_Chess960 re-applied so a respawn doesn't drop it (AP-960-4), and set
   *  false for standard games to overwrite any cached true from a prior 960 game. */
  async applyStrength(): Promise<void> {
    await this.engine.applyOptions({
      UCI_LimitStrength: true,
      UCI_Elo: clampElo(this.state.targetElo),
      UCI_Chess960: this.chess960,
    });
  }

  /** Ask the opponent for a move in the given position. */
  async pickMove(fen: string, movetime = 500): Promise<string | null> {
    const res = await this.engine.evaluate(fen, { movetime });
    return res.bestmove;
  }

  /**
   * Human-like move: sample among the engine's top moves weighted by eval, with a
   * temperature set by the target Elo (lower Elo → more variety). Never a catastrophic
   * blunder (moves > maxGapCp below best are excluded). Falls back to the best move if
   * MultiPV is unavailable. The Maia-spike's cheap alternative — varied, beatable play.
   */
  async pickHumanMove(fen: string, movetime = 300): Promise<string | null> {
    let lines;
    try {
      // MultiPV 3 (was 4): 3 lines suffice for temperature sampling and cost the engine less
      // on the hot path (every bot move); the anti-blunder gap filter below is unchanged (audit W15).
      lines = await this.engine.analyzeLines(fen, { multipv: 3, movetime });
    } catch {
      return this.pickMove(fen, movetime);
    }
    if (!lines.length || !lines[0].uci) return this.pickMove(fen, movetime);
    const whiteToMove = fen.split(' ')[1] !== 'b';
    const moves = lines
      .filter((l) => l.uci)
      .map((l) => ({ uci: l.uci as string, cp: whiteToMove ? l.whiteCp : -l.whiteCp }));
    return sampleHumanMove(moves, {
      temperature: temperatureForElo(this.state.targetElo),
      maxGapCp: 150,
      rand: Math.random(),
    });
  }

  /** Record the finished game and re-apply the adjusted strength. */
  async finishGame(outcome: GameOutcome): Promise<OpponentState> {
    this.state = recordGame(this.state, outcome);
    await this.applyStrength();
    return this.state;
  }
}
