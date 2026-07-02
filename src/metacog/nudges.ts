// Metacog routing nudges (PR-11 metacog-routing, ADR-0069). The calibration/impulsivity signals
// were collected and displayed but never ROUTED anywhere. This derives AT MOST ONE soft
// suggestion from the existing readouts — no new math, no thresholds of its own beyond the
// dominance floor, and strictly a SUGGESTION, never a grade or a behavioural override
// (AP-META-1 intact; the coach-intake C5 REJECT — no measurement biasing — is untouched:
// nudges route TRAINING, never the measurement).

import type { Calibration } from './metacog';

export type MetacogNudgeKind = 'rushed' | 'unfamiliar' | 'overconfident';

export interface MetacogNudge {
  kind: MetacogNudgeKind;
  /** The share behind the claim (topCause pct), when the nudge is cause-driven. */
  pct?: number;
}

/** A self-diagnosed cause must be genuinely dominant before we suggest anything on it. */
export const NUDGE_CAUSE_FLOOR = 0.3;

/**
 * Derive AT MOST ONE nudge (the wave-3 gate: never stacked). Priority favours the most
 * actionable route: 'rushed' has a dedicated trainer mode (timed tactics), 'unfamiliar' has the
 * concepts library, 'overconfident' only earns a sentence (no honest route exists — saying so
 * beats inventing one). Below the calibration floor (readout null) → no nudge, nothing asserted.
 */
export function metacogNudge(cal: Calibration | null): MetacogNudge | null {
  const readout = cal?.readout;
  if (!readout) return null;
  const top = readout.topCause;
  if (top && top.pct >= NUDGE_CAUSE_FLOOR) {
    if (top.tag === 'rushed') return { kind: 'rushed', pct: top.pct };
    if (top.tag === 'unfamiliar-pattern') return { kind: 'unfamiliar', pct: top.pct };
  }
  if (readout.verdict === 'overconfident') return { kind: 'overconfident' };
  return null;
}
