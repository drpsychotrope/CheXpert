// Annotated-replay selectors (PR-08 annotated-replay, ADR-0066). Pure helpers that turn the
// stored per-ply analysis (types the UI never surfaced move-by-move) into displayable pieces:
// NAG glyphs, a White-POV eval label, and paired move rows. No engine at replay time — everything
// was persisted by the batch pass (same doctrine as WhenToThink, ADR-0038).

import type { PlyAnalysis, Severity } from './types';

/** Standard NAG glyph for a classified move ('' for best/good — no noise on fine moves). */
export function nagFor(sev: Severity): '' | '?!' | '?' | '??' {
  return sev === 'inaccuracy' ? '?!' : sev === 'mistake' ? '?' : sev === 'blunder' ? '??' : '';
}

/** Eval label after the move, White POV: mate distance when present ('M3' / '-M2' from the
 *  mover POV is confusing — the stored `mate` is at fenBefore for the mover, so for the simple
 *  replay line we show the resulting centipawn eval, which BatchAnalyzer clamps for mates). */
export function evalLabel(p: PlyAnalysis): string {
  const pawns = p.playedWhiteCp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(1)}`;
}

export interface MoveRowHalf {
  /** Index into analysis.plies. */
  i: number;
  san: string;
  nag: '' | '?!' | '?' | '??';
  severity: Severity;
  /** True when this ply was the analysed player's move (the UI badges those). */
  mine: boolean;
}

export interface MoveRow {
  n: number; // full-move number
  white?: MoveRowHalf;
  black?: MoveRowHalf;
}

/** Pair plies into "n. white black" rows (handles a Black-to-move start via moveNumber/color). */
export function moveRows(plies: PlyAnalysis[], playerColor: 'w' | 'b'): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < plies.length; i++) {
    const p = plies[i];
    const half: MoveRowHalf = { i, san: p.san, nag: nagFor(p.severity), severity: p.severity, mine: p.color === playerColor };
    let row = rows[rows.length - 1];
    if (!row || row.n !== p.moveNumber) {
      row = { n: p.moveNumber };
      rows.push(row);
    }
    if (p.color === 'w') row.white = half;
    else row.black = half;
  }
  return rows;
}

/** Clamp a replay cursor into [-1, plies.length - 1] (-1 = the starting position). */
export function clampIndex(i: number, plyCount: number): number {
  return Math.max(-1, Math.min(plyCount - 1, Math.trunc(i)));
}
