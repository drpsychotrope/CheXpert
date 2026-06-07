import { describe, it, expect } from 'vitest';

// require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves
// import.meta.url to a non-file URL that readFileSync rejects. Same pattern as
// concept-card-board-size.test.ts.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const board = stripComments(readFileSync(resolve(process.cwd(), 'src/ui/Board.svelte'), 'utf8'));

// Regression guard for the "playing Black, pieces are grabbable but moves never apply"
// bug (ADR-0050).
//
// chessground applies a drag as a real move only when its `turnColor` equals the side to
// move; when they disagree it silently demotes the drag to a (never-applied) premove. The
// side to move is a fact OF the position, so the board MUST derive the chessground
// turnColor from `fen`.
//
// The original code trusted a `turnColor` prop that every caller computed from a ChessGame
// held in $state. Svelte 5 does NOT deep-proxy class instances, so the engine's reply
// MUTATED the game without reassigning it, and the prop's derived stayed frozen at its
// initial value ('white', the side to move at game start). `movableColor`/`dests` were
// kept fresh because their deriveds also read `status`/`thinking` (which fire each move),
// but `turnColor` read nothing else — so a Black-playing human got fresh dests on a board
// chessground still thought was White's, and every move became a premove that never ran.
// White never hit it because the frozen 'white' happens to match White's turns.
//
// jsdom does no layout and the WASM engine can't run here, so the move/premove behaviour
// can't be exercised visually (same constraint as the mini-board sizing guard). We guard
// the source invariant instead: turnColor is derived from the FEN, never the raw prop.
describe('Board turnColor tracks the rendered position', () => {
  it('derives the side to move from the FEN field, not a separately-passed prop', () => {
    expect(board).toMatch(/fen\.split\(' '\)\[1\]\s*===\s*'b'/);
  });

  it('hands chessground the FEN-derived side to move (so it can never go stale)', () => {
    // The config passed to Chessground must use the derived value, not the raw prop —
    // passing `turnColor: turnColor` (or the bare shorthand) re-introduces the stale read.
    expect(board).toMatch(/turnColor:\s*sideToMove\b/);
    expect(board).not.toMatch(/turnColor:\s*turnColor\b/);
  });
});
