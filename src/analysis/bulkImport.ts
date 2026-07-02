// Sequential, cancellable bulk import (PR-06 bulk-import, ADR-0064). Turns a multi-game PGN
// (Lichess/Chess.com "export all", studies) into N analysed imports in ONE user action — the
// cold-start unlock: a real weakness profile from your history on day 1 instead of game 21.
//
// Mirrors analyzeBacklog's shape (P1): strictly SEQUENTIAL (single engine worker,
// AP-PLAYLOOK-2 precedent), cancellable BETWEEN games (never mid-game), every game wrapped in
// try/catch so one bad PGN never aborts the batch, and all side-effecting deps injectable with
// production defaults so the loop is unit-testable by injection (no module mocks).
//
// Honesty invariant carried over from audit v2 C-3: a game whose colour cannot be determined is
// SKIPPED AND COUNTED, never guessed — one wrongly-attributed game corrupts the whole profile.

import type { EngineClient } from '../engine/EngineClient';
import type { PuzzleRepo } from '../trainer/PuzzleRepo';
import type { GameAnalysis } from './types';
import { parsePgn as parsePgnImpl, inferPlayerColor } from './pgn';
import { runAnalysis as runAnalysisImpl } from './runAnalysis';
import { getAnalysis as getAnalysisImpl, putImportedGame as putImportedGameImpl } from '../store/gamesRepo';

/** Split a raw paste/file into individual PGN games on `[Event` boundaries (the exact heuristic
 *  Import.svelte shipped for detection — extracted pure so the bulk loop and the UI share it). */
export function splitPgnGames(raw: string): string[] {
  return raw
    .split(/\n\s*\n(?=\[Event\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** djb2 — content-addresses an import so re-analysing the same PGN overwrites itself while
 *  distinct games never collide (audit v2 P1-11; moved here from Import.svelte, same output). */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The content-addressed import id (single source of truth for single AND bulk imports). */
export function importGameId(headers: Record<string, string>, source: string): string {
  return `import:${headers.White ?? '?'}-${headers.Black ?? '?'}-${shortHash(source)}`;
}

export interface ImportBulkOpts {
  /** Polled BETWEEN games so a long run can be stopped cleanly. */
  isCancelled?: () => boolean;
  /** Which game the loop is on (1-based), for the "game i/N" progress line. */
  onGameStart?: (index: number, total: number) => void;
  onPositionProgress?: (done: number, total: number) => void;
  movetimeMs?: number;
  now?: () => number;
  /** Seams (tests inject; production uses the real pipeline/DB). */
  parse?: typeof parsePgnImpl;
  runAnalysis?: typeof runAnalysisImpl;
  getAnalysis?: typeof getAnalysisImpl;
  putImportedGame?: typeof putImportedGameImpl;
}

export interface ImportBulkResult {
  analyzed: number;
  /** Colour undeterminable (auto mode, no header match) — skipped, never guessed (audit C-3). */
  skippedColor: number;
  /** Already analysed (same content hash) — idempotent re-import. */
  skippedDup: number;
  /** Parse errors / empty movetexts / analysis throws — counted, batch continues. */
  failed: number;
  /** Personal puzzles generated across the run. */
  puzzles: number;
  /** Last produced analysis, for the result panel. */
  last: GameAnalysis | null;
}

/**
 * Import + analyse `sources` one game at a time. `colorChoice` 'auto' infers per game from the
 * headers vs `playerName` (a mixed archive attributes each game correctly); an explicit 'w'/'b'
 * is honoured for every game (the UI labels it as such).
 */
export async function importBulk(
  engine: EngineClient,
  puzzles: PuzzleRepo,
  baseRating: number,
  sources: string[],
  playerName: string,
  colorChoice: 'auto' | 'w' | 'b',
  opts: ImportBulkOpts = {},
): Promise<ImportBulkResult> {
  const parse = opts.parse ?? parsePgnImpl;
  const runAnalysis = opts.runAnalysis ?? runAnalysisImpl;
  const getAnalysis = opts.getAnalysis ?? getAnalysisImpl;
  const putImportedGame = opts.putImportedGame ?? putImportedGameImpl;
  const now = opts.now ?? Date.now;

  const res: ImportBulkResult = { analyzed: 0, skippedColor: 0, skippedDup: 0, failed: 0, puzzles: 0, last: null };
  const total = sources.length;

  // Clear any leftover 960 mode once up-front (AP-960-4); cheap and idempotent.
  await engine.resetVariant();

  for (let i = 0; i < total; i++) {
    if (opts.isCancelled?.()) break;
    opts.onGameStart?.(i + 1, total);
    const source = sources[i];
    try {
      const parsed = parse(source);
      if (parsed.plies.length === 0) {
        res.failed++; // headers-only PGN: nothing to analyse (audit v2 L21 — never persist junk)
        continue;
      }
      const color = colorChoice === 'auto' ? inferPlayerColor(parsed.headers, playerName) : colorChoice;
      if (!color) {
        res.skippedColor++; // cannot determine the side — refuse to guess (audit C-3)
        continue;
      }
      const gameId = importGameId(parsed.headers, source);
      if (await getAnalysis(gameId)) {
        res.skippedDup++; // same content already analysed — idempotent
        continue;
      }
      const stamp = now();
      await putImportedGame({ id: gameId, pgn: source, playerColor: color, headers: parsed.headers, importedAt: stamp, analyzed: false });
      const out = await runAnalysis(engine, puzzles, {
        gameId,
        pgn: source,
        playerColor: color,
        source: 'imported',
        baseRating,
        now: stamp,
        movetimeMs: opts.movetimeMs ?? 200,
        onProgress: opts.onPositionProgress,
      });
      await putImportedGame({ id: gameId, pgn: source, playerColor: color, headers: parsed.headers, importedAt: stamp, analyzed: true });
      res.analyzed++;
      res.puzzles += out.puzzles.length;
      res.last = out.analysis;
    } catch {
      res.failed++; // one bad game never aborts the batch (F-P1-4 precedent)
    }
  }
  return res;
}
