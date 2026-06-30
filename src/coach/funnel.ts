// Coach funnel (C8 / CO20): the PURE predicate that decides whether to *offer* a coaching read
// at the right moment, plus the export filename helper. No `Date.now()` / `Math.random()` here —
// `now` is always an argument (AP-CFUNNEL-2), mirroring Session.svelte's UI-boundary timestamp.
//
// The coach is hard to find and never surfaced after a rough patch (the dead-end funnel, CO20).
// `shouldOfferCoach` reads ONLY already-persisted state — the per-pool rolling outcomes
// (`opponentByPool[*].recent`, the same list AdaptiveOpponent keeps) and the saved `coachProfile`'s
// `assessedAt` — so the rough-patch signal needs NO new schema (AP-CFUNNEL-3).

import type { PlayerModel } from '../store/db';

/** Trailing consecutive losses (newest last) that constitute a "rough patch". A short streak so the
 *  offer catches a real slump without firing on a single bad game. */
export const STREAK_LEN = 3;

/** A `coachProfile` assessed within this window counts as "fresh" — we do NOT nag a user who already
 *  has a recent read (staleness guard, Q-A2=c). Shorter than COACH_STALE_DAYS (21d) so the offer
 *  re-appears once the read ages, but stays quiet right after an assessment. */
export const FRESH_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** True iff the tail of `recent` is a run of ≥ STREAK_LEN losses (newest last, as AdaptiveOpponent
 *  appends them). Total: empty / short / non-losing tail → false. Pure. */
export function hasLosingStreak(recent: readonly ('win' | 'loss' | 'draw')[] | undefined, len = STREAK_LEN): boolean {
  if (!recent || recent.length < len) return false;
  for (let i = recent.length - 1; i >= recent.length - len; i--) {
    if (recent[i] !== 'loss') return false;
  }
  return true;
}

/** True iff a saved profile is recent enough to suppress the offer (the staleness guard). A missing
 *  profile (or assessedAt) is NOT fresh → it never suppresses. Pure (`now` injected). */
export function hasFreshProfile(model: PlayerModel | null, now: number, freshMs = FRESH_MS): boolean {
  const at = model?.coachProfile?.assessedAt;
  if (typeof at !== 'number') return false;
  return now - at <= freshMs;
}

/**
 * Whether to surface the rough-patch coaching offer (CO20, Q-A2=a+c). TRUE iff there is a losing
 * streak in ANY rating pool's rolling outcomes AND there is no fresh `coachProfile`. TOTAL — a null
 * model, empty pools, a sub-threshold streak, or a just-assessed profile all return false (FOLD-C5):
 * the offer is opt-in and non-nagging (AP-CFUNNEL-1). No `Date.now()` — `now` is an argument.
 */
export function shouldOfferCoach(model: PlayerModel | null, now: number): boolean {
  if (!model) return false;
  if (hasFreshProfile(model, now)) return false; // already has a recent read — don't nag
  const pools = model.opponentByPool;
  if (!pools) return false;
  for (const pool of Object.values(pools)) {
    if (pool && hasLosingStreak(pool.recent)) return true;
  }
  return false;
}

/** Zero-pad a 1–2 digit date part to 2 chars (local, no Intl dependency — keeps the filename stable;
 *  mirrors pgnDownload's pad2). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Deterministic export filename for a coach profile, derived from its `assessedAt` (NOT `Date.now()`
 * — pure & unit-testable, AP-CFUNNEL-2). Shape: `coach-profile-YYYY-MM-DD.json`. Date parts are
 * sanitised by construction (numeric); the `.json` extension matches the JSON export (Q-D=a).
 */
export function coachProfileFilename(assessedAt: number): string {
  const d = new Date(assessedAt);
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return `coach-profile-${date}.json`;
}
