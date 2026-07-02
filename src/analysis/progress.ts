// Progress series (PR-04 progress-graph, ADR-0062). Pure selectors that turn the PR-02 rating
// snapshots (GameRecord.ratingBefore/After) and the puzzle-attempt history into plottable
// time-series. No Date.now(), no DOM — the view injects everything.
//
// Honesty (roadmap I9): these ratings are an INTERNAL, self-referential scale (Glicko vs the
// local bot / the puzzle pool) — comparable to yourself over time, NOT to FIDE/Lichess numbers.
// The chart carries that note; nothing here smooths or extrapolates.

import type { GameRecord, PuzzleAttemptRecord } from '../store/db';
import type { RatingPool } from '../rating/pools';
import { localDayKey } from '../trainer/retention';

export interface SeriesPoint {
  t: number;
  rating: number;
  /** Glicko RD at that point when it was captured (game snapshots from PR-04 on). */
  rd?: number;
}

/** Which pool a played game belongs to: 960 → chess960; else its clock category; untimed and
 *  legacy (no timeControl) → classical (README: untimed = classical). */
export function poolOfGame(g: GameRecord): RatingPool {
  if (g.variant === 'chess960') return 'chess960';
  if (!g.timeControl || g.timeControl.untimed) return 'classical';
  return g.timeControl.category;
}

/** Chronological rating series for one pool — only games that carry the PR-02 snapshot
 *  (counted games; unrated/override games never claimed a rating move). */
export function gameRatingSeries(games: GameRecord[], pool: RatingPool): SeriesPoint[] {
  return games
    .filter((g) => g.ratingAfter != null && poolOfGame(g) === pool)
    .sort((a, b) => a.playedAt - b.playedAt)
    .map((g) => ({ t: g.playedAt, rating: g.ratingAfter as number, ...(g.ratingRdAfter != null ? { rd: g.ratingRdAfter } : {}) }));
}

/** Pools that have at least `min` plottable points, in display order. */
export function availablePools(games: GameRecord[], min = 2): RatingPool[] {
  const order: RatingPool[] = ['classical', 'rapid', 'blitz', 'bullet', 'chess960'];
  return order.filter((p) => gameRatingSeries(games, p).length >= min);
}

/**
 * Puzzle-rating series, bucketed to the LAST attempt of each local day (a day of drilling is one
 * honest point — plotting every attempt would just draw Glicko noise). Coach probes are excluded:
 * they deliberately never move the rating (ratingBefore === ratingAfter, AP-COACH-8).
 */
export function puzzleRatingSeries(attempts: PuzzleAttemptRecord[]): SeriesPoint[] {
  const byDay = new Map<string, PuzzleAttemptRecord>();
  for (const a of attempts) {
    if (a.coachProbe) continue;
    const key = localDayKey(a.playedAt);
    const prev = byDay.get(key);
    if (!prev || a.playedAt > prev.playedAt) byDay.set(key, a);
  }
  return [...byDay.values()]
    .sort((a, b) => a.playedAt - b.playedAt)
    .map((a) => ({ t: a.playedAt, rating: a.ratingAfter }));
}

/** Chart geometry: map a series to SVG polyline points in a 100×100 viewBox (padding via the
 *  y-range margin). Pure so the scaling is unit-testable; returns null under 2 points. */
export function toPolyline(series: SeriesPoint[]): { points: string; min: number; max: number } | null {
  if (series.length < 2) return null;
  const ratings = series.map((p) => p.rating);
  let min = Math.min(...ratings);
  let max = Math.max(...ratings);
  if (max - min < 20) {
    // Flat series: widen the window so the line doesn't glue to an edge and a ±2-point
    // wobble doesn't render as a cliff.
    const mid = (max + min) / 2;
    min = mid - 10;
    max = mid + 10;
  }
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const pts = series
    .map((p) => `${(((p.t - t0) / span) * 100).toFixed(2)},${(100 - ((p.rating - min) / (max - min)) * 100).toFixed(2)}`)
    .join(' ');
  return { points: pts, min: Math.round(min), max: Math.round(max) };
}
