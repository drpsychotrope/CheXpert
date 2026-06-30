// Pure generator-translation helper (V2-W18 Phase 3). Lets PURE cores (explain, positional,
// program, metacog, diagnostic) resolve their bilingual phrases by an INJECTED locale without
// importing the reactive locale singleton — so they stay pure and unit-testable.
import { generators } from './messages/generators';
import { translate, type Locale, type TParams } from './translate';

/** Translate a generator key in the given locale. */
export function gt(key: string, locale: Locale, params?: TParams): string {
  return translate(generators, key, locale, params);
}

/** Does a generator key exist? (Used to decide whether a motif has a phrase to show.) */
export function gtHas(key: string): boolean {
  return key in generators;
}

/** A motif's localized label, or the raw key when there's no catalogue entry (phase-fallback leaks). */
export function motifLabelOrRaw(motif: string, locale: Locale): string {
  return gtHas('motif.' + motif) ? gt('motif.' + motif, locale) : motif;
}

/**
 * Generic display resolver (F1, FOLD I4): a `namespace.key` localized label, or the raw `key`
 * when no catalogue entry exists. Sibling of `motifLabelOrRaw` (which is `labelOrRaw('motif', …)`).
 * Display-only — the raw `key` keeps feeding routing/filters unchanged (AP-I18N-1). Consumed by
 * Coach + Insights for `activity.*`; the raw fallback is for open-vocabulary tails only — a closed
 * union (e.g. `activity.*`) must have every key, gated by the parity test (AP-I18N-4).
 */
export function labelOrRaw(namespace: string, key: string, locale: Locale): string {
  const full = namespace + '.' + key;
  return gtHas(full) ? gt(full, locale) : key;
}
