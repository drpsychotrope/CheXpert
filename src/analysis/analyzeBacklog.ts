// Sequential, cancellable, capped batch analysis of the played-game backlog (P1,
// play-loop-closure-spec §4.3). Closes the play→analysis loop when the user never clicked
// "Analyse this game": clear the unanalysed backlog in one user-initiated run.
//
// The engine is a SINGLE worker (app.engine) and analysis forces full strength, so the runner is
// strictly SEQUENTIAL — parallel calls would contend and stall (AP-PLAYLOOP-2). It is user-initiated
// only; the backlog is never auto-drained on finish/boot (AP-PLAYLOOP-3).
//
// The two cores keep their side-effecting dependencies (engine reset, getAnalysis read, runAnalysis
// write) INJECTABLE with production defaults, so the orchestration logic is unit-testable by
// injection — no module mocks — matching the codebase's pure-core doctrine (rand/evaluator seams).

import type { EngineClient } from '../engine/EngineClient';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import type { PlayerModel, GameRecord } from '../store/db';
import type { GameAnalysis } from './types';
import { runAnalysis as runAnalysisImpl } from './runAnalysis';
import { getAnalysis as getAnalysisImpl } from '../store/gamesRepo';

export interface AnalyzeOneOpts {
  /** Forwarded to runAnalysis for the per-position progress bar. */
  onProgress?: (done: number, total: number) => void;
  /** Movetime per position (ms); defaults to runAnalysis's 200ms. */
  movetimeMs?: number;
  /** Injectable clock for the `now` stamp (tests pass a fixed value). Defaults to Date.now. */
  now?: () => number;
  /** Seams (tests inject; production uses the real DB/pipeline). */
  getAnalysis?: (gameId: string) => Promise<GameAnalysis | undefined>;
  runAnalysis?: typeof runAnalysisImpl;
}

/**
 * The single-game core shared by the Play-tail button, the batch loop, AND auto-run (F-P1-5).
 *
 * `resetVariant()` clears any leftover 960 mode so standard analysis never runs in 960 (AP-960-4);
 * the per-game `getAnalysis` guard makes it idempotent — runAnalysis is NOT internally idempotent
 * and re-running duplicates puzzles + double-folds weaknessCounters (AP-PLAYLOOP-7). `playerColor`
 * comes from the stored GameRecord (AP-PLAYLOOP-12), guaranteed non-null when the selector fed the
 * game in.
 */
export async function analyzeOnePlayedGame(
  engine: EngineClient,
  puzzles: PuzzleRepo,
  model: PlayerModel,
  game: GameRecord,
  opts: AnalyzeOneOpts = {},
): Promise<GameAnalysis> {
  const getAnalysis = opts.getAnalysis ?? getAnalysisImpl;
  const runAnalysis = opts.runAnalysis ?? runAnalysisImpl;
  await engine.resetVariant();
  const existing = await getAnalysis(game.id);
  if (existing) return existing;
  const { analysis } = await runAnalysis(engine, puzzles, {
    gameId: game.id,
    pgn: game.pgn,
    playerColor: game.playerColor!,
    source: 'played',
    baseRating: Math.round(model.puzzleRating.rating),
    now: (opts.now ?? Date.now)(),
    movetimeMs: opts.movetimeMs ?? 200,
    onProgress: opts.onProgress,
    // PR-20 (ADR-0078): 960 games analyse through the shim parser + UCI_Chess960 — the ONE
    // call-site covers the Play button, the auto-run AND the backlog batch.
    variant: game.variant ?? 'standard',
    startFen: game.startFen,
  });
  return analysis;
}

export interface AnalyzeBacklogOpts {
  /** Max games to analyse this run; the rest are left in the backlog ("M remaining"). Default 10. */
  maxPerRun?: number;
  /** Polled BETWEEN games so a long run can be stopped cleanly (never mid-game). */
  isCancelled?: () => boolean;
  /** Per-game lifecycle for a progress UI: which game we're on, and per-position progress. */
  onGameStart?: (gameId: string, doneSoFar: number, total: number) => void;
  onPositionProgress?: (done: number, total: number) => void;
  movetimeMs?: number;
  now?: () => number;
  /** Seam: the per-game analyse function (tests inject a stub; production uses the real core). */
  analyzeOne?: (
    engine: EngineClient,
    puzzles: PuzzleRepo,
    model: PlayerModel,
    game: GameRecord,
    opts?: AnalyzeOneOpts,
  ) => Promise<GameAnalysis>;
}

export interface AnalyzeBacklogResult {
  /** Games successfully analysed (or already analysed) this run. */
  done: number;
  /** Games that threw during analysis (left in the backlog, F-P1-4). */
  failed: number;
  /** Games not processed this run: capped-out + cancelled-before + failed. */
  remaining: number;
  /** The last successfully produced/loaded analysis, for the result panel. */
  last: GameAnalysis | null;
}

/**
 * Analyse the backlog ONE game at a time (Q-C=b). Each game is wrapped in try/catch so a single
 * failure (engine crash/timeout) is counted, leaves that game in the backlog, and the loop
 * CONTINUES (F-P1-4 / AP-PLAYLOOP-14) — never stranding the games already analysed. Honours the
 * per-run cap and a cancellation flag polled between games. Returns counts + the last analysis.
 *
 * `games` must already be the selector output (standard, color-bearing, unanalysed) so every entry
 * is safe to feed to `analyzeOnePlayedGame`.
 */
export async function analyzeBacklog(
  engine: EngineClient,
  puzzles: PuzzleRepo,
  model: PlayerModel,
  games: GameRecord[],
  opts: AnalyzeBacklogOpts = {},
): Promise<AnalyzeBacklogResult> {
  const analyzeOne = opts.analyzeOne ?? analyzeOnePlayedGame;
  const maxPerRun = opts.maxPerRun ?? 10;
  const total = games.length;
  let done = 0;
  let failed = 0;
  let processed = 0; // attempts started this run (success + failure), bounded by the cap
  let last: GameAnalysis | null = null;

  // Clear 960 once up-front; analyzeOnePlayedGame also resets per game (idempotent, cheap).
  await engine.resetVariant();

  for (const game of games) {
    if (processed >= maxPerRun) break;
    if (opts.isCancelled?.()) break;
    opts.onGameStart?.(game.id, done, total);
    processed++;
    try {
      last = await analyzeOne(engine, puzzles, model, game, {
        onProgress: opts.onPositionProgress,
        movetimeMs: opts.movetimeMs,
        now: opts.now,
      });
      done++;
    } catch {
      // One game's failure must never abort the batch; count it and move on (F-P1-4). Already-
      // analysed games persist regardless — runAnalysis committed them before any later throw.
      failed++;
    }
  }

  return { done, failed, remaining: total - done, last };
}
