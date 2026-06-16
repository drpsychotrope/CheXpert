// i18n public API (V2-W18, ADR-0053).
//   - UI (.svelte): import { t, tn, fmtPct, fmtNum } — these read the reactive current locale,
//     so flipping the language re-renders them.
//   - Pure cores (generators, tests): import { translate, plural, type Locale } from './translate'
//     and take `locale` as a parameter — they must NOT depend on the reactive singleton.
import { getLocale } from './locale.svelte';
import { ALL_MESSAGES } from './messages';
import { translate, plural, formatNumber, formatPercent, type TParams } from './translate';

export type { Locale, Message, Messages, TParams } from './translate';
export { translate, plural, formatNumber, formatPercent, LOCALES, DEFAULT_LOCALE } from './translate';
export { getLocale, setLocaleState } from './locale.svelte';
export { ALL_MESSAGES } from './messages';

/** Reactive translation for the UI. Reads the current locale → re-renders on switch. */
export function t(key: string, params?: TParams): string {
  return translate(ALL_MESSAGES, key, getLocale(), params);
}

/** Reactive pluralized translation: picks `oneKey`/`manyKey` by the locale's rules, interpolating {n}. */
export function tn(n: number, oneKey: string, manyKey: string, params?: TParams): string {
  const merged = { ...params, n };
  const one = t(oneKey, merged);
  const many = t(manyKey, merged);
  return plural(n, getLocale(), one, many);
}

/** Reactive locale-aware number / percent formatting (W18 I3). */
export function fmtNum(n: number, fractionDigits?: number): string {
  return formatNumber(n, getLocale(), fractionDigits);
}
export function fmtPct(n: number, fractionDigits = 0): string {
  return formatPercent(n, getLocale(), fractionDigits);
}
