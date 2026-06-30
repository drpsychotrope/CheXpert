// Coach metacognition line (C5/CO14). PURE — no Date, no Math.random, no engine.
// Turns the EXISTING calibration readout (metacog.ts `CalibrationReadout`) into ONE descriptive,
// coach-voiced sentence for the assessment result. No new math: it only re-phrases the readout the
// Insights tab already computes.
//
// Honesty doctrine (AP-CINTAKE-3/4 · AP-META-1): the line is DESCRIPTIVE — a verdict word + the
// self-diagnosed top cause when present — NEVER a number, letter, or percentage-as-grade. Below the
// sample floor / with no reported attempts the readout is `null`, and we emit NOTHING (anti-fabrication:
// no data ⇒ no line). The UI gates the whole thing behind `settings.metacogEnabled`.

import type { Calibration, Verdict } from '../metacog/metacog';
import { gt } from '../i18n/gen';
import type { Locale } from '../i18n/translate';

/** Verdict value → its bilingual generator key (the SAME keys Insights uses — no new verdict copy). */
const VERDICT_KEY: Record<Verdict, string> = {
  'well-calibrated': 'metacog.verdictWellCalibrated',
  overconfident: 'metacog.verdictOverconfident',
  underconfident: 'metacog.verdictUnderconfident',
  mixed: 'metacog.verdictMixed',
};

/**
 * Compose ONE coach-voiced calibration sentence from the existing readout, or `null` when there is
 * nothing honest to say.
 *
 * - `cal.readout === null` (below `minReported` floor / no reported attempts) → `null`
 *   (anti-fabrication — AP-CINTAKE-4; never synthesize "you're well-calibrated" on thin/absent data).
 * - else → a sentence built from the descriptive verdict word (`metacog.verdict*`), and, when a top
 *   self-diagnosed cause exists, the cause label (`selfTag.*`) woven in. Pure mapping over the readout,
 *   so it is trivially unit-testable and emits no digit (AP-CINTAKE-3 — asserted in tests).
 */
export function metacogCoachLine(cal: Calibration, locale: Locale): string | null {
  const readout = cal.readout;
  if (!readout) return null; // no data / below floor ⇒ no line (AP-CINTAKE-4)

  const verdict = gt(VERDICT_KEY[readout.verdict], locale);
  const cause = readout.topCause;
  if (cause) {
    return gt('coaching.lineWithCause', locale, {
      verdict,
      cause: gt('selfTag.' + cause.tag, locale),
    });
  }
  return gt('coaching.line', locale, { verdict });
}
