import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { COACH_PROBES, mirrorFen, seedForSide, extractProbeDim } from './probes';
import { buildCoachProfile } from './diagnostic';
import { IMBALANCE_LIBRARY } from '../analysis/scenarios';
import type { DimensionScore } from '../analysis/weakness';

// ── Registry shape (FOLD E4, spec §5 #5) ─────────────────────────────────────
describe('COACH_PROBES registry', () => {
  it('holds exactly the two V1 entries, each targeting its own dimension', () => {
    expect(COACH_PROBES).toHaveLength(2);
    for (const probe of COACH_PROBES) {
      expect(probe.targetDimension).toBe(probe.dimension);
      expect(['endgameConversion', 'resilience']).toContain(probe.dimension);
    }
    const dims = COACH_PROBES.map((p) => p.dimension).sort();
    expect(dims).toEqual(['endgameConversion', 'resilience']);
  });

  it('reuses the existing rook-up library scenario for conversion (no divergent FEN — spec §5 #2)', () => {
    const conversion = COACH_PROBES.find((p) => p.dimension === 'endgameConversion')!;
    const rookUp = IMBALANCE_LIBRARY.find((s) => s.id === 'rook-up')!;
    expect(conversion.seed).toBe(rookUp); // same object reference — never duplicated
    expect(conversion.seed.fen).toBe(rookUp.fen);
  });

  it('uses the coach:defend-worse seed for resilience', () => {
    const resilience = COACH_PROBES.find((p) => p.dimension === 'resilience')!;
    expect(resilience.seed.id).toBe('coach:defend-worse');
  });

  it('every probe seed FEN is legal and the side to move is the side to train', () => {
    for (const probe of COACH_PROBES) {
      const c = new Chess(probe.seed.fen); // throws on malformed
      expect(c.turn()).toBe(probe.seed.sideToTrain);
    }
  });
});

// ── coach:defend-worse seed — clearly worse but holdable, player to move (spec §5 #1) ─────────────
describe('coach:defend-worse seed', () => {
  const seed = IMBALANCE_LIBRARY.find((s) => s.id === 'coach:defend-worse')!;

  it('is legal, with the side to TRAIN (= the worse side) to move and not already in check', () => {
    const c = new Chess(seed.fen);
    expect(c.turn()).toBe(seed.sideToTrain);
    expect(c.inCheck()).toBe(false); // a defend position shouldn't open mid-check
    expect(c.moves().length).toBeGreaterThan(0);
  });

  it('the side to move is materially WORSE (down ~a pawn) — a real defend, not an even/winning seed', () => {
    const c = new Chess(seed.fen);
    const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let w = 0;
    let b = 0;
    for (const sq of c.board().flat()) {
      if (!sq) continue;
      (sq.color === 'w' ? (w += val[sq.type]) : (b += val[sq.type]));
    }
    const mover = seed.sideToTrain === 'w' ? w : b;
    const opp = seed.sideToTrain === 'w' ? b : w;
    expect(mover).toBeLessThan(opp); // clearly worse
    expect(opp - mover).toBeLessThanOrEqual(3); // but not lost (≈ a pawn down, holdable)
    expect(seed.goalFr!.length).toBeGreaterThan(0); // bilingual goal present
  });
});

// ── mirrorFen round-trip + legality + flips (FOLD E5, spec §5 #3) ─────────────
describe('mirrorFen', () => {
  it('round-trips: mirrorFen(mirrorFen(fen)) === fen for every probe seed', () => {
    for (const probe of COACH_PROBES) {
      expect(mirrorFen(mirrorFen(probe.seed.fen))).toBe(probe.seed.fen);
    }
  });

  it('flips the side to move and yields a legal position', () => {
    for (const probe of COACH_PROBES) {
      const m = mirrorFen(probe.seed.fen);
      const c = new Chess(m); // legal mirror (throws otherwise)
      expect(c.turn()).toBe(probe.seed.sideToTrain === 'w' ? 'b' : 'w');
    }
  });

  it('mirrors castling rights (case swap) and the en-passant square (rank reflect)', () => {
    // The standard start position is symmetric under color+rank reflection, so the PLACEMENT maps to
    // itself; only the side flips (w→b) and the rights case-swap (KQkq→kqKQ).
    expect(mirrorFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b kqKQ - 0 1',
    );
    // En-passant square reflects rank 3 ⇄ 6, file kept; clocks preserved; rights case-swapped.
    const m = mirrorFen('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2');
    expect(m.split(' ')[2]).toBe('kqKQ');
    expect(m.split(' ')[3]).toBe('c3');
    expect(m.split(' ').slice(4).join(' ')).toBe('0 2');
  });

  it('preserves piece count and material (a reflection only swaps colors/ranks)', () => {
    for (const probe of COACH_PROBES) {
      const orig = new Chess(probe.seed.fen).board().flat().filter(Boolean).length;
      const mir = new Chess(mirrorFen(probe.seed.fen)).board().flat().filter(Boolean).length;
      expect(mir).toBe(orig);
    }
  });
});

// ── seedForSide (spec §5 #4) ─────────────────────────────────────────────────
describe('seedForSide', () => {
  it('returns a seed with side-to-move === side for BOTH colors, legal both ways', () => {
    for (const probe of COACH_PROBES) {
      for (const side of ['w', 'b'] as const) {
        const fen = seedForSide(probe, side);
        const c = new Chess(fen);
        expect(c.turn()).toBe(side);
      }
    }
  });

  it('returns the library FEN unchanged for the authored side, the mirror for the other', () => {
    const probe = COACH_PROBES[0];
    expect(seedForSide(probe, probe.seed.sideToTrain)).toBe(probe.seed.fen);
    expect(seedForSide(probe, probe.seed.sideToTrain === 'w' ? 'b' : 'w')).toBe(mirrorFen(probe.seed.fen));
  });
});

// ── Single-dimension extraction (Q-C, spec §5 #6/#7/#8) ──────────────────────
const dim = (dimension: DimensionScore['dimension'], score: number, sampleSize: number): DimensionScore => ({
  dimension,
  score,
  detail: 'from-analysis',
  sampleSize,
});

// A full buildWeaknessProfile-shaped DimensionScore[] (all five axes).
const fullDims: DimensionScore[] = [
  dim('tactics', 60, 10),
  dim('openingAccuracy', 40, 8),
  dim('endgameConversion', 72, 6),
  dim('timeManagement', 30, 4),
  dim('resilience', 55, 5),
];

describe('extractProbeDim — single-dimension extraction', () => {
  it('emits ONLY the targeted dimension (the other four are never produced — AP-CDESIGN-2)', () => {
    const conv = extractProbeDim('endgameConversion', fullDims, 'designed-conversion');
    expect(conv.dimension).toBe('endgameConversion');
    const res = extractProbeDim('resilience', fullDims, 'designed-resilience');
    expect(res.dimension).toBe('resilience');
    // The function returns a single DimensionScore, not an array — structurally one cell only.
    expect(Array.isArray(conv)).toBe(false);
  });

  it('carries the MEASURED score + sampleSize (never inflated/hard-coded — AP-CDESIGN-4) and names the position', () => {
    const conv = extractProbeDim('endgameConversion', fullDims, 'designed-conversion');
    expect(conv.score).toBe(72); // from the analysis cell
    expect(conv.sampleSize).toBe(6); // the measured n, not a large fabricated number
    expect(conv.detail).toBe('designed-conversion'); // names the designed position (FOLD E2)
  });

  it('stays "not measured" when the analysis cell is thin (sampleSize 0 → no fabricated score — AP-CDESIGN-3)', () => {
    const thin = [dim('endgameConversion', 90, 0), dim('resilience', 10, 0)];
    const conv = extractProbeDim('endgameConversion', thin, 'designed-conversion');
    expect(conv.score).toBe(50); // neutral, not the analysis's 90
    expect(conv.sampleSize).toBe(0); // honestly unmeasured
  });

  it('stays "not measured" when the targeted dimension is absent entirely', () => {
    const conv = extractProbeDim('endgameConversion', [dim('tactics', 50, 5)], 'designed-conversion');
    expect(conv.sampleSize).toBe(0);
    expect(conv.score).toBe(50);
  });
});

// ── Provenance via the existing buildCoachProfile merge (FOLD E2, spec §5 #9) ─
describe('probe provenance through buildCoachProfile', () => {
  const gameDims: DimensionScore[] = [
    dim('tactics', 50, 10),
    dim('openingAccuracy', 40, 8),
    dim('endgameConversion', 50, 0), // game didn't measure conversion
    dim('timeManagement', 60, 5),
    dim('resilience', 50, 0), // game didn't measure resilience
  ];

  it('merging a probe cell sets source.probes = true and overrides the matching radar cell', () => {
    const probeCell = extractProbeDim('endgameConversion', fullDims, 'a designed rook-up endgame');
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [{ theme: 'fork', rating: 1200, n: 2 }],
      gameDimensions: gameDims,
      assessedAt: 1,
      locale: 'en',
      probeDims: [probeCell],
    });
    expect(p.source.probes).toBe(true);
    const cell = p.dimensions.find((d) => d.dimension === 'endgameConversion')!;
    expect(cell.score).toBe(72); // probe overrides the game's "not measured" cell
    expect(cell.sampleSize).toBe(6);
    expect(cell.detail).toBe('a designed rook-up endgame'); // designed-position string survives
    // game-ness is NOT implied by a probe: source.game tracks the real game only.
    expect(p.source.game).toBe(true); // because gameDims were passed (a real even game ran)
  });

  it('a probe cell takes precedence over a game cell even when the game measured it', () => {
    const measuredGame: DimensionScore[] = [
      dim('tactics', 50, 10),
      dim('openingAccuracy', 40, 8),
      dim('endgameConversion', 20, 4), // game DID measure conversion
      dim('timeManagement', 60, 5),
      dim('resilience', 50, 0),
    ];
    const probeCell = extractProbeDim('endgameConversion', fullDims, 'designed'); // score 72, n 6
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [],
      gameDimensions: measuredGame,
      assessedAt: 1,
      locale: 'en',
      probeDims: [probeCell],
    });
    const cell = p.dimensions.find((d) => d.dimension === 'endgameConversion')!;
    expect(cell.score).toBe(72); // the designed probe is the authoritative read for its axis
  });

  it('with NO probeDims the output is byte-identical and source has no probes key (no regression)', () => {
    const base = {
      puzzleRating: 1200,
      probes: [{ theme: 'fork', rating: 1100, n: 2 }],
      gameDimensions: gameDims,
      assessedAt: 7,
      locale: 'en' as const,
    };
    const without = buildCoachProfile(base);
    const withUndef = buildCoachProfile({ ...base, probeDims: undefined });
    const withEmpty = buildCoachProfile({ ...base, probeDims: [] });
    expect(withUndef).toEqual(without);
    expect(withEmpty).toEqual(without);
    expect('probes' in without.source).toBe(false);
  });

  it('localizes the designed-position detail in FR and EN (bilingual — spec §5 #9)', () => {
    // The caller passes the gt-resolved detail; assert both locales produce a non-empty, distinct string.
    // (gt keys diag.probeConversion / diag.probeResilience are parity-tested in translate.test.ts.)
    const en = extractProbeDim('resilience', fullDims, 'from a designed worse position to defend');
    const fr = extractProbeDim('resilience', fullDims, 'depuis une position inférieure conçue à défendre');
    expect(en.detail).not.toBe(fr.detail);
    expect(fr.detail.length).toBeGreaterThan(0);
  });
});

// ── AP-CDESIGN-1 / AP-COACH-8: no diagnostic→pool leak (spec §5 #10) ──────────
// Strip comments before scanning so we assert against real CODE, not the prose that explains the
// doctrine (the module header literally names AdaptiveOpponent / Math.random when stating it avoids
// them). require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves import.meta.url to
// a non-file URL readFileSync rejects, and svelte-check has no node types for `import 'fs'` here — same
// pattern as board-input-wiring.test.ts.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const probesCode = stripComments(readFileSync(resolve(process.cwd(), 'src/coach/probes.ts'), 'utf8'));

describe('AP-COACH-8 — the probe path never touches the rating pool', () => {
  it('the probe core emits a DimensionScore ONLY (never a graded result / pool mutation)', () => {
    const cell = extractProbeDim('resilience', fullDims, 'designed');
    // It is a plain radar cell: dimension/score/detail/sampleSize, nothing rating-shaped.
    expect(Object.keys(cell).sort()).toEqual(['detail', 'dimension', 'sampleSize', 'score']);
  });

  it('probes.ts code does not reference AdaptiveOpponent / finishGame / recordGame (no pool coupling)', () => {
    expect(probesCode).not.toMatch(/AdaptiveOpponent/);
    expect(probesCode).not.toMatch(/finishGame|recordGame/);
    expect(probesCode).not.toMatch(/puzzleRating/);
  });

  it('the core is pure: no Date / Math.random in probes.ts code (AP-CDESIGN-8)', () => {
    expect(probesCode).not.toMatch(/Date\.now|Math\.random/);
  });
});
