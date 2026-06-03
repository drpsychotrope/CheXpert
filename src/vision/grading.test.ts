import { describe, it, expect } from 'vitest';
import { VISION_GRADE_THRESHOLDS, blindfoldGrade } from './grading';
import { Grade, resultToGrade } from '../srs/fsrs';

describe('vision grading', () => {
  it('blindfold grades on correctness only (memory, not speed)', () => {
    expect(blindfoldGrade(true)).toBe(Grade.Good);
    expect(blindfoldGrade(false)).toBe(Grade.Again);
  });
  it('coordinate thresholds are sub-second scaled', () => {
    expect(VISION_GRADE_THRESHOLDS).toEqual({ fastMs: 1500, slowMs: 5000 });
  });
  it('fast coordinate recall → Easy, slow → Hard, between → Good, fail → Again', () => {
    expect(resultToGrade(true, 1000, VISION_GRADE_THRESHOLDS)).toBe(Grade.Easy);
    expect(resultToGrade(true, 6000, VISION_GRADE_THRESHOLDS)).toBe(Grade.Hard);
    expect(resultToGrade(true, 3000, VISION_GRADE_THRESHOLDS)).toBe(Grade.Good);
    expect(resultToGrade(false, 100, VISION_GRADE_THRESHOLDS)).toBe(Grade.Again);
  });
});
