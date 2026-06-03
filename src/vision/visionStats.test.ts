import { describe, it, expect } from 'vitest';
import { recordDrill, type VisionStats } from './visionStats';

describe('recordDrill', () => {
  it('seeds a missing key: emaMs = ms, attempts = 1', () => {
    const out = recordDrill({}, 'knight', true, 1000, 5);
    expect(out.knight).toEqual({ attempts: 1, correct: 1, emaMs: 1000, lastSeen: 5 });
  });

  it('blends emaMs = 0.3*ms + 0.7*prev on the next attempt', () => {
    const s1 = recordDrill({}, 'knight', true, 1000, 1);
    const s2 = recordDrill(s1, 'knight', true, 2000, 2);
    expect(s2.knight!.emaMs).toBeCloseTo(0.3 * 2000 + 0.7 * 1000); // 1300
    expect(s2.knight!.attempts).toBe(2);
  });

  it('increments correct only on success', () => {
    let s: VisionStats = recordDrill({}, 'findall', false, 500, 1);
    expect(s.findall).toEqual({ attempts: 1, correct: 0, emaMs: 500, lastSeen: 1 });
    s = recordDrill(s, 'findall', true, 500, 2);
    expect(s.findall!.correct).toBe(1);
    expect(s.findall!.attempts).toBe(2);
  });

  it('is pure — does not mutate the input', () => {
    const input: VisionStats = {};
    const out = recordDrill(input, 'diagonal', true, 800, 9);
    expect(input).toEqual({});
    expect(out).not.toBe(input);
  });
});
