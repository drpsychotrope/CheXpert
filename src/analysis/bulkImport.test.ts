import { describe, it, expect } from 'vitest';
import { splitPgnGames, shortHash, importGameId, importBulk, type ImportBulkOpts } from './bulkImport';
import type { EngineClient } from '../engine/EngineClient';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import type { GameAnalysis } from './types';

const G = (white: string, black: string, moves = '1. e4 e5 *') =>
  `[Event "Test"]\n[White "${white}"]\n[Black "${black}"]\n\n${moves}`;

const engine = { resetVariant: async () => {} } as unknown as EngineClient;
const puzzles = {} as PuzzleRepo;
const analysis = { gameId: 'x' } as unknown as GameAnalysis;

/** Injected seams: parse from headers via a tiny fake (keeps the tests engine-free and fast). */
function seams(over: Partial<ImportBulkOpts> = {}): ImportBulkOpts {
  return {
    parse: (src: string) => {
      const white = /\[White "(.*?)"\]/.exec(src)?.[1] ?? '?';
      const black = /\[Black "(.*?)"\]/.exec(src)?.[1] ?? '?';
      const empty = /\*\s*$/.test(src) && !/1\./.test(src);
      return { plies: empty ? [] : [{ ply: 0 } as never], headers: { White: white, Black: black }, incrementSec: 0 } as never;
    },
    runAnalysis: async () => ({ analysis, puzzles: [{ id: 'p1' }] }) as never,
    getAnalysis: async () => undefined,
    putImportedGame: async () => {},
    now: () => 1000,
    ...over,
  };
}

describe('splitPgnGames / importGameId (pure)', () => {
  it('splits on [Event boundaries and trims', () => {
    const raw = `${G('A', 'B')}\n\n${G('C', 'D')}\n\n\n${G('E', 'F')}`;
    expect(splitPgnGames(raw).length).toBe(3);
    expect(splitPgnGames('  ')).toEqual([]);
    expect(splitPgnGames(G('A', 'B')).length).toBe(1);
  });
  it('content-addresses ids stably (same input → same id; different → different)', () => {
    const a = importGameId({ White: 'A', Black: 'B' }, 'src1');
    expect(a).toBe(`import:A-B-${shortHash('src1')}`);
    expect(importGameId({ White: 'A', Black: 'B' }, 'src2')).not.toBe(a);
  });
});

describe('importBulk (sequential, cancellable, honest skips)', () => {
  it('analyses every attributable game and sums puzzles', async () => {
    const sources = [G('Me', 'X'), G('Y', 'Me'), G('Me', 'Z')];
    const r = await importBulk(engine, puzzles, 1200, sources, 'Me', 'auto', seams());
    expect(r.analyzed).toBe(3);
    expect(r.puzzles).toBe(3);
    expect(r.skippedColor).toBe(0);
    expect(r.last).toBe(analysis);
  });

  it('skips (and counts) games whose colour cannot be inferred — never guesses (audit C-3)', async () => {
    const sources = [G('Me', 'X'), G('Other', 'People')];
    const r = await importBulk(engine, puzzles, 1200, sources, 'Me', 'auto', seams());
    expect(r.analyzed).toBe(1);
    expect(r.skippedColor).toBe(1);
  });

  it('dedupes on the content-addressed id via getAnalysis (idempotent re-import)', async () => {
    const seen = new Set<string>([importGameId({ White: 'Me', Black: 'X' }, G('Me', 'X'))]);
    const r = await importBulk(engine, puzzles, 1200, [G('Me', 'X'), G('Me', 'Z')], 'Me', 'auto',
      seams({ getAnalysis: async (id: string) => (seen.has(id) ? (analysis as never) : undefined) }));
    expect(r.skippedDup).toBe(1);
    expect(r.analyzed).toBe(1);
  });

  it('one throwing game is counted failed and the batch continues (F-P1-4)', async () => {
    let calls = 0;
    const r = await importBulk(engine, puzzles, 1200, [G('Me', 'X'), G('Me', 'Y'), G('Me', 'Z')], 'Me', 'auto',
      seams({ runAnalysis: (async () => { calls++; if (calls === 2) throw new Error('engine crash'); return { analysis, puzzles: [] }; }) as never }));
    expect(r.analyzed).toBe(2);
    expect(r.failed).toBe(1);
  });

  it('cancellation between games stops cleanly', async () => {
    let started = 0;
    const r = await importBulk(engine, puzzles, 1200, [G('Me', 'X'), G('Me', 'Y'), G('Me', 'Z')], 'Me', 'auto',
      seams({ isCancelled: () => started >= 1, onGameStart: () => { started++; } }));
    expect(r.analyzed).toBe(1);
  });

  it('an explicit colour choice is honoured for every game', async () => {
    const r = await importBulk(engine, puzzles, 1200, [G('Nobody', 'Known')], '', 'b', seams());
    expect(r.analyzed).toBe(1);
    expect(r.skippedColor).toBe(0);
  });
});
