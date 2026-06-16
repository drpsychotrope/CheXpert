import { describe, it, expect } from 'vitest';
import {
  calibration,
  SELF_TAGS,
  SELF_TAG_LABELS,
  type MetacogAttempt,
} from './metacog';

/** Build n attempts of a given confidence, `correct` of them solved. */
function conf(confidence: 'sure' | 'unsure' | 'guess', n: number, correct: number): MetacogAttempt[] {
  return Array.from({ length: n }, (_, i) => ({ solved: i < correct, confidence }));
}
/** A failed attempt tagged with a self-diagnosed cause. */
function miss(selfTag: string): MetacogAttempt {
  return { solved: false, selfTag };
}

describe('calibration — byConfidence table', () => {
  it('emits exactly 3 rows in fixed order (sure, unsure, guess), accuracy = correct / n', () => {
    const cal = calibration([...conf('sure', 5, 4), ...conf('unsure', 3, 1)]);
    expect(cal.byConfidence.map((r) => r.confidence)).toEqual(['sure', 'unsure', 'guess']);
    const sure = cal.byConfidence[0];
    expect(sure).toMatchObject({ confidence: 'sure', n: 5, correct: 4 });
    expect(sure.accuracy).toBeCloseTo(0.8, 5);
    const unsure = cal.byConfidence[1];
    expect(unsure).toMatchObject({ confidence: 'unsure', n: 3, correct: 1 });
    expect(unsure.accuracy).toBeCloseTo(1 / 3, 5);
  });

  it('empty bucket → n 0, accuracy 0 (never NaN)', () => {
    const cal = calibration(conf('sure', 4, 4));
    const guess = cal.byConfidence[2];
    expect(guess.confidence).toBe('guess');
    expect(guess.n).toBe(0);
    expect(guess.accuracy).toBe(0);
  });

  it('counts reportedAttempts as attempts with a confidence set', () => {
    const cal = calibration([...conf('sure', 2, 2), { solved: false }, { solved: true }]);
    expect(cal.reportedAttempts).toBe(2);
  });
});

describe('calibration — verdict thresholds (minReported lowered for tests)', () => {
  const opts = { minReported: 4 };

  it('sure accuracy >= 0.80 → well-calibrated', () => {
    const cal = calibration(conf('sure', 5, 4), opts); // 0.80
    expect(cal.readout?.verdict).toBe('well-calibrated');
  });

  it('sure accuracy < 0.60 → overconfident', () => {
    const cal = calibration(conf('sure', 5, 2), opts); // 0.40
    expect(cal.readout?.verdict).toBe('overconfident');
  });

  it('weak sure + strong guess (>= 0.70 over floor) → underconfident', () => {
    const cal = calibration([...conf('sure', 5, 3), ...conf('guess', 5, 4)], opts); // sure 0.60 (mixed band), guess 0.80
    expect(cal.readout?.verdict).toBe('underconfident');
  });

  it('sure in the 0.60–0.80 band with no strong guess → mixed', () => {
    const cal = calibration([...conf('sure', 5, 3), ...conf('guess', 5, 2)], opts); // sure 0.60, guess 0.40
    expect(cal.readout?.verdict).toBe('mixed');
  });

  it('well-calibrated sure wins even when guess is also strong (precedence)', () => {
    const cal = calibration([...conf('sure', 5, 5), ...conf('guess', 5, 5)], opts);
    expect(cal.readout?.verdict).toBe('well-calibrated');
  });
});

describe('calibration — sentence is descriptive, not a grade (AP-META-1)', () => {
  it('contains a percentage and the confidence word, and NO grade token', () => {
    const cal = calibration(conf('sure', 10, 8), { minReported: 4, locale: 'en' });
    const s = cal.readout!.sentence;
    expect(s).toMatch(/%/);
    expect(s.toLowerCase()).toContain('sure');
    expect(s).not.toMatch(/\b(grade|score|[A-F][+-]?|good|bad|poor|excellent)\b/);
  });
});

describe('calibration — self-tag breakdown (AP-META-2)', () => {
  it('counts misses by tag, sorts desc by count, pct sums ~1 over tagged misses', () => {
    const cal = calibration([miss('rushed'), miss('rushed'), miss('miscalculated')], { minReported: 1 });
    expect(cal.taggedMisses).toBe(3);
    expect(cal.selfTags[0]).toMatchObject({ tag: 'rushed', n: 2 });
    expect(cal.selfTags[0].pct).toBeCloseTo(2 / 3, 5);
    const sumPct = cal.selfTags.reduce((a, r) => a + r.pct, 0);
    expect(sumPct).toBeCloseTo(1, 5);
  });

  it('unknown / legacy tag strings bucket under "other"', () => {
    const cal = calibration([miss('totally-made-up'), miss('other')], { minReported: 1 });
    const other = cal.selfTags.find((r) => r.tag === 'other');
    expect(other?.n).toBe(2);
  });

  it('a solved attempt carrying a stray selfTag is ignored in the miss breakdown', () => {
    const cal = calibration([{ solved: true, selfTag: 'rushed' }, miss('rushed')], { minReported: 1 });
    expect(cal.taggedMisses).toBe(1);
    expect(cal.selfTags.find((r) => r.tag === 'rushed')?.n).toBe(1);
  });

  it('topCause is the most common cause, or null when no tagged misses', () => {
    expect(calibration(conf('sure', 5, 4), { minReported: 1 }).readout?.topCause).toBeNull();
    const cal = calibration([...conf('sure', 5, 4), miss('rushed'), miss('rushed'), miss('wrong-plan')], { minReported: 1 });
    expect(cal.readout?.topCause).toMatchObject({ tag: 'rushed' });
  });
});

describe('calibration — sample-size floor (AP-META-3)', () => {
  it('below minReported (default 10) → readout null, but reportedAttempts still counted', () => {
    const cal = calibration(conf('sure', 3, 3)); // default floor 10
    expect(cal.readout).toBeNull();
    expect(cal.reportedAttempts).toBe(3);
  });

  it('custom minReported via opts is honoured', () => {
    expect(calibration(conf('sure', 3, 3), { minReported: 3 }).readout).not.toBeNull();
    expect(calibration(conf('sure', 3, 3), { minReported: 4 }).readout).toBeNull();
  });
});

describe('calibration — legacy-safe & deterministic (AP-META-6)', () => {
  it('attempts with no confidence/selfTag are ignored and do not throw', () => {
    const cal = calibration([{ solved: true }, { solved: false }, { solved: true }]);
    expect(cal.reportedAttempts).toBe(0);
    expect(cal.taggedMisses).toBe(0);
    expect(cal.readout).toBeNull();
    expect(cal.byConfidence).toHaveLength(3);
  });

  it('same input → identical output (no Date.now/Math.random; ties by taxonomy order)', () => {
    const input: MetacogAttempt[] = [miss('wrong-plan'), miss('rushed'), miss('miscalculated')];
    const a = calibration(input, { minReported: 1 });
    const b = calibration(input, { minReported: 1 });
    expect(a).toEqual(b);
    // one each → tie broken by taxonomy order (miscalculated before rushed before wrong-plan).
    expect(a.selfTags.map((r) => r.tag)).toEqual(['miscalculated', 'rushed', 'wrong-plan']);
  });
});

describe('taxonomy constants', () => {
  it('exposes the closed set and a label for every tag', () => {
    expect(SELF_TAGS).toEqual([
      'miscalculated',
      'missed-opponent-resource',
      'rushed',
      'unfamiliar-pattern',
      'wrong-plan',
      'other',
    ]);
    for (const t of SELF_TAGS) expect(typeof SELF_TAG_LABELS[t]).toBe('string');
  });
});
