// Adaptive Stockfish opponent (spec §4.4, AP-CHESS-6).
//
// Strength is set with UCI_LimitStrength + UCI_Elo (NOT random blunder injection
// and NOT Skill Level — UCI_Elo takes precedence and is instructive). After each
// game we nudge the target Elo by ±STEP toward a player win-rate band around 55%,
// so the opponent stays in the player's zone of proximal development.

import type { EngineClient } from './EngineClient';

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
  ) {}

  /** Apply the current target Elo to the engine. Call after init / after changes. */
  async applyStrength(): Promise<void> {
    await this.engine.init();
    this.engine.setOption('UCI_LimitStrength', true);
    this.engine.setOption('UCI_Elo', clampElo(this.state.targetElo));
    await this.engine.isready();
  }

  /** Ask the opponent for a move in the given position. */
  async pickMove(fen: string, movetime = 500): Promise<string | null> {
    const res = await this.engine.evaluate(fen, { movetime });
    return res.bestmove;
  }

  /** Record the finished game and re-apply the adjusted strength. */
  async finishGame(outcome: GameOutcome): Promise<OpponentState> {
    this.state = recordGame(this.state, outcome);
    await this.applyStrength();
    return this.state;
  }
}
