import { describe, it, expect } from 'vitest';
import { buildCoachProfile, motifAggregateScore, COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from './diagnostic';
import type { DimensionScore } from '../analysis/weakness';

const probe = (theme: string, rating: number, n = 4) => ({ theme, rating, n });

describe('constants', () => {
  it('probes the six geometric motifs, one puzzle per theme', () => {
    expect(COACH_MOTIF_PROBES).toEqual(['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mate']);
    expect(COACH_LADDER_MIN).toBe(1);
    expect(COACH_LADDER_MAX).toBe(1);
  });
});

describe('buildCoachProfile — puzzle-only (no game)', () => {
  it('computes per-motif deltas vs the baseline', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1000), probe('pin', 1400)],
      gameDimensions: null,
      assessedAt: 42,
    });
    expect(p.motifs.find((m) => m.theme === 'fork')!.delta).toBe(-200);
    expect(p.motifs.find((m) => m.theme === 'pin')!.delta).toBe(200);
    expect(p.source).toEqual({ ladders: true, game: false });
    expect(p.gameAnalyzed).toBe(false);
    expect(p.assessedAt).toBe(42);
  });

  it('drops n=0 probes (empty theme never scored as a weakness)', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 800), probe('mate', 1200, 0)],
      gameDimensions: null,
      assessedAt: 1,
    });
    expect(p.motifs.map((m) => m.theme)).toEqual(['fork']);
  });

  it('marks the four game-only dimensions as unsampled placeholders', () => {
    const p = buildCoachProfile({ puzzleRating: 1200, probes: [probe('fork', 1200)], gameDimensions: null, assessedAt: 1 });
    const opening = p.dimensions.find((d) => d.dimension === 'openingAccuracy')!;
    expect(opening.sampleSize).toBe(0);
    expect(opening.detail).toMatch(/calibration game/i);
  });

  it('ranks weak motifs into weaknesses (worst-first) and strong into strengths', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 900), probe('skewer', 1000), probe('pin', 1700)],
      gameDimensions: null,
      assessedAt: 1,
    });
    expect(p.weaknesses[0]).toBe('Forks');     // -300, worst first
    expect(p.weaknesses).toContain('Skewers'); // -200
    expect(p.strengths).toContain('Pins');     // +500
  });

  it('returns an honest empty profile when no probe has data', () => {
    const p = buildCoachProfile({ puzzleRating: 1200, probes: [probe('fork', 0, 0)], gameDimensions: null, assessedAt: 1 });
    expect(p.motifs).toEqual([]);
    expect(p.weaknesses).toEqual([]);
    expect(p.source.ladders).toBe(false);
  });
});

describe('buildCoachProfile — with game dimensions', () => {
  const dims: DimensionScore[] = [
    { dimension: 'tactics', score: 50, detail: 'x', sampleSize: 10 },
    { dimension: 'openingAccuracy', score: 30, detail: 'x', sampleSize: 8 },
    { dimension: 'endgameConversion', score: 70, detail: 'x', sampleSize: 6 },
    { dimension: 'timeManagement', score: 20, detail: 'x', sampleSize: 5 },
    { dimension: 'resilience', score: 80, detail: 'x', sampleSize: 4 },
  ];

  it('uses injected dims, overrides tactics with the motif aggregate, and ranks dims', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1600)],
      gameDimensions: dims,
      assessedAt: 1,
    });
    expect(p.source.game).toBe(true);
    const tac = p.dimensions.find((d) => d.dimension === 'tactics')!;
    expect(tac.score).toBe(motifAggregateScore(p.motifs)); // overridden
    expect(p.weaknesses).toContain('Time management'); // score 20
    expect(p.strengths).toContain('Resilience');       // score 80
  });
});

describe('motifAggregateScore', () => {
  it('maps mean delta 0 → 50 and is monotonic', () => {
    expect(motifAggregateScore([])).toBe(50);
    expect(motifAggregateScore([{ theme: 'fork', rating: 1200, baseline: 1200, delta: 0, n: 4 }])).toBe(50);
    const strong = motifAggregateScore([{ theme: 'fork', rating: 1400, baseline: 1200, delta: 200, n: 4 }]);
    const weak = motifAggregateScore([{ theme: 'fork', rating: 1000, baseline: 1200, delta: -200, n: 4 }]);
    expect(strong).toBeGreaterThan(50);
    expect(weak).toBeLessThan(50);
  });
});
