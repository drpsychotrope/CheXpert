import { closeTrainerDB, DB_NAME } from '../store/db';

/**
 * Fully reset the IndexedDB between tests: close the cached connection first so
 * deleteDatabase isn't blocked, then delete. Resolve on success/error/blocked.
 */
export async function resetDb(): Promise<void> {
  await closeTrainerDB();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
