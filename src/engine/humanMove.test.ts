import { describe, it, expect } from 'vitest';
import { sampleHumanMove, temperatureForElo } from './humanMove';

describe('sampleHumanMove', () => {
  const moves = [
    { uci: 'best', cp: 0 },
    { uci: 'near', cp: -5 },
    { uci: 'blunder', cp: -500 },
  ];

  it('plays the best move at near-zero temperature', () => {
    expect(sampleHumanMove(moves, { temperature: 1, maxGapCp: 200, rand: 0.99 })).toBe('best');
  });

  it('never plays a move worse than maxGapCp below best (no catastrophic blunders)', () => {
    // High temperature + rand pushing to the end: the −500 move is filtered out entirely.
    for (const rand of [0, 0.5, 0.999]) {
      expect(sampleHumanMove(moves, { temperature: 300, maxGapCp: 150, rand })).not.toBe('blunder');
    }
  });

  it('picks a near-best alternative when temperature + rand allow (human variety)', () => {
    // Two near-equal moves; high rand lands in the second weight bucket.
    expect(sampleHumanMove([{ uci: 'a', cp: 0 }, { uci: 'b', cp: -5 }], { temperature: 100, maxGapCp: 150, rand: 0.99 })).toBe('b');
  });

  it('returns the only move, or null for none', () => {
    expect(sampleHumanMove([{ uci: 'x', cp: -10 }], { temperature: 100, maxGapCp: 150, rand: 0.5 })).toBe('x');
    expect(sampleHumanMove([], { temperature: 100, maxGapCp: 150, rand: 0.5 })).toBeNull();
  });
});

describe('temperatureForElo', () => {
  it('is hotter (more human variety) at low Elo than high Elo', () => {
    expect(temperatureForElo(1320)).toBeGreaterThan(temperatureForElo(3190));
  });
  it('clamps out-of-range Elo', () => {
    expect(temperatureForElo(500)).toBe(temperatureForElo(1320));
    expect(temperatureForElo(4000)).toBe(temperatureForElo(3190));
  });
});
