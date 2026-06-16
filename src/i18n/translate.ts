// Pure i18n core (V2-W18, ADR-0053). NO runes, NO Date/Math.random — importable from
// pure cores (generators) and unit tests without pulling in Svelte reactivity. The reactive
// current-locale lives in locale.svelte.ts; UI calls t() (index.ts) which wraps these with it.
//
// Design (ADR-0052 Q3 superseded → bilingual): each message carries BOTH locales, so
// keys(fr) === keys(en) is structural — a key can never exist in one locale only.

export type Locale = 'fr' | 'en';
export const LOCALES: readonly Locale[] = ['fr', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'fr';

/** A user-facing message in every supported locale. */
export type Message = Record<Locale, string>;
export type Messages = Record<string, Message>;

export interface TParams {
  [k: string]: string | number;
}

/**
 * Resolve `key` in `locale` with `{param}` interpolation. Robustness (W18 rider):
 * - missing key → fall back to the default locale's value → the key itself (never blank/throw);
 * - missing interpolation param → leave the `{name}` token verbatim (never "undefined").
 */
export function translate(messages: Messages, key: string, locale: Locale, params?: TParams): string {
  const entry = messages[key];
  let s = entry ? (entry[locale] ?? entry[DEFAULT_LOCALE] ?? key) : key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (whole, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
    );
  }
  return s;
}

/**
 * Pluralization. French: 0 AND 1 are singular ("0 partie", "1 partie", "2 parties");
 * English: only 1 is singular. `one`/`many` may contain a `{n}` token.
 */
export function plural(n: number, locale: Locale, one: string, many: string): string {
  const isSingular = locale === 'fr' ? Math.abs(n) <= 1 : Math.abs(n) === 1;
  return (isSingular ? one : many).replace(/\{n\}/g, String(n));
}

const INTL_LOCALE: Record<Locale, string> = { fr: 'fr-FR', en: 'en-US' };

/** Locale-aware number formatting (W18 I3). fr-FR: comma decimal + spaced thousands; en-US: dot + comma. */
export function formatNumber(n: number, locale: Locale, fractionDigits?: number): string {
  const opts =
    fractionDigits == null
      ? undefined
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
  return new Intl.NumberFormat(INTL_LOCALE[locale], opts).format(n);
}

/** Locale-aware percent (W18 I3). FR inserts a no-break space before "%": "78 %"; EN: "78%". */
export function formatPercent(n: number, locale: Locale, fractionDigits = 0): string {
  const num = formatNumber(n, locale, fractionDigits);
  return locale === 'fr' ? `${num} %` : `${num}%`;
}
