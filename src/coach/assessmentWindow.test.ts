import { describe, it, expect } from 'vitest';
import {
  recentAnalyses,
  analysesBySource,
  COACH_ASSESS_WINDOW,
  COACH_ASSESS_MIN_GAMES,
} from './assessmentWindow';
import { buildWeaknessProfile } from '../analysis/weakness';
import type { GameAnalysis, GamePhase, PlyAnalysis } from '../analysis/types';

// Minimal GameAnalysis fixture — recentAnalyses/analysesBySource only read `analyzedAt` and
// `source`. `id`/`analyzedAt`/`source` are the load-bearing fields; the rest are filler so the
// record is a valid GameAnalysis (and can feed buildWeaknessProfile for the composition test).
function ga(partial: Partial<GameAnalysis>): GameAnalysis {
  const byPhase: Record<GamePhase, GameAnalysis['byPhase']['opening']> = {
    opening: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    middlegame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
  };
  return {
    gameId: 'g',
    source: 'played',
    playerColor: 'w',
    analyzedAt: 0,
    movetimeMs: 100,
    plies: [],
    byPhase,
    acpl: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    puzzlesGenerated: 0,
    ...partial,
  };
}

describe('recentAnalyses — pure recent-N window (C4)', () => {
  it('returns the N newest by analyzedAt (descending), regardless of input order', () => {
    const a = ga({ gameId: 'a', analyzedAt: 100 });
    const b = ga({ gameId: 'b', analyzedAt: 300 });
    const c = ga({ gameId: 'c', analyzedAt: 200 });
    const out = recentAnalyses([a, b, c], 2);
    expect(out.map((g) => g.gameId)).toEqual(['b', 'c']); // 300, 200 — the two newest
  });

  it('sorts a fuller set strictly by analyzedAt desc and caps at N', () => {
    const set = [10, 50, 30, 90, 70, 20].map((ts, i) => ga({ gameId: `g${i}`, analyzedAt: ts }));
    const out = recentAnalyses(set, 3);
    expect(out.map((g) => g.analyzedAt)).toEqual([90, 70, 50]);
  });

  it('n greater than length returns all (sorted), not padded', () => {
    const set = [ga({ analyzedAt: 1 }), ga({ analyzedAt: 3 }), ga({ analyzedAt: 2 })];
    const out = recentAnalyses(set, 10);
    expect(out).toHaveLength(3);
    expect(out.map((g) => g.analyzedAt)).toEqual([3, 2, 1]);
  });

  it('n = 0 returns an empty array', () => {
    expect(recentAnalyses([ga({ analyzedAt: 5 })], 0)).toEqual([]);
  });

  it('negative n is clamped to 0 (empty), never throws', () => {
    expect(recentAnalyses([ga({ analyzedAt: 5 })], -3)).toEqual([]);
  });

  it('empty input returns empty', () => {
    expect(recentAnalyses([], COACH_ASSESS_WINDOW)).toEqual([]);
  });

  it('does not mutate the caller array (copy-then-sort)', () => {
    const set = [ga({ gameId: 'a', analyzedAt: 1 }), ga({ gameId: 'b', analyzedAt: 9 })];
    const before = set.map((g) => g.gameId);
    recentAnalyses(set, 2);
    expect(set.map((g) => g.gameId)).toEqual(before); // original order untouched
  });

  it('equal analyzedAt ties keep input order (stable sort)', () => {
    const set = [
      ga({ gameId: 'x', analyzedAt: 5 }),
      ga({ gameId: 'y', analyzedAt: 5 }),
      ga({ gameId: 'z', analyzedAt: 5 }),
    ];
    expect(recentAnalyses(set, 3).map((g) => g.gameId)).toEqual(['x', 'y', 'z']);
  });

  it('is deterministic — no Date.now (same input, same output)', () => {
    const set = [ga({ analyzedAt: 2 }), ga({ analyzedAt: 8 }), ga({ analyzedAt: 4 })];
    expect(recentAnalyses(set, 2)).toEqual(recentAnalyses(set, 2));
  });
});

describe('analysesBySource — per-source counts for provenance (FOLD-C4)', () => {
  it('counts mixed played + imported', () => {
    const set = [
      ga({ source: 'played' }),
      ga({ source: 'imported' }),
      ga({ source: 'played' }),
      ga({ source: 'imported' }),
      ga({ source: 'imported' }),
    ];
    expect(analysesBySource(set)).toEqual({ played: 2, imported: 3 });
  });

  it('all-played', () => {
    expect(analysesBySource([ga({ source: 'played' }), ga({ source: 'played' })]))
      .toEqual({ played: 2, imported: 0 });
  });

  it('all-imported', () => {
    expect(analysesBySource([ga({ source: 'imported' }), ga({ source: 'imported' })]))
      .toEqual({ played: 0, imported: 2 });
  });

  it('empty → zeros', () => {
    expect(analysesBySource([])).toEqual({ played: 0, imported: 0 });
  });

  it('counts of the window sum to the window length (used by the provenance line)', () => {
    const set = [10, 50, 30, 90, 70, 20].map((ts, i) =>
      ga({ gameId: `g${i}`, analyzedAt: ts, source: i % 2 ? 'imported' : 'played' }));
    const window = recentAnalyses(set, COACH_ASSESS_WINDOW);
    const counts = analysesBySource(window);
    expect(counts.played + counts.imported).toBe(window.length);
  });
});

describe('thin-history fallback predicate (FOLD-C2 / AP-CREAL-5)', () => {
  it('empty history → window below the floor → coach falls back to toy-game/ladders', () => {
    const window = recentAnalyses([], COACH_ASSESS_WINDOW);
    expect(window.length < COACH_ASSESS_MIN_GAMES).toBe(true);
  });

  it('one analysed game meets the floor → the history path is taken (not a fallback)', () => {
    const window = recentAnalyses([ga({ analyzedAt: 1 })], COACH_ASSESS_WINDOW);
    expect(window.length < COACH_ASSESS_MIN_GAMES).toBe(false);
    expect(window.length).toBeGreaterThanOrEqual(COACH_ASSESS_MIN_GAMES);
  });

  it('COACH_ASSESS_WINDOW is the documented default (N=10)', () => {
    expect(COACH_ASSESS_WINDOW).toBe(10);
  });
});

describe('consume-not-fork composition (AP-CREAL-1)', () => {
  // The coach calls buildWeaknessProfile(recentAnalyses(all, N), …). Prove the helper merely composes
  // with the EXISTING core: windowing then profiling yields the same dimensions as profiling the
  // windowed array directly — i.e. C4 changes only the INPUT array, never the aggregation.
  function ply(partial: Partial<PlyAnalysis>): PlyAnalysis {
    return {
      ply: 0, moveNumber: 1, color: 'w', san: 'x', uci: 'a1a1', fenBefore: 'f', fenAfter: 'f',
      bestUci: null, bestWhiteCp: 0, playedWhiteCp: 0, cpLoss: 0, winProbLoss: 0,
      severity: 'good', phase: 'middlegame', ...partial,
    };
  }
  function gameWith(ts: number, cpLoss: number): GameAnalysis {
    return ga({
      gameId: `g${ts}`, analyzedAt: ts,
      plies: [ply({ phase: 'opening', cpLoss }), ply({ phase: 'middlegame', cpLoss, severity: 'blunder' })],
      byPhase: {
        opening: { plies: 1, acpl: cpLoss, blunders: 0, mistakes: 0, inaccuracies: 0 },
        middlegame: { plies: 1, acpl: cpLoss, blunders: 1, mistakes: 0, inaccuracies: 0 },
        endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      },
    });
  }

  it('buildWeaknessProfile(recentAnalyses(all, N)) === buildWeaknessProfile(window) — same dimensions', () => {
    const all = [gameWith(10, 20), gameWith(50, 200), gameWith(30, 80), gameWith(90, 40)];
    const n = 2;
    const window = recentAnalyses(all, n); // the two newest: ts 90, 50
    const viaHelper = buildWeaknessProfile(recentAnalyses(all, n), 1500, 'en').dimensions;
    const direct = buildWeaknessProfile(window, 1500, 'en').dimensions;
    expect(viaHelper).toEqual(direct);
  });
});
