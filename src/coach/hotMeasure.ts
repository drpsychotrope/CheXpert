// "Hot measure" detector (PR-12, ratified I10). A re-probe run right after drilling the same
// motif measures RECENCY, not acquisition — short-term memory inflates the score. This flags
// that condition so the UI can LABEL the read (descriptive, never blocking, never a delay gate —
// the softened I10 wording; AP-META-1 family).

export interface AttemptLike {
  themes: string[];
  playedAt: number;
  coachProbe?: boolean;
}

/** Default window: drilling the motif within the last 6 h marks the re-probe as "hot". */
export const HOT_MEASURE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** True when `theme` has NON-probe attempts inside the window before `now`. Pure. */
export function isHotMeasure(
  attempts: AttemptLike[],
  theme: string,
  now: number,
  windowMs: number = HOT_MEASURE_WINDOW_MS,
): boolean {
  const since = now - windowMs;
  return attempts.some((a) => !a.coachProbe && a.playedAt >= since && a.playedAt <= now && a.themes.includes(theme));
}
