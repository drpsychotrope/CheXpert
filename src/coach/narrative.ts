// Coach narrative + leverage core (C6, ADR-0045 reuse). PURE: no Date, no Math.random,
// no engine, no store; the locale is INJECTED (gt) exactly like program.ts / diagnostic.ts.
// Turns a CoachProfile into (1) a leverage-ranked list of focus areas and (2) a short
// DIRECTIONAL prose summary assembled from COMPLETE per-locale catalogue templates
// (coachReview.*) — never concatenated fragments (AP-CTEACH-5), never a runtime LLM
// (AP-CTEACH-4). Honest: no grade, no invented Elo/% payoff (AP-CTEACH-2/3); degrades
// gracefully on thin / empty data (FOLD-A4).

import type { CoachProfile } from './types';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

// Mirror program.ts / diagnostic.ts thresholds so the narrative, the program, and the
// strengths/weaknesses lists can never disagree about what counts as "weak".
const WEAKNESS_DELTA = -40; // a motif is weak at delta <= -40
const WEAKNESS_DIM = 35; // a dimension is weak at score <= 35 (with sampleSize > 0)

/** A focus area ranked by leverage = severity × frequency, sample-gated. PURE. */
export interface RankedFocus {
  kind: 'motif' | 'dimension';
  /** Stable routing key: a motif theme ('fork'…) or a dimension id ('resilience'…). */
  key: string;
  /** Localized display label (via motif.* / dim.*). */
  label: string;
  /** Normalized 0..1 severity (motif: -delta capped; dim: (50-score) capped). */
  severity: number;
  /** Normalized 0..1 frequency = sample-size confidence (n / 6, capped). */
  frequency: number;
  /** severity * frequency. */
  leverage: number;
}

/**
 * Rank weak motifs + weak game dimensions by leverage (severity × frequency), worst-first.
 * Returns `[]` when nothing crosses threshold. The `tactics` aggregate dimension is skipped
 * (the per-motif scores already carry the tactical granularity — same de-dup as program.ts /
 * diagnostic.ts). Deterministic: ties broken by stable key ascending. No Elo / % is computed
 * (AP-CTEACH-3) — `severity`/`frequency`/`leverage` are unitless 0..1 ranking weights only.
 */
export function rankByLeverage(profile: CoachProfile, locale: Locale = 'en'): RankedFocus[] {
  const out: RankedFocus[] = [];

  for (const m of profile.motifs) {
    if (m.delta > WEAKNESS_DELTA) continue;
    const severity = Math.min(1, -m.delta / 200);
    const frequency = Math.min(1, m.n / 6);
    out.push({
      kind: 'motif',
      key: m.theme,
      label: gt('motif.' + m.theme, locale),
      severity,
      frequency,
      leverage: severity * frequency,
    });
  }

  for (const d of profile.dimensions) {
    if (d.dimension === 'tactics') continue; // covered by per-motif (no double-count)
    if (!(d.sampleSize > 0) || d.score > WEAKNESS_DIM) continue;
    const severity = Math.min(1, (50 - d.score) / 50);
    const frequency = Math.min(1, d.sampleSize / 6);
    out.push({
      kind: 'dimension',
      key: d.dimension,
      label: gt('dim.' + d.dimension, locale),
      severity,
      frequency,
      leverage: severity * frequency,
    });
  }

  // Worst-first by leverage; tie-break by stable key so order is deterministic.
  return out.sort((a, b) => b.leverage - a.leverage || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The localized labels of the player's top 1-2 strengths (already display labels on the profile). */
function topStrengths(profile: CoachProfile): string[] {
  return profile.strengths.slice(0, 2);
}

/** Locale-correct list join via the catalogue template — never a raw ", " glue (AP-CTEACH-5). */
function joinAreas(parts: string[], locale: Locale): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  // Fold any 3rd+ item with the same connective so we never glue raw labels with a literal comma.
  return parts.reduce((acc, p) => (acc ? gt('coachReview.listJoin', locale, { a: acc, b: p }) : p), '');
}

/** True when the read had no analysed game OR no game dimension was measured (directional only). */
function isPuzzleOnly(profile: CoachProfile): boolean {
  if (!profile.source.game) return true;
  // No measured non-tactics dimension ⇒ effectively a puzzle-only read.
  return !profile.dimensions.some((d) => d.dimension !== 'tactics' && d.sampleSize > 0);
}

/**
 * A 2-4 sentence DIRECTIONAL narrative in `locale`, derived from the profile. Names 1-2
 * strengths, 1-2 weaknesses, and the top-leverage focus ("start here") with a qualitative,
 * NON-NUMERIC payoff cue. Adds a puzzle-only/directional caveat when no full game backed the
 * read. When nothing crosses threshold it returns a single honest "no clear weakness" line
 * (mirrors program.maintenance). Never throws on empty motifs/dimensions (FOLD-A4). Pure +
 * templated — no LLM (AP-CTEACH-4), no grade / invented number (AP-CTEACH-2/3).
 */
export function buildCoachNarrative(profile: CoachProfile, locale: Locale): string[] {
  const ranked = rankByLeverage(profile, locale);

  // Nothing weak ⇒ one honest maintenance line (AP-CTEACH-2 / FOLD-A4).
  if (ranked.length === 0) {
    return [gt('coachReview.narrNoWeak', locale)];
  }

  const sentences: string[] = [];

  const strengths = topStrengths(profile);
  if (strengths.length > 0) {
    sentences.push(gt('coachReview.narrStrength', locale, { areas: joinAreas(strengths, locale) }));
  }

  // Weak areas: name the top 1-2 ranked focuses by their localized labels.
  const weakLabels = ranked.slice(0, 2).map((r) => r.label);
  sentences.push(gt('coachReview.narrWeak', locale, { areas: joinAreas(weakLabels, locale) }));

  // "Start here": the single top-leverage focus + a qualitative (non-numeric) payoff cue.
  sentences.push(
    gt('coachReview.startHere', locale, { focus: ranked[0].label }) +
      ' ' +
      gt('coachReview.payoffSoft', locale),
  );

  // Honest caveat when no full game backed the read (FOLD-A8 / AP-CTEACH-2).
  if (isPuzzleOnly(profile)) {
    sentences.push(gt('coachReview.narrPuzzleOnly', locale));
  }

  return sentences;
}
