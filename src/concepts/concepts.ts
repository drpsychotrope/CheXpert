// Curated concept cards (teach-before-test, ADR-0040). One card per high-confidence
// motif FAMILY the detector emits (mate, hangingPiece, fork, pin, skewer,
// discoveredAttack, doubleCheck). Pure lookup + a graceful fetch loader, mirroring
// src/opening/eco.ts. CURATED static content only — never generated (no LLM).

import { MOTIF_PRECEDENCE } from '../analysis/motif';
import type { Locale } from '../i18n/translate';

export interface ConceptExample {
  /** Legal FEN with the SOLVER to move. */
  fen: string;
  /** A legal UCI move in `fen` that demonstrates the motif. */
  keyMove: string;
  /** One-line explanation of why the move shows the pattern. */
  why: string;
}

export interface ConceptCard {
  /** A detector-emitted FAMILY theme key (mate/hangingPiece/fork/pin/skewer/discoveredAttack/doubleCheck). */
  motif: string;
  title: string;
  /** 1-2 sentence plain-English idea. */
  idea: string;
  /** 2-3 worked examples. */
  examples: ConceptExample[];
}

/** Sub-tag → family-card key. Sub-tags share the family card (Q-A). */
export const MOTIF_ALIASES: Record<string, string> = {
  mateIn1: 'mate',
  mateIn2: 'mate',
  mateIn3: 'mate',
  backRankMate: 'mate',
  knightFork: 'fork',
  absolutePin: 'pin',
  relativePin: 'pin',
  discoveredCheck: 'discoveredAttack',
};

/**
 * Detector precedence (ADR-0020): mate is most forcing, then the in-code motif.ts
 * order. Used by cardForThemes to pick the single most relevant card for a puzzle.
 */
export const CARD_PRECEDENCE: string[] = ['mate', ...MOTIF_PRECEDENCE];

/** Canonicalize a raw theme/motif key to its family key (via the alias table). */
function familyKey(motif: string): string {
  return MOTIF_ALIASES[motif] ?? motif;
}

/** Pure: the card for a motif or any of its sub-tags, or null. */
export function cardForMotif(motif: string, cards: ConceptCard[]): ConceptCard | null {
  if (!motif) return null;
  const key = familyKey(motif);
  return cards.find((c) => c.motif === key) ?? null;
}

/**
 * Pure: the card for a puzzle's themes — the highest-precedence theme (after alias
 * resolution) that has a card. This is the puzzle→card entry point. Returns null when
 * no theme resolves to a card (e.g. only a low-confidence fallback tag).
 */
export function cardForThemes(themes: string[], cards: ConceptCard[]): ConceptCard | null {
  const families = new Set(themes.map(familyKey));
  for (const fam of CARD_PRECEDENCE) {
    if (families.has(fam)) {
      const card = cards.find((c) => c.motif === fam);
      if (card) return card;
    }
  }
  return null;
}

// --- runtime loader (bundled JSON; mirrors eco.ts + PuzzleRepo) ---------------
type Fetcher = (url: string) => Promise<Response>;
// Cached PER locale: fr → concepts.fr.json, en → concepts.json (English canonical).
const cache = new Map<Locale, ConceptCard[]>();

/**
 * Fetch + cache the committed seed for `locale` (fr → concepts.fr.json, else the
 * English canonical concepts.json). Returns [] on ANY failure — a missing/broken
 * asset must never break Tactics (the "Learn the pattern" link simply won't appear).
 * `fetchFn` is injectable for tests; the seed assets themselves are validated by the
 * disk-read tests (concepts.seed.test.ts / concepts.fr-parity.test.ts), NOT this loader.
 */
export async function loadConcepts(locale: Locale, fetchFn: Fetcher = (u) => fetch(u)): Promise<ConceptCard[]> {
  const cached = cache.get(locale);
  if (cached) return cached;
  let result: ConceptCard[];
  try {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    const file = locale === 'fr' ? 'concepts/concepts.fr.json' : 'concepts/concepts.json';
    const res = await fetchFn(`${base}${file}`);
    if (!res.ok) {
      result = [];
    } else {
      const data = (await res.json()) as { cards?: ConceptCard[] } | ConceptCard[];
      result = Array.isArray(data) ? data : (data.cards ?? []);
    }
  } catch {
    result = [];
  }
  cache.set(locale, result);
  return result;
}

/** Test-only: reset the per-locale module cache between cases. */
export function __resetConceptsCacheForTests(): void {
  cache.clear();
}
