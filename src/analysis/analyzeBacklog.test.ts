import { describe, it, expect, vi } from 'vitest';
import { analyzeBacklog, analyzeOnePlayedGame } from './analyzeBacklog';
import type { EngineClient } from '../engine/EngineClient';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import type { PlayerModel, GameRecord } from '../store/db';
import type { GameAnalysis } from './types';

// ── Lightweight fakes (injection seams; no DB / no engine) ──────────────────────────────────────
const fakeEngine = () => {
  const calls = { resetVariant: 0 };
  const engine = { resetVariant: async () => { calls.resetVariant++; } } as unknown as EngineClient;
  return { engine, calls };
};
const fakePuzzles = {} as PuzzleRepo;
const fakeModel = { puzzleRating: { rating: 1500 } } as PlayerModel;

const game = (id: string, playerColor: 'w' | 'b' = 'w'): GameRecord => ({
  id, pgn: '1. e4 e5', result: 'win', botElo: 1500, playedAt: 1, coached: false, playerColor,
});
const analysisFor = (gameId: string, playerColor: 'w' | 'b' = 'w'): GameAnalysis =>
  ({ gameId, source: 'played', playerColor, analyzedAt: 1, movetimeMs: 200, plies: [],
     byPhase: {} as GameAnalysis['byPhase'], acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0,
     puzzlesGenerated: 0 });

describe('analyzeOnePlayedGame (shared core, F-P1-5)', () => {
  it('short-circuits when getAnalysis returns an existing row (idempotent, AP-PLAYLOOP-7)', async () => {
    const { engine } = fakeEngine();
    const runAnalysis = vi.fn();
    const existing = analysisFor('g1');
    const out = await analyzeOnePlayedGame(engine, fakePuzzles, fakeModel, game('g1'), {
      getAnalysis: async () => existing,
      runAnalysis: runAnalysis as never,
    });
    expect(out).toBe(existing);
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it('otherwise calls runAnalysis once with the game POV + source:played', async () => {
    const { engine, calls } = fakeEngine();
    const runAnalysis = vi.fn(async (_e, _p, input) => ({ analysis: analysisFor(input.gameId, input.playerColor), puzzles: [] }));
    const out = await analyzeOnePlayedGame(engine, fakePuzzles, fakeModel, game('g1', 'b'), {
      getAnalysis: async () => undefined,
      runAnalysis: runAnalysis as never,
      now: () => 4242,
    });
    expect(calls.resetVariant).toBe(1); // 960 cleared before analysing (AP-960-4)
    expect(runAnalysis).toHaveBeenCalledTimes(1);
    const input = runAnalysis.mock.calls[0][2];
    expect(input).toMatchObject({ gameId: 'g1', playerColor: 'b', source: 'played', baseRating: 1500, now: 4242 });
    expect(out.gameId).toBe('g1');
  });
});

describe('analyzeBacklog (sequential runner, Q-C=b)', () => {
  it('invokes the games one at a time, in order, and returns the last analysis', async () => {
    const { engine } = fakeEngine();
    const order: string[] = [];
    let inFlight = 0;
    let maxConcurrent = 0;
    const analyzeOne = vi.fn(async (_e, _p, _m, g: GameRecord) => {
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await Promise.resolve();
      order.push(g.id);
      inFlight--;
      return analysisFor(g.id);
    });
    const res = await analyzeBacklog(engine, fakePuzzles, fakeModel, [game('a'), game('b'), game('c')], {
      analyzeOne: analyzeOne as never,
    });
    expect(order).toEqual(['a', 'b', 'c']);
    expect(maxConcurrent).toBe(1); // strictly sequential (AP-PLAYLOOP-2)
    expect(res).toMatchObject({ done: 3, failed: 0, remaining: 0 });
    expect(res.last?.gameId).toBe('c');
  });

  it('passes each game playerColor through to the per-game core', async () => {
    const { engine } = fakeEngine();
    const seen: Array<{ id: string; color?: 'w' | 'b' }> = [];
    const analyzeOne = vi.fn(async (_e, _p, _m, g: GameRecord) => {
      seen.push({ id: g.id, color: g.playerColor });
      return analysisFor(g.id, g.playerColor);
    });
    await analyzeBacklog(engine, fakePuzzles, fakeModel, [game('a', 'w'), game('b', 'b')], {
      analyzeOne: analyzeOne as never,
    });
    expect(seen).toEqual([{ id: 'a', color: 'w' }, { id: 'b', color: 'b' }]);
  });

  it('honours the per-run cap, leaving the rest in remaining (AP — bound engine time)', async () => {
    const { engine } = fakeEngine();
    const analyzeOne = vi.fn(async (_e, _p, _m, g: GameRecord) => analysisFor(g.id));
    const res = await analyzeBacklog(engine, fakePuzzles, fakeModel, [game('a'), game('b'), game('c'), game('d')], {
      analyzeOne: analyzeOne as never,
      maxPerRun: 2,
    });
    expect(analyzeOne).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ done: 2, remaining: 2 });
  });

  it('honours cancellation between games (clean stop, never mid-game)', async () => {
    const { engine } = fakeEngine();
    let cancelled = false;
    const analyzeOne = vi.fn(async (_e, _p, _m, g: GameRecord) => {
      cancelled = true; // cancel after the first game completes
      return analysisFor(g.id);
    });
    const res = await analyzeBacklog(engine, fakePuzzles, fakeModel, [game('a'), game('b'), game('c')], {
      analyzeOne: analyzeOne as never,
      isCancelled: () => cancelled,
    });
    expect(analyzeOne).toHaveBeenCalledTimes(1); // 'b' is gated by the between-games cancel check
    expect(res).toMatchObject({ done: 1, remaining: 2 });
  });

  it('catches a single game throw so the loop continues; failure counted in failed/remaining (F-P1-4)', async () => {
    const { engine } = fakeEngine();
    const order: string[] = [];
    const analyzeOne = vi.fn(async (_e, _p, _m, g: GameRecord) => {
      order.push(g.id);
      if (g.id === 'b') throw new Error('engine crashed');
      return analysisFor(g.id);
    });
    const res = await analyzeBacklog(engine, fakePuzzles, fakeModel, [game('a'), game('b'), game('c')], {
      analyzeOne: analyzeOne as never,
    });
    expect(order).toEqual(['a', 'b', 'c']); // never aborted by 'b' throwing (AP-PLAYLOOP-14)
    expect(res).toMatchObject({ done: 2, failed: 1, remaining: 1 });
    expect(res.last?.gameId).toBe('c'); // last SUCCESSFUL analysis, not the failed one
  });

  it('empty backlog → no work, zero counts, null last', async () => {
    const { engine } = fakeEngine();
    const analyzeOne = vi.fn();
    const res = await analyzeBacklog(engine, fakePuzzles, fakeModel, [], { analyzeOne: analyzeOne as never });
    expect(analyzeOne).not.toHaveBeenCalled();
    expect(res).toEqual({ done: 0, failed: 0, remaining: 0, last: null });
  });
});
