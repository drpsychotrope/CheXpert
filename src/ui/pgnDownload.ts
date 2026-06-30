// Client-side PGN export primitive (F5, ADR-0056). Local-first PWA: nothing leaves the device —
// export is a Blob → object-URL → anchor click, no server round-trip (AP-GAMES-9). The stored
// `GameRecord.pgn` is already a valid chess.js-serialised PGN, so export downloads it verbatim;
// we never re-serialise (AP-GAMES-2).

/** Pad a 1–2 digit date part to 2 chars (local, no Intl dependency — keeps the filename stable). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
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
 * Trigger a client-side download of `pgn` as `filename`. DOM side-effect; SSR/jsdom-safe via a
 * feature-detect on `URL.createObjectURL` (no throw when absent). No-ops on empty PGN (defensive —
 * §3: the helper should disable/no-op on an empty string). Always revokes the object URL.
 */
export function downloadPgn(pgn: string, filename: string): void {
  if (!pgn) return; // nothing to export
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof document === 'undefined') {
    return; // non-DOM environment — nothing to do
  }
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
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
