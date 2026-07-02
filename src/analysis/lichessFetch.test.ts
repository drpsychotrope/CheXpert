import { describe, it, expect } from 'vitest';
import { isValidLichessUsername, lichessExportUrl, fetchLichessGames, LICHESS_MAX_CHOICES } from './lichessFetch';

const resp = (status: number, body = '') =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response;

describe('lichessExportUrl / isValidLichessUsername (pure)', () => {
  it('builds the clocks-on export URL with encoding and a clamped max', () => {
    expect(lichessExportUrl('Me_123', 50)).toBe(
      'https://lichess.org/api/games/user/Me_123?max=50&clocks=true&opening=false&evals=false',
    );
    expect(lichessExportUrl(' user ', 999)).toContain('/user/user?max=300&');
    expect(lichessExportUrl('a b', 20)).toContain('/user/a%20b?'); // encoded, even if invalid upstream
  });
  it('validates the lichess username shape', () => {
    expect(isValidLichessUsername('thibault')).toBe(true);
    expect(isValidLichessUsername('a')).toBe(false);
    expect(isValidLichessUsername('has space')).toBe(false);
    expect(isValidLichessUsername('ok-name_1')).toBe(true);
  });
  it('exposes the fixed N choices', () => {
    expect(LICHESS_MAX_CHOICES).toEqual([20, 50, 100]);
  });
});

describe('fetchLichessGames (typed error mapping, injected fetch)', () => {
  it('returns the PGN body on 200', async () => {
    const r = await fetchLichessGames('me', 20, (async () => resp(200, '[Event "x"]\n\n1. e4 *')) as typeof fetch);
    expect(r).toEqual({ ok: true, pgn: '[Event "x"]\n\n1. e4 *' });
  });
  it('maps 404 → not-found, 429 → rate-limited, other non-OK/throw → network, blank → empty', async () => {
    expect((await fetchLichessGames('me', 20, (async () => resp(404)) as typeof fetch))).toEqual({ ok: false, error: 'not-found' });
    expect((await fetchLichessGames('me', 20, (async () => resp(429)) as typeof fetch))).toEqual({ ok: false, error: 'rate-limited' });
    expect((await fetchLichessGames('me', 20, (async () => resp(500)) as typeof fetch))).toEqual({ ok: false, error: 'network' });
    expect((await fetchLichessGames('me', 20, (async () => { throw new Error('offline'); }) as unknown as typeof fetch))).toEqual({ ok: false, error: 'network' });
    expect((await fetchLichessGames('me', 20, (async () => resp(200, '  ')) as typeof fetch))).toEqual({ ok: false, error: 'empty' });
  });
  it('rejects an invalid username WITHOUT any network call', async () => {
    let called = false;
    const r = await fetchLichessGames('bad name', 20, (async () => { called = true; return resp(200, 'x'); }) as typeof fetch);
    expect(r).toEqual({ ok: false, error: 'invalid-username' });
    expect(called).toBe(false);
  });
});
