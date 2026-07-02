import { describe, it, expect } from 'vitest';
import { metacogNudge, NUDGE_CAUSE_FLOOR } from './nudges';
import type { Calibration } from './metacog';

const cal = (over: Partial<NonNullable<Calibration['readout']>> | null): Calibration =>
  ({
    byConfidence: [],
    reportedAttempts: 20,
    taggedMisses: 10,
    selfTags: [],
    readout: over === null ? null : { sentence: 'x', verdict: 'mixed', topCause: null, ...over },
  }) as unknown as Calibration;

describe('metacogNudge (PR-11 — at most ONE, floors respected, suggestion not grade)', () => {
  it('returns null below the calibration floor (readout null) — nothing asserted', () => {
    expect(metacogNudge(cal(null))).toBeNull();
    expect(metacogNudge(null)).toBeNull();
  });

  it('routes a DOMINANT rushed cause to the timed-tactics nudge', () => {
    expect(metacogNudge(cal({ topCause: { tag: 'rushed', pct: 0.42 } }))).toEqual({ kind: 'rushed', pct: 0.42 });
  });

  it('routes a dominant unfamiliar-pattern cause to the concepts nudge', () => {
    expect(metacogNudge(cal({ topCause: { tag: 'unfamiliar-pattern', pct: 0.35 } }))).toEqual({ kind: 'unfamiliar', pct: 0.35 });
  });

  it('a NON-dominant cause never nudges (floor)', () => {
    expect(metacogNudge(cal({ topCause: { tag: 'rushed', pct: NUDGE_CAUSE_FLOOR - 0.01 } }))).toBeNull();
  });

  it('a cause without a route (miscalculated) falls through to the verdict check only', () => {
    expect(metacogNudge(cal({ topCause: { tag: 'miscalculated', pct: 0.9 } }))).toBeNull();
    expect(metacogNudge(cal({ topCause: { tag: 'miscalculated', pct: 0.9 }, verdict: 'overconfident' }))).toEqual({ kind: 'overconfident' });
  });

  it('never stacks: a dominant rushed cause wins over an overconfident verdict (one nudge max)', () => {
    expect(metacogNudge(cal({ topCause: { tag: 'rushed', pct: 0.5 }, verdict: 'overconfident' }))).toEqual({ kind: 'rushed', pct: 0.5 });
  });
});
