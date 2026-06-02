// Smarter scheduling (spec C / 3c): interleave the due queue so consecutive items
// differ in theme (desirable difficulty), and build a Woodpecker set from the
// puzzles you fail most. Pure.

/** Reorder so adjacent items differ in theme where possible, keeping rough priority. */
export function interleave<T>(items: T[], themeOf: (t: T) => string): T[] {
  const remaining = items.slice();
  const out: T[] = [];
  let lastTheme: string | null = null;
  while (remaining.length) {
    let idx = remaining.findIndex((t) => themeOf(t) !== lastTheme);
    if (idx === -1) idx = 0; // all same theme left → take the earliest
    const [picked] = remaining.splice(idx, 1);
    out.push(picked);
    lastTheme = themeOf(picked);
  }
  return out;
}

export interface AttemptLike {
  puzzleId: string;
  solved: boolean;
}

/** Failure tally per puzzle id (the single source of truth for "most-failed"). Pure. */
export function failCountByPuzzle(attempts: AttemptLike[]): Map<string, number> {
  const fails = new Map<string, number>();
  for (const a of attempts) {
    if (a.solved) continue;
    fails.set(a.puzzleId, (fails.get(a.puzzleId) ?? 0) + 1);
  }
  return fails;
}

/** The `k` puzzles you fail most (any source), ranked by failure count (a "your misses" set). */
export function buildLapseSet(attempts: AttemptLike[], k: number): string[] {
  const fails = failCountByPuzzle(attempts);
  return [...fails.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    .slice(0, k)
    .map(([id]) => id);
}

/** A puzzle is a "leech" once it's been failed at least `threshold` times (Q-B: N=3). Pure. */
export function isLeech(failCount: number, threshold: number): boolean {
  return failCount >= threshold;
}
