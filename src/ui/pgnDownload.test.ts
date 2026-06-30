import { describe, it, expect, vi, afterEach } from 'vitest';
import { pgnFilename, downloadPgn, downloadText } from './pgnDownload';

describe('pgnFilename (F5) — pure, derived from playedAt (no Date.now, AP-GAMES-6)', () => {
  it('is deterministic for a fixed epoch and ends with .pgn', () => {
    const ts = 1_700_000_000_000;
    expect(pgnFilename(ts, 'win')).toBe(pgnFilename(ts, 'win')); // stable across calls
    expect(pgnFilename(ts, 'win').endsWith('.pgn')).toBe(true);
    expect(pgnFilename(ts, 'win').startsWith('game-')).toBe(true);
  });

  it('embeds the playedAt date (local) and the result segment', () => {
    const ts = 1_700_000_000_000;
    const d = new Date(ts);
    const p = (n: number) => (n < 10 ? `0${n}` : String(n));
    const expectedDate = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    expect(pgnFilename(ts, 'loss')).toBe(`game-${expectedDate}-loss.pgn`);
    expect(pgnFilename(ts, 'draw')).toContain('-draw.pgn');
  });

  it('sanitises unsafe characters in the result segment to [a-z0-9-]', () => {
    const ts = 1_700_000_000_000;
    expect(pgnFilename(ts, 'Win/Loss?!')).toMatch(/^game-\d{4}-\d{2}-\d{2}-win-loss\.pgn$/);
    // An all-unsafe result still yields a valid, non-empty filename.
    expect(pgnFilename(ts, '???')).toMatch(/^game-\d{4}-\d{2}-\d{2}-game\.pgn$/);
  });

  it('does NOT call Date.now (purity): result is independent of the wall clock', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const ts = 1_700_000_000_000;
      const d = new Date(ts);
      const p = (n: number) => (n < 10 ? `0${n}` : String(n));
      const expected = `game-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-win.pgn`;
      expect(pgnFilename(ts, 'win')).toBe(expected);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('downloadPgn (F5) — client-side, SSR/jsdom-safe', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no-ops on an empty PGN (defensive, §3) — never touches the DOM', () => {
    const create = vi.fn();
    // Even with createObjectURL available, an empty pgn must not produce a download.
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
    expect(() => downloadPgn('', 'game.pgn')).not.toThrow();
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('feature-detects: does not throw when URL.createObjectURL is absent', () => {
    vi.stubGlobal('URL', {} as unknown as typeof URL); // no createObjectURL
    expect(() => downloadPgn('1. e4 *', 'game.pgn')).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('creates and revokes an object URL and clicks an anchor when supported (jsdom)', () => {
    const url = 'blob:test';
    const createObjectURL = vi.fn(() => url);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const clicked: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });

    downloadPgn('1. e4 e5 *', 'game-2026-06-30-win.pgn');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(url);
    expect(clicked).toEqual(['game-2026-06-30-win.pgn']);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('downloadText (C8 FOLD-C6) — generic primitive shared by PGN + coach-profile export', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no-ops on empty content — never touches the DOM', () => {
    const create = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
    expect(() => downloadText('', 'coach-profile-2026-06-30.json')).not.toThrow();
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('feature-detects: does not throw when URL.createObjectURL is absent (SSR/jsdom-safe)', () => {
    vi.stubGlobal('URL', {} as unknown as typeof URL);
    expect(() => downloadText('{"a":1}', 'coach-profile-2026-06-30.json')).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('creates/revokes an object URL and clicks an anchor with the given filename + mime (jsdom)', () => {
    const url = 'blob:test';
    const createObjectURL = vi.fn((_blob: Blob) => url);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const clicked: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });

    downloadText('{"assessedAt":1}', 'coach-profile-2026-06-30.json');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // The blob carries the default JSON mime (the arg the coach export relies on).
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(revokeObjectURL).toHaveBeenCalledWith(url);
    expect(clicked).toEqual(['coach-profile-2026-06-30.json']);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('honours a custom mime (downloadPgn delegates with the chess-PGN type)', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadPgn('1. e4 *', 'game-2026-06-30-win.pgn');
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/x-chess-pgn');
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
