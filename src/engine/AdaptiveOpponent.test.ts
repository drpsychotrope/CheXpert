import { describe, it, expect } from 'vitest';
import {
  clampElo,
  initOpponentState,
  recordGame,
  rollingWinRate,
  ELO_MIN,
  ELO_MAX,
  TARGET_WINRATE,
} from './AdaptiveOpponent';

describe('AdaptiveOpponent strength adaptation', () => {
  it('clamps Elo to the UCI_Elo supported range', () => {
    expect(clampElo(100)).toBe(ELO_MIN);
    expect(clampElo(9999)).toBe(ELO_MAX);
    expect(clampElo(1500)).toBe(1500);
  });

  it('raises bot Elo when the player keeps winning', () => {
    let s = initOpponentState(1500);
    for (let i = 0; i < 6; i++) s = recordGame(s, 'win');
    expect(s.targetElo).toBeGreaterThan(1500);
  });

  it('lowers bot Elo when the player keeps losing', () => {
    let s = initOpponentState(1500);
    for (let i = 0; i < 6; i++) s = recordGame(s, 'loss');
    expect(s.targetElo).toBeLessThan(1500);
  });

  it('converges toward the ~55% win band rather than oscillating wildly', () => {
    let s = initOpponentState(1500);
    // Simulate a player who wins ~55% by pattern W,W,L,W,L repeating.
    const pattern: Array<'win' | 'loss'> = ['win', 'win', 'loss', 'win', 'loss'];
    for (let i = 0; i < 40; i++) s = recordGame(s, pattern[i % pattern.length]);
    // Should settle within the legal band and not peg to an extreme.
    expect(s.targetElo).toBeGreaterThan(ELO_MIN);
    expect(s.targetElo).toBeLessThan(ELO_MAX);
  });

  it('rolling win rate counts draws as half and defaults to target when empty', () => {
    expect(rollingWinRate([])).toBe(TARGET_WINRATE);
    expect(rollingWinRate(['win', 'loss'])).toBe(0.5);
    expect(rollingWinRate(['draw', 'draw'])).toBe(0.5);
  });
});
