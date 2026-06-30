import { describe, it, expect } from 'vitest';
import {
  difficultyTargetElo,
  decideResign,
  decideAcceptDraw,
  coachedBlunderThreshold,
  adaptationDirection,
  gameAdaptsPool,
  resignThreshold,
  RESIGN_PLIES,
  DRAW_PLIES,
} from './opponentAgency';
import { ELO_MIN, ELO_MAX } from './AdaptiveOpponent';

describe('difficultyTargetElo', () => {
  it('adaptive returns the adaptive Elo', () => {
    expect(difficultyTargetElo('adaptive', 2000, 1500)).toBe(2000);
  });
  it('easier subtracts the offset, harder adds it', () => {
    expect(difficultyTargetElo('easier', 2000, 1500)).toBe(1800);
    expect(difficultyTargetElo('harder', 2000, 1500)).toBe(2200);
  });
  it('fixed returns the (clamped) fixed Elo', () => {
    expect(difficultyTargetElo('fixed', 2000, 1500)).toBe(1500);
  });
  it('clamps at the boundaries', () => {
    expect(difficultyTargetElo('harder', 3100, 1500)).toBe(ELO_MAX); // 3300 → 3190
    expect(difficultyTargetElo('easier', 1400, 1500)).toBe(ELO_MIN); // 1200 → 1320
    expect(difficultyTargetElo('fixed', 2000, 99999)).toBe(ELO_MAX);
  });
});

describe('decideResign', () => {
  it('a strong bot resigns on a sustained decisive deficit', () => {
    expect(decideResign({ botPovCp: -1200, consecutiveLostPlies: RESIGN_PLIES, botElo: 2800 })).toBe(true);
  });
  it('a strong bot does NOT resign before the deficit persists RESIGN_PLIES', () => {
    expect(decideResign({ botPovCp: -1200, consecutiveLostPlies: RESIGN_PLIES - 1, botElo: 2800 })).toBe(false);
  });
  it('a single bad ply never triggers resignation', () => {
    expect(decideResign({ botPovCp: -3000, consecutiveLostPlies: 1, botElo: 2800 })).toBe(false);
  });
  it('weak bots resign less: a sub-floor bot never resigns even when crushed', () => {
    expect(decideResign({ botPovCp: -3000, consecutiveLostPlies: 10, botElo: 1320 })).toBe(false);
  });
  it('weak (above-floor) bots need a bigger deficit than strong bots', () => {
    // -1200 is enough for a 2800 bot but not a 1700 bot (Elo-scaled threshold).
    expect(decideResign({ botPovCp: -1200, consecutiveLostPlies: RESIGN_PLIES, botElo: 1700 })).toBe(false);
    expect(decideResign({ botPovCp: -2000, consecutiveLostPlies: RESIGN_PLIES, botElo: 1700 })).toBe(true);
  });
  it('resignThreshold is monotonic (stronger → smaller/stricter) above the floor', () => {
    expect(resignThreshold(2800)).toBeLessThan(resignThreshold(1700));
    expect(resignThreshold(1320)).toBe(Infinity);
  });
});

describe('decideAcceptDraw', () => {
  it('accepts a dead-equal position sustained for DRAW_PLIES', () => {
    expect(decideAcceptDraw({ whiteCp: 10, botSide: 'w', consecutiveEqualPlies: DRAW_PLIES })).toBe(true);
  });
  it('declines while the bot is winning (white bot, +200)', () => {
    expect(decideAcceptDraw({ whiteCp: 200, botSide: 'w', consecutiveEqualPlies: DRAW_PLIES })).toBe(false);
  });
  it('declines while the bot is winning (black bot, white −200)', () => {
    expect(decideAcceptDraw({ whiteCp: -200, botSide: 'b', consecutiveEqualPlies: DRAW_PLIES })).toBe(false);
  });
  it('declines before the equality is stable', () => {
    expect(decideAcceptDraw({ whiteCp: 10, botSide: 'w', consecutiveEqualPlies: DRAW_PLIES - 1 })).toBe(false);
  });
});

describe('coachedBlunderThreshold', () => {
  it('≈ 250 at the mid pool (regression anchor)', () => {
    expect(coachedBlunderThreshold(2000)).toBe(250);
  });
  it('monotonic decreasing in Elo (stronger → tighter gate)', () => {
    expect(coachedBlunderThreshold(ELO_MAX)).toBeLessThan(coachedBlunderThreshold(2000));
    expect(coachedBlunderThreshold(2000)).toBeLessThan(coachedBlunderThreshold(ELO_MIN));
  });
  it('stays clamped sane at the extremes', () => {
    expect(coachedBlunderThreshold(ELO_MAX)).toBeGreaterThanOrEqual(150);
    expect(coachedBlunderThreshold(ELO_MIN)).toBeLessThanOrEqual(400);
  });
});

describe('adaptationDirection', () => {
  it('reports the direction for adaptive games', () => {
    expect(adaptationDirection('adaptive', 1700, 1800)).toBe('tougher');
    expect(adaptationDirection('adaptive', 1800, 1700)).toBe('easier');
    expect(adaptationDirection('adaptive', 1700, 1700)).toBe('unchanged');
  });
  it('is suppressed (null) for override games', () => {
    expect(adaptationDirection('harder', 1700, 1800)).toBeNull();
    expect(adaptationDirection('fixed', 1700, 1700)).toBeNull();
  });
});

describe('gameAdaptsPool (honesty predicate Q-E)', () => {
  it('only adaptive games fold into the pool', () => {
    expect(gameAdaptsPool('adaptive')).toBe(true);
    expect(gameAdaptsPool('easier')).toBe(false);
    expect(gameAdaptsPool('harder')).toBe(false);
    expect(gameAdaptsPool('fixed')).toBe(false);
  });
});
