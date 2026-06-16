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
