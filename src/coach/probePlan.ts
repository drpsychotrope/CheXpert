// Coach probe PLANNER (feature C2, ADR-0045 extension). PURE: no Date, no Math.random,
// no engine/Svelte imports. The single source of truth for WHICH probes run, in what
// ORDER, and HOW DEEP. diagnostic.ts stays the pure AGGREGATOR; this is the pure PLANNER
// (Q-G). Coach.svelte stays the impure driver (owns the ladder, Date, recording).
//
// Three jobs, all pure & unit-tested (spec §4 A1, §5):
//  1. buildProbePlan — turn the user's à-la-carte scope (CF7) into the ordered ProbeSpec[]
//     (motifs + endgame sub-buckets + optional timed). Empty/undefined selection => all
//     (AP-CPROBE-4 — never a zero-probe assessment).
//  2. COACH_ENDGAME_BUCKETS — real Lichess theme keys (CF6); minorPieceEndgame is a C2
//     umbrella over {knightEndgame, bishopEndgame}. A bucket with no in-zone puzzle is
//     dropped downstream by buildCoachProfile's n>0 guard — never faked (AP-CPROBE-3).
//  3. borderlineDepth — adaptive depth (CO4): extend a ladder by ONE puzzle ONLY while its
//     running delta is borderline AND its RD is still loose AND the grand cap is not hit
//     (AP-CPROBE-2 — bounded, honest about length).

import { COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from './diagnostic';

export type ProbeKind = 'motif' | 'endgame' | 'timed';

/** One planned probe: a theme/phase filter + its depth bounds. */
export interface ProbeSpec {
  kind: ProbeKind;
  /** Stable key: a motif ('fork'), an endgame bucket ('rookEndgame'), or 'timed'. Untranslated. */
  key: string;
  /** Exact theme filter for PuzzleRepo (ANY-of match). Undefined for a pure phase / timed probe. */
  themes?: string[];
  /** Coarse phase filter (kept for the fallback / timed case). */
  phase?: 'endgame';
  /** Floor puzzles (default COACH_LADDER_MIN). */
  min: number;
  /** Ceiling puzzles (raised one-at-a-time by adaptive depth, bounded by the grand cap). */
  max: number;
}

/**
 * Endgame sub-buckets (CF6) — REAL Lichess theme keys; array order is the probe order.
 * 'minorPieceEndgame' is the C2 umbrella key, mapped to Lichess {knightEndgame, bishopEndgame}
 * via themes:['knightEndgame','bishopEndgame'] (ANY-of match in PuzzleRepo.next).
 */
export const COACH_ENDGAME_BUCKETS = ['rookEndgame', 'pawnEndgame', 'minorPieceEndgame'] as const;
export type EndgameBucket = (typeof COACH_ENDGAME_BUCKETS)[number];

/** Theme filter for each endgame bucket (umbrella buckets expand to their Lichess keys). */
export const ENDGAME_BUCKET_THEMES: Record<EndgameBucket, string[]> = {
  rookEndgame: ['rookEndgame'],
  pawnEndgame: ['pawnEndgame'],
  minorPieceEndgame: ['knightEndgame', 'bishopEndgame'],
};

/** |delta| <= band ⇒ borderline ⇒ the motif earns an extra probe (CO4). */
export const COACH_BORDERLINE_BAND = 60;
/** Grand cap on total probe puzzles across the WHOLE assessment (honesty about length, Q-A / AP-CPROBE-2). */
export const COACH_PROBE_MAX_TOTAL = 20;
/** RD floor mirroring isDone(): a ladder whose RD has tightened past this is "settled" — don't extend. */
export const COACH_LOOSE_RD = 90;

/** A bare motif spec at the flat min/max (today's default depth). */
function motifSpec(theme: string): ProbeSpec {
  return { kind: 'motif', key: theme, themes: [theme], min: COACH_LADDER_MIN, max: COACH_LADDER_MAX };
}

/** An endgame-bucket spec (theme-filtered, not phase-only). */
function endgameSpec(bucket: EndgameBucket): ProbeSpec {
  return { kind: 'endgame', key: bucket, themes: ENDGAME_BUCKET_THEMES[bucket], min: COACH_LADDER_MIN, max: COACH_LADDER_MAX };
}

/** The single coarse phase:'endgame' fallback spec (used only when ALL theme buckets are empty). */
export function coarseEndgameSpec(): ProbeSpec {
  return { kind: 'endgame', key: 'endgame', phase: 'endgame', min: COACH_LADDER_MIN, max: COACH_LADDER_MAX };
}

/** The timed-block spec — on-level puzzles, no theme/phase filter (a speed read, not a motif read). */
function timedSpec(): ProbeSpec {
  return { kind: 'timed', key: 'timed', min: COACH_LADDER_MIN, max: COACH_LADDER_MAX };
}

/** PR-12 (ADR-0070, lifts coach-program-v2 D2): a one-motif re-probe plan — the targeted
 *  "re-check this motif" run that MERGES into the saved profile instead of replacing it. */
export function singleMotifPlan(theme: string): ProbeSpec[] {
  return [motifSpec(theme)];
}

/**
 * Build the ordered probe plan from the selected areas (CF7).
 *  - selected 'all' / undefined / [] => every area (motifs + endgame buckets, + timed iff includeTimed).
 *  - a subset of ProbeKind => only those kinds' specs (still in catalogue order).
 * Empty selection is treated as ALL (AP-CPROBE-4 — never an empty assessment). The timed block is
 * included only when the 'timed' kind is selected AND includeTimed is true (the UI gates the opt-in).
 */
export function buildProbePlan(opts: { selected?: ProbeKind[] | 'all'; includeTimed?: boolean }): ProbeSpec[] {
  const raw = opts.selected;
  const all = raw === undefined || raw === 'all' || (Array.isArray(raw) && raw.length === 0);
  const want = (kind: ProbeKind): boolean => all || (Array.isArray(raw) && raw.includes(kind));

  const plan: ProbeSpec[] = [];
  if (want('motif')) for (const m of COACH_MOTIF_PROBES) plan.push(motifSpec(m));
  if (want('endgame')) for (const b of COACH_ENDGAME_BUCKETS) plan.push(endgameSpec(b));
  // Timed is opt-in: present only when its area is selected AND the caller kept it on.
  if (want('timed') && opts.includeTimed) plan.push(timedSpec());
  return plan;
}

/**
 * Adaptive depth (CO4): decide whether THIS ladder earns one more puzzle. Pure.
 *
 * Returns true ONLY when ALL hold:
 *  - the running delta is borderline: |currentDelta| <= band (near the strength/weakness boundary —
 *    exactly where one puzzle's ±~115 Glicko swing is most likely to flip the verdict);
 *  - the ladder's RD is still loose: currentRd > COACH_LOOSE_RD (mirrors isDone — a settled ladder
 *    has enough signal already);
 *  - we are under the grand cap: totalSpent < cap (AP-CPROBE-2 — the assessment stays short/honest).
 *
 * Clear motifs (large |delta|), settled ladders (tight RD), and a hit cap all return false → the
 * ladder stops at its flat minimum (today's behaviour). The timed block is not depth-extended (it
 * runs to its own budget), so callers pass it through this only for motif/endgame ladders.
 */
export function borderlineDepth(args: {
  spec: ProbeSpec;
  currentDelta: number;
  currentRd: number;
  countSoFar: number;
  totalSpent: number;
  band?: number;
  cap?: number;
}): boolean {
  const band = args.band ?? COACH_BORDERLINE_BAND;
  const cap = args.cap ?? COACH_PROBE_MAX_TOTAL;
  if (args.totalSpent >= cap) return false;          // grand cap — honesty about length
  if (args.currentRd <= COACH_LOOSE_RD) return false; // settled — enough signal already
  return Math.abs(args.currentDelta) <= band;         // borderline — earn one more
}
