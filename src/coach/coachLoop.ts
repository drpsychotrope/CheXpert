// C7 closed coach loop (CO10/CO17). PURE: NO Date, NO Math.random, NO Svelte/`app` import — mirrors
// program.ts. The eco table + analyses are passed in by the UI boundary (AP-CPROG-9). The loop is
// DESCRIPTIVE: it surfaces the EXISTING motifEfficacy before/after read (the SAME one Insights uses)
// plus a SOFT advisory; it never claims the training CAUSED the change, never marks a weakness
// "resolved", and never mutates the stored CoachProfile (honesty — mirrors insights.didItMoveBody;
// AP-CPROG-4). Takes (program, analyses) → data only (read-only by type).

import type { GameAnalysis } from '../analysis/types';
import { motifEfficacy, type EfficacyReadout } from '../analysis/efficacy';
import { nameOpening, localizedOpeningName, type EcoEntry } from '../opening/eco';
import type { PlanItem } from '../analysis/studyPlan';
import type { Locale } from '../i18n/translate';

export interface StepEfficacy {
  motifKey: string;
  readout: EfficacyReadout;
  /** Soft, descriptive advisory — NOT a causal claim, NOT a verdict (AP-CPROG-4). */
  looksImproved: boolean;   // enoughData && deltaPct < 0
  /** Honesty distinction (E2): this motif NEVER occurred in any analysed game (vs merely thin data).
   *  Predicate: readout.early.playerMoves + readout.recent.playerMoves === 0. Drives "play some games
   *  to see if this moves" instead of the ambiguous "too little data" (AP-CPROG-5). */
  neverMeasured: boolean;
}

/**
 * Descriptive before/after for each program step that maps to a measurable motif. Reuses
 * motifEfficacy (the SAME read Insights uses — so a leak and its efficacy number can never disagree).
 * Pure: the caller passes the analyses. The `endgame` streak key and dimension keys are NOT measurable
 * leak keys (motifEfficacy is per-leak-cluster), so only true motif keys are surfaced; an empty
 * analyses array yields `[]` (drives the no-header UI path — E3 / AP-CPROG-5).
 */
export function programEfficacy(program: PlanItem[], analyses: GameAnalysis[]): StepEfficacy[] {
  // E3 / AP-CPROG-5: no analysed games at all ⇒ nothing to describe → []. The UI renders NO efficacy
  // section (not a hollow "Did it move?" header). With games present, a per-motif readout may still be
  // neverMeasured/thin — those ARE surfaced (distinct honesty branches downstream).
  if (analyses.length === 0) return [];
  const out: StepEfficacy[] = [];
  const seen = new Set<string>();
  for (const step of program) {
    const key = step.mastery?.motifKey;
    // Map only measurable motif keys: skip dimension/endgame keys (not leak clusters) and dupes.
    if (!key || !isMeasurableMotif(key) || seen.has(key)) continue;
    seen.add(key);
    const readout = motifEfficacy(analyses, key);
    const neverMeasured = readout.early.playerMoves + readout.recent.playerMoves === 0;
    out.push({
      motifKey: key,
      readout,
      neverMeasured,
      looksImproved: readout.enoughData && readout.deltaPct < 0,
    });
  }
  return out;
}

// Dimension keys carried on dimension steps' mastery.motifKey are NOT motif/leak clusters — they are
// radar dimensions, which motifEfficacy can't measure per-cluster. Exclude them (and 'endgame', which
// is the endgame STREAK key, not a leak cluster) so the loop only surfaces true per-motif efficacy.
const DIMENSION_KEYS = new Set(['openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience']);
function isMeasurableMotif(key: string): boolean {
  return key !== 'endgame' && !DIMENSION_KEYS.has(key);
}

/**
 * CO17 helper: name the player's MOST-PLAYED opening across recent analyses (longest-prefix per game,
 * then tallied), localized. Pure given the eco table. Returns the most frequent named line's
 * `{ key, label }` (key = canonical English name — a STABLE routing/measurement key; label =
 * localized display name) or `null` when no game matches a book line (empty=clean → generic reason).
 */
export function namedOpeningForGap(
  analyses: GameAnalysis[],
  ecoTable: EcoEntry[],
  locale: Locale,
): { key: string; label: string } | null {
  if (analyses.length === 0 || ecoTable.length === 0) return null;
  const counts = new Map<string, number>();
  for (const a of analyses) {
    // Reconstruct the played move sequence (UCI) from the per-ply analysis; nameOpening does the
    // longest-prefix match over the bundled CC0 table (same matcher eco.ts/Insights use).
    const uci = a.plies.map((p) => p.uci).filter(Boolean);
    if (uci.length === 0) continue;
    const named = nameOpening(uci, ecoTable);
    if (!named) continue;
    counts.set(named.name, (counts.get(named.name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  // Most frequent wins; ties broken by first-seen insertion order (Map preserves it) for determinism.
  let bestName: string | null = null;
  let bestCount = 0;
  for (const [name, n] of counts) {
    if (n > bestCount) { bestName = name; bestCount = n; }
  }
  if (!bestName) return null;
  return { key: bestName, label: localizedOpeningName({ name: bestName }, locale) };
}
