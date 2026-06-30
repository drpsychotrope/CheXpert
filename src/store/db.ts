// IndexedDB persistence via idb (spec AP-CHESS-3: never localStorage for volume).
//
// Schema v4. The upgrade() switch is a fallthrough ladder so each phase appends
// cases without rewriting earlier ones. Migrations must never drop existing data.
//   v1 (Phase 1): games, puzzleAttempts, puzzles, playerModel, settings
//   v2 (Phase 2): importedGames, gameAnalyses
//   v3 (Phase 3): srsCards, repertoire
//   v4 (Phase 4): woodpeckerSets

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Rating } from '../rating/glicko2';
import type { RatingPool } from '../rating/pools';
import type { GameOutcome } from '../engine/AdaptiveOpponent';
import type { Category } from '../clock/categories';
import type { Puzzle } from '../trainer/puzzle';
import type { GameAnalysis } from '../analysis/types';
import type { SrsCardRecord } from '../srs/types';
import type { RepertoireLine } from '../repertoire/types';
import type { WoodpeckerSet } from '../woodpecker/types';

export interface GameRecord {
  id: string;
  pgn: string;
  result: 'win' | 'loss' | 'draw';
  botElo: number;
  playedAt: number;
  coached: boolean;
  /** Set when the player used an in-play takeback (P2/ADR-0058); the game is persisted but its
   *  rating update is skipped. Additive — absent reads `?? false`. NO DB_VERSION bump. */
  unrated?: boolean;
  /** Time control this game was played under (absent on legacy records = untimed classical). */
  timeControl?: { initialSec: number; incrementSec: number; category: Category; untimed?: boolean };
  /** Chess960 (ADR-0041): default 'standard'. Additive — no DB_VERSION bump. */
  variant?: 'standard' | 'chess960';
  /** The 960 start FEN, for replay/audit. Present only when variant==='chess960'. */
  startFen?: string;
  /** Side the human played (F5, ADR-0056). Persisted so re-analysing a game from history attributes
   *  mistakes to the right colour — the played PGN has no White/Black headers to infer it from.
   *  Additive optional; legacy records lack it (history derives a fallback). NO DB_VERSION bump. */
  playerColor?: 'w' | 'b';
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
  // metacognition: optional, additive — no migration (ADR-0037).
  confidence?: 'sure' | 'unsure' | 'guess'; // self-reported before the reveal; absent on legacy records
  selfTag?: string; // self-diagnosed cause (closed taxonomy key); absent on legacy / when skipped
  /** True when this attempt came from a coach diagnostic probe (F3, ADR-0055). Provenance tag
   *  ONLY — probes are graded into FSRS + weaknessCounters but never move the rating pools
   *  (AP-COACH-8). Additive optional; absent on legacy/normal attempts reads falsy. No `source`
   *  union change (AP-ATTEMPT-5), NO DB_VERSION bump. */
  coachProbe?: boolean;
  /** True when the player took a hint (any tier) on this attempt (T3/TR5, Q-B). A hinted SOLVE
   *  is graded FSRS ≤ Hard and skips the Glicko gain (rating flat) so a hint can't inflate the
   *  measurement (AP-TINTEG-1). Provenance tag ONLY. Additive optional; absent on legacy/unaided
   *  attempts reads falsy. Mirrors `coachProbe?` — NO `source` union change, NO DB_VERSION bump. */
  usedHint?: boolean;
}

export interface PlayerModel {
  id: 'singleton';
  puzzleRating: Rating;
  /** Per-time-control game ratings (spec §4.4). chess960 seeded lazily. */
  gameRatings: Partial<Record<RatingPool, Rating>>;
  /** Per-pool adaptive-opponent state (target Elo + rolling outcomes). */
  opponentByPool: Partial<Record<RatingPool, { targetElo: number; recent: GameOutcome[] }>>;
  /** Nascent weakness counters keyed by theme — Phase 2 fleshes this out. */
  weaknessCounters: Record<string, number>;
  /** Resolved motif keys whose concept card has already been offered at first-exposure
   *  (ADR-0040). Additive; old records lack it and read `?? []`. NO DB_VERSION bump. */
  conceptSeen?: string[];
  /** Per-drill board-vision stats (ADR-0043). Additive; old records read `?? {}`. NO DB_VERSION bump. */
  visionStats?: import('../vision/visionStats').VisionStats;
  /** Coach mode (ADR-0045): last assessment + the prior one for a delta. Additive;
   *  old records lack it and read `undefined`. NO DB_VERSION bump. */
  coachProfile?: import('../coach/types').CoachProfile;
  coachProfilePrev?: import('../coach/types').CoachProfile;
  /** Day-based training retention (T3/TR8, Q-C/Q-E). Additive optional, backfilled in the load
   *  path (playerModel.ts) with schemaRev 1→2 — old records read the defaults; NO DB_VERSION bump
   *  (mirrors `conceptSeen?`). Named `dailyStreak` (NOT bare `streak`, which is Vision's in-drill
   *  counter — AP-TINTEG-4). `dailyStreak`: consecutive training days; `dailyGoal`: puzzles/day
   *  target (absent reads as the default 10); `lastTrainedAt`: epoch ms of the last training day
   *  used to roll the streak. */
  dailyStreak?: number;
  dailyGoal?: number;
  lastTrainedAt?: number;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
  /** Data-shape revision of this singleton (audit W13). Additive fields bump it and are
   *  backfilled in the load path; a destructive store change bumps DB_VERSION instead. */
  schemaRev?: number;
}

export interface SettingsRecord {
  id: 'singleton';
  coachedMode: boolean;
  /** Telemetry/analysis stays local; nothing leaves the device unless true. */
  allowNetwork: boolean;
  boardOrientation: 'white' | 'black';
  /** Play opponent style: 'human' = top moves sampled by temperature (varied);
   *  'engine' = always the best move at the current Elo. */
  opponentStyle?: 'human' | 'engine';
  /** Last time control chosen on the Play screen, restored as the default on mount (spec §4.5). */
  lastTimeControl?: { initialSec: number; incrementSec: number };
  /** Opt-in: show confidence/error-cause chips on puzzles (default false). ADR-0037. */
  metacogEnabled?: boolean;
  /** UI language (V2-W18, ADR-0053 — supersedes ADR-0052 Q3 mono-locale). Additive; a
   *  legacy/absent value reads as the default 'fr'. No DB_VERSION bump (read-site `?? 'fr'`). */
  locale?: 'fr' | 'en';
  /** Trainer source preference (T2/TR9): which puzzle source the trainer draws from when no
   *  dashboard drill is active. Maps 1:1 onto PuzzleQuery.source ('mixed' -> undefined). Additive
   *  optional; a legacy/absent value reads as the default 'mixed' (read-site `?? 'mixed'`) so a
   *  fresh/legacy profile still sees its personal puzzles (AP-TPERS-12). NO DB_VERSION bump,
   *  mirrors `locale?` (precedent ADR-0037/0040/0043/0053). */
  trainerSource?: 'mixed' | 'personal' | 'curated';
  /** Opt-in: analyse a played game automatically the moment it finishes (P1, play-loop-closure
   *  §4.6). When true, ONLY the just-finished game is analysed (never the backlog — heavy, Q-C);
   *  960 games never auto-run. Additive optional; a legacy/absent value reads as the default false
   *  (read-site `?? false`). NO DB_VERSION bump (mirrors `metacogEnabled?`/`opponentStyle?`). */
  autoAnalyzeOnFinish?: boolean;
  /** Opt-in: allow on-demand takeback during a normal game (P2). Default false (read-site
   *  `?? false`). A takeback in a rated game marks that game un-counted (ADR-0058). No DB_VERSION
   *  bump (mirrors `metacogEnabled?`/`autoAnalyzeOnFinish?`). */
  takebackInPlay?: boolean;
  /** Data-shape revision (audit W13). See PlayerModel.schemaRev. */
  schemaRev?: number;
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
  srsCards: { key: string; value: SrsCardRecord; indexes: { due: number; kind: string } };
  repertoire: { key: string; value: RepertoireLine; indexes: { color: string } };
  woodpeckerSets: { key: string; value: WoodpeckerSet; indexes: { createdAt: number } };
}

export const DB_NAME = 'chess-trainer';
// Migration policy (audit W13):
//  - ADDITIVE change (new optional field on an existing store) → add the field + bump the
//    record's `schemaRev`, backfilled in the load path (playerModel.ts). NO DB_VERSION bump.
//  - DESTRUCTIVE change (drop/rename/reindex a store) → bump DB_VERSION + add an `upgrade` block.
export const DB_VERSION = 4;

/** Thrown when IndexedDB cannot be opened (private browsing, storage disabled by
 *  policy, quota, or a failed upgrade). The boot path catches it to degrade with an
 *  explicit message instead of hanging forever on "Loading…" (audit W2). */
export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      'Storage (IndexedDB) is unavailable — the app cannot save your progress. ' +
        'This usually means private/incognito browsing or disabled site storage.',
    );
    this.name = 'StorageUnavailableError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

// Cached single connection. Opening a fresh connection per call leaks handles
// and, critically, blocks deleteDatabase (which matters for clean test resets).
let dbPromise: Promise<IDBPDatabase<TrainerDB>> | null = null;

export function openTrainerDB(): Promise<IDBPDatabase<TrainerDB>> {
  if (!dbPromise) {
    dbPromise = createDB().catch((e) => {
      dbPromise = null; // allow a later retry rather than caching the failure forever
      throw e instanceof StorageUnavailableError ? e : new StorageUnavailableError(e);
    });
  }
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
      // v3 — Phase 3 stores. Additive only; v1/v2 data is preserved.
      if (oldVersion < 3) {
        const srs = db.createObjectStore('srsCards', { keyPath: 'id' });
        srs.createIndex('due', 'due'); // epoch ms — query the due queue cheaply
        srs.createIndex('kind', 'kind');
        const rep = db.createObjectStore('repertoire', { keyPath: 'id' });
        rep.createIndex('color', 'color');
      }
      // v4 — Phase 4 (Woodpecker). Additive only; prior data preserved.
      if (oldVersion < 4) {
        const wp = db.createObjectStore('woodpeckerSets', { keyPath: 'id' });
        wp.createIndex('createdAt', 'createdAt');
      }
    },
  });
}

export type { TrainerDB };
