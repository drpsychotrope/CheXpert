// Opt-in Lichess games fetch (PR-07 lichess-fetch, ADR-0065). The app's SECOND network feature
// ever, behind the SAME explicit consent switch as Syzygy (ADR-0012 `allowNetwork`) — the caller
// gates on it; this module never reads settings. Public export API, no auth, no account token:
// only the username the user typed is sent. `clocks=true` so the imported games carry %clk and
// feed the time-management radar exactly like PR-02's own-game telemetry.
//
// Live pre-flight (2026-07-02, roadmap N3): GET lichess.org/api/games/user/{u}?max=2&clocks=true
// → 200, `application/x-chess-pgn`, multi-game PGN with standard headers + { [%clk 0:10:00] }
// comments — splitPgnGames/parsePgn consume it unchanged.

export const LICHESS_MAX_CHOICES = [20, 50, 100] as const;

/** Lichess usernames: 2–30 chars, letters/digits/_/- (their own constraint). Pure. */
export function isValidLichessUsername(u: string): boolean {
  return /^[a-zA-Z0-9_-]{2,30}$/.test(u);
}

/** The export URL (pure, testable): PGN with clocks, without opening/eval annotations we ignore. */
export function lichessExportUrl(username: string, max: number): string {
  const u = encodeURIComponent(username.trim());
  const n = Math.max(1, Math.min(300, Math.floor(max)));
  return `https://lichess.org/api/games/user/${u}?max=${n}&clocks=true&opening=false&evals=false`;
}

export type LichessFetchError = 'invalid-username' | 'not-found' | 'rate-limited' | 'network' | 'empty';

export type LichessFetchResult = { ok: true; pgn: string } | { ok: false; error: LichessFetchError };

/**
 * Fetch the user's latest games as one multi-game PGN string. `fetchFn` is injectable so the
 * mapping is unit-testable offline; errors are TYPED so the UI can say something actionable
 * (404 → check the username; 429 → Lichess rate limit, retry later) instead of a raw throw.
 */
export async function fetchLichessGames(
  username: string,
  max: number,
  fetchFn: typeof fetch = fetch,
): Promise<LichessFetchResult> {
  if (!isValidLichessUsername(username.trim())) return { ok: false, error: 'invalid-username' };
  let res: Response;
  try {
    res = await fetchFn(lichessExportUrl(username, max), {
      headers: { Accept: 'application/x-chess-pgn' },
    });
  } catch {
    return { ok: false, error: 'network' };
  }
  if (res.status === 404) return { ok: false, error: 'not-found' };
  if (res.status === 429) return { ok: false, error: 'rate-limited' };
  if (!res.ok) return { ok: false, error: 'network' };
  const pgn = (await res.text()).trim();
  if (!pgn) return { ok: false, error: 'empty' };
  return { ok: true, pgn };
}
