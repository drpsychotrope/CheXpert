// Full-profile backup/restore (PR-01 data-backup, ADR-0059). One JSON snapshot of every object
// store in the main DB, and a replace-everything restore. This is the safety net for a local-only
// app whose IndexedDB is keyed to the origin (ADR-0049): one browser-storage wipe would otherwise
// destroy months of training history with no recourse.
//
// Deliberate exclusions:
//  - The Syzygy tablebase cache lives in its OWN IndexedDB (`chess-trainer-tbcache`,
//    endgame/tablebaseCache.ts) and is a re-fetchable cache, not profile data — excluded (I2).
//    The privacy wipe (ADR-0013) still clears it.
//  - Curated puzzles: the shipped ~80k-row asset is re-seeded by PuzzleRepo.init() whenever the
//    store has no curated rows, and would bloat the file by ~15–20 MB. Only PERSONAL puzzles
//    (mined from your games) are profile data (AP-BACKUP-4).
//
// No Date.now() in here — `now` is injected at the call boundary (AP-BACKUP-5).

import { openTrainerDB, DB_VERSION } from './db';

export const BACKUP_MARKER = 'chess-trainer-backup';

export interface BackupFile {
  marker: typeof BACKUP_MARKER;
  /** DB_VERSION at export time. A backup from a NEWER schema than the running app is refused
   *  (I5) — additive migrations only run forward. Older backups load fine (absent stores are
   *  simply cleared; absent fields read `?? default` at the sites). */
  schema: number;
  exportedAt: number;
  stores: Record<string, unknown[]>;
}

export type BackupError = 'not-a-backup' | 'newer-schema' | 'malformed';

/** Pure validation of a parsed JSON value as a restorable backup. The version guard (I5) refuses
 *  a backup written by a newer schema instead of importing it "best effort" (AP-BACKUP-3). */
export function validateBackup(
  raw: unknown,
  currentSchema: number = DB_VERSION,
): { ok: true; backup: BackupFile } | { ok: false; error: BackupError } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'not-a-backup' };
  const b = raw as Partial<BackupFile>;
  if (b.marker !== BACKUP_MARKER) return { ok: false, error: 'not-a-backup' };
  if (typeof b.schema !== 'number' || !Number.isFinite(b.schema)) return { ok: false, error: 'malformed' };
  if (b.schema > currentSchema) return { ok: false, error: 'newer-schema' };
  if (typeof b.stores !== 'object' || b.stores === null || Array.isArray(b.stores)) {
    return { ok: false, error: 'malformed' };
  }
  for (const rows of Object.values(b.stores)) {
    if (!Array.isArray(rows)) return { ok: false, error: 'malformed' };
  }
  return { ok: true, backup: b as BackupFile };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Deterministic download filename derived from the injected `now` (pure, unit-testable —
 *  mirrors pgnFilename, AP-GAMES-6). */
export function backupFilename(now: number): string {
  const d = new Date(now);
  return `chess-trainer-backup-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
}

/** Snapshot every store of the main DB into one JSON string. Iterates `objectStoreNames`
 *  dynamically (precedent: clearAllData, ADR-0013) so a store added in a later phase is covered
 *  automatically (AP-BACKUP-1). The `puzzles` store is filtered to personal-only (AP-BACKUP-4). */
export async function exportAll(now: number): Promise<string> {
  const db = await openTrainerDB();
  const stores: Record<string, unknown[]> = {};
  for (const name of [...db.objectStoreNames]) {
    if (name === 'puzzles') {
      stores[name] = await db.getAllFromIndex('puzzles', 'source', 'personal');
    } else {
      stores[name] = await db.getAll(name as never);
    }
  }
  const backup: BackupFile = { marker: BACKUP_MARKER, schema: DB_VERSION, exportedAt: now, stores };
  return JSON.stringify(backup);
}

export interface RestoreResult {
  /** Records written per store. */
  restored: Record<string, number>;
  /** Store names present in the backup but unknown to the live DB (written by a same-or-older
   *  schema that had a store this build doesn't — skipped, never guessed at). */
  skipped: string[];
}

/** Replace-everything restore (AP-BACKUP-2): clear EVERY live store (so a store absent from the
 *  backup ends empty — the restore reproduces the backup's state, not a hybrid), then write the
 *  backup's records. Curated puzzles re-seed on next boot via PuzzleRepo.init() (count===0 path).
 *  Callers must validate first (validateBackup) and reload the app after (mirrors the wipe). */
export async function importAll(backup: BackupFile): Promise<RestoreResult> {
  const db = await openTrainerDB();
  const live = new Set<string>([...db.objectStoreNames]);
  const restored: Record<string, number> = {};
  const skipped: string[] = [];

  await Promise.all([...live].map((name) => db.clear(name as never)));

  for (const [name, rows] of Object.entries(backup.stores)) {
    if (!live.has(name)) {
      skipped.push(name);
      continue;
    }
    const tx = db.transaction(name as never, 'readwrite');
    await Promise.all(rows.map((r) => (tx.store as { put(v: unknown): Promise<unknown> }).put(r)));
    await tx.done;
    restored[name] = rows.length;
  }

  // Drop the in-memory analyses cache so the restored state is visible immediately (mirror of
  // clearAllData, audit W15). The tbcache is untouched — it is not profile data (I2).
  const { invalidateAnalysesCache } = await import('../analysis/runAnalysis');
  invalidateAnalysesCache();

  return { restored, skipped };
}
