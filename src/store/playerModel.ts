// Read/write helpers for the singleton player model + settings.

import { openTrainerDB, type PlayerModel, type SettingsRecord } from './db';
import { defaultRating } from '../rating/glicko2';

export function freshPlayerModel(now: number): PlayerModel {
  return {
    id: 'singleton',
    puzzleRating: defaultRating(),
    gameRating: defaultRating(),
    opponentTargetElo: 1500,
    recentOutcomes: [],
    weaknessCounters: {},
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function freshSettings(): SettingsRecord {
  return { id: 'singleton', coachedMode: false, allowNetwork: false, boardOrientation: 'white' };
}

export async function loadPlayerModel(now: number): Promise<PlayerModel> {
  const db = await openTrainerDB();
  const existing = await db.get('playerModel', 'singleton');
  if (existing) return existing;
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

/** Privacy / data-control: wipe everything local (spec §4.10 Settings). */
export async function clearAllData(): Promise<void> {
  const db = await openTrainerDB();
  await Promise.all([
    db.clear('games'),
    db.clear('puzzleAttempts'),
    db.clear('playerModel'),
    db.clear('settings'),
  ]);
}
