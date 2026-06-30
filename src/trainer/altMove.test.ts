import { describe, it, expect } from 'vitest';
import { acceptAltMove, DEFAULT_ALT_MOVE_POLICY, type LineEval } from './altMove';

// All evals are White-POV (as EngineClient produces). acceptAltMove flips sign for a Black solver.

describe('acceptAltMove (T1, Q-A pure decision)', () => {
  it('accepts a played move that forces mate FOR the solver (White)', () => {
    // After the played move the OPPONENT is to move and is being mated → mate < 0 (mover POV).
    const best: LineEval = { uci: 'b1b8', whiteCp: 100000, mate: 1 };
    const played: LineEval = { uci: 'a1a8', whiteCp: 99998, mate: -1 };
    expect(acceptAltMove('white', best, played)).toBe(true);
  });

  it('rejects a played move that gets the solver mated (mate > 0 in the after-position)', () => {
    const best: LineEval = { uci: 'g1f3', whiteCp: 120 };
    const played: LineEval = { uci: 'f2f3', whiteCp: -99999, mate: 2 }; // opponent to move, opponent mates
    expect(acceptAltMove('white', best, played)).toBe(false);
  });

  it('accepts an alt within X cp of best AND clearly winning (White)', () => {
    const best: LineEval = { uci: 'd1d8', whiteCp: 620 };
    const played: LineEval = { uci: 'c1c8', whiteCp: 590 }; // 30cp below best, +5.9 → clearly winning
    expect(acceptAltMove('white', best, played)).toBe(true);
  });

  it('REJECTS a "less bad" losing move (relative-only trap): close to best but not winning', () => {
    // The whole position is lost; the played move is only 20cp worse than the best, but neither is
    // winning for the solver. A relative-only test would wrongly accept this.
    const best: LineEval = { uci: 'a2a3', whiteCp: -400 };
    const played: LineEval = { uci: 'b2b3', whiteCp: -420 };
    expect(acceptAltMove('white', best, played)).toBe(false);
  });

  it('REJECTS an equal-but-not-winning quiet move below the winning floor', () => {
    // Played move equals best (0cp gap) but the eval is only +0.5 — below the +200 floor.
    const best: LineEval = { uci: 'e2e4', whiteCp: 50 };
    const played: LineEval = { uci: 'd2d4', whiteCp: 50 };
    expect(acceptAltMove('white', best, played)).toBe(false);
  });

  it('REJECTS a move materially worse than best even if still winning (gap > withinCp)', () => {
    const best: LineEval = { uci: 'd1h5', whiteCp: 900 };
    const played: LineEval = { uci: 'f1c4', whiteCp: 300 }; // +3.0, winning, but 600cp below best
    expect(acceptAltMove('white', best, played)).toBe(false);
  });

  it('is sign-correct for a Black solver (White-POV negatives are wins for Black)', () => {
    // Black to move in the start position; a winning alt for Black is whiteCp << 0.
    const best: LineEval = { uci: 'd8d1', whiteCp: -620 };
    const played: LineEval = { uci: 'c8c1', whiteCp: -590 }; // for Black: +590, 30cp below best
    expect(acceptAltMove('black', best, played)).toBe(true);
    // The same numbers must be REJECTED for a White solver (they are losing for White).
    expect(acceptAltMove('white', best, played)).toBe(false);
  });

  it('honors custom thresholds', () => {
    const best: LineEval = { uci: 'a1a8', whiteCp: 300 };
    const played: LineEval = { uci: 'b1b8', whiteCp: 250 }; // 50cp gap, +2.5
    // Default (within 50 / floor 200): accepted.
    expect(acceptAltMove('white', best, played, DEFAULT_ALT_MOVE_POLICY)).toBe(true);
    // Tighter relative gate (within 40): rejected.
    expect(acceptAltMove('white', best, played, { withinCp: 40, winningFloorCp: 200 })).toBe(false);
    // Higher floor (300): rejected (played +2.5 < +3.0).
    expect(acceptAltMove('white', best, played, { withinCp: 50, winningFloorCp: 300 })).toBe(false);
  });
});
