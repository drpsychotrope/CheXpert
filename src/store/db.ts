// IndexedDB persistence via idb (spec AP-CHESS-3: never localStorage for volume).
//
// Schema v2. The upgrade() switch is a fallthrough ladder so each phase appends
// cases without rewriting earlier ones. Migrations must never drop existing data.
//   v1 (Phase 1): games, puzzleAttempts, puzzles, playerModel, settings
//   v2 (Phase 2): importedGames, gameAnalyses

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Rating } from '../rating/glicko2';
import type { Puzzle } from '../trainer/puzzle';
import type { GameAnalysis } from '../analysis/types';

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

/** A PGN brought in for analysis (Phase 2). Raw source + which side the user was. */
export interface ImportedGameRecord {
  id: string;
  pgn: string;
  playerColor: 'w' | 'b';
  headers: Record<string, string>;
  importedAt: number;
  analyzed: boolean;
}

interface TrainerDB extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { playedAt: number } };
  puzzleAttempts: { key: string; value: PuzzleAttemptRecord; indexes: { puzzleId: string; playedAt: number } };
  puzzles: { key: string; value: Puzzle; indexes: { rating: number; source: string } };
  playerModel: { key: string; value: PlayerModel };
  settings: { key: string; value: SettingsRecord };
  importedGames: { key: string; value: ImportedGameRecord; indexes: { importedAt: number } };
  gameAnalyses: { key: string; value: GameAnalysis; indexes: { analyzedAt: number } };
}

export const DB_NAME = 'chess-trainer';
export const DB_VERSION = 2;

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
      // v2 — Phase 2 stores. Additive only; v1 data is preserved.
      if (oldVersion < 2) {
        const ig = db.createObjectStore('importedGames', { keyPath: 'id' });
        ig.createIndex('importedAt', 'importedAt');
        const ga = db.createObjectStore('gameAnalyses', { keyPath: 'gameId' });
        ga.createIndex('analyzedAt', 'analyzedAt');
      }
      // Phase 3 will add: if (oldVersion < 3) { srsCards, repertoire ... }
    },
  });
}

export type { TrainerDB };
