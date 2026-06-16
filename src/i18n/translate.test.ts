import { describe, it, expect } from 'vitest';
import { translate, plural, formatNumber, formatPercent, type Messages } from './translate';
import { ALL_MESSAGES, DOMAINS } from './messages';

const M: Messages = {
  greet: { fr: 'Bonjour {name}', en: 'Hello {name}' },
  plain: { fr: 'Salut', en: 'Hi' },
};

describe('translate', () => {
  it('resolves per locale', () => {
    expect(translate(M, 'plain', 'fr')).toBe('Salut');
    expect(translate(M, 'plain', 'en')).toBe('Hi');
  });
  it('interpolates params', () => {
    expect(translate(M, 'greet', 'fr', { name: 'Jean' })).toBe('Bonjour Jean');
    expect(translate(M, 'greet', 'en', { name: 'Jean' })).toBe('Hello Jean');
  });
  it('leaves a missing param token verbatim (never "undefined")', () => {
    expect(translate(M, 'greet', 'fr')).toBe('Bonjour {name}');
  });
  it('falls back to the key when missing (never blank/throw)', () => {
    expect(translate(M, 'nope.key', 'fr')).toBe('nope.key');
  });
});

describe('plural', () => {
  it('French: 0 and 1 are singular', () => {
    expect(plural(0, 'fr', '{n} partie', '{n} parties')).toBe('0 partie');
    expect(plural(1, 'fr', '{n} partie', '{n} parties')).toBe('1 partie');
    expect(plural(2, 'fr', '{n} partie', '{n} parties')).toBe('2 parties');
  });
  it('English: only 1 is singular', () => {
    expect(plural(0, 'en', '{n} game', '{n} games')).toBe('0 games');
    expect(plural(1, 'en', '{n} game', '{n} games')).toBe('1 game');
  });
});

describe('locale-aware number formatting (I3)', () => {
  it('uses a comma decimal in French, a dot in English', () => {
    expect(formatNumber(1.5, 'fr', 1)).toBe('1,5');
    expect(formatNumber(1.5, 'en', 1)).toBe('1.5');
  });
  it('inserts a no-break space before % in French only', () => {
    expect(formatPercent(78, 'fr')).toBe('78 %');
    expect(formatPercent(78, 'en')).toBe('78%');
  });
});

describe('catalogue integrity (W18 I1 — honest, measurable bilingual DoD)', () => {
  it('every message has a non-empty fr AND en (keys(fr) === keys(en) by construction)', () => {
    for (const [key, msg] of Object.entries(ALL_MESSAGES)) {
      expect(msg.fr, `fr missing for ${key}`).toBeTruthy();
      expect(msg.en, `en missing for ${key}`).toBeTruthy();
    }
  });
  it('no key collides across domains (silent spread overwrite guard)', () => {
    const sum = Object.values(DOMAINS).reduce((n, d) => n + Object.keys(d).length, 0);
    expect(Object.keys(ALL_MESSAGES).length).toBe(sum);
  });
});
