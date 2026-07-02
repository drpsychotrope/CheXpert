import { describe, it, expect } from 'vitest';
import { onlyMoveGap, isOnlyMove, onlyMoveTargets, ONLY_MOVE_GAP_CP } from './onlyMove';
import type { PlyAnalysis } from './types';

const ply = (i: number, color: 'w' | 'b', severity: PlyAnalysis['severity']): PlyAnalysis =>
  ({ ply: i, color, severity }) as PlyAnalysis;

describe('onlyMoveGap / isOnlyMove (PR-21, Q-E=c)', () => {
  it('computes the mover-POV gap for both colours', () => {
    expect(onlyMoveGap(200, 50, 'w')).toBe(150); // white best +2.0, second +0.5
    expect(onlyMoveGap(-200, -50, 'b')).toBe(150); // black best −2.0 (good for black), second −0.5
  });
  it('flags only when the stored gap clears the threshold; absent data → false (no claim)', () => {
    expect(isOnlyMove({ bestWhiteCp: 200, secondBestCp: 50, color: 'w' })).toBe(true);
    expect(isOnlyMove({ bestWhiteCp: 200, secondBestCp: 200 - ONLY_MOVE_GAP_CP + 1, color: 'w' })).toBe(false);
    expect(isOnlyMove({ bestWhiteCp: 200, color: 'w' })).toBe(false);
  });
});

describe('onlyMoveTargets', () => {
  it("targets ONLY the player's mistake/blunder plies", () => {
    const targets = onlyMoveTargets({
      playerColor: 'w',
      plies: [
        ply(0, 'w', 'good'),
        ply(1, 'b', 'blunder'), // opponent — not targeted
        ply(2, 'w', 'mistake'),
        ply(3, 'w', 'inaccuracy'), // below the class — not targeted
        ply(4, 'w', 'blunder'),
      ],
    });
    expect(targets).toEqual([2, 4]);
  });
});
