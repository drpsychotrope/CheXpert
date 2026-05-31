import { describe, it, expect } from 'vitest';
import { defaultRating, updateRating, winProbability } from './glicko2';

describe('glicko2', () => {
  it('reproduces the Glickman (2013) worked example', () => {
    // From the official paper: player r=1500, RD=200, vol=0.06 plays 3 games
    // vs (1400,30,W), (1550,100,L), (1700,300,L). Expected ~ r=1464.06, RD=151.52.
    const player = defaultRating(1500, 200, 0.06);
    const result = updateRating(
      player,
      [
        { opponentRating: 1400, opponentRd: 30, score: 1 },
        { opponentRating: 1550, opponentRd: 100, score: 0 },
        { opponentRating: 1700, opponentRd: 300, score: 0 },
      ],
      0.5,
    );
    expect(result.rating).toBeCloseTo(1464.06, 0);
    expect(result.rd).toBeCloseTo(151.52, 0);
    expect(result.vol).toBeCloseTo(0.05999, 3);
  });

  it('raises rating on a win, lowers on a loss', () => {
    const p = defaultRating(1500, 200, 0.06);
    const win = updateRating(p, [{ opponentRating: 1500, opponentRd: 50, score: 1 }]);
    const loss = updateRating(p, [{ opponentRating: 1500, opponentRd: 50, score: 0 }]);
    expect(win.rating).toBeGreaterThan(1500);
    expect(loss.rating).toBeLessThan(1500);
  });

  it('shrinks RD as games are played (more certainty)', () => {
    const p = defaultRating(1500, 350, 0.06);
    const after = updateRating(p, [{ opponentRating: 1500, opponentRd: 50, score: 1 }]);
    expect(after.rd).toBeLessThan(350);
    expect(after.rd).toBeGreaterThanOrEqual(30);
  });

  it('RD grows during inactivity (no results)', () => {
    const p = defaultRating(1500, 60, 0.06);
    const after = updateRating(p, []);
    expect(after.rd).toBeGreaterThan(60);
    expect(after.rating).toBe(1500);
  });

  it('win probability is ~0.5 vs an equal opponent and ordered by strength', () => {
    const p = defaultRating(1500, 50, 0.06);
    expect(winProbability(p, 1500)).toBeCloseTo(0.5, 1);
    expect(winProbability(p, 1200)).toBeGreaterThan(winProbability(p, 1800));
  });
});
