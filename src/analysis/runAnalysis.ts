// Orchestrates the full Phase 2 loop for one game:
//   parse PGN → batch analyse → classify/tag → generate personal puzzles →
//   persist analysis + puzzles → fold motifs into the player's weakness counters.
//
// UI-agnostic; the Import view and (future) post-game review both call this.

import type { EngineClient } from '../engine/EngineClient';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import { openTrainerDB } from '../store/db';
import { parsePgn } from './pgn';
import { parse960Pgn } from './pgn960';
import { analyzeGame, engineEvaluator } from './BatchAnalyzer';
import { generatePuzzlesFromAnalysis, engineLineEvaluator } from './generatePuzzles';
import type { GameAnalysis } from './types';
import type { Puzzle } from '../trainer/puzzle';

export interface RunAnalysisInput {
  gameId: string;
  pgn: string;
  playerColor: 'w' | 'b';
  source: 'imported' | 'played';
  baseRating: number;
  now: number;
  movetimeMs?: number;
  onProgress?: (done: number, total: number) => void;
  /** PR-20 (ADR-0078): Chess960 analysis. Requires `startFen` (the persisted GameRecord field);
   *  the engine runs in UCI_Chess960 for the whole pass and is reset after (finally — the
   *  audit C-1 failure class). Absent = standard, byte-identical. */
  variant?: 'standard' | 'chess960';
  startFen?: string;
}

export interface RunAnalysisResult {
  analysis: GameAnalysis;
  puzzles: Puzzle[];
}

/** Collect FENs of existing personal puzzles so we never duplicate one. */
async function seenPersonalFens(): Promise<Set<string>> {
  const db = await openTrainerDB();
  const all = await db.getAllFromIndex('puzzles', 'source', 'personal');
  return new Set(all.map((p) => p.fen));
}

export async function runAnalysis(
  engine: EngineClient,
  repo: PuzzleRepo,
  input: RunAnalysisInput,
): Promise<RunAnalysisResult> {
  const movetimeMs = input.movetimeMs ?? 200;
  const is960 = input.variant === 'chess960';
  if (is960 && !input.startFen) throw new Error('chess960 analysis requires startFen');

  // PR-20 (ADR-0078): 960 replays through the shim parser (chess.js cannot replay 960 castling)
  // and runs the WHOLE pass in UCI_Chess960 — reset in `finally` so the shared engine can never
  // stay in the wrong mode (the audit v2 C-1 failure class).
  const game = is960 ? parse960Pgn(input.pgn, input.startFen!) : parsePgn(input.pgn);
  if (is960) await engine.setChess960();
  let analysis: GameAnalysis;
  let rawPuzzles: Puzzle[];
  try {
    analysis = await analyzeGame(input.gameId, game, engineEvaluator(engine, movetimeMs), {
      playerColor: input.playerColor,
      movetimeMs,
      source: input.source,
      onProgress: input.onProgress,
    });
    analysis.analyzedAt = input.now;

    const seen = await seenPersonalFens();
    rawPuzzles = await generatePuzzlesFromAnalysis(analysis, engineLineEvaluator(engine), {
      baseRating: input.baseRating,
      seenFens: seen,
    });
  } finally {
    if (is960) await engine.resetVariant().catch(() => {});
  }
  // 960 puzzles must be standard-engine-safe at drill time (Tactics runs chess.js/standard):
  // keep only positions with NO castling rights left; tag the survivors (additive field).
  const puzzles = is960
    ? rawPuzzles.filter((p) => p.fen.split(' ')[2] === '-').map((p) => ({ ...p, variant: 'chess960' as const }))
    : rawPuzzles;

  // Persist analysis + puzzles.
  const db = await openTrainerDB();
  await db.put('gameAnalyses', analysis);
  invalidateAnalysesCache(); // a new analysis → drop the dashboard cache (audit W15)
  if (puzzles.length) await repo.addPuzzles(puzzles);

  // Fold motif tags into the player's weakness counters. These steer the trainer's
  // weakness-biased no-drill curated selection (F3 / TR2, ADR-0055) via
  // steerFromWeakness in Tactics.loadNext. NOT a study-plan input — buildStudyPlan
  // consumes leaks + the radar, never weaknessCounters (AP-COACH-1).
  const model = await db.get('playerModel', 'singleton');
  if (model) {
    for (const ply of analysis.plies) {
      if (ply.color === analysis.playerColor && ply.motif) {
        for (const tag of ply.motif.tags) {
          model.weaknessCounters[tag] = (model.weaknessCounters[tag] ?? 0) + 1;
        }
      }
    }
    model.updatedAt = input.now;
    await db.put('playerModel', model);
  }

  return { analysis, puzzles };
}

// The (read-only) analyses are re-read by the dashboard, insights, comeback, sparring, session,
// when-to-think AND every "New game" (for opponent steering). Cache them so a heavy history isn't
// re-deserialized on each navigation; invalidate on a new analysis or a data wipe (audit W15).
let analysesCache: GameAnalysis[] | null = null;

/** Load all stored analyses (for the weakness dashboard). Cached — see invalidateAnalysesCache. */
export async function loadAllAnalyses(): Promise<GameAnalysis[]> {
  if (analysesCache) return analysesCache;
  const db = await openTrainerDB();
  analysesCache = await db.getAll('gameAnalyses');
  return analysesCache;
}

/** Drop the cached analyses (after storing a new one, or wiping all local data). */
export function invalidateAnalysesCache(): void {
  analysesCache = null;
}
