// Coach progress-trend core (C1, spec coach-profile-persistence §4.1). PURE: no Date,
// no Math.random, no Svelte/app — `now` is injected at the UI boundary (AP-CPROF-1).
//
// Surfaces the already-persisted `coachProfilePrev → coachProfile` movement that ADR-0045
// writes but nothing reads. Compares ABSOLUTE themed `MotifScore.rating` (the cross-run-stable
// quantity), NOT the baseline-relative `delta` which drifts with `puzzleRating` and is therefore
// NOT comparable across runs (CF5 / AP-CPROF-4). Directional only — never a grade (AP-CPROF-2).

import type { CoachProfile, MotifScore } from './types';

/** Direction of an absolute themed-rating change. Directional, never a grade (AP-CPROF-2). */
export type TrendDir = 'up' | 'down' | 'flat';

export interface MotifTrend {
  theme: string;       // joined on both runs
  prev: number;        // absolute MotifScore.rating, previous run
  current: number;     // absolute MotifScore.rating, current run
  delta: number;       // current - prev (absolute rating points — comparable; CF5)
  dir: TrendDir;
  nPrev: number;       // sample sizes carried so the UI can label honesty
  nCurrent: number;
  lowData: boolean;    // both runs minimally sampled (n<=LOW_DATA_N) → swing is likely noise (enrich FOLD-2)
}

export interface CoachTrend {
  motifs: MotifTrend[];        // per-theme, inner-joined; empty when no prior or no overlap
  tacticsDelta: number | null; // current.tactics.score - prev.tactics.score (dimension score), or null
  tacticsDir: TrendDir | null;
}

const FLAT_BAND = 15; // |rating delta| <= 15 reads as "≈": within themed-ladder noise, not a real move.
const LOW_DATA_N = 2; // both runs at the COACH_LADDER min (2 puzzles) → flag the row low-confidence (FOLD-2).

export function trendDir(delta: number, band = FLAT_BAND): TrendDir {
  if (delta > band) return 'up';
  if (delta < -band) return 'down';
  return 'flat';
}

/** Inner-join prev & current motifs on `theme` (a theme dropped for n=0 in either run is skipped),
 *  compare ABSOLUTE ratings (CF5 — deltas drift with the baseline so are NOT comparable). Pure. */
export function buildCoachTrend(current: CoachProfile, prev: CoachProfile | undefined): CoachTrend {
  if (!prev) return { motifs: [], tacticsDelta: null, tacticsDir: null };

  const prevByTheme = new Map<string, MotifScore>(prev.motifs.map((m) => [m.theme, m]));
  const motifs: MotifTrend[] = [];
  for (const cur of current.motifs) {
    const p = prevByTheme.get(cur.theme);
    if (!p) continue; // measured in only one run → not comparable, omit
    const delta = Math.round(cur.rating - p.rating);
    motifs.push({
      theme: cur.theme,
      prev: p.rating,
      current: cur.rating,
      delta,
      dir: trendDir(delta),
      nPrev: p.n,
      nCurrent: cur.n,
      lowData: p.n <= LOW_DATA_N && cur.n <= LOW_DATA_N,
    });
  }
  motifs.sort((a, b) => a.delta - b.delta); // biggest regressions first (worst-first, matches program order)

  const curTac = current.dimensions.find((d) => d.dimension === 'tactics' && d.sampleSize > 0);
  const prevTac = prev.dimensions.find((d) => d.dimension === 'tactics' && d.sampleSize > 0);
  const tacticsDelta = curTac && prevTac ? Math.round(curTac.score - prevTac.score) : null;

  return { motifs, tacticsDelta, tacticsDir: tacticsDelta === null ? null : trendDir(tacticsDelta) };
}

/** ~one training cycle; soft nudge only (AP-CPROF-3). Tune here. */
export const COACH_STALE_DAYS = 21;

/** Days between two epoch-ms instants, floored. Pure (now injected at the UI boundary). */
export function profileAgeDays(assessedAt: number | undefined, now: number): number | null {
  if (typeof assessedAt !== 'number' || !(assessedAt > 0)) return null; // legacy/missing → unknown, no nudge
  return Math.floor((now - assessedAt) / 86_400_000);
}

export function isStale(assessedAt: number | undefined, now: number, staleDays = COACH_STALE_DAYS): boolean {
  const age = profileAgeDays(assessedAt, now);
  return age !== null && age > staleDays;
}
