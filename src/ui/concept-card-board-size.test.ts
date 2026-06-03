import { describe, it, expect } from 'vitest';

// require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves
// import.meta.url to a non-file URL that readFileSync rejects. Same pattern as
// concepts.seed.test.ts; the typed casts keep tsc happy without @types/node.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

// Regression guard for the "learn the pattern renders a wrong board" bug.
//
// chessground positions pieces with pixel offsets derived from
// elements.board.getBoundingClientRect() (see chessground util.posToTranslate +
// the memoised bounds in chessground.js). getBoundingClientRect() reports the
// transform-scaled rect, but the board element's own coordinate space is
// untransformed — so an ancestor `transform: scale()` makes pieces land at a
// fraction of their correct local offset and bunch toward the top-left origin.
//
// The mini-board MUST therefore shrink by sizing the board for real (--board-size),
// never by scaling a transformed ancestor. jsdom does no layout, so this can't be
// asserted visually in a unit test; we guard the source invariant instead.
// Strip block comments so we assert against real CSS, not the prose that explains it
// (this very file's own comments mention `transform: scale`).
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const conceptCard = stripComments(readFileSync(resolve(process.cwd(), 'src/ui/ConceptCard.svelte'), 'utf8'));
const board = stripComments(readFileSync(resolve(process.cwd(), 'src/ui/Board.svelte'), 'utf8'));

describe('ConceptCard mini-board sizing', () => {
  it('does not shrink the board with a CSS transform (corrupts chessground piece placement)', () => {
    expect(conceptCard).not.toMatch(/transform:\s*scale/);
  });

  it('shrinks the board by setting --board-size', () => {
    expect(conceptCard).toMatch(/--board-size\s*:/);
  });

  it('Board honors --board-size for its rendered board dimension', () => {
    expect(board).toMatch(/--board:\s*round\(down,\s*var\(--board-size,/);
  });
});
