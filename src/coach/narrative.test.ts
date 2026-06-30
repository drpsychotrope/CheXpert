import { describe, it, expect } from 'vitest';
import { buildCoachNarrative, rankByLeverage } from './narrative';
import type { CoachProfile, MotifScore } from './types';
import type { DimensionScore } from '../analysis/weakness';

// ── fixtures (mirror program.test.ts style) ──────────────────────────────────
const motif = (theme: string, delta: number, n = 6): MotifScore => ({
  theme,
  rating: 1200 + delta,
  baseline: 1200,
  delta,
  n,
});

const dim = (dimension: DimensionScore['dimension'], score: number, sampleSize = 6): DimensionScore => ({
  dimension,
  score,
  detail: 'x',
  sampleSize,
});

function profile(over: Partial<CoachProfile> = {}): CoachProfile {
  return {
    assessedAt: 1,
    puzzleRating: 1200,
    motifs: [],
    dimensions: [],
    strengths: [],
    weaknesses: [],
    source: { ladders: true, game: true },
    gameAnalyzed: true,
    ...over,
  };
}

describe('rankByLeverage', () => {
  it('orders a high-(-delta)/high-n motif above a marginal one', () => {
    const p = profile({
      motifs: [
        motif('pin', -50, 2), // marginal: sev 0.25 × freq 0.33 ≈ 0.083
        motif('fork', -300, 6), // strong: sev 1 × freq 1 = 1.0
      ],
    });
    const ranked = rankByLeverage(p, 'en');
    expect(ranked.map((r) => r.key)).toEqual(['fork', 'pin']);
    expect(ranked[0].leverage).toBeGreaterThan(ranked[1].leverage);
  });

  it('excludes a weak dimension with sampleSize 0 (no data → no leverage)', () => {
    const p = profile({ dimensions: [dim('resilience', 15, 0)] });
    expect(rankByLeverage(p, 'en')).toEqual([]);
  });

  it('includes a weak measured dimension and skips the tactics aggregate', () => {
    const p = profile({
      dimensions: [dim('tactics', 10, 8), dim('resilience', 20, 6)],
    });
    const ranked = rankByLeverage(p, 'en');
    expect(ranked.map((r) => r.key)).toEqual(['resilience']); // tactics aggregate excluded
    expect(ranked[0].kind).toBe('dimension');
  });

  it('returns [] when nothing crosses threshold', () => {
    const p = profile({
      motifs: [motif('fork', -10, 6)], // delta > -40 ⇒ not weak
      dimensions: [dim('resilience', 50, 6)], // score > 35 ⇒ not weak
    });
    expect(rankByLeverage(p, 'en')).toEqual([]);
  });

  it('is deterministic on ties (stable key order)', () => {
    const p = profile({
      // identical leverage (same delta, same n) → tie broken by key ascending
      motifs: [motif('pin', -200, 6), motif('fork', -200, 6)],
    });
    expect(rankByLeverage(p, 'en').map((r) => r.key)).toEqual(['fork', 'pin']);
  });

  it('does not emit any Elo / % / rating-gain number (AP-CTEACH-3)', () => {
    const p = profile({ motifs: [motif('fork', -300, 6)], dimensions: [dim('resilience', 15, 6)] });
    const ranked = rankByLeverage(p, 'en');
    // severity/frequency/leverage are unitless 0..1 ranking weights, never a payoff figure.
    for (const r of ranked) {
      expect(r.severity).toBeGreaterThanOrEqual(0);
      expect(r.severity).toBeLessThanOrEqual(1);
      expect(r.leverage).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildCoachNarrative', () => {
  it('returns a non-empty FR and EN array for a profile with a clear weakness', () => {
    const p = profile({ motifs: [motif('pin', -100, 4)], strengths: ['Forks'] });
    expect(buildCoachNarrative(p, 'fr').length).toBeGreaterThan(0);
    expect(buildCoachNarrative(p, 'en').length).toBeGreaterThan(0);
  });

  it('produces different text in FR vs EN for the same input (bilingual parity sanity)', () => {
    const p = profile({ motifs: [motif('pin', -100, 4)] });
    const fr = buildCoachNarrative(p, 'fr').join(' ');
    const en = buildCoachNarrative(p, 'en').join(' ');
    expect(fr).not.toBe(en);
  });

  it('names the top-leverage label in the "start here" sentence', () => {
    const p = profile({
      motifs: [motif('pin', -50, 2), motif('fork', -300, 6)],
    });
    const ranked = rankByLeverage(p, 'en');
    const en = buildCoachNarrative(p, 'en').join(' ');
    expect(ranked[0].label).toBe('Forks');
    expect(en).toContain('Forks'); // the highest-leverage focus is surfaced
    expect(en).toContain('Start with Forks');
  });

  it('emits NO digit-bearing payoff anywhere in the narrative (no Elo/%, AP-CTEACH-3)', () => {
    const p = profile({
      motifs: [motif('fork', -300, 6), motif('pin', -250, 6)],
      dimensions: [dim('resilience', 12, 6)],
      strengths: ['Mating patterns'],
    });
    for (const loc of ['fr', 'en'] as const) {
      const text = buildCoachNarrative(p, loc).join(' ');
      expect(text).not.toMatch(/\d/); // no scores, no %, no "+150 rating"
      expect(text).not.toMatch(/%/);
    }
  });

  it('returns the single honest "no clear weakness" line on an all-strong / empty profile (AP-CTEACH-2)', () => {
    const strong = profile({ motifs: [motif('fork', 200, 6)], strengths: ['Forks'] });
    const fr = buildCoachNarrative(strong, 'fr');
    expect(fr).toHaveLength(1);
    expect(fr[0]).toBe('Aucune faiblesse nette — gardez vos automatismes affûtés.');

    const empty = buildCoachNarrative(profile(), 'en');
    expect(empty).toHaveLength(1);
    expect(empty[0]).toBe('No clear weakness — keep your patterns sharp.');
  });

  it('emits the directional / puzzle-only caveat when no game backed the read (FOLD-A8)', () => {
    const puzzleOnly = profile({
      motifs: [motif('pin', -120, 4)],
      source: { ladders: true, game: false },
      gameAnalyzed: false,
    });
    const en = buildCoachNarrative(puzzleOnly, 'en');
    expect(en.some((l) => l.includes('puzzles only'))).toBe(true);

    // A game-backed read (a measured non-tactics dimension) does NOT carry the puzzle-only caveat.
    const gameBacked = profile({
      motifs: [motif('pin', -120, 4)],
      dimensions: [dim('resilience', 20, 6)],
    });
    const en2 = buildCoachNarrative(gameBacked, 'en');
    expect(en2.some((l) => l.includes('puzzles only'))).toBe(false);
  });

  it('joins multiple weak areas via the localized list join, never a raw ", " glue (AP-CTEACH-5)', () => {
    const p = profile({ motifs: [motif('fork', -300, 6), motif('pin', -250, 6)] });
    const fr = buildCoachNarrative(p, 'fr').join(' ');
    const en = buildCoachNarrative(p, 'en').join(' ');
    expect(fr).toContain('Fourchettes et Clouages');
    expect(en).toContain('Forks and Pins');
    // never raw comma-glued labels
    expect(fr).not.toContain('Fourchettes, Clouages');
    expect(en).not.toContain('Forks, Pins');
  });

  it('never throws on empty motifs / dimensions (FOLD-A4)', () => {
    expect(() => buildCoachNarrative(profile(), 'fr')).not.toThrow();
    expect(() => buildCoachNarrative(profile({ motifs: [], dimensions: [] }), 'en')).not.toThrow();
  });
});
