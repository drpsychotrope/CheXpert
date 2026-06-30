import { describe, it, expect } from 'vitest';
import { steerFromWeakness } from './weaknessSelect';

describe('steerFromWeakness (F3 pure core — ADR-0055)', () => {
  it('empty counters → no signal (no-regression escape hatch)', () => {
    expect(steerFromWeakness({})).toEqual({ themes: undefined });
  });

  it('all-zero counters → no signal', () => {
    expect(steerFromWeakness({ fork: 0, pin: 0 })).toEqual({ themes: undefined });
  });

  it('all-below-minCount (single miss) → no signal (noise floor, AP-ATTEMPT-4)', () => {
    // Default minCount = 2: a lone miss must not redirect the queue.
    expect(steerFromWeakness({ fork: 1 })).toEqual({ themes: undefined });
    expect(steerFromWeakness({ fork: 1, pin: 1 })).toEqual({ themes: undefined });
  });

  it('a single dominant theme above minCount → biases toward it', () => {
    expect(steerFromWeakness({ fork: 3, pin: 1 })).toEqual({ themes: ['fork'], topTheme: 'fork' });
  });

  it('picks the worst (highest count) theme as the lead bias', () => {
    expect(steerFromWeakness({ fork: 2, pin: 5, skewer: 3 })).toEqual({ themes: ['pin'], topTheme: 'pin' });
  });

  it('ties broken deterministically by theme key (no Math.random, AP-ATTEMPT-8)', () => {
    // fork and pin both at 4 → ascending key order picks 'fork'. Stable across calls.
    const a = steerFromWeakness({ pin: 4, fork: 4 });
    const b = steerFromWeakness({ fork: 4, pin: 4 });
    expect(a).toEqual({ themes: ['fork'], topTheme: 'fork' });
    expect(a).toEqual(b);
  });

  it('honors k > 1 (soft bias toward the top-k worst, worst-first)', () => {
    expect(steerFromWeakness({ fork: 2, pin: 5, skewer: 4 }, { k: 2 })).toEqual({
      themes: ['pin', 'skewer'],
      topTheme: 'pin',
    });
  });

  it('k clamps to available themes (fewer than k qualifying)', () => {
    expect(steerFromWeakness({ fork: 3, pin: 1 }, { k: 3 })).toEqual({ themes: ['fork'], topTheme: 'fork' });
  });

  it('k <= 0 → no signal', () => {
    expect(steerFromWeakness({ fork: 5 }, { k: 0 })).toEqual({ themes: undefined });
  });

  it('honors a custom minCount', () => {
    // minCount 3 suppresses a theme at 2; raising the floor yields no signal here.
    expect(steerFromWeakness({ fork: 2 }, { minCount: 3 })).toEqual({ themes: undefined });
    expect(steerFromWeakness({ fork: 3 }, { minCount: 3 })).toEqual({ themes: ['fork'], topTheme: 'fork' });
  });
});
