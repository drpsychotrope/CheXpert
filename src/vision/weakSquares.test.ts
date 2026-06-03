import { describe, it, expect } from 'vitest';
import type { SrsCardRecord } from '../srs/types';
import { weakSquares, visionMastery } from './weakSquares';

function card(p: Partial<SrsCardRecord> & { refId: string }): SrsCardRecord {
  return {
    id: `${p.kind ?? 'vision-square'}:${p.refId}`,
    kind: p.kind ?? 'vision-square',
    refId: p.refId,
    due: p.due ?? 0,
    stability: p.stability ?? 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: p.state ?? 2,
    last_review: null,
    createdAt: 0,
  };
}

describe('weakSquares', () => {
  const now = 10;
  const cards = [
    card({ refId: 'e4', due: 0, stability: 5 }),   // due, stab 5
    card({ refId: 'a1', due: 100, stability: 1 }), // NOT due, stab 1
    card({ refId: 'h8', due: 0, stability: 2 }),   // due, stab 2
    card({ refId: 'p1', kind: 'puzzle', due: 0, stability: 0 }), // ignored
  ];

  it('orders due before not-due, then ascending stability', () => {
    expect(weakSquares(cards, now, 10)).toEqual(['h8', 'e4', 'a1']);
  });
  it('honours the limit', () => {
    expect(weakSquares(cards, now, 1)).toEqual(['h8']);
  });
  it('ignores non-vision-square cards', () => {
    expect(weakSquares(cards, now, 10)).not.toContain('p1');
  });
});

describe('visionMastery', () => {
  it('is 0 for no cards', () => {
    expect(visionMastery([])).toBe(0);
  });
  it('counts only stable Review squares over a fixed denominator of 64', () => {
    const cards = [
      card({ refId: 'e4', state: 2, stability: 30 }), // mastered (>=21)
      card({ refId: 'd4', state: 2, stability: 5 }),  // Review but not stable enough
      card({ refId: 'c4', state: 1, stability: 99 }), // still Learning
    ];
    expect(visionMastery(cards)).toBeCloseTo(1 / 64);
  });
  it('is 1.0 when all 64 squares are mastered', () => {
    const files = 'abcdefgh';
    const all: SrsCardRecord[] = [];
    for (let r = 1; r <= 8; r++) for (const f of files) all.push(card({ refId: `${f}${r}`, state: 2, stability: 30 }));
    expect(visionMastery(all)).toBe(1);
  });
});
