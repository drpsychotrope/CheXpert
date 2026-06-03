// Per-drill vision stats reducer (ADR-0042). Pure — the UI persists the result to PlayerModel.
// Covers the relational/calculation drills (diagonal, knight, find-all). The single-square drills
// (coordinate, blindfold) are tracked via FSRS 'vision-square' cards instead.

export type VisionDrillKey = 'diagonal' | 'knight' | 'findall';

export interface VisionDrillStat {
  attempts: number;
  correct: number;
  emaMs: number;
  lastSeen: number;
}

export type VisionStats = Partial<Record<VisionDrillKey, VisionDrillStat>>;

/** Fold one attempt into the stats. Returns a new object (no mutation). */
export function recordDrill(
  stats: VisionStats,
  key: VisionDrillKey,
  correct: boolean,
  ms: number,
  now: number,
): VisionStats {
  const prev = stats[key];
  return {
    ...stats,
    [key]: {
      attempts: (prev?.attempts ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      emaMs: prev ? 0.3 * ms + 0.7 * prev.emaMs : ms,
      lastSeen: now,
    },
  };
}
