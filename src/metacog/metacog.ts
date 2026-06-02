// Metacognition pure core (ADR-0037): confidence calibration + self-diagnosed
// error-cause breakdown over puzzle attempts. Pure & deterministic — no Date.now,
// no Math.random; the caller passes the attempts array (cf. fingerprint.ts).
//
// Honesty doctrine (AP-META-1): the readout is DESCRIPTIVE, never a grade — a
// fact-sentence + a descriptive verdict word, no letter/number score.

export type Confidence = 'sure' | 'unsure' | 'guess';

/** Fixed self-tag taxonomy (closed set — AP-META-2). 'other' is the escape hatch. */
export const SELF_TAGS = [
  'miscalculated',
  'missed-opponent-resource',
  'rushed',
  'unfamiliar-pattern',
  'wrong-plan',
  'other',
] as const;
export type SelfTag = (typeof SELF_TAGS)[number];

/** Human labels for chips/readout. Storage uses the stable keys above. */
export const SELF_TAG_LABELS: Record<SelfTag, string> = {
  miscalculated: 'Miscalculated',
  'missed-opponent-resource': "Missed opponent's resource",
  rushed: 'Rushed',
  'unfamiliar-pattern': 'Unfamiliar pattern',
  'wrong-plan': 'Wrong plan',
  other: 'Other',
};

const CONFIDENCES: Confidence[] = ['sure', 'unsure', 'guess'];

/** Minimal attempt shape the calibration math needs (decoupled from the DB record). */
export interface MetacogAttempt {
  solved: boolean;
  confidence?: Confidence;
  selfTag?: string; // unknown/legacy values bucket under 'other'
}

export interface ConfidenceRow {
  confidence: Confidence;
  n: number; // attempts with this confidence reported
  correct: number; // of which solved
  accuracy: number; // correct / n, 0..1 (0 when n === 0)
}

export interface SelfTagRow {
  tag: SelfTag;
  n: number; // misses tagged with this cause
  pct: number; // n / taggedMisses, 0..1
}

export type Verdict = 'well-calibrated' | 'overconfident' | 'underconfident' | 'mixed';

export interface CalibrationReadout {
  /** e.g. "When you said you were sure, you were right 78% of the time." */
  sentence: string;
  /** Descriptive verdict, NOT a grade. */
  verdict: Verdict;
  /** Most common self-diagnosed cause; null if no tagged misses. */
  topCause: { tag: SelfTag; pct: number } | null;
}

export interface Calibration {
  byConfidence: ConfidenceRow[]; // always 3 rows, fixed order sure>unsure>guess
  reportedAttempts: number; // attempts with confidence !== undefined
  taggedMisses: number; // misses with a selfTag set
  selfTags: SelfTagRow[]; // sorted desc by n, then taxonomy order
  /** Descriptive readout; null when below the sample-size floor. */
  readout: CalibrationReadout | null;
}

function normalizeTag(raw: string): SelfTag {
  return (SELF_TAGS as readonly string[]).includes(raw) ? (raw as SelfTag) : 'other';
}

function buildByConfidence(attempts: MetacogAttempt[]): ConfidenceRow[] {
  return CONFIDENCES.map((c) => {
    const bucket = attempts.filter((a) => a.confidence === c);
    const n = bucket.length;
    const correct = bucket.filter((a) => a.solved).length;
    return { confidence: c, n, correct, accuracy: n === 0 ? 0 : correct / n };
  });
}

function buildSelfTags(attempts: MetacogAttempt[]): { rows: SelfTagRow[]; taggedMisses: number } {
  const counts = new Map<SelfTag, number>();
  for (const a of attempts) {
    if (a.solved || a.selfTag === undefined) continue; // misses only (AP-META-2/Q-D)
    const tag = normalizeTag(a.selfTag);
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const taggedMisses = [...counts.values()].reduce((s, n) => s + n, 0);
  const order = (t: SelfTag) => SELF_TAGS.indexOf(t);
  const rows: SelfTagRow[] = [...counts.entries()]
    .map(([tag, n]) => ({ tag, n, pct: taggedMisses === 0 ? 0 : n / taggedMisses }))
    .sort((x, y) => y.n - x.n || order(x.tag) - order(y.tag)); // desc by count, then taxonomy order
  return { rows, taggedMisses };
}

/** Descriptive verdict (Q-B: confidence×accuracy table, NOT Brier). Thresholds
 * 0.60 / 0.80 / 0.70 are evaluated in precedence order; branches are exclusive. */
function deriveVerdict(rows: ConfidenceRow[], minReported: number): Verdict {
  const sure = rows[0];
  const guess = rows[2];
  if (sure.n >= minReported) {
    if (sure.accuracy < 0.6) return 'overconfident';
    if (sure.accuracy >= 0.8) return 'well-calibrated';
  }
  if (guess.n >= minReported && guess.accuracy >= 0.7) return 'underconfident';
  return 'mixed';
}

function pct(x: number): number {
  return Math.round(x * 100);
}

function buildSentence(rows: ConfidenceRow[]): string {
  // Prefer the 'sure' row when it has data; else the bucket with the most data.
  const sure = rows[0];
  const chosen = sure.n > 0 ? sure : [...rows].sort((a, b) => b.n - a.n)[0];
  const word = chosen.confidence === 'sure' ? 'sure' : chosen.confidence === 'unsure' ? 'unsure' : 'just guessing';
  return `When you said you were ${word}, you were right ${pct(chosen.accuracy)}% of the time.`;
}

export function calibration(
  attempts: MetacogAttempt[],
  opts?: { minReported?: number },
): Calibration {
  const minReported = opts?.minReported ?? 10;
  const byConfidence = buildByConfidence(attempts);
  const reportedAttempts = byConfidence.reduce((s, r) => s + r.n, 0);
  const { rows: selfTags, taggedMisses } = buildSelfTags(attempts);

  let readout: CalibrationReadout | null = null;
  if (reportedAttempts >= minReported) {
    readout = {
      sentence: buildSentence(byConfidence),
      verdict: deriveVerdict(byConfidence, minReported),
      topCause: selfTags.length ? { tag: selfTags[0].tag, pct: selfTags[0].pct } : null,
    };
  }

  return { byConfidence, reportedAttempts, taggedMisses, selfTags, readout };
}
