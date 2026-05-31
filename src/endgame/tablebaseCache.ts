// IndexedDB-backed cache for Syzygy results (AP-CHESS-14). Stored in a tiny
// dedicated store created lazily inside the existing DB connection is awkward with
// the typed schema, so we keep the cache in the `settings`-adjacent space via a
// simple keyed store. To avoid another migration, we serialize the cache map into
// a single record in `settings`? No — that grows unbounded. Instead we use a
// separate IndexedDB database dedicated to the cache, opened on demand.

import { openDB, type IDBPDatabase } from 'idb';
import type { TablebaseResult } from './syzygy';

const CACHE_DB = 'chess-trainer-tbcache';
const STORE = 'tb';

let cachePromise: Promise<IDBPDatabase> | null = null;

function cacheDB(): Promise<IDBPDatabase> {
  if (!cachePromise) {
    cachePromise = openDB(CACHE_DB, 1, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
  }
  return cachePromise;
}

export async function tbCacheGet(fen: string): Promise<TablebaseResult | undefined> {
  const db = await cacheDB();
  return db.get(STORE, fen);
}

export async function tbCacheSet(fen: string, result: TablebaseResult): Promise<void> {
  const db = await cacheDB();
  // Don't store the transient `cached` flag.
  const { cached: _cached, ...clean } = result;
  void _cached;
  await db.put(STORE, clean, fen);
}

export async function tbCacheClear(): Promise<void> {
  const db = await cacheDB();
  await db.clear(STORE);
}

export async function closeTbCache(): Promise<void> {
  if (cachePromise) {
    (await cachePromise).close();
    cachePromise = null;
  }
}
