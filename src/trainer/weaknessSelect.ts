// PURE. No Date, no Math.random. Turns weaknessCounters into a steering decision
// for the trainer's no-drill curated fallback (F3 / TR2). Soft bias, not a hard
// filter (Q-B): we pick the top weakness theme(s) to PASS to PuzzleRepo.next({themes}),
// keeping the rating window wide so variety survives. ADR-0055.
//
// weaknessCounters was a dead-read until F3 (written on miss by Tactics/Review and per
// played-game motif by runAnalysis, but consulted by no selection path). This core turns
// it into a live steering signal; the caller falls through to plain curated when there is
// no usable signal, so behaviour is byte-identical to baseline when counters are empty.

export interface WeaknessSteer {
  /** Themes to pass to PuzzleRepo.next() as a soft bias, or undefined when there is no signal. */
  themes: string[] | undefined;
  /** The single worst theme (for callers/tests that want to assert the lead bias). */
  topTheme?: string;
}

export interface SteerOpts {
  /** How many top weakness themes to bias toward (default 1 — soft bias on the single worst). */
  k?: number;
  /** Minimum miss count for a theme to count as signal — suppresses one-off noise (default 2). */
  minCount?: number;
}

/**
 * Rank weakness themes worst-first; return up to `k` for a soft bias, or `{ themes: undefined }`
 * when there is no usable signal (empty / all-zero / all-below-`minCount` counters). The tie-break
 * is deterministic by theme key (locale-independent) so the choice is stable and unit-testable —
 * no Date, no Math.random (AP-ATTEMPT-8).
 *
 * `minCount` (default 2) is the noise floor: a single miss must NOT redirect the queue
 * (AP-ATTEMPT-4). `k` (default 1) keeps the bias soft — `next()` still searches the rating
 * window, so other themes appear when the biased theme has no in-zone puzzle (AP-ATTEMPT-2).
 *
 * Returning `{ themes: undefined }` is the no-regression escape hatch: the caller then falls
 * through to plain curated, identical to today's behaviour.
 */
export function steerFromWeakness(
  counters: Record<string, number>,
  opts: SteerOpts = {},
): WeaknessSteer {
  const k = opts.k ?? 1;
  const minCount = opts.minCount ?? 2;

  const ranked = Object.entries(counters)
    .filter(([, n]) => typeof n === 'number' && n >= minCount)
    // Worst-first by count; deterministic tie-break by theme key (ascending) — no Math.random.
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([theme]) => theme);

  if (k <= 0 || ranked.length === 0) return { themes: undefined };

  const themes = ranked.slice(0, k);
  return { themes, topTheme: themes[0] };
}
