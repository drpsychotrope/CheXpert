import { describe, it, expect } from 'vitest';
import { metacogCoachLine } from './coaching';
import { calibration, type MetacogAttempt } from '../metacog/metacog';

/** n attempts at a confidence, `correct` of them solved (mirrors metacog.test.ts helper). */
function conf(confidence: 'sure' | 'unsure' | 'guess', n: number, correct: number): MetacogAttempt[] {
  return Array.from({ length: n }, (_, i) => ({ solved: i < correct, confidence }));
}
function miss(selfTag: string): MetacogAttempt {
  return { solved: false, selfTag };
}

describe('metacogCoachLine (C5/CO14)', () => {
  it('returns null below the sample floor / no reported attempts (anti-fabrication, AP-CINTAKE-4)', () => {
    expect(metacogCoachLine(calibration([], { locale: 'en' }), 'en')).toBeNull();
    // a few reported attempts but below the default minReported (10) → readout still null
    expect(metacogCoachLine(calibration(conf('sure', 3, 3), { locale: 'en' }), 'en')).toBeNull();
  });

  it('verdict-only readout (no tagged misses) → a sentence WITHOUT a cause clause', () => {
    // 12 reported, well above the floor; no selfTag on any attempt ⇒ topCause === null.
    const cal = calibration(conf('sure', 12, 10), { locale: 'en' });
    expect(cal.readout).not.toBeNull();
    expect(cal.readout!.topCause).toBeNull();
    const line = metacogCoachLine(cal, 'en');
    expect(line).toBeTruthy();
    // The verdict word is woven in; no self-tag cause label appears.
    expect(line).toContain('well-calibrated');
    expect(line).not.toContain('Rushed');
    expect(line!.toLowerCase()).not.toContain('cluster on');
  });

  it('with a top cause → includes the self-tag label', () => {
    // overconfident (sure accuracy < 0.6) + tagged misses dominated by "rushed".
    const cal = calibration(
      [...conf('sure', 12, 4), miss('rushed'), miss('rushed'), miss('miscalculated')],
      { locale: 'en' },
    );
    expect(cal.readout).not.toBeNull();
    expect(cal.readout!.topCause?.tag).toBe('rushed');
    const line = metacogCoachLine(cal, 'en');
    expect(line).toContain('overconfident'); // verdict word
    expect(line).toContain('Rushed');        // selfTag.* label, EN
  });

  it('emits NO digit anywhere in the line (descriptive, never a grade — AP-CINTAKE-3)', () => {
    const withCause = calibration(
      [...conf('sure', 12, 4), miss('rushed'), miss('rushed')],
      { locale: 'fr' },
    );
    const withoutCause = calibration(conf('sure', 12, 10), { locale: 'fr' });
    expect(metacogCoachLine(withCause, 'fr')!).not.toMatch(/\d/);
    expect(metacogCoachLine(withoutCause, 'fr')!).not.toMatch(/\d/);
    // EN too
    expect(metacogCoachLine(withCause, 'en')!).not.toMatch(/\d/);
  });

  it('FR and EN differ (bilingual parity)', () => {
    const cal = calibration([...conf('sure', 12, 4), miss('rushed'), miss('rushed')], { locale: 'fr' });
    const fr = metacogCoachLine(cal, 'fr');
    const en = metacogCoachLine(cal, 'en');
    expect(fr).toBeTruthy();
    expect(en).toBeTruthy();
    expect(fr).not.toBe(en);
    expect(fr).toContain('Précipité'); // selfTag.rushed, FR
    expect(en).toContain('Rushed');    // selfTag.rushed, EN
  });
});
