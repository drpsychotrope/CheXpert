import { describe, it, expect } from 'vitest';
import {
  labelPly,
  buildDrillSet,
  scoreCall,
  type DrillItem,
  type DrillLabel,
} from './criticalMomentDrill';
import type { GameAnalysis, GamePhase, PhaseStat, PlyAnalysis, Severity } from './types';
// Vite `?raw` import: the module's source text, for the purity guard (no fs, no new dep).
import drillSource from './criticalMomentDrill.ts?raw';

// --- synthetic fixtures (mirror criticalMoments.test.ts) ---------------------

function mkPly(
  i: number,
  color: 'w' | 'b',
  winProbLoss: number,
  opts: Partial<PlyAnalysis> = {},
): PlyAnalysis {
  return {
    ply: i,
    moveNumber: Math.floor(i / 2) + 1,
    color,
    san: opts.san ?? `m${i}`,
    uci: opts.uci ?? 'e2e4',
    // Distinct fenBefore per ply so dedup-by-fenBefore doesn't collapse the set.
    fenBefore: opts.fenBefore ?? `fen-${i}`,
    fenAfter: opts.fenAfter ?? `fenA-${i}`,
    bestUci: opts.bestUci ?? 'e2e4',
    bestWhiteCp: opts.bestWhiteCp ?? 0,
    playedWhiteCp: opts.playedWhiteCp ?? 0,
    cpLoss: opts.cpLoss ?? 0,
    winProbLoss,
    severity: opts.severity ?? 'good',
    phase: opts.phase ?? 'middlegame',
    captured: opts.captured,
  };
}

const PHASE: PhaseStat = { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 };

function mkAnalysis(plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w'): GameAnalysis {
  const byPhase = { opening: PHASE, middlegame: PHASE, endgame: PHASE } as Record<GamePhase, PhaseStat>;
  return {
    gameId: 'g',
    source: 'imported',
    playerColor,
    analyzedAt: 0,
    movetimeMs: 200,
    plies,
    byPhase,
    acpl: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    puzzlesGenerated: 0,
  };
}

// Deterministic PRNG (mulberry32) so shuffle order is reproducible in tests.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- labelPly ----------------------------------------------------------------

describe('labelPly', () => {
  it('labels a >= 15 swing CRITICAL', () => {
    expect(labelPly(mkPly(0, 'w', 20))).toBe('critical');
  });
  it('labels a <= 3 swing ROUTINE', () => {
    expect(labelPly(mkPly(0, 'w', 1))).toBe('routine');
  });
  it('returns null for the ambiguous band (between routineLoss and criticalLoss)', () => {
    expect(labelPly(mkPly(0, 'w', 8))).toBeNull();
  });
  it('treats the exact thresholds as inclusive (15 => critical, 3 => routine)', () => {
    expect(labelPly(mkPly(0, 'w', 15))).toBe('critical');
    expect(labelPly(mkPly(0, 'w', 3))).toBe('routine');
  });
  it('honours custom thresholds', () => {
    expect(labelPly(mkPly(0, 'w', 6), { criticalLoss: 5 })).toBe('critical');
    expect(labelPly(mkPly(0, 'w', 4), { routineLoss: 5 })).toBe('routine');
  });
});

// --- buildDrillSet -----------------------------------------------------------

describe('buildDrillSet', () => {
  it('returns ONLY player-to-move plies (opponent plies never appear)', () => {
    // White player. Black plies all have huge swings but must be excluded.
    const a = mkAnalysis(
      [
        mkPly(0, 'w', 20),
        mkPly(1, 'b', 90),
        mkPly(2, 'w', 1),
        mkPly(3, 'b', 90),
      ],
      'w',
    );
    const set = buildDrillSet([a], seeded(1));
    expect(set.length).toBe(2);
    expect(set.every((it) => it.ply.color === 'w')).toBe(true);
  });

  it('balances ~50/50 when both labels are plentiful, capped at max', () => {
    const crit = Array.from({ length: 10 }, (_, k) => mkPly(k, 'w', 30, { fenBefore: `c${k}` }));
    const routine = Array.from({ length: 10 }, (_, k) => mkPly(20 + k, 'w', 1, { fenBefore: `r${k}` }));
    const set = buildDrillSet([mkAnalysis([...crit, ...routine], 'w')], seeded(7), { max: 6 });
    expect(set.length).toBe(6);
    const nCrit = set.filter((it) => it.label === 'critical').length;
    const nRoutine = set.filter((it) => it.label === 'routine').length;
    expect(nCrit).toBe(3);
    expect(nRoutine).toBe(3);
  });

  it('tops up from the larger side when one label is short (best-effort, never empty)', () => {
    // Only CRITICAL data: a player with no routine moves still gets a full set.
    const crit = Array.from({ length: 8 }, (_, k) => mkPly(k, 'w', 30, { fenBefore: `c${k}` }));
    const set = buildDrillSet([mkAnalysis(crit, 'w')], seeded(3), { max: 5 });
    expect(set.length).toBe(5);
    expect(set.every((it) => it.label === 'critical')).toBe(true);
  });

  it('is deterministic for a given seed and reorders for a different seed', () => {
    const crit = Array.from({ length: 6 }, (_, k) => mkPly(k, 'w', 30, { fenBefore: `c${k}` }));
    const routine = Array.from({ length: 6 }, (_, k) => mkPly(20 + k, 'w', 1, { fenBefore: `r${k}` }));
    const games = [mkAnalysis([...crit, ...routine], 'w')];
    const a1 = buildDrillSet(games, seeded(42)).map((it) => it.fenBefore);
    const a2 = buildDrillSet(games, seeded(42)).map((it) => it.fenBefore);
    const b = buildDrillSet(games, seeded(99)).map((it) => it.fenBefore);
    expect(a1).toEqual(a2); // same seed → identical order
    expect(a1).not.toEqual(b); // different seed → different order (shuffle uses rand)
  });

  it('excludes a trivial recapture from ROUTINE when excludeRecaptures is on, keeps it when off', () => {
    // ply 1 (player, white) recaptures on d5 — prev ply moved TO d5 (uci "...d5").
    const plies = [
      mkPly(0, 'b', 0, { uci: 'c6d5' }), // opponent moves a piece to d5
      mkPly(1, 'w', 1, { uci: 'e4d5', captured: 'p', fenBefore: 'recap-pos' }), // player recaptures on d5, ROUTINE swing
      mkPly(2, 'w', 1, { uci: 'a2a3', fenBefore: 'quiet-pos' }), // a quiet routine move (kept either way)
    ];
    const withExcl = buildDrillSet([mkAnalysis(plies, 'w')], seeded(1), { excludeRecaptures: true });
    const withoutExcl = buildDrillSet([mkAnalysis(plies, 'w')], seeded(1), { excludeRecaptures: false });
    expect(withExcl.some((it) => it.fenBefore === 'recap-pos')).toBe(false);
    expect(withExcl.some((it) => it.fenBefore === 'quiet-pos')).toBe(true);
    expect(withoutExcl.some((it) => it.fenBefore === 'recap-pos')).toBe(true);
  });

  it('does NOT drop a CRITICAL recapture (a recapture can itself be a blunder)', () => {
    const plies = [
      mkPly(0, 'b', 0, { uci: 'c6d5' }),
      mkPly(1, 'w', 40, { uci: 'e4d5', captured: 'q', fenBefore: 'bad-recap', severity: 'blunder' }),
    ];
    const set = buildDrillSet([mkAnalysis(plies, 'w')], seeded(1), { excludeRecaptures: true });
    expect(set.some((it) => it.fenBefore === 'bad-recap' && it.label === 'critical')).toBe(true);
  });

  it('dedups by fenBefore', () => {
    const dup = [
      mkPly(0, 'w', 30, { fenBefore: 'same' }),
      mkPly(2, 'w', 30, { fenBefore: 'same' }),
    ];
    const set = buildDrillSet([mkAnalysis(dup, 'w')], seeded(1));
    expect(set.length).toBe(1);
  });

  it('returns [] for empty input', () => {
    expect(buildDrillSet([], seeded(1))).toEqual([]);
  });

  it('carries the ground-truth label and the reveal winProbLoss onto each item', () => {
    const set = buildDrillSet([mkAnalysis([mkPly(0, 'w', 22)], 'w')], seeded(1));
    expect(set[0].label).toBe('critical');
    expect(set[0].winProbLoss).toBe(22);
    expect(set[0].fenBefore).toBe(set[0].ply.fenBefore);
    expect(set[0].gameId).toBe('g');
    expect(set[0].plyIndex).toBe(0);
  });
});

// --- scoreCall ---------------------------------------------------------------

describe('scoreCall', () => {
  const item: DrillItem = {
    gameId: 'g',
    plyIndex: 0,
    ply: mkPly(0, 'w', 30),
    fenBefore: 'fen-0',
    label: 'critical',
    winProbLoss: 30,
  };
  it('marks a matching call correct and echoes truth/call', () => {
    expect(scoreCall(item, 'critical')).toEqual({ correct: true, truth: 'critical', call: 'critical' });
  });
  it('marks a mismatched call incorrect', () => {
    const r = scoreCall(item, 'routine' as DrillLabel);
    expect(r.correct).toBe(false);
    expect(r.truth).toBe('critical');
    expect(r.call).toBe('routine');
  });
});

// --- purity guard (mirrors the no-engine/no-clock doctrine, AP-CMD-4) --------

describe('criticalMomentDrill purity', () => {
  it('contains no Math.random, no Date.now, and no engine/chess.js import', () => {
    expect(drillSource).not.toMatch(/Math\.random/);
    expect(drillSource).not.toMatch(/Date\.now/);
    expect(drillSource).not.toMatch(/from ['"]chess\.js['"]/);
    expect(drillSource).not.toMatch(/EngineClient|engine\.evaluate|analyzeLines/);
  });
});
