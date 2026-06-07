import { describe, it, expect } from 'vitest';
import { botMovetime, flagOutcome, applyGameResult, BUDGET_BOUNDS } from './playSession';
import { defaultRating } from '../rating/glicko2';

describe('playSession (W12)', () => {
  describe('botMovetime', () => {
    it('clamps to the category floor and ceil', () => {
      expect(botMovetime(0, 0, 'bullet')).toBe(BUDGET_BOUNDS.bullet[0]); // ~no time → floor
      expect(botMovetime(10_000_000, 0, 'bullet')).toBe(BUDGET_BOUNDS.bullet[1]); // lots → ceil
    });
    it('scales with remaining time within bounds', () => {
      expect(botMovetime(60_000, 0, 'classical')).toBe(1500); // 60s / 40 moves, within [200,2000]
    });
  });

  describe('flagOutcome (FIDE Art. 6.9)', () => {
    const BOTH_MATE = '3qk3/8/8/8/8/8/8/3QK3 w - - 0 1'; // both sides have a queen
    const BARE_KINGS = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    it('player loses when they flag and the opponent can mate', () => {
      expect(flagOutcome('w', 'w', BOTH_MATE)).toEqual({ outcome: 'loss', draw: false });
    });
    it('player wins when the opponent flags and the player can mate', () => {
      expect(flagOutcome('b', 'w', BOTH_MATE)).toEqual({ outcome: 'win', draw: false });
    });
    it('is a draw when the non-flagging side cannot mate', () => {
      expect(flagOutcome('w', 'w', BARE_KINGS)).toEqual({ outcome: 'draw', draw: true });
    });
  });

  describe('applyGameResult', () => {
    it('raises the rating on a win and lowers it on a loss vs the same bot', () => {
      const r = defaultRating(1500, 100, 0.06);
      const opp = { targetElo: 1500, recent: [] };
      const win = applyGameResult(r, opp, 'win', 1500).nextRating.rating;
      const loss = applyGameResult(r, opp, 'loss', 1500).nextRating.rating;
      expect(win).toBeGreaterThan(r.rating);
      expect(loss).toBeLessThan(r.rating);
    });
  });
});
