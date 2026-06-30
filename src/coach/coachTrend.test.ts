import { describe, it, expect } from 'vitest';
import {
  buildCoachTrend,
  trendDir,
  profileAgeDays,
  isStale,
  COACH_STALE_DAYS,
} from './coachTrend';
import { buildCoachProgram } from './program';
import { buildSession } from '../analysis/session';
import type { CoachProfile, MotifScore } from './types';
import type { DimensionScore } from '../analysis/weakness';

const DAY = 86_400_000;

const motif = (theme: string, rating: number, n = 4, baseline = 1200): MotifScore => ({
  theme,
  rating,
  baseline,
  delta: Math.round(rating - baseline),
  n,
});

const dim = (dimension: DimensionScore['dimension'], score: number, sampleSize = 10): DimensionScore => ({
  dimension,
  score,
  detail: 'x',
  sampleSize,
});

/** Minimal CoachProfile fixture — only the fields the trend core reads matter. */
const profile = (over: Partial<CoachProfile> = {}): CoachProfile => ({
  assessedAt: 1000,
  puzzleRating: 1200,
  motifs: [],
  dimensions: [],
  strengths: [],
  weaknesses: [],
  source: { ladders: true, game: false },
  gameAnalyzed: false,
  ...over,
});

describe('buildCoachTrend — no prior', () => {
  it('returns an empty trend when prev is undefined (first-ever run → section hidden)', () => {
    const cur = profile({ motifs: [motif('fork', 1300)] });
    expect(buildCoachTrend(cur, undefined)).toEqual({ motifs: [], tacticsDelta: null, tacticsDir: null });
  });

  it('returns empty motifs when there is no theme overlap (CO2/CF5 inner-join)', () => {
    const cur = profile({ motifs: [motif('fork', 1300)] });
    const prev = profile({ motifs: [motif('pin', 1100)] });
    expect(buildCoachTrend(cur, prev).motifs).toEqual([]);
  });
});

describe('buildCoachTrend — inner-join on theme', () => {
  it('omits a theme present in only one run, keeps the shared one with carried sample sizes', () => {
    const cur = profile({ motifs: [motif('fork', 1300, 2), motif('mate', 1500, 3)] }); // mate: current-only
    const prev = profile({ motifs: [motif('fork', 1200, 4), motif('skewer', 1000, 5)] }); // skewer: prev-only
    const t = buildCoachTrend(cur, prev);
    expect(t.motifs.map((m) => m.theme)).toEqual(['fork']);
    const fork = t.motifs[0];
    expect(fork.prev).toBe(1200);
    expect(fork.current).toBe(1300);
    expect(fork.delta).toBe(100);
    expect(fork.dir).toBe('up');
    expect(fork.nPrev).toBe(4);
    expect(fork.nCurrent).toBe(2);
  });

  it('compares ABSOLUTE rating, NOT the baseline-relative delta (the CF5 guard)', () => {
    // Baselines DIFFER between runs (puzzleRating drifted 1100 → 1300) but the ABSOLUTE ratings are
    // equal, so the player did not actually move on this theme → delta 0, flat. A delta-based compare
    // would (wrongly) read these as a swing because each run's `delta` is measured off its own baseline.
    const prev = profile({ puzzleRating: 1100, motifs: [motif('fork', 1250, 4, 1100)] }); // delta +150
    const cur = profile({ puzzleRating: 1300, motifs: [motif('fork', 1250, 4, 1300)] }); // delta -50
    const t = buildCoachTrend(cur, prev);
    expect(t.motifs[0].delta).toBe(0);
    expect(t.motifs[0].dir).toBe('flat');
  });

  it('sorts biggest regression (most negative delta) first', () => {
    const cur = profile({
      motifs: [motif('fork', 1400), motif('pin', 1000), motif('mate', 1250)],
    });
    const prev = profile({
      motifs: [motif('fork', 1200), motif('pin', 1300), motif('mate', 1240)],
    });
    const t = buildCoachTrend(cur, prev);
    // pin: -300, mate: +10, fork: +200 → most negative first
    expect(t.motifs.map((m) => m.theme)).toEqual(['pin', 'mate', 'fork']);
    expect(t.motifs.map((m) => m.delta)).toEqual([-300, 10, 200]);
  });
});

describe('buildCoachTrend — lowData marker (FOLD-2)', () => {
  it('flags a row low-confidence only when BOTH runs are at n<=2', () => {
    const cur = profile({ motifs: [motif('fork', 1300, 2), motif('pin', 1300, 3)] });
    const prev = profile({ motifs: [motif('fork', 1200, 2), motif('pin', 1200, 2)] });
    const t = buildCoachTrend(cur, prev);
    const fork = t.motifs.find((m) => m.theme === 'fork')!;
    const pin = t.motifs.find((m) => m.theme === 'pin')!;
    expect(fork.lowData).toBe(true); // 2 & 2
    expect(pin.lowData).toBe(false); // 3 (current) > 2
  });

  it('is false when only the prev run is well-sampled', () => {
    const cur = profile({ motifs: [motif('fork', 1300, 2)] });
    const prev = profile({ motifs: [motif('fork', 1200, 9)] });
    expect(buildCoachTrend(cur, prev).motifs[0].lowData).toBe(false);
  });
});

describe('buildCoachTrend — tactics dimension', () => {
  it('reports a tactics delta/dir only when BOTH runs measured the tactics dimension', () => {
    const cur = profile({ dimensions: [dim('tactics', 70)] });
    const prev = profile({ dimensions: [dim('tactics', 50)] });
    const t = buildCoachTrend(cur, prev);
    expect(t.tacticsDelta).toBe(20);
    expect(t.tacticsDir).toBe('up');
  });

  it('is null when either run lacks a measured tactics dimension (sampleSize 0)', () => {
    const cur = profile({ dimensions: [dim('tactics', 70, 0)] }); // unsampled
    const prev = profile({ dimensions: [dim('tactics', 50, 8)] });
    const t = buildCoachTrend(cur, prev);
    expect(t.tacticsDelta).toBeNull();
    expect(t.tacticsDir).toBeNull();
  });

  it('is null when a run has no tactics dimension at all', () => {
    const cur = profile({ dimensions: [dim('resilience', 70)] });
    const prev = profile({ dimensions: [dim('tactics', 50)] });
    expect(buildCoachTrend(cur, prev).tacticsDelta).toBeNull();
  });
});

describe('trendDir — flat band', () => {
  it('+16 → up, -16 → down, +15/-15 → flat (strict band of 15)', () => {
    expect(trendDir(16)).toBe('up');
    expect(trendDir(-16)).toBe('down');
    expect(trendDir(15)).toBe('flat');
    expect(trendDir(-15)).toBe('flat');
    expect(trendDir(0)).toBe('flat');
  });
});

describe('profileAgeDays — pure, now injected', () => {
  it('returns null for missing/zero/negative assessedAt (legacy/unknown → no nudge)', () => {
    const now = 100 * DAY;
    expect(profileAgeDays(undefined, now)).toBeNull();
    expect(profileAgeDays(0, now)).toBeNull();
    expect(profileAgeDays(-5, now)).toBeNull();
  });

  it('floors the elapsed days', () => {
    const assessedAt = 10 * DAY;
    expect(profileAgeDays(assessedAt, 10 * DAY + 21 * DAY)).toBe(21);
    expect(profileAgeDays(assessedAt, 10 * DAY + 21 * DAY + DAY / 2)).toBe(21); // 21.5 → 21
  });
});

describe('isStale — soft staleness predicate', () => {
  it('exposes the cycle constant', () => {
    expect(COACH_STALE_DAYS).toBe(21);
  });

  it('is true strictly beyond COACH_STALE_DAYS, false at the boundary', () => {
    const assessedAt = 10 * DAY; // a real (positive) assessment instant
    expect(isStale(assessedAt, assessedAt + 22 * DAY)).toBe(true); // 22 > 21
    expect(isStale(assessedAt, assessedAt + 21 * DAY)).toBe(false); // 21 is NOT > 21
    expect(isStale(assessedAt, assessedAt + 5 * DAY)).toBe(false);
  });

  it('never nudges on an unknown age (absent/zero assessedAt)', () => {
    expect(isStale(undefined, 100 * DAY)).toBe(false);
    expect(isStale(0, 100 * DAY)).toBe(false);
  });

  it('honours an injected staleDays override', () => {
    const assessedAt = 10 * DAY;
    expect(isStale(assessedAt, assessedAt + 8 * DAY, 7)).toBe(true);
    expect(isStale(assessedAt, assessedAt + 7 * DAY, 7)).toBe(false);
  });
});

describe('resume-equivalence (Q-D) — rebuild is deterministic, not replayed', () => {
  it('buildSession(buildCoachProgram(saved,30,locale)) equals a fresh rebuild from the same profile', () => {
    const saved = profile({
      puzzleRating: 1200,
      motifs: [motif('fork', 1000), motif('pin', 1100)], // weak motifs → real program steps
      dimensions: [dim('tactics', 40), dim('resilience', 30)],
    });
    const a = buildSession(buildCoachProgram(saved, 30, 'en'));
    const b = buildSession(buildCoachProgram(saved, 30, 'en'));
    // Deterministic: rebuilding from the persisted profile yields the same plan twice — so a resume
    // after a hard reload reconstructs the SAME program (reload-safe, no persisted activeSession).
    expect(a).toEqual(b);
    expect(a.steps.length).toBeGreaterThan(0);
  });
});
