// Woodpecker Method (spec §4 item 5, ADR-0016): a FIXED set of puzzles solved in
// full, then repeated as fast cycles until the patterns are automatic. This
// COMPLEMENTS the FSRS adaptive-variety mode (Phase 3) — different goal: FSRS
// times reviews for long-term retention across an expanding pool; Woodpecker
// hammers one fixed set for speed/automaticity.

export interface WoodpeckerCycle {
  /** 1-based cycle number. */
  cycle: number;
  startedAt: number;
  completedAt: number | null;
  /** Per-puzzle solve time in ms, in set order (null = not yet attempted). */
  msPerPuzzle: (number | null)[];
  /** Whether each puzzle was solved first-try this cycle. */
  solved: boolean[];
}

export interface WoodpeckerSet {
  id: string;
  name: string;
  /** Fixed, ordered puzzle ids — never changes once created. */
  puzzleIds: string[];
  createdAt: number;
  cycles: WoodpeckerCycle[];
}
