// Read/write helpers for the singleton player model + settings.

import { openTrainerDB, type PlayerModel, type SettingsRecord } from './db';
import { defaultRating, type Rating } from '../rating/glicko2';
import { STANDARD_POOLS, type RatingPool } from '../rating/pools';
import type { GameOutcome } from '../engine/AdaptiveOpponent';

export function freshPlayerModel(now: number): PlayerModel {
  const gameRatings: PlayerModel['gameRatings'] = {};
  const opponentByPool: PlayerModel['opponentByPool'] = {};
  for (const pool of STANDARD_POOLS) {
    gameRatings[pool] = defaultRating();
    opponentByPool[pool] = { targetElo: 1500, recent: [] };
  }
  return {
    id: 'singleton',
    puzzleRating: defaultRating(),
    gameRatings,
    opponentByPool,
    weaknessCounters: {},
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Load-path migration (spec §4.4, AP-TC-7): if a record carries the legacy single
 * `gameRating` and lacks `gameRatings`, seed the 4 standard pools from it (RD widened
 * to >= 150, since per-pool evidence is thinner than the old single rating) and seed
 * `opponentByPool` from the legacy `opponentTargetElo`/`recentOutcomes`. chess960 stays
 * absent (seeded lazily by the chess960 spec). Legacy fields are dropped. An already
 * migrated record is returned essentially unchanged. NO DB_VERSION bump.
 */
export function migratePlayerModel(raw: Record<string, unknown>): PlayerModel {
  const r = raw as Partial<PlayerModel> & {
    gameRating?: Rating;
    opponentTargetElo?: number;
    recentOutcomes?: GameOutcome[];
  };
  if (r.gameRatings && r.opponentByPool) {
    // Already in the new shape — return as a PlayerModel (defensive copy of nested maps).
    return { ...(raw as unknown as PlayerModel) };
  }

  const legacy = r.gameRating ?? defaultRating();
  const widenedRd = Math.max(legacy.rd, 150);
  const seeded: Rating = { rating: legacy.rating, rd: widenedRd, vol: legacy.vol };
  const targetElo = r.opponentTargetElo ?? Math.round(legacy.rating);
  const recent = r.recentOutcomes ?? [];

  const gameRatings: PlayerModel['gameRatings'] = {};
  const opponentByPool: PlayerModel['opponentByPool'] = {};
  for (const pool of STANDARD_POOLS) {
    gameRatings[pool] = { ...seeded };
    opponentByPool[pool] = { targetElo, recent: [...recent] };
  }

  return {
    id: 'singleton',
    puzzleRating: r.puzzleRating ?? defaultRating(),
    gameRatings,
    opponentByPool,
    weaknessCounters: r.weaknessCounters ?? {},
    onboarded: r.onboarded ?? false,
    createdAt: r.createdAt ?? Date.now(),
    updatedAt: r.updatedAt ?? Date.now(),
  };
}

/** The game rating for a pool, falling back to the nearest seeded standard pool, then defaultRating(). */
export function poolRating(m: PlayerModel, pool: RatingPool): Rating {
  const direct = m.gameRatings[pool];
  if (direct) return direct;
  for (const p of STANDARD_POOLS) {
    const r = m.gameRatings[p];
    if (r) return r;
  }
  return defaultRating();
}

/** The adaptive-opponent state for a pool, falling back to nearest seeded pool, then a 1500 seed. */
export function poolOpponent(m: PlayerModel, pool: RatingPool): { targetElo: number; recent: GameOutcome[] } {
  const direct = m.opponentByPool[pool];
  if (direct) return direct;
  for (const p of STANDARD_POOLS) {
    const o = m.opponentByPool[p];
    if (o) return o;
  }
  return { targetElo: 1500, recent: [] };
}

export function freshSettings(): SettingsRecord {
  return { id: 'singleton', coachedMode: false, allowNetwork: false, boardOrientation: 'white', opponentStyle: 'human', metacogEnabled: false };
}

export async function loadPlayerModel(now: number): Promise<PlayerModel> {
  const db = await openTrainerDB();
  const existing = await db.get('playerModel', 'singleton');
  if (existing) return migratePlayerModel(existing as unknown as Record<string, unknown>);
  const fresh = freshPlayerModel(now);
  await db.put('playerModel', fresh);
  return fresh;
}

export async function savePlayerModel(model: PlayerModel, now: number): Promise<void> {
  const db = await openTrainerDB();
  await db.put('playerModel', { ...model, updatedAt: now });
}

export async function loadSettings(): Promise<SettingsRecord> {
  const db = await openTrainerDB();
  const existing = await db.get('settings', 'singleton');
  if (existing) return existing;
  const fresh = freshSettings();
  await db.put('settings', fresh);
  return fresh;
}

export async function saveSettings(s: SettingsRecord): Promise<void> {
  const db = await openTrainerDB();
  await db.put('settings', s);
}

/** Privacy / data-control: wipe everything local (spec §4.10 Settings).
 * Iterates every object store (so stores added in later phases are covered
 * automatically) and also clears the separate Syzygy tablebase cache DB. */
export async function clearAllData(): Promise<void> {
  const db = await openTrainerDB();
  await Promise.all([...db.objectStoreNames].map((name) => db.clear(name)));
  // The tablebase cache lives in its own IndexedDB (endgame/tablebaseCache.ts).
  const { tbCacheClear } = await import('../endgame/tablebaseCache');
  await tbCacheClear();
}
