// Client-side text export primitive (F5, ADR-0056; generalised in C8, ADR-0054). Local-first PWA:
// nothing leaves the device — export is a Blob → object-URL → anchor click, no server round-trip
// (AP-GAMES-9 / AP-CFUNNEL-7). The stored `GameRecord.pgn` is already a valid chess.js-serialised
// PGN, so export downloads it verbatim; we never re-serialise (AP-GAMES-2).
//
// C8 (FOLD-C6): the generic `downloadText` here is the one Blob/object-URL primitive both F5's PGN
// download and C8's coach-profile JSON export use — reuse-if-shipped (this file existed), no second
// implementation (AP-CFUNNEL-11). `downloadPgn` is now a thin wrapper over it.

/** Pad a 1–2 digit date part to 2 chars (local, no Intl dependency — keeps the filename stable). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Trigger a client-side download of arbitrary text `content` as `filename` with the given `mime`.
 * DOM side-effect only (no pure logic here); SSR/jsdom-safe via a feature-detect on
 * `URL.createObjectURL` (no throw when absent). No-ops on empty content (defensive). Always revokes
 * the object URL. This is the shared primitive (C8 FOLD-C6) — PGN and coach-profile JSON both use it.
 */
export function downloadText(content: string, filename: string, mime = 'application/json'): void {
  if (!content) return; // nothing to export
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof document === 'undefined') {
    return; // non-DOM environment — nothing to do
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Deterministic download filename for a played game, derived from the record's `playedAt`
 * (NOT `Date.now()` — pure & unit-testable, AP-GAMES-6). Shape: `game-YYYY-MM-DD-<result>.pgn`.
 * The result segment is sanitised to `[a-z0-9-]` so an unexpected value can't break the filename.
 */
export function pgnFilename(playedAt: number, result: string): string {
  const d = new Date(playedAt);
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const safe = result.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'game';
  return `game-${date}-${safe}.pgn`;
}

/**
 * Trigger a client-side download of `pgn` as `filename`. Thin wrapper over `downloadText` with the
 * chess-PGN mime; SSR/jsdom-safe and no-ops on empty PGN (defensive — §3) via the shared primitive.
 */
export function downloadPgn(pgn: string, filename: string): void {
  downloadText(pgn, filename, 'application/x-chess-pgn');
}
