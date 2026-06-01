import { describe, it, expect } from 'vitest';
import { buildWeaknessProfile, drillTarget, expectedAcpl, resilienceScore } from './weakness';
import type { GameAnalysis, PlyAnalysis, GamePhase } from './types';

function ply(partial: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0,
    moveNumber: 1,
    color: 'w',
    san: 'x',
    uci: 'a1a1',
    fenBefore: 'f',
    fenAfter: 'f',
    bestUci: null,
    bestWhiteCp: 0,
    playedWhiteCp: 0,
    cpLoss: 0,
    winProbLoss: 0,
    severity: 'good',
    phase: 'middlegame',
    ...partial,
  };
}

function game(plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w'): GameAnalysis {
  const byPhase = {
    opening: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    middlegame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
  };
  for (const p of plies) {
    if (p.color !== playerColor) continue;
    const ps = byPhase[p.phase as GamePhase];
    ps.plies += 1;
    ps.acpl += p.cpLoss;
  }
  for (const k of Object.keys(byPhase) as GamePhase[]) {
    if (byPhase[k].plies) byPhase[k].acpl = Math.round(byPhase[k].acpl / byPhase[k].plies);
  }
  return {
    gameId: 'g',
    source: 'imported',
    playerColor,
    analyzedAt: 0,
    movetimeMs: 100,
    plies,
    byPhase,
    acpl: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    puzzlesGenerated: 0,
  };
}

describe('weakness aggregation', () => {
  it('expectedAcpl decreases with rating', () => {
    expect(expectedAcpl(800)).toBeGreaterThan(expectedAcpl(1600));
    expect(expectedAcpl(1600)).toBeGreaterThan(expectedAcpl(2200));
  });

  it('builds all five dimensions', () => {
    const g = game([
      ply({ phase: 'opening', cpLoss: 20 }),
      ply({ phase: 'middlegame', cpLoss: 200, severity: 'blunder' }),
      ply({ phase: 'middlegame', cpLoss: 10 }),
      ply({ phase: 'endgame', cpLoss: 300, severity: 'blunder' }),
    ]);
    const profile = buildWeaknessProfile([g], 1500);
    expect(profile.dimensions).toHaveLength(5);
    expect(profile.dimensions.map((d) => d.dimension)).toContain('tactics');
    expect(profile.gamesAnalyzed).toBe(1);
  });

  it('picks the weakest dimension among those with enough data', () => {
    // Many middlegame blunders → tactics should be weak.
    const plies: PlyAnalysis[] = [];
    for (let i = 0; i < 6; i++) {
      plies.push(ply({ ply: i, phase: 'middlegame', cpLoss: 300, severity: 'blunder' }));
    }
    const profile = buildWeaknessProfile([game(plies)], 1500);
    expect(profile.weakest).toBe('tactics');
  });

  it('resilience rewards recovering from a losing position', () => {
    // Player (white) falls to -250 then recovers to -50.
    const recovered = game([
      ply({ ply: 0, playedWhiteCp: -250 }),
      ply({ ply: 1, playedWhiteCp: -50 }),
    ]);
    const r = resilienceScore([recovered]);
    expect(r.n).toBe(1);
    expect(r.score).toBe(100);
  });
});

describe('drillTarget — every dimension routes to a view (loop-closers 3b)', () => {
  it('routes opening and endgame away from Tactics', () => {
    expect(drillTarget('openingAccuracy').view).toBe('repertoire');
    expect(drillTarget('endgameConversion').view).toBe('endgames');
  });

  it('routes time management to timed Tactics', () => {
    expect(drillTarget('timeManagement')).toEqual({ view: 'tactics', timed: true });
  });

  it('routes resilience to comeback drills', () => {
    expect(drillTarget('resilience').view).toBe('comeback');
  });

  it('routes tactics to Tactics with geometric-motif themes', () => {
    const t = drillTarget('tactics');
    expect(t.view).toBe('tactics');
    expect(t.themes).toContain('pin');
    expect(t.themes).toContain('fork');
  });
});
