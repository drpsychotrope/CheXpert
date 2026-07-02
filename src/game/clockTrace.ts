// Per-move clock capture → %clk-annotated PGN (PR-02 play-telemetry, ADR-0060).
//
// Play records one snapshot per ply — the mover's REMAINING ms right after the clock press
// (post-increment), which is exactly Lichess/standard `[%clk H:MM:SS]` semantics. This module is
// the pure tail: format the snapshots into chess.js comments + the `TimeControl` header so the
// EXISTING consumer (`analysis/pgn.ts` parsePgn → clockMs/secondsSpent → weakness time dimension)
// reads a played game the same way it reads an imported Lichess PGN. Variant/cadence-agnostic
// (I1: PR-20 inherits this untouched for timed 960).
//
// I4 (ratified): the values come from the Clock STATE MACHINE, which Play advances with
// performance.now() deltas — never from rAF paint counts — so a backgrounded tab yields coarse
// but correct remaining times. msToClk still floors/clamps defensively (never emits a negative
// or NaN clock).

import { Chess } from 'chess.js';

/** One per-ply snapshot: which side moved and their remaining ms AFTER the press. */
export interface PlyClockSnap {
  side: 'w' | 'b';
  remainingMs: number;
}

/** Format remaining ms as a %clk body: 'H:MM:SS' (hours not padded, like Lichess exports).
 *  Defensive: non-finite / negative input clamps to 0:00:00 (I4). */
export function msToClk(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** The PGN `TimeControl` header value ("300+3") that parseIncrement() reads back. */
export function timeControlTag(initialSec: number, incrementSec: number): string {
  return `${initialSec}+${incrementSec}`;
}

/**
 * Re-emit `pgn` with one `[%clk …]` comment per ply from `trace`, plus a `TimeControl` header.
 * Pure (chess.js in, chess.js out). Robustness over completeness:
 *  - a trace shorter than the game annotates only the plies it has (never throws);
 *  - a snapshot whose `side` does not match the actual mover is SKIPPED (a desynced trace must
 *    not attach a wrong clock to a move — absent beats wrong, doctrine honnêteté);
 *  - any load/replay failure falls back to the caller keeping the original PGN (throwing here
 *    would risk the game record itself — the caller wraps in try/catch, AP-TELEM-1).
 * Standard-chess PGNs only for now (chess.js loadPgn; 960 arrives with PR-20's analysis shim).
 */
export function pgnWithClocks(pgn: string, trace: PlyClockSnap[], timeControl?: string): string {
  const src = new Chess();
  src.loadPgn(pgn); // throws on malformed — caller guards (AP-TELEM-1)
  const moves = src.history({ verbose: true }) as Array<{ san: string; color: 'w' | 'b' }>;

  const out = new Chess();
  // Carry the original headers over, then set/override TimeControl.
  const headers = src.header() as Record<string, string>;
  for (const [k, v] of Object.entries(headers)) out.header(k, v);
  if (timeControl) out.header('TimeControl', timeControl);

  for (let i = 0; i < moves.length; i++) {
    out.move(moves[i].san);
    const snap = trace[i];
    if (snap && snap.side === moves[i].color) {
      out.setComment(`[%clk ${msToClk(snap.remainingMs)}]`);
    }
  }
  return out.pgn();
}
