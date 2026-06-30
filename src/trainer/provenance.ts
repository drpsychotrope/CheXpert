// PURE. No Date, no Math.random, no Svelte. Personal-puzzle provenance + difficulty mapping (T2/TR4+TR9).
//
// generatePuzzles.ts stores rich provenance on every personal puzzle (sourceGameId/moveNumber/
// playedMove/severity/motifConfidence/kind) but the trainer surfaces none of it (it showed only a
// generic "★ from your game" tag). This core turns that meta into a displayable pre-solve object and
// maps the coarse difficulty band to a (rating, window) query — both harness-free so they unit-test
// without a Svelte component test harness. The after-solve "missed win" SAN is computed at the CALL
// SITE (via ChessGame.moveUci on moves[0]) and passed to the i18n string — this module never parses
// FEN/UCI, keeping it dependency-free (AP-TPERS-6).

/** The severity union surfaced by a personal puzzle (mirrors generatePuzzles' PlyAnalysis.severity
 *  plus the synthetic 'missed-win'). The label namespace severity.* must cover exactly this union
 *  (parity-gated, AP-TPERS-9). */
export type Severity = 'mistake' | 'blunder' | 'inaccuracy' | 'missed-win';

/** What a personal puzzle played out as, for after-solve framing (AP-TPERS-1). */
export type ProvenanceKind = 'mistake' | 'missed-win';

/** Shown while solving: which move you played, and how bad. `null` when the puzzle isn't a personal
 *  puzzle / lacks the essential meta (the no-op escape — caller shows the generic tag instead). */
export interface PuzzleProvenance {
  moveNumber: string;
  playedMove: string;
  severity: string;
  kind: ProvenanceKind;
}

interface PuzzleMetaLike {
  source: string;
  meta?: Record<string, string> | undefined;
}

/**
 * Extract the displayable provenance from a puzzle's meta, or `null` when it isn't a personal
 * puzzle / lacks meta (the no-op escape — caller shows the generic tag, byte-identical to today for
 * curated).
 *
 * ROBUST (enrich E2 / AP-TPERS-10): tolerate partial/legacy meta — return `null` if any of the
 * ESSENTIAL fields (moveNumber, playedMove, severity) is absent or non-string; never throw. Extra /
 * unknown meta keys are ignored. `kind` is normalised: anything other than 'missed-win' (incl. a
 * legacy missing kind) is treated as 'mistake' so the after-solve framing always has a valid branch.
 */
export function provenanceOf(puzzle: PuzzleMetaLike): PuzzleProvenance | null {
  if (!puzzle || puzzle.source !== 'personal') return null;
  const meta = puzzle.meta;
  if (!meta || typeof meta !== 'object') return null;

  const moveNumber = meta.moveNumber;
  const playedMove = meta.playedMove;
  const severity = meta.severity;
  // Essential trio: all three must be present, non-empty strings — else degrade to the generic tag.
  if (typeof moveNumber !== 'string' || moveNumber.length === 0) return null;
  if (typeof playedMove !== 'string' || playedMove.length === 0) return null;
  if (typeof severity !== 'string' || severity.length === 0) return null;

  const kind: ProvenanceKind = meta.kind === 'missed-win' ? 'missed-win' : 'mistake';
  return { moveNumber, playedMove, severity, kind };
}

/** Coarse difficulty band — 3 buckets, never a slider (AP-TPERS-7). */
export type DifficultyBand = 'easier' | 'on-level' | 'harder';

/**
 * Coarse difficulty band -> (ratingOffset, window) applied to the player's puzzleRating in the
 * existing PuzzleRepo.next() query. No new puzzle metadata, no schema.
 *   on-level -> { rating: base,       window: 250 }   (today's curated window — no-regression default)
 *   easier   -> { rating: base - 150, window: 200 }
 *   harder   -> { rating: base + 150, window: 200 }
 */
export function bandToQuery(band: DifficultyBand, baseRating: number): { rating: number; window: number } {
  switch (band) {
    case 'easier':
      return { rating: baseRating - 150, window: 200 };
    case 'harder':
      return { rating: baseRating + 150, window: 200 };
    case 'on-level':
    default:
      return { rating: baseRating, window: 250 };
  }
}

/** The trainer source toggle value. Maps 1:1 onto PuzzleQuery.source: 'mixed' -> undefined,
 *  'personal'/'curated' pass through. Persisted as optional SettingsRecord.trainerSource? (read
 *  `?? 'mixed'`) — additive, NO DB_VERSION bump (AP-TPERS-4). */
export type TrainerSource = 'mixed' | 'personal' | 'curated';

/** Map the toggle to the PuzzleQuery.source field. 'mixed' -> undefined (today's behaviour, which
 *  blends personal + curated); the other two pass through unchanged. Pure + trivially testable. */
export function sourceToQuery(source: TrainerSource): 'curated' | 'personal' | undefined {
  return source === 'mixed' ? undefined : source;
}
