import { describe, it, expect } from 'vitest';
import { poolOfGame, gameRatingSeries, availablePools, puzzleRatingSeries, toPolyline } from './progress';
import type { GameRecord, PuzzleAttemptRecord } from '../store/db';

const game = (over: Partial<GameRecord>): GameRecord => ({
  id: over.id ?? `g:${over.playedAt}`, pgn: '1. e4', result: 'win', botElo: 1500, playedAt: 1, coached: false, ...over,
});
const attempt = (playedAt: number, ratingAfter: number, over: Partial<PuzzleAttemptRecord> = {}): PuzzleAttemptRecord => ({
  id: `p:${playedAt}`, puzzleId: 'p', solved: true, ms: 900, themes: [], ratingBefore: ratingAfter - 5, ratingAfter, playedAt, source: 'curated', ...over,
});

describe('poolOfGame (PR-04)', () => {
  it('maps 960 → chess960, clock category → its pool, untimed/legacy → classical', () => {
    expect(poolOfGame(game({ variant: 'chess960' }))).toBe('chess960');
    expect(poolOfGame(game({ timeControl: { initialSec: 180, incrementSec: 2, category: 'blitz' } }))).toBe('blitz');
    expect(poolOfGame(game({ timeControl: { initialSec: 0, incrementSec: 0, category: 'classical', untimed: true } }))).toBe('classical');
    expect(poolOfGame(game({}))).toBe('classical'); // legacy: no timeControl
  });
});

describe('gameRatingSeries / availablePools', () => {
  const games: GameRecord[] = [
    game({ playedAt: 3, ratingAfter: 1520, ratingRdAfter: 80, timeControl: { initialSec: 600, incrementSec: 0, category: 'rapid' } }),
    game({ playedAt: 1, ratingAfter: 1500, timeControl: { initialSec: 600, incrementSec: 0, category: 'rapid' } }),
    game({ playedAt: 2, timeControl: { initialSec: 600, incrementSec: 0, category: 'rapid' } }), // no snapshot (unrated/override)
    game({ playedAt: 4, ratingAfter: 1490, timeControl: { initialSec: 60, incrementSec: 0, category: 'bullet' } }),
  ];
  it('keeps only snapshot-bearing games of the pool, sorted by time, carrying rd when present', () => {
    const s = gameRatingSeries(games, 'rapid');
    expect(s.map((p) => p.rating)).toEqual([1500, 1520]);
    expect(s[0].rd).toBeUndefined();
    expect(s[1].rd).toBe(80);
  });
  it('availablePools lists pools with ≥2 points only', () => {
    expect(availablePools(games)).toEqual(['rapid']); // bullet has 1 point
  });
});

describe('puzzleRatingSeries (day-bucketed, probe-free)', () => {
  it('keeps the LAST attempt of each local day and skips coach probes', () => {
    const day1a = new Date(2026, 5, 1, 9).getTime();
    const day1b = new Date(2026, 5, 1, 21).getTime();
    const day2 = new Date(2026, 5, 2, 12).getTime();
    const s = puzzleRatingSeries([
      attempt(day1a, 1400),
      attempt(day1b, 1415),
      attempt(day2, 1420, { coachProbe: true }), // probe: rating deliberately unchanged — excluded
      attempt(day2, 1425),
    ]);
    expect(s.map((p) => p.rating)).toEqual([1415, 1425]);
  });
});

describe('toPolyline', () => {
  it('null under 2 points; scales into the 100×100 box otherwise', () => {
    expect(toPolyline([{ t: 1, rating: 1500 }])).toBeNull();
    const r = toPolyline([
      { t: 0, rating: 1400 },
      { t: 50, rating: 1500 },
      { t: 100, rating: 1600 },
    ])!;
    expect(r.min).toBe(1400);
    expect(r.max).toBe(1600);
    const pts = r.points.split(' ');
    expect(pts[0]).toBe('0.00,100.00'); // min rating at the bottom
    expect(pts[2]).toBe('100.00,0.00'); // max rating at the top
  });
  it('widens a flat series so a 2-point wobble does not render as a cliff', () => {
    const r = toPolyline([
      { t: 0, rating: 1500 },
      { t: 1, rating: 1502 },
    ])!;
    expect(r.max - r.min).toBeGreaterThanOrEqual(20);
  });
});
