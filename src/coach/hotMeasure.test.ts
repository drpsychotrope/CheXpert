import { describe, it, expect } from 'vitest';
import { isHotMeasure, HOT_MEASURE_WINDOW_MS } from './hotMeasure';
import { singleMotifPlan } from './probePlan';

const att = (theme: string, playedAt: number, coachProbe = false) => ({ themes: [theme], playedAt, coachProbe });
const NOW = 10_000_000_000;

describe('isHotMeasure (PR-12, I10 — descriptive label, never a gate)', () => {
  it('flags a non-probe attempt on the theme inside the window', () => {
    expect(isHotMeasure([att('fork', NOW - 1000)], 'fork', NOW)).toBe(true);
  });
  it('ignores attempts outside the window, on other themes, or from probes', () => {
    expect(isHotMeasure([att('fork', NOW - HOT_MEASURE_WINDOW_MS - 1)], 'fork', NOW)).toBe(false);
    expect(isHotMeasure([att('pin', NOW - 1000)], 'fork', NOW)).toBe(false);
    expect(isHotMeasure([att('fork', NOW - 1000, true)], 'fork', NOW)).toBe(false); // probes don't heat the measure
    expect(isHotMeasure([], 'fork', NOW)).toBe(false);
  });
});

describe('singleMotifPlan (PR-12 — the D2 re-probe plan)', () => {
  it('is exactly one themed motif spec', () => {
    const p = singleMotifPlan('fork');
    expect(p.length).toBe(1);
    expect(p[0].kind).toBe('motif');
    expect(p[0].key).toBe('fork');
    expect(p[0].themes).toEqual(['fork']);
    expect(p[0].min).toBeGreaterThan(0);
  });
});
