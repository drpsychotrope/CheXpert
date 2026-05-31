// Orchestrates the full Phase 2 loop for one game:
//   parse PGN → batch analyse → classify/tag → generate personal puzzles →
//   persist analysis + puzzles → fold motifs into the player's weakness counters.
//
// UI-agnostic; the Import view and (future) post-game review both call this.

import type { EngineClient } from '../engine/EngineClient';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import { openTrainerDB } from '../store/db';
import { parsePgn } from './pgn';
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
  const game = parsePgn(input.pgn);

  const analysis = await analyzeGame(input.gameId, game, engineEvaluator(engine, movetimeMs), {
    playerColor: input.playerColor,
    movetimeMs,
    source: input.source,
    onProgress: input.onProgress,
  });
  analysis.analyzedAt = input.now;

  const seen = await seenPersonalFens();
  const puzzles = await generatePuzzlesFromAnalysis(analysis, engineLineEvaluator(engine), {
    baseRating: input.baseRating,
    seenFens: seen,
  });

  // Persist analysis + puzzles.
  const db = await openTrainerDB();
  await db.put('gameAnalyses', analysis);
  if (puzzles.length) await repo.addPuzzles(puzzles);

  // Fold motif tags into the player's weakness counters (used by the trainer's
  // personalised selection and the dashboard).
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

/** Load all stored analyses (for the weakness dashboard). */
export async function loadAllAnalyses(): Promise<GameAnalysis[]> {
  const db = await openTrainerDB();
  return db.getAll('gameAnalyses');
}
