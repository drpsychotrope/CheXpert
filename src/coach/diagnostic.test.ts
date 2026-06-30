import { describe, it, expect } from 'vitest';
import { buildCoachProfile, motifAggregateScore, COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from './diagnostic';
import type { DimensionScore } from '../analysis/weakness';

const probe = (theme: string, rating: number, n = 4) => ({ theme, rating, n });

describe('constants', () => {
  it('probes the six geometric motifs, two puzzles per theme', () => {
    expect(COACH_MOTIF_PROBES).toEqual(['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mate']);
    expect(COACH_LADDER_MIN).toBe(2);
    expect(COACH_LADDER_MAX).toBe(2);
  });
});

describe('buildCoachProfile — puzzle-only (no game)', () => {
  it('computes per-motif deltas vs the baseline', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1000), probe('pin', 1400)],
      gameDimensions: null,
      assessedAt: 42,
      locale: 'en',
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
      locale: 'en',
    });
    expect(p.motifs.map((m) => m.theme)).toEqual(['fork']);
  });

  it('marks the four game-only dimensions as unsampled placeholders', () => {
    const p = buildCoachProfile({ puzzleRating: 1200, probes: [probe('fork', 1200)], gameDimensions: null, assessedAt: 1, locale: 'en' });
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
      locale: 'en',
    });
    expect(p.weaknesses[0]).toBe('Forks');     // -300, worst first
    expect(p.weaknesses).toContain('Skewers'); // -200
    expect(p.strengths).toContain('Pins');     // +500
  });

  it('localizes the labels when locale is fr (V2-W18)', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 900), probe('pin', 1700)],
      gameDimensions: null,
      assessedAt: 1,
      locale: 'fr',
    });
    expect(p.weaknesses).toContain('Fourchettes'); // "Forks" → "Fourchettes"
    expect(p.strengths).toContain('Clouages');     // "Pins" → "Clouages"
  });

  it('returns an honest empty profile when no probe has data', () => {
    const p = buildCoachProfile({ puzzleRating: 1200, probes: [probe('fork', 0, 0)], gameDimensions: null, assessedAt: 1, locale: 'en' });
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
      locale: 'en',
    });
    expect(p.source.game).toBe(true);
    const tac = p.dimensions.find((d) => d.dimension === 'tactics')!;
    expect(tac.score).toBe(motifAggregateScore(p.motifs)); // overridden
    expect(p.weaknesses).toContain('Time management'); // score 20
    expect(p.strengths).toContain('Resilience');       // score 80
  });
});

describe('buildCoachProfile — timed dimension seam (C2/CO15)', () => {
  const timed = (score: number, sampleSize: number): DimensionScore => ({
    dimension: 'timeManagement',
    score,
    detail: 'timed',
    sampleSize,
  });

  it('with timedDim and NO game: timeManagement fills from the timed read; other game-only dims stay placeholders', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1200)],
      gameDimensions: null,
      assessedAt: 1,
      locale: 'en',
      timedDim: timed(72, 5),
    });
    const time = p.dimensions.find((d) => d.dimension === 'timeManagement')!;
    expect(time.score).toBe(72);
    expect(time.sampleSize).toBe(5);
    // opening/endgame/resilience remain unmeasured placeholders (only the timed axis was filled).
    expect(p.dimensions.find((d) => d.dimension === 'openingAccuracy')!.sampleSize).toBe(0);
    expect(p.dimensions.find((d) => d.dimension === 'resilience')!.sampleSize).toBe(0);
  });

  it('a timedDim with sampleSize 0 does NOT fill the axis (stays n/a — AP-CPROBE-7)', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1200)],
      gameDimensions: null,
      assessedAt: 1,
      locale: 'en',
      timedDim: timed(50, 0),
    });
    expect(p.dimensions.find((d) => d.dimension === 'timeManagement')!.sampleSize).toBe(0);
  });

  it('with BOTH a game and timedDim: the game time read wins (precedence)', () => {
    const dims: DimensionScore[] = [
      { dimension: 'tactics', score: 50, detail: 'x', sampleSize: 10 },
      { dimension: 'openingAccuracy', score: 30, detail: 'x', sampleSize: 8 },
      { dimension: 'endgameConversion', score: 70, detail: 'x', sampleSize: 6 },
      { dimension: 'timeManagement', score: 20, detail: 'game', sampleSize: 5 },
      { dimension: 'resilience', score: 80, detail: 'x', sampleSize: 4 },
    ];
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1200)],
      gameDimensions: dims,
      assessedAt: 1,
      locale: 'en',
      timedDim: timed(99, 8),
    });
    const time = p.dimensions.find((d) => d.dimension === 'timeManagement')!;
    expect(time.score).toBe(20); // game wins
    expect(time.detail).toBe('game');
  });

  it('NO-REGRESSION: output is byte-identical with vs without an undefined timedDim', () => {
    const argsBase = {
      puzzleRating: 1200,
      probes: [probe('fork', 1100), probe('pin', 1400)],
      gameDimensions: null,
      assessedAt: 7,
      locale: 'en' as const,
    };
    const without = buildCoachProfile(argsBase);
    const withUndef = buildCoachProfile({ ...argsBase, timedDim: undefined });
    expect(withUndef).toEqual(without);
  });
});

describe('buildCoachProfile — endgame sub-buckets (C2/CF6)', () => {
  it('scores each endgame bucket with n>0 as its own motif and drops n=0 buckets', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [
        probe('rookEndgame', 1000, 2),
        probe('pawnEndgame', 1400, 2),
        probe('minorPieceEndgame', 1200, 0), // empty bucket (seed set has none) → dropped
      ],
      gameDimensions: null,
      assessedAt: 1,
      locale: 'en',
    });
    const themes = p.motifs.map((m) => m.theme);
    expect(themes).toContain('rookEndgame');
    expect(themes).toContain('pawnEndgame');
    expect(themes).not.toContain('minorPieceEndgame'); // n=0 never fabricated (AP-CPROBE-3)
    expect(p.motifs.find((m) => m.theme === 'rookEndgame')!.delta).toBe(-200);
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
