import { describe, it, expect } from 'vitest';
import { programEfficacy, namedOpeningForGap } from './coachLoop';
import type { GameAnalysis, PlyAnalysis } from '../analysis/types';
import type { PlanItem } from '../analysis/studyPlan';
import type { EcoEntry } from '../opening/eco';

// ── fixtures (same idiom as efficacy.test.ts) ────────────────────────────────
function ply(p: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0, moveNumber: 1, color: 'w', san: 'Nf3', uci: 'g1f3',
    fenBefore: 'fen', fenAfter: 'fen2',
    bestUci: null, bestWhiteCp: 0, playedWhiteCp: 0, cpLoss: 0,
    winProbLoss: 10, severity: 'good', phase: 'middlegame',
    ...p,
  } as PlyAnalysis;
}
function game(analyzedAt: number, plies: PlyAnalysis[], playerColor: 'w' | 'b' = 'w'): GameAnalysis {
  return {
    gameId: `g${analyzedAt}`, source: 'played', playerColor, analyzedAt, movetimeMs: 100, plies,
    byPhase: {
      opening: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      middlegame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    },
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}
const fork = (sev: PlyAnalysis['severity']): PlyAnalysis =>
  ply({ severity: sev, phase: 'middlegame', motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } });
const clean = (): PlyAnalysis => ply({ severity: 'good', phase: 'middlegame' });

/** A middlegame game with `misses` fork-mistakes + `cleanMoves` clean plies (≥20/window ⇒ enoughData). */
function mg(at: number, misses: number, cleanMoves: number): GameAnalysis {
  return game(at, [
    ...Array.from({ length: misses }, () => fork('mistake')),
    ...Array.from({ length: cleanMoves }, () => clean()),
  ]);
}

const tacticsStep = (focus: string, motifKey: string): PlanItem =>
  ({ activity: 'tactics', focus, minutes: 8, reason: 'r', mastery: { kind: 'streak', target: 4, motifKey } });

describe('programEfficacy (C7/CO10)', () => {
  it('reuses motifEfficacy and flags looksImproved when fork-misses fall across the split', () => {
    const program: PlanItem[] = [tacticsStep('fork', 'fork')];
    // early (1,2) high miss density; recent (3,4) low. ≥20 player plies/window for the default gate.
    const analyses = [mg(1, 8, 16), mg(2, 8, 16), mg(3, 2, 22), mg(4, 2, 22)];
    const [e] = programEfficacy(program, analyses);
    expect(e.motifKey).toBe('fork');
    expect(e.readout.enoughData).toBe(true);
    expect(e.readout.deltaPct).toBeLessThan(0);
    expect(e.looksImproved).toBe(true);
    expect(e.neverMeasured).toBe(false);
  });

  it('honesty gate: thin data → enoughData false, looksImproved false (no fabricated improvement)', () => {
    const program: PlanItem[] = [tacticsStep('fork', 'fork')];
    // present but below the 20-move/window floor → thin, not never-measured.
    const analyses = [mg(1, 1, 3), mg(2, 1, 3)];
    const [e] = programEfficacy(program, analyses);
    expect(e.readout.enoughData).toBe(false);
    expect(e.looksImproved).toBe(false);
    expect(e.neverMeasured).toBe(false); // some plies in scope ⇒ NOT never-measured (E2 distinction)
  });

  it('distinguishes never-measured from thin data (E2)', () => {
    const program: PlanItem[] = [tacticsStep('fork', 'fork')];
    // games with NO fork plies at all and no middlegame plies in this motif's phase set → never measured.
    const noForks = [game(1, [ply({ phase: 'endgame', severity: 'good' })]), game(2, [ply({ phase: 'endgame', severity: 'good' })])];
    const [e] = programEfficacy(program, noForks);
    expect(e.neverMeasured).toBe(true);
    expect(e.looksImproved).toBe(false);
    expect(e.readout.early.playerMoves + e.readout.recent.playerMoves).toBe(0);
  });

  it('empty analyses → [] (drives the no-header UI path, E3)', () => {
    expect(programEfficacy([tacticsStep('fork', 'fork')], [])).toEqual([]);
  });

  it('skips dimension and endgame keys (not leak clusters) and de-dupes', () => {
    const program: PlanItem[] = [
      { activity: 'endgames', focus: 'endgame conversion', minutes: 8, reason: 'r', mastery: { kind: 'streak', target: 3, motifKey: 'endgame' } },
      { activity: 'repertoire', focus: 'opening lines', minutes: 6, reason: 'r', mastery: { kind: 'missRate', target: 0.25, motifKey: 'openingAccuracy' } },
      tacticsStep('fork', 'fork'),
      tacticsStep('fork-dupe', 'fork'), // same motifKey → only one readout
      { activity: 'play-steered', focus: 'openingAccuracy', minutes: 8, reason: 'r' }, // no mastery
    ];
    const out = programEfficacy(program, [mg(1, 4, 18), mg(2, 4, 18)]);
    expect(out.map((e) => e.motifKey)).toEqual(['fork']); // endgame + dims skipped, fork de-duped
  });

  it('is read-only: takes (program, analyses) and returns data (no CoachProfile in or out)', () => {
    // Type-level guarantee compiled below; runtime check it returns a plain array of readouts.
    const out = programEfficacy([tacticsStep('fork', 'fork')], [mg(1, 4, 18), mg(2, 4, 18)]);
    expect(Array.isArray(out)).toBe(true);
    for (const e of out) expect(e).toHaveProperty('readout');
  });
});

// ── namedOpeningForGap (C7/CO17) ─────────────────────────────────────────────
const ECO: EcoEntry[] = [
  { eco: 'B20', name: 'Sicilian Defence', uci: ['e2e4', 'c7c5'] },
  { eco: 'C00', name: 'French Defence', uci: ['e2e4', 'e7e6'] },
  { eco: 'C20', name: "King's Pawn Game", uci: ['e2e4'] },
];
/** A game whose opening plies are the given UCI sequence (rest are filler middlegame plies). */
function gameWithLine(at: number, line: string[]): GameAnalysis {
  const open = line.map((uci, i) => ply({ ply: i, uci, phase: 'opening' }));
  return game(at, [...open, clean(), clean()]);
}

describe('namedOpeningForGap (C7/CO17)', () => {
  it('returns the MOST-FREQUENT named line, localized for fr', () => {
    const analyses = [
      gameWithLine(1, ['e2e4', 'c7c5']),  // Sicilian
      gameWithLine(2, ['e2e4', 'c7c5']),  // Sicilian
      gameWithLine(3, ['e2e4', 'e7e6']),  // French
    ];
    const fr = namedOpeningForGap(analyses, ECO, 'fr');
    expect(fr).toEqual({ key: 'Sicilian Defence', label: 'Défense sicilienne' });
    const en = namedOpeningForGap(analyses, ECO, 'en');
    expect(en).toEqual({ key: 'Sicilian Defence', label: 'Sicilian Defence' });
  });

  it('returns null when no game matches a book line, and for empty inputs (empty = clean)', () => {
    const noMatch = [gameWithLine(1, ['g1f3', 'd7d5'])]; // not in ECO
    expect(namedOpeningForGap(noMatch, ECO, 'en')).toBeNull();
    expect(namedOpeningForGap([], ECO, 'en')).toBeNull();
    expect(namedOpeningForGap([gameWithLine(1, ['e2e4', 'c7c5'])], [], 'en')).toBeNull();
  });
});
