import { describe, it, expect } from 'vitest';
import {
  buildProbePlan,
  borderlineDepth,
  coarseEndgameSpec,
  COACH_ENDGAME_BUCKETS,
  ENDGAME_BUCKET_THEMES,
  COACH_BORDERLINE_BAND,
  COACH_PROBE_MAX_TOTAL,
  COACH_LOOSE_RD,
  type ProbeSpec,
} from './probePlan';
import { COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from './diagnostic';

describe('buildProbePlan — à-la-carte scope (CF7)', () => {
  it("'all' + includeTimed → 6 motifs + 3 endgame buckets + 1 timed, in catalogue order", () => {
    const plan = buildProbePlan({ selected: 'all', includeTimed: true });
    const motifs = plan.filter((p) => p.kind === 'motif').map((p) => p.key);
    const endgames = plan.filter((p) => p.kind === 'endgame').map((p) => p.key);
    const timed = plan.filter((p) => p.kind === 'timed');
    expect(motifs).toEqual([...COACH_MOTIF_PROBES]);
    expect(endgames).toEqual([...COACH_ENDGAME_BUCKETS]);
    expect(timed).toHaveLength(1);
    // order: motifs, then endgames, then timed
    expect(plan.map((p) => p.kind)).toEqual([
      ...COACH_MOTIF_PROBES.map(() => 'motif'),
      ...COACH_ENDGAME_BUCKETS.map(() => 'endgame'),
      'timed',
    ]);
  });

  it('each spec carries the flat min/max as its starting depth bounds', () => {
    const plan = buildProbePlan({ selected: 'all', includeTimed: true });
    for (const spec of plan) {
      expect(spec.min).toBe(COACH_LADDER_MIN);
      expect(spec.max).toBe(COACH_LADDER_MAX);
    }
  });

  it('motif specs filter by their exact theme key', () => {
    const plan = buildProbePlan({ selected: ['motif'], includeTimed: false });
    expect(plan.find((p) => p.key === 'fork')!.themes).toEqual(['fork']);
  });

  it('a subset selection returns only the selected kinds (no endgame, no timed)', () => {
    const plan = buildProbePlan({ selected: ['motif'], includeTimed: true });
    expect(plan.every((p) => p.kind === 'motif')).toBe(true);
    expect(plan).toHaveLength(COACH_MOTIF_PROBES.length);
  });

  it("endgame-only subset returns the 3 buckets and nothing else", () => {
    const plan = buildProbePlan({ selected: ['endgame'], includeTimed: true });
    expect(plan.map((p) => p.key)).toEqual([...COACH_ENDGAME_BUCKETS]);
  });

  it('timed is opt-in: selected but includeTimed=false → no timed spec (AP-CPROBE-6 gate)', () => {
    const plan = buildProbePlan({ selected: ['timed'], includeTimed: false });
    expect(plan).toHaveLength(0);
  });

  it('timed selected + includeTimed=true → exactly the timed spec', () => {
    const plan = buildProbePlan({ selected: ['timed'], includeTimed: true });
    expect(plan.map((p) => p.key)).toEqual(['timed']);
  });

  it('empty selection is treated as ALL (AP-CPROBE-4 — never an empty assessment)', () => {
    const empty = buildProbePlan({ selected: [], includeTimed: true });
    const all = buildProbePlan({ selected: 'all', includeTimed: true });
    expect(empty).toEqual(all);
    expect(empty.length).toBeGreaterThan(0);
  });

  it('undefined selection is treated as ALL', () => {
    const plan = buildProbePlan({ includeTimed: true });
    expect(plan.length).toBe(COACH_MOTIF_PROBES.length + COACH_ENDGAME_BUCKETS.length + 1);
  });

  it('all selection WITHOUT includeTimed drops only the timed block (motifs + endgames stay)', () => {
    const plan = buildProbePlan({ selected: 'all', includeTimed: false });
    expect(plan.some((p) => p.kind === 'timed')).toBe(false);
    expect(plan.filter((p) => p.kind === 'motif')).toHaveLength(COACH_MOTIF_PROBES.length);
    expect(plan.filter((p) => p.kind === 'endgame')).toHaveLength(COACH_ENDGAME_BUCKETS.length);
  });
});

describe('endgame buckets (CF6) — real Lichess theme keys, umbrella mapping', () => {
  it('COACH_ENDGAME_BUCKETS are the real Lichess keys (+ the C2 umbrella)', () => {
    expect(COACH_ENDGAME_BUCKETS).toEqual(['rookEndgame', 'pawnEndgame', 'minorPieceEndgame']);
  });

  it('minorPieceEndgame maps to themes:[knightEndgame, bishopEndgame] (ANY-of match)', () => {
    expect(ENDGAME_BUCKET_THEMES.minorPieceEndgame).toEqual(['knightEndgame', 'bishopEndgame']);
    expect(ENDGAME_BUCKET_THEMES.rookEndgame).toEqual(['rookEndgame']);
    expect(ENDGAME_BUCKET_THEMES.pawnEndgame).toEqual(['pawnEndgame']);
  });

  it('the coarse fallback spec is a pure phase:endgame probe (used only when all buckets are empty)', () => {
    const spec = coarseEndgameSpec();
    expect(spec.kind).toBe('endgame');
    expect(spec.phase).toBe('endgame');
    expect(spec.themes).toBeUndefined();
    expect(spec.key).toBe('endgame');
  });
});

describe('borderlineDepth — adaptive depth (CO4) + grand cap (AP-CPROBE-2)', () => {
  const spec: ProbeSpec = { kind: 'motif', key: 'fork', themes: ['fork'], min: COACH_LADDER_MIN, max: COACH_LADDER_MAX };
  const base = { spec, countSoFar: COACH_LADDER_MIN, totalSpent: 4 };

  it('borderline delta + loose RD + under cap → true (earn one more)', () => {
    expect(borderlineDepth({ ...base, currentDelta: 10, currentRd: 200 })).toBe(true);
    expect(borderlineDepth({ ...base, currentDelta: -COACH_BORDERLINE_BAND, currentRd: 200 })).toBe(true);
  });

  it('clear delta (well outside the band) → false (clear motif stays flat)', () => {
    expect(borderlineDepth({ ...base, currentDelta: 300, currentRd: 200 })).toBe(false);
    expect(borderlineDepth({ ...base, currentDelta: -300, currentRd: 200 })).toBe(false);
  });

  it('tight RD (settled ladder) → false even when borderline', () => {
    expect(borderlineDepth({ ...base, currentDelta: 0, currentRd: COACH_LOOSE_RD })).toBe(false);
    expect(borderlineDepth({ ...base, currentDelta: 0, currentRd: COACH_LOOSE_RD - 1 })).toBe(false);
  });

  it('at/over the grand cap → false even when borderline + loose RD (honesty about length)', () => {
    expect(borderlineDepth({ ...base, currentDelta: 0, currentRd: 250, totalSpent: COACH_PROBE_MAX_TOTAL })).toBe(false);
    expect(borderlineDepth({ ...base, currentDelta: 0, currentRd: 250, totalSpent: COACH_PROBE_MAX_TOTAL + 5 })).toBe(false);
  });

  it('a borderline sequence stops extending once totalSpent reaches the cap', () => {
    // Simulate extending one ladder repeatedly; total puzzles spent climbs to the cap and then locks.
    let totalSpent = COACH_PROBE_MAX_TOTAL - 2;
    let extensions = 0;
    for (let i = 0; i < 10; i++) {
      const can = borderlineDepth({ spec, currentDelta: 0, currentRd: 250, countSoFar: 2 + i, totalSpent });
      if (!can) break;
      extensions += 1;
      totalSpent += 1; // each extension spends one more puzzle
    }
    expect(totalSpent).toBe(COACH_PROBE_MAX_TOTAL); // never exceeds the cap
    expect(extensions).toBe(2); // exactly filled the remaining budget
  });

  it('is deterministic — same inputs, same output (no Date/Math.random)', () => {
    const a = borderlineDepth({ ...base, currentDelta: 5, currentRd: 150 });
    const b = borderlineDepth({ ...base, currentDelta: 5, currentRd: 150 });
    expect(a).toBe(b);
  });
});
