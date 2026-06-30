import { describe, it, expect } from 'vitest';
import { initTimedProbe, recordTimed, timedDimension, speedFactor } from './timedProbe';

describe('timed-probe accumulation (CO15)', () => {
  it('accumulates solved/attempted/totalMs from a result stream', () => {
    let s = initTimedProbe();
    s = recordTimed(s, { solved: true, ms: 4000 });
    s = recordTimed(s, { solved: false, ms: 6000 });
    s = recordTimed(s, { solved: true, ms: 5000 });
    expect(s.solved).toBe(2);
    expect(s.attempted).toBe(3);
    expect(s.totalMs).toBe(15000);
  });

  it('clamps a negative ms to 0 (defensive)', () => {
    let s = initTimedProbe();
    s = recordTimed(s, { solved: true, ms: -100 });
    expect(s.totalMs).toBe(0);
  });

  it('recordTimed is immutable (returns a new object)', () => {
    const s0 = initTimedProbe();
    const s1 = recordTimed(s0, { solved: true, ms: 1000 });
    expect(s0).toEqual({ solved: 0, attempted: 0, totalMs: 0 });
    expect(s1).not.toBe(s0);
  });
});

describe('speedFactor — monotonic decreasing in time', () => {
  it('fast → high, slow → low, monotonic', () => {
    expect(speedFactor(2000)).toBe(100); // very fast clamps to 100
    const fast = speedFactor(4000);
    const mid = speedFactor(10000);
    const slow = speedFactor(25000);
    const verySlow = speedFactor(60000);
    expect(fast).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThanOrEqual(verySlow);
    expect(verySlow).toBe(10); // floor
  });
});

describe('timedDimension — directional, sample-size-labelled (AP-CPROBE-7)', () => {
  it('derives a 0..100 timeManagement score with sampleSize = attempted', () => {
    let s = initTimedProbe();
    s = recordTimed(s, { solved: true, ms: 4000 });
    s = recordTimed(s, { solved: true, ms: 5000 });
    const d = timedDimension(s, 'en');
    expect(d.dimension).toBe('timeManagement');
    expect(d.sampleSize).toBe(2);
    expect(d.score).toBeGreaterThan(0);
    expect(d.score).toBeLessThanOrEqual(100);
  });

  it('is monotonic in accuracy (more solves at the same speed → higher score)', () => {
    const mk = (solved: number) => {
      let s = initTimedProbe();
      for (let i = 0; i < 4; i++) s = recordTimed(s, { solved: i < solved, ms: 5000 });
      return timedDimension(s, 'en').score;
    };
    expect(mk(4)).toBeGreaterThan(mk(2));
    expect(mk(2)).toBeGreaterThan(mk(0));
  });

  it('is inversely monotonic in time (same accuracy, slower → lower score)', () => {
    const mk = (ms: number) => {
      let s = initTimedProbe();
      s = recordTimed(s, { solved: true, ms });
      s = recordTimed(s, { solved: true, ms });
      return timedDimension(s, 'en').score;
    };
    expect(mk(4000)).toBeGreaterThan(mk(20000));
  });

  it('sampleSize 0 when no puzzle was attempted → radar shows n/a (honest, not a fake number)', () => {
    const d = timedDimension(initTimedProbe(), 'en');
    expect(d.sampleSize).toBe(0);
    expect(d.detail).toMatch(/skipped|no puzzle/i);
  });

  it('localizes the detail in FR', () => {
    let s = initTimedProbe();
    s = recordTimed(s, { solved: true, ms: 5000 });
    const d = timedDimension(s, 'fr');
    expect(d.detail).toMatch(/chronométré/i);
  });

  it('is pure — same inputs, same output (no Date/Math.random)', () => {
    let s = initTimedProbe();
    s = recordTimed(s, { solved: true, ms: 3500 });
    s = recordTimed(s, { solved: false, ms: 12000 });
    expect(timedDimension(s, 'en')).toEqual(timedDimension(s, 'en'));
  });
});
