// sessionLog store access (PR-09, ADR-0067). Same thin-repo shape as gamesRepo/attemptsRepo
// (audit W11): components never open the DB themselves.

import { openTrainerDB, type SessionLogRecord } from './db';

export async function putSessionLog(rec: SessionLogRecord): Promise<void> {
  const db = await openTrainerDB();
  await db.put('sessionLog', rec);
}

/** Newest-first session logs (endedAt index walked backwards), capped to `limit`. */
export async function recentSessionLogs(limit = 20): Promise<SessionLogRecord[]> {
  const db = await openTrainerDB();
  const out: SessionLogRecord[] = [];
  let cur = await db.transaction('sessionLog').store.index('endedAt').openCursor(null, 'prev');
  while (cur && out.length < limit) {
    out.push(cur.value);
    cur = await cur.continue();
  }
  return out;
}
