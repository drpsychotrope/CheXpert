import { describe, it, expect } from 'vitest';
import { winPct, winProbLoss, cpLoss, classify } from './winProb';

describe('winProb', () => {
  it('winPct is 50 at 0 cp and monotonic', () => {
    expect(winPct(0)).toBeCloseTo(50, 5);
    expect(winPct(100)).toBeGreaterThan(50);
    expect(winPct(-100)).toBeLessThan(50);
    expect(winPct(100000)).toBeGreaterThan(99);
    expect(winPct(-100000)).toBeLessThan(1);
  });

  it('winProbLoss is from the moving side POV', () => {
    // White to move, best keeps +300, played drops to 0 → White lost win%.
    const wLoss = winProbLoss(300, 0, true);
    expect(wLoss).toBeGreaterThan(0);
    // Black to move, best keeps -300 (good for Black), played to 0 → Black lost.
    const bLoss = winProbLoss(-300, 0, false);
    expect(bLoss).toBeCloseTo(wLoss, 5);
  });

  it('no loss when the played move matches best', () => {
    expect(winProbLoss(150, 150, true)).toBe(0);
    expect(cpLoss(150, 150, true)).toBe(0);
  });

  it('cpLoss respects side to move', () => {
    expect(cpLoss(300, 100, true)).toBe(200); // white lost 200cp
    // Black to move: best line is -300 (great for Black), played slid to -100.
    expect(cpLoss(-300, -100, false)).toBe(200); // black lost 200cp
  });

  it('classify maps win% loss to severity', () => {
    expect(classify(0.2)).toBe('best');
    expect(classify(3)).toBe('good');
    expect(classify(7)).toBe('inaccuracy');
    expect(classify(14)).toBe('mistake');
    expect(classify(30)).toBe('blunder');
  });
});
