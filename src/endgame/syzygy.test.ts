import { describe, it, expect } from 'vitest';
import {
  TablebaseClient,
  NetworkNotAllowedError,
  pieceCount,
  withinTablebase,
  bestMove,
  type TablebaseResult,
} from './syzygy';

const SAMPLE_RAW = {
  category: 'win',
  dtz: 12,
  dtm: 17,
  moves: [
    { uci: 'e2e7', san: 'Qe7+', category: 'loss', dtz: -11, dtm: -16 },
    { uci: 'e2e3', san: 'Qe3', category: 'win', dtz: 20 },
  ],
};

function memoryCache() {
  const map = new Map<string, TablebaseResult>();
  return {
    get: async (fen: string) => map.get(fen),
    set: async (fen: string, r: TablebaseResult) => void map.set(fen, r),
    map,
  };
}

describe('syzygy helpers', () => {
  it('counts pieces and enforces the <=7 limit', () => {
    expect(pieceCount('8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1')).toBe(3);
    expect(withinTablebase('8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1')).toBe(true);
    expect(withinTablebase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
  });

  it('bestMove returns the first listed move', () => {
    const r: TablebaseResult = { category: 'win', dtz: 12, moves: [{ uci: 'e2e7', category: 'loss', dtz: -11 }] };
    expect(bestMove(r)?.uci).toBe('e2e7');
  });
});

describe('TablebaseClient', () => {
  it('hits the network on a miss, then serves from cache', async () => {
    const cache = memoryCache();
    let calls = 0;
    const client = new TablebaseClient({
      allowNetwork: () => true,
      fetchFn: async () => {
        calls += 1;
        return { ok: true, json: async () => SAMPLE_RAW };
      },
      cacheGet: cache.get,
      cacheSet: cache.set,
    });

    const fen = '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1';
    const first = await client.probe(fen);
    expect(first.cached).toBe(false);
    expect(first.category).toBe('win');
    expect(first.moves).toHaveLength(2);

    const second = await client.probe(fen);
    expect(second.cached).toBe(true);
    expect(calls).toBe(1); // no second network hit (AP-CHESS-14)
  });

  it('refuses an uncached lookup without consent (AP-CHESS-17)', async () => {
    const cache = memoryCache();
    const client = new TablebaseClient({
      allowNetwork: () => false,
      fetchFn: async () => ({ ok: true, json: async () => SAMPLE_RAW }),
      cacheGet: cache.get,
      cacheSet: cache.set,
    });
    await expect(client.probe('8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1')).rejects.toBeInstanceOf(NetworkNotAllowedError);
  });

  it('serves a cached result even without consent (no network needed)', async () => {
    const cache = memoryCache();
    const fen = '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1';
    cache.map.set(fen, { category: 'win', dtz: 12, moves: [] });
    const client = new TablebaseClient({
      allowNetwork: () => false,
      fetchFn: async () => ({ ok: true, json: async () => SAMPLE_RAW }),
      cacheGet: cache.get,
      cacheSet: cache.set,
    });
    const r = await client.probe(fen);
    expect(r.cached).toBe(true);
    expect(r.category).toBe('win');
  });

  it('drops malformed moves with no UCI from an untrusted response (audit W6)', async () => {
    const cache = memoryCache();
    const client = new TablebaseClient({
      allowNetwork: () => true,
      fetchFn: async () => ({
        ok: true,
        json: async () => ({ category: 'win', dtz: 1, moves: [{ category: 'loss' }, { uci: 'e2e7', category: 'loss' }] }),
      }),
      cacheGet: cache.get,
      cacheSet: cache.set,
    });
    const r = await client.probe('8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1');
    expect(r.moves).toHaveLength(1);
    expect(r.moves[0].uci).toBe('e2e7');
  });
});
