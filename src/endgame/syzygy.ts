// Syzygy tablebase client (Phase 3, ADR-0012).
//
// Perfect endgame feedback (WDL + DTZ + best moves, <= 7 pieces) via the Lichess
// public API. This is the ONE network egress in the whole app, so:
//  - It is gated on explicit consent (settings.allowNetwork) — AP-CHESS-17 / Q-A=b.
//  - Every response is cached in IndexedDB so we never re-hit the rate-limited API
//    for a position we've seen — AP-CHESS-14. (We reuse the `gameAnalyses` DB? No —
//    cache lives in-memory + a dedicated lightweight cache; see TablebaseCache.)
//
// The API is dependency-injected (fetchFn) so tests never touch the network.

export interface TablebaseMove {
  uci: string;
  san?: string;
  /** Win/draw/loss category from the side-to-move POV. */
  category: 'win' | 'draw' | 'loss' | 'unknown' | 'maybe-win' | 'maybe-loss' | 'blessed-loss' | 'cursed-win';
  dtz: number | null;
  dtm?: number | null;
  zeroing?: boolean;
}

export interface TablebaseResult {
  /** Position category from side-to-move POV. */
  category: TablebaseMove['category'];
  dtz: number | null;
  dtm?: number | null;
  /** Best moves, best-first (engine orders them). */
  moves: TablebaseMove[];
  /** True if served from cache (no network hit). */
  cached?: boolean;
}

export const SYZYGY_ENDPOINT = 'https://tablebase.lichess.ovh/standard';

type FetchFn = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export interface TablebaseClientOptions {
  fetchFn?: FetchFn;
  /** Returns true if the user has consented to network calls. */
  allowNetwork: () => boolean;
  cacheGet: (fen: string) => Promise<TablebaseResult | undefined>;
  cacheSet: (fen: string, result: TablebaseResult) => Promise<void>;
}

export class NetworkNotAllowedError extends Error {
  constructor() {
    super('Network access is disabled. Enable it in Settings to use the Syzygy endgame tablebase.');
    this.name = 'NetworkNotAllowedError';
  }
}

export class TablebaseClient {
  constructor(private opts: TablebaseClientOptions) {}

  /**
   * Probe a position. Cache-first (AP-CHESS-14): a cached result never hits the
   * network, so consent is only required for an uncached lookup.
   */
  async probe(fen: string): Promise<TablebaseResult> {
    const cached = await this.opts.cacheGet(fen);
    if (cached) return { ...cached, cached: true };

    if (!this.opts.allowNetwork()) throw new NetworkNotAllowedError();

    const fetchFn = this.opts.fetchFn ?? defaultFetch;
    const url = `${SYZYGY_ENDPOINT}?fen=${encodeURIComponent(fen)}`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error('Tablebase request failed');
    const data = (await res.json()) as RawTablebase;
    const result = normalize(data);
    await this.opts.cacheSet(fen, result);
    return { ...result, cached: false };
  }
}

interface RawTablebase {
  category?: string;
  dtz?: number | null;
  dtm?: number | null;
  moves?: Array<{ uci: string; san?: string; category?: string; dtz?: number | null; dtm?: number | null; zeroing?: boolean }>;
}

function normalize(data: RawTablebase): TablebaseResult {
  return {
    category: (data.category as TablebaseMove['category']) ?? 'unknown',
    dtz: data.dtz ?? null,
    dtm: data.dtm ?? null,
    // Defensive (audit W6): the response is untrusted JSON. Drop moves without a plausible UCI
    // so a malformed/partial response can't crash downstream (game.moveUci(undefined)) or poison
    // the cache.
    moves: (data.moves ?? [])
      .filter((m) => typeof m?.uci === 'string' && m.uci.length >= 4)
      .map((m) => ({
        uci: m.uci,
        san: m.san,
        category: (m.category as TablebaseMove['category']) ?? 'unknown',
        dtz: m.dtz ?? null,
        dtm: m.dtm ?? null,
        zeroing: m.zeroing,
      })),
  };
}

const defaultFetch: FetchFn = (url) => fetch(url);

/**
 * The tablebase API reports each move's category from the POV of the side to move
 * AFTER that move (i.e. the opponent). So a move leading to 'loss' for the
 * opponent is a WIN for us. This helper picks the best move for the side to move.
 */
export function bestMove(result: TablebaseResult): TablebaseMove | null {
  return result.moves.length ? result.moves[0] : null;
}

/** Count pieces in a FEN to guard the <=7 tablebase limit before any call. */
export function pieceCount(fen: string): number {
  const board = fen.split(' ')[0];
  return (board.match(/[a-zA-Z]/g) || []).length;
}

export function withinTablebase(fen: string): boolean {
  return pieceCount(fen) <= 7;
}
