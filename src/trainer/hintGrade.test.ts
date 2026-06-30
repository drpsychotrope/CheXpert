import { describe, it, expect } from 'vitest';
import { clampGradeForHint, applyGlickoGain } from './hintGrade';
import { Grade, State, gradeCard, newCard } from '../srs/fsrs';

describe('clampGradeForHint (T3/TR5, Q-B — a hinted solve caps at Hard)', () => {
  it('returns the grade unchanged when no hint was used', () => {
    expect(clampGradeForHint(Grade.Good, false)).toBe(Grade.Good);
    expect(clampGradeForHint(Grade.Easy, false)).toBe(Grade.Easy);
    expect(clampGradeForHint(Grade.Again, false)).toBe(Grade.Again);
  });

  it('caps Easy and Good down to Hard when a hint was used', () => {
    expect(clampGradeForHint(Grade.Easy, true)).toBe(Grade.Hard);
    expect(clampGradeForHint(Grade.Good, true)).toBe(Grade.Hard);
  });

  it('leaves Hard at Hard (already ≤ cap)', () => {
    expect(clampGradeForHint(Grade.Hard, true)).toBe(Grade.Hard);
  });

  it('leaves a miss (Again) unchanged — never punishes a hint into a worse grade (AP-TINTEG-2)', () => {
    expect(clampGradeForHint(Grade.Again, true)).toBe(Grade.Again);
  });

  it('never raises a grade (AP-TINTEG-3): output ordinal ≤ input ordinal for every grade', () => {
    for (const g of [Grade.Again, Grade.Hard, Grade.Good, Grade.Easy]) {
      expect(clampGradeForHint(g, true)).toBeLessThanOrEqual(g);
    }
  });
});

describe('applyGlickoGain (T3/TR5, Q-B — withhold the gain on a hinted solve)', () => {
  it('is false on a hinted solve (rating stays flat — no gain)', () => {
    expect(applyGlickoGain(true, true)).toBe(false);
  });
  it('is true on an unaided solve (normal gain)', () => {
    expect(applyGlickoGain(true, false)).toBe(true);
  });
  it('is true on a miss (the normal loss path still applies — the hint did not save it)', () => {
    expect(applyGlickoGain(false, true)).toBe(true);
    expect(applyGlickoGain(false, false)).toBe(true);
  });
});

describe('clamp composition with gradeCard first-exposure clamp (AP-TINTEG-3)', () => {
  it('a hinted fast first solve on a State.New card resolves to ≤ Hard (hint cap dominates)', () => {
    const now = 1_000_000;
    const fresh = newCard('puzzle', 'p1', now);
    expect(fresh.state).toBe(State.New);

    // Simulate the call site: hint clamp applied BEFORE gradeCard (which adds the first-exposure
    // Easy→Good clamp). A fast clean solve would be Easy; the hint caps it to Hard first.
    const effective = clampGradeForHint(Grade.Easy, true); // → Hard
    const carded = gradeCard(fresh, effective, now);

    // Cross-check against the unaided fast first solve (Easy → first-exposure clamp → Good).
    const unaided = gradeCard(newCard('puzzle', 'p2', now), Grade.Easy, now);

    // The hinted card must come due SOONER (a shorter interval) than the unaided one — the cap
    // resurfaced it faster. (A Hard step is shorter than the Good first-exposure step.)
    expect(carded.due - now).toBeLessThan(unaided.due - now);
  });
});
