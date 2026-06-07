// Loads the curated puzzle subset and serves puzzles in the player's zone.
//
// Source preference (spec Q-E=a): the ETL output public/puzzles/puzzles.json if
// present, else the small verified seed set. On first run we seed IndexedDB (G5)
// so subsequent loads are instant and offline (PWA).

import { openTrainerDB } from '../store/db';
import { phaseOf, type Puzzle } from './puzzle';

export interface PuzzleQuery {
  /** Target rating; we return a puzzle within `window` of it when possible. */
  rating: number;
  window?: number;
  themes?: string[];
  phase?: 'opening' | 'middlegame' | 'endgame';
  /** Puzzle ids to avoid (already attempted this session). */
  exclude?: Set<string>;
  source?: 'curated' | 'personal';
}

type Fetcher = (url: string) => Promise<Response>;

export class PuzzleRepo {
  private loaded = false;
  private cache: Puzzle[] = [];

  constructor(private fetchFn: Fetcher = (u) => fetch(u)) {}

  /** Ensure puzzles are seeded into IndexedDB and loaded into memory. */
  async init(): Promise<void> {
    if (this.loaded) return;
    const db = await openTrainerDB();
    // Count via the index instead of materialising ~80k keys just to take .length (audit W3).
    const curatedCount = await db.countFromIndex('puzzles', 'source', 'curated');
    // Seed when the store has no curated puzzles, OR when the shipped subset has
    // GROWN since last seed (e.g. a new seed file or a freshly-run ETL). This lets
    // a bigger puzzle set land for existing users without wiping their personal
    // puzzles or attempt history. We never delete existing rows here.
    const subset = curatedCount === 0 ? await this.fetchSubset() : null;
    if (subset && subset.length) {
      await this.seedInBatches(db, subset);
    } else if (curatedCount > 0) {
      // Curated rows already present, but check whether the shipped set is bigger.
      const shipped = await this.fetchSubset();
      if (shipped.length > curatedCount) await this.seedInBatches(db, shipped);
    }
    this.cache = await db.getAll('puzzles');
    this.loaded = true;
  }

  /** Seed puzzles in bounded transactions so a fresh ~80k-row import doesn't freeze the
   *  main thread with one 80k-put transaction at first launch (audit W3). */
  private async seedInBatches(db: Awaited<ReturnType<typeof openTrainerDB>>, puzzles: Puzzle[]): Promise<void> {
    const BATCH = 2000;
    for (let i = 0; i < puzzles.length; i += BATCH) {
      const tx = db.transaction('puzzles', 'readwrite');
      const slice = puzzles.slice(i, i + BATCH);
      await Promise.all(slice.map((p) => tx.store.put(p)));
      await tx.done;
    }
  }

  /** Number of puzzles available. */
  get size(): number {
    return this.cache.length;
  }

  /** Fetch the ETL subset, falling back to the seed set. */
  private async fetchSubset(): Promise<Puzzle[]> {
    for (const url of ['/puzzles/puzzles.json', '/puzzles/seed-puzzles.json']) {
      try {
        const res = await this.fetchFn(url);
        if (!res.ok) continue;
        const data = await res.json();
        const puzzles: Puzzle[] = Array.isArray(data) ? data : data.puzzles;
        if (puzzles && puzzles.length) return puzzles;
      } catch {
        // try next
      }
    }
    return [];
  }

  /** Allow tests / personal-puzzle generation to inject puzzles directly. */
  async addPuzzles(puzzles: Puzzle[]): Promise<void> {
    const db = await openTrainerDB();
    const tx = db.transaction('puzzles', 'readwrite');
    await Promise.all(puzzles.map((p) => tx.store.put(p)));
    await tx.done;
    this.cache.push(...puzzles);
  }

  /** Look up a puzzle by id from the in-memory cache (used by the SRS review queue). */
  byId(id: string): Puzzle | null {
    return this.cache.find((p) => p.id === id) ?? null;
  }

  /**
   * Pick the next puzzle nearest the requested rating, honoring theme/phase/source
   * filters and exclusions. Pure selection over the in-memory cache.
   */
  next(q: PuzzleQuery): Puzzle | null {
    const window = q.window ?? 150;
    const exclude = q.exclude ?? new Set<string>();

    const pool = this.cache.filter((p) => {
      if (exclude.has(p.id)) return false;
      if (q.source && p.source !== q.source) return false;
      if (q.themes && q.themes.length && !q.themes.some((t) => p.themes.includes(t))) return false;
      if (q.phase && phaseOf(p.fen) !== q.phase) return false;
      return true;
    });
    if (pool.length === 0) return null;

    // Prefer within the rating window; otherwise nearest by absolute distance.
    const within = pool.filter((p) => Math.abs(p.rating - q.rating) <= window);
    const candidates = within.length ? within : pool;
    candidates.sort((a, b) => Math.abs(a.rating - q.rating) - Math.abs(b.rating - q.rating));

    // Among the closest few, pick deterministically by id hash to add variety
    // without Math.random (kept pure/testable).
    const topN = candidates.slice(0, Math.min(8, candidates.length));
    const pick = topN[hashId(q.rating + (q.themes?.join() ?? '')) % topN.length];
    return pick ?? candidates[0];
  }
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
