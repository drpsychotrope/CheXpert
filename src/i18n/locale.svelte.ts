// Reactive current-locale (V2-W18, ADR-0053). The ONE reactive source the language switch
// flips. Components read it via t() (index.ts) inside templates/$derived, so flipping the
// locale re-renders every t() output (ADR-0050/0051: reactivity needs a tracked $state dep).
// Persistence to SettingsRecord.locale is owned by app.svelte.ts (this module is UI-state only).

import { DEFAULT_LOCALE, type Locale } from './translate';

let _locale = $state<Locale>(DEFAULT_LOCALE);

/** Current UI locale. Reactive: reading this inside a component tracks it. */
export function getLocale(): Locale {
  return _locale;
}

/** Set the live locale and mirror it onto <html lang> (a11y / SR pronunciation). */
export function setLocaleState(locale: Locale): void {
  _locale = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
