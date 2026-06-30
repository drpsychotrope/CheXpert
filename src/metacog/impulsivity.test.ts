import { describe, it, expect } from 'vitest';
import { impulsivity, type ImpulsivityAttempt } from './impulsivity';
import { DEFAULT_GRADE_THRESHOLDS } from '../srs/fsrs';

const FAST = DEFAULT_GRADE_THRESHOLDS.fastMs; // the grader's own fast boundary (/enrich#6)
const fast = (solved: boolean): ImpulsivityAttempt => ({ solved, ms: FAST - 1000 });
const slow = (solved: boolean): ImpulsivityAttempt => ({ solved, ms: FAST + 10_000 });

describe('impulsivity (T3 — descriptive move-time readout, AP-TINTEG-7/9)', () => {
  it('uses the grader\'s fastMs as the default split threshold (import, not re-declared)', () => {
    // An attempt exactly at fastMs counts as fast; one just over counts as slow.
    const r = impulsivity([{ solved: false, ms: FAST }, { solved: true, ms: FAST + 1 }], { minN: 1 });
    expect(r.fastTotal).toBe(1);
    expect(r.slowTotal).toBe(1);
  });

  it('empty → no claim (readout null), zero counts', () => {
    const r = impulsivity([]);
    expect(r.readout).toBeNull();
    expect(r.n).toBe(0);
    expect(r.avgMs).toBe(0);
  });

  it('below the sample-size floor → readout null (anti-fabrication on thin data)', () => {
    const attempts = Array.from({ length: 9 }, () => fast(false)); // 9 < default minN 10
    const r = impulsivity(attempts);
    expect(r.n).toBe(9);
    expect(r.readout).toBeNull(); // no "0%/100% impulsive" asserted yet
  });

  it('all fast + wrong above the floor → kind "impulsive", high fastMissPct, denominators set', () => {
    const attempts = Array.from({ length: 12 }, () => fast(false));
    const r = impulsivity(attempts);
    expect(r.readout?.kind).toBe('impulsive');
    expect(r.readout?.fastMissPct).toBe(100);
    expect(r.fastTotal).toBe(12);
    expect(r.fastWrong).toBe(12);
    expect(r.slowTotal).toBe(0);
  });

  it('all slow + right → kind "deliberate" with the slow denominator', () => {
    const attempts = Array.from({ length: 12 }, () => slow(true));
    const r = impulsivity(attempts);
    expect(r.readout?.kind).toBe('deliberate');
    expect(r.slowRight).toBe(12);
    expect(r.slowTotal).toBe(12);
  });

  it('mixed pattern → kind "mixed"', () => {
    // 6 fast (half wrong → fastMissShare 0.5 → impulsive boundary) — push below 0.5 to force mixed:
    // 6 fast with 2 wrong (0.33), 6 slow with 2 right (0.33 slow-right) → neither bucket dominates.
    const attempts = [
      ...Array.from({ length: 4 }, () => fast(true)),
      ...Array.from({ length: 2 }, () => fast(false)),
      ...Array.from({ length: 4 }, () => slow(false)),
      ...Array.from({ length: 2 }, () => slow(true)),
    ];
    const r = impulsivity(attempts);
    expect(r.readout?.kind).toBe('mixed');
  });

  it('avgMs is the true arithmetic mean (deterministic, no Date)', () => {
    const attempts: ImpulsivityAttempt[] = [
      { solved: true, ms: 1000 },
      { solved: false, ms: 3000 },
      { solved: true, ms: 5000 },
    ];
    const r = impulsivity(attempts, { minN: 1 });
    expect(r.avgMs).toBe(3000);
    expect(r.readout?.avgSec).toBe(3);
  });

  it('never labels a player with no fast attempts as impulsive (guards the empty-bucket share)', () => {
    const attempts = Array.from({ length: 12 }, () => slow(false)); // all slow, all wrong
    const r = impulsivity(attempts);
    expect(r.readout?.kind).not.toBe('impulsive'); // fastTotal 0 → not impulsive
  });
});
