// IndexedDB persistence via idb (spec AP-CHESS-3: never localStorage for volume).
//
// Schema v1 (Phase 1). The upgrade() switch is written as a fallthrough ladder so
// Phase 2 (v2: importedGames, per-ply evals) and Phase 3 (v3: srsCards, repertoire)
// can append cases without rewriting v1. Migrations must never drop existing data.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Rating } from '../rating/glicko2';
import type { Puzzle } from '../trainer/puzzle';

export interface GameRecord {
  id: string;
  pgn: string;
  result: 'win' | 'loss' | 'draw';
  botElo: number;
  playedAt: number;
  coached: boolean;
}

export interface PuzzleAttemptRecord {
  id: string; // `${puzzleId}:${playedAt}`
  puzzleId: string;
  solved: boolean;
  ms: number;
  themes: string[];
  ratingBefore: number;
  ratingAfter: number;
  playedAt: number;
  source: 'curated' | 'personal';
}

export interface PlayerModel {
  id: 'singleton';
  puzzleRating: Rating;
  gameRating: Rating;
  opponentTargetElo: number;
  recentOutcomes: ('win' | 'loss' | 'draw')[];
  /** Nascent weakness counters keyed by theme — Phase 2 fleshes this out. */
  weaknessCounters: Record<string, number>;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SettingsRecord {
  id: 'singleton';
  coachedMode: boolean;
  /** Telemetry/analysis stays local; nothing leaves the device unless true. */
  allowNetwork: boolean;
  boardOrientation: 'white' | 'black';
}

interface TrainerDB extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { playedAt: number } };
  puzzleAttempts: { key: string; value: PuzzleAttemptRecord; indexes: { puzzleId: string; playedAt: number } };
  puzzles: { key: string; value: Puzzle; indexes: { rating: number; source: string } };
  playerModel: { key: string; value: PlayerModel };
  settings: { key: string; value: SettingsRecord };
}

export const DB_NAME = 'chess-trainer';
export const DB_VERSION = 1;

// Cached single connection. Opening a fresh connection per call leaks handles
// and, critically, blocks deleteDatabase (which matters for clean test resets).
let dbPromise: Promise<IDBPDatabase<TrainerDB>> | null = null;

export function openTrainerDB(): Promise<IDBPDatabase<TrainerDB>> {
  if (!dbPromise) dbPromise = createDB();
  return dbPromise;
}

/** Close the cached connection (tests call this before deleteDatabase). */
export async function closeTrainerDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

function createDB(): Promise<IDBPDatabase<TrainerDB>> {
  return openDB<TrainerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1 — Phase 1 stores.
      if (oldVersion < 1) {
        const games = db.createObjectStore('games', { keyPath: 'id' });
        games.createIndex('playedAt', 'playedAt');

        const pa = db.createObjectStore('puzzleAttempts', { keyPath: 'id' });
        pa.createIndex('puzzleId', 'puzzleId');
        pa.createIndex('playedAt', 'playedAt');

        const puz = db.createObjectStore('puzzles', { keyPath: 'id' });
        puz.createIndex('rating', 'rating');
        puz.createIndex('source', 'source');

        db.createObjectStore('playerModel', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      // Phase 2 will add: if (oldVersion < 2) { importedGames, plyEvals ... }
      // Phase 3 will add: if (oldVersion < 3) { srsCards, repertoire ... }
    },
  });
}

export type { TrainerDB };
