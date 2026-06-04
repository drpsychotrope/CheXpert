# Coach Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a re-runnable "Coach mode" that reuses the launch calibration method (adaptive puzzle ladder + optional analysed game) to build a multi-dimensional strength/weakness profile, then generates a personalized program of drills and game modes via the existing session runner.

**Architecture:** Two pure cores (`coach/diagnostic.ts` → `CoachProfile`, `coach/program.ts` → `PlanItem[]`) feed the existing `buildSession`/`Session.svelte` runner. A new `Coach.svelte` wizard drives themed `PuzzleLadder`s + an `AdaptiveOpponent` game (analysed via `runAnalysis(source:'played')`). Profile persists as an additive `PlayerModel.coachProfile?` field — no `DB_VERSION` bump. Game modes (Sparring, Play-steered, Comeback) are reached via additive `SessionStepKind`s + `app` signals.

**Tech Stack:** Svelte 5 (runes), TypeScript (strict), Vitest, IndexedDB (idb), chess.js, Stockfish (Web Worker).

**Spec:** `specs/coach-mode-spec.md` (V1, decisions Q-A..Q-D = defaults). **ADR:** ADR-0045.

**Test command:** single file `npx vitest run <path>`; full suite `npm test`; types `npm run check`; build `npm run build`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/coach/types.ts` | `CoachProfile`, `MotifScore`, `ThemeProbeResult` | create |
| `src/coach/diagnostic.ts` | pure `buildCoachProfile` + probe constants + `motifAggregateScore` | create |
| `src/coach/diagnostic.test.ts` | unit tests for the above | create |
| `src/coach/program.ts` | pure `buildCoachProgram` + `profileToLeaks` + `scenarioForFocus` | create |
| `src/coach/program.test.ts` | unit tests for the above | create |
| `src/analysis/studyPlan.ts` | widen `PlanItem.activity` (additive) | modify |
| `src/analysis/session.ts` | widen `SessionStepKind` (additive) | modify |
| `src/analysis/session.test.ts` | assert new kinds pass through `buildSession` | modify |
| `src/state/app.svelte.ts` | `View += 'coach'`; `sparringScenarioId`, `steerDimension` signals | modify |
| `src/store/db.ts` | `PlayerModel.coachProfile? + coachProfilePrev?` | modify |
| `src/ui/Coach.svelte` | the wizard view | create |
| `src/ui/Session.svelte` | route + seed new kinds | modify |
| `src/ui/Sparring.svelte` | consume `app.sparringScenarioId` | modify |
| `src/ui/Play.svelte` | consume `app.steerDimension` override | modify |
| `src/ui/Comeback.svelte` | Sparring fallback when empty (Q-C) | modify |
| `src/ui/App.svelte` | render `Coach` on `view==='coach'` | modify |
| `src/ui/Home.svelte` | "Personal coaching" entry | modify |
| `src/ui/Insights.svelte` | coach entry link | modify |
| `src/ui/Settings.svelte` | "Re-run coaching assessment" entry | modify |
| `decisions.md` | ADR-0045 (append-only) | modify |
| `README.md` | Coach feature line | modify |

---

## Task 1: Coach types

**Files:**
- Create: `src/coach/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// Coach mode (ADR-0045): the persisted strength/weakness profile shape and the
// raw per-theme probe result the wizard collects. Plain data only (IndexedDB
// structured-clone safe); no engine/Svelte imports so db.ts can import it freely.

import type { DimensionScore } from '../analysis/weakness';

/** One tactical-motif (or 'endgame') probe scored relative to the puzzle-rating baseline. */
export interface MotifScore {
  theme: string;     // motif key ('fork'…'mate') or 'endgame'
  rating: number;    // Glicko rating from the themed ladder
  baseline: number;  // puzzleRating at probe time
  delta: number;     // rating - baseline (>0 strength, <0 weakness)
  n: number;         // puzzles attempted (sample size — honesty)
}

/** Raw output of one themed ladder, handed to buildCoachProfile. */
export interface ThemeProbeResult {
  theme: string;
  rating: number;
  n: number;
}

/** Persisted coaching assessment (PlayerModel.coachProfile). Directional, not a grade. */
export interface CoachProfile {
  assessedAt: number;            // UI-stamped (Date.now boundary)
  puzzleRating: number;          // baseline for motif deltas
  motifs: MotifScore[];
  dimensions: DimensionScore[];  // 5-dim radar (game-derived when present)
  strengths: string[];           // display labels
  weaknesses: string[];          // display labels
  source: { ladders: boolean; game: boolean };
  gameAnalyzed: boolean;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: 0 errors (file compiles; `DimensionScore` resolves from `weakness.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/coach/types.ts
git commit -m "feat(coach): add CoachProfile / MotifScore / ThemeProbeResult types"
```

---

## Task 2: Diagnostic core (`buildCoachProfile`)

**Files:**
- Create: `src/coach/diagnostic.ts`
- Test: `src/coach/diagnostic.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildCoachProfile, motifAggregateScore, COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from './diagnostic';
import type { DimensionScore } from '../analysis/weakness';

const probe = (theme: string, rating: number, n = 4) => ({ theme, rating, n });

describe('constants', () => {
  it('probes the six geometric motifs and uses a short ladder', () => {
    expect(COACH_MOTIF_PROBES).toEqual(['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mate']);
    expect(COACH_LADDER_MIN).toBe(3);
    expect(COACH_LADDER_MAX).toBe(5);
  });
});

describe('buildCoachProfile — puzzle-only (no game)', () => {
  it('computes per-motif deltas vs the baseline', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1000), probe('pin', 1400)],
      gameDimensions: null,
      assessedAt: 42,
    });
    expect(p.motifs.find((m) => m.theme === 'fork')!.delta).toBe(-200);
    expect(p.motifs.find((m) => m.theme === 'pin')!.delta).toBe(200);
    expect(p.source).toEqual({ ladders: true, game: false });
    expect(p.gameAnalyzed).toBe(false);
    expect(p.assessedAt).toBe(42);
  });

  it('drops n=0 probes (empty theme never scored as a weakness)', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 800), probe('mate', 1200, 0)],
      gameDimensions: null,
      assessedAt: 1,
    });
    expect(p.motifs.map((m) => m.theme)).toEqual(['fork']);
  });

  it('marks the four game-only dimensions as unsampled placeholders', () => {
    const p = buildCoachProfile({ puzzleRating: 1200, probes: [probe('fork', 1200)], gameDimensions: null, assessedAt: 1 });
    const opening = p.dimensions.find((d) => d.dimension === 'openingAccuracy')!;
    expect(opening.sampleSize).toBe(0);
    expect(opening.detail).toMatch(/calibration game/i);
  });

  it('ranks weak motifs into weaknesses (worst-first) and strong into strengths', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 900), probe('skewer', 1000), probe('pin', 1700)],
      gameDimensions: null,
      assessedAt: 1,
    });
    expect(p.weaknesses[0]).toBe('Forks');     // -300, worst first
    expect(p.weaknesses).toContain('Skewers'); // -200
    expect(p.strengths).toContain('Pins');     // +500
  });

  it('returns an honest empty profile when no probe has data', () => {
    const p = buildCoachProfile({ puzzleRating: 1200, probes: [probe('fork', 0, 0)], gameDimensions: null, assessedAt: 1 });
    expect(p.motifs).toEqual([]);
    expect(p.weaknesses).toEqual([]);
    expect(p.source.ladders).toBe(false);
  });
});

describe('buildCoachProfile — with game dimensions', () => {
  const dims: DimensionScore[] = [
    { dimension: 'tactics', score: 50, detail: 'x', sampleSize: 10 },
    { dimension: 'openingAccuracy', score: 30, detail: 'x', sampleSize: 8 },
    { dimension: 'endgameConversion', score: 70, detail: 'x', sampleSize: 6 },
    { dimension: 'timeManagement', score: 20, detail: 'x', sampleSize: 5 },
    { dimension: 'resilience', score: 80, detail: 'x', sampleSize: 4 },
  ];

  it('uses injected dims, overrides tactics with the motif aggregate, and ranks dims', () => {
    const p = buildCoachProfile({
      puzzleRating: 1200,
      probes: [probe('fork', 1600)],
      gameDimensions: dims,
      assessedAt: 1,
    });
    expect(p.source.game).toBe(true);
    const tac = p.dimensions.find((d) => d.dimension === 'tactics')!;
    expect(tac.score).toBe(motifAggregateScore(p.motifs)); // overridden
    expect(p.weaknesses).toContain('Time management'); // score 20
    expect(p.strengths).toContain('Resilience');       // score 80
  });
});

describe('motifAggregateScore', () => {
  it('maps mean delta 0 → 50 and is monotonic', () => {
    expect(motifAggregateScore([])).toBe(50);
    expect(motifAggregateScore([{ theme: 'fork', rating: 1200, baseline: 1200, delta: 0, n: 4 }])).toBe(50);
    const strong = motifAggregateScore([{ theme: 'fork', rating: 1400, baseline: 1200, delta: 200, n: 4 }]);
    const weak = motifAggregateScore([{ theme: 'fork', rating: 1000, baseline: 1200, delta: -200, n: 4 }]);
    expect(strong).toBeGreaterThan(50);
    expect(weak).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/coach/diagnostic.test.ts`
Expected: FAIL — "Failed to resolve import './diagnostic'".

- [ ] **Step 3: Write the implementation**

```ts
// Coach diagnostic core (ADR-0045). PURE: no Date, no Math.random, no engine.
// Reuses the calibration PuzzleLadder method across themes; this module only
// AGGREGATES the collected results into a CoachProfile. The UI (Coach.svelte)
// owns the engine/ladder/Date side and injects gameDimensions (already computed
// by buildWeaknessProfile) so this core needs no GameAnalysis fixture to test.

import type { Dimension, DimensionScore } from '../analysis/weakness';
import type { CoachProfile, MotifScore, ThemeProbeResult } from './types';

export const COACH_MOTIF_PROBES = ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'mate'] as const;
export const COACH_LADDER_MIN = 3;
export const COACH_LADDER_MAX = 5;

const STRENGTH_DELTA = 40;
const WEAKNESS_DELTA = -40;
const STRENGTH_DIM = 65;
const WEAKNESS_DIM = 35;
const ALL_DIMS: Dimension[] = ['tactics', 'openingAccuracy', 'endgameConversion', 'timeManagement', 'resilience'];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Mean motif delta → 0..100 (0→50, +250→100, −250→0). Directional, not a grade. */
export function motifAggregateScore(motifs: MotifScore[]): number {
  if (motifs.length === 0) return 50;
  const mean = motifs.reduce((s, m) => s + m.delta, 0) / motifs.length;
  return clamp(Math.round(50 + mean / 5), 0, 100);
}

function placeholderDim(dimension: Dimension): DimensionScore {
  return { dimension, score: 50, detail: 'Play the calibration game to assess this', sampleSize: 0 };
}

const MOTIF_LABELS: Record<string, string> = {
  fork: 'Forks', pin: 'Pins', skewer: 'Skewers', hangingPiece: 'Hanging pieces',
  discoveredAttack: 'Discovered attacks', mate: 'Mating patterns', endgame: 'Endgames',
};
function motifLabel(theme: string): string {
  return MOTIF_LABELS[theme] ?? theme;
}
const DIM_LABELS: Record<Dimension, string> = {
  tactics: 'Tactics', openingAccuracy: 'Opening accuracy', endgameConversion: 'Endgame conversion',
  timeManagement: 'Time management', resilience: 'Resilience',
};

export function buildCoachProfile(args: {
  puzzleRating: number;
  probes: ThemeProbeResult[];
  gameDimensions: DimensionScore[] | null;
  assessedAt: number;
}): CoachProfile {
  const { puzzleRating, probes, gameDimensions, assessedAt } = args;

  // n=0 guard: a theme with no in-band puzzle is dropped, never scored.
  const scored = probes.filter((p) => p.n > 0);
  const motifs: MotifScore[] = scored.map((p) => ({
    theme: p.theme,
    rating: p.rating,
    baseline: puzzleRating,
    delta: Math.round(p.rating - puzzleRating),
    n: p.n,
  }));
  const totalPuzzles = scored.reduce((s, p) => s + p.n, 0);
  const aggregate = motifAggregateScore(motifs);
  const tacticsDim: DimensionScore =
    motifs.length > 0
      ? { dimension: 'tactics', score: aggregate, detail: `${motifs.length} motifs probed (${totalPuzzles} puzzles)`, sampleSize: totalPuzzles }
      : placeholderDim('tactics');

  let dimensions: DimensionScore[];
  if (gameDimensions) {
    dimensions = gameDimensions.map((d) => (d.dimension === 'tactics' && motifs.length > 0 ? tacticsDim : d));
  } else {
    dimensions = ALL_DIMS.map((dim) => (dim === 'tactics' ? tacticsDim : placeholderDim(dim)));
  }

  // Strengths / weaknesses. Per-motif covers the tactics granularity, so the dim
  // loop skips 'tactics' to avoid double-counting.
  const sortedMotifs = [...motifs].sort((a, b) => a.delta - b.delta); // weakest first
  const weaknesses: string[] = [];
  const strengths: string[] = [];
  for (const m of sortedMotifs) if (m.delta <= WEAKNESS_DELTA) weaknesses.push(motifLabel(m.theme));
  for (const m of [...sortedMotifs].reverse()) if (m.delta >= STRENGTH_DELTA) strengths.push(motifLabel(m.theme));

  const sortedDims = dimensions.filter((d) => d.sampleSize > 0 && d.dimension !== 'tactics').sort((a, b) => a.score - b.score);
  for (const d of sortedDims) if (d.score <= WEAKNESS_DIM) weaknesses.push(DIM_LABELS[d.dimension]);
  for (const d of [...sortedDims].reverse()) if (d.score >= STRENGTH_DIM) strengths.push(DIM_LABELS[d.dimension]);

  return {
    assessedAt,
    puzzleRating,
    motifs,
    dimensions,
    strengths,
    weaknesses,
    source: { ladders: motifs.length > 0, game: !!gameDimensions },
    gameAnalyzed: !!gameDimensions,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/coach/diagnostic.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/coach/diagnostic.ts src/coach/diagnostic.test.ts
git commit -m "feat(coach): buildCoachProfile diagnostic core + tests"
```

---

## Task 3: Program core (`buildCoachProgram`)

**Files:**
- Create: `src/coach/program.ts`
- Test: `src/coach/program.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildCoachProgram, profileToLeaks, scenarioForFocus } from './program';
import type { CoachProfile } from './types';
import type { DimensionScore } from '../analysis/weakness';

const dim = (dimension: DimensionScore['dimension'], score: number, sampleSize = 6): DimensionScore => ({ dimension, score, detail: 'x', sampleSize });

function profile(over: Partial<CoachProfile> = {}): CoachProfile {
  return {
    assessedAt: 1, puzzleRating: 1200, motifs: [], dimensions: [], strengths: [], weaknesses: [],
    source: { ladders: true, game: false }, gameAnalyzed: false, ...over,
  };
}

describe('scenarioForFocus', () => {
  it('maps focus to a stable IMBALANCE_LIBRARY id', () => {
    expect(scenarioForFocus('endgame conversion')).toBe('rook-up');
    expect(scenarioForFocus('opposite-side attack')).toBe('opp-castle');
    expect(scenarioForFocus('fork')).toBe('iqp');
  });
});

describe('buildCoachProgram routing', () => {
  it('routes weak motifs to themed tactics, worst-first', () => {
    const p = profile({ motifs: [
      { theme: 'pin', rating: 1100, baseline: 1200, delta: -100, n: 4 },
      { theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 },
    ] });
    const plan = buildCoachProgram(p, 30);
    expect(plan[0]).toMatchObject({ activity: 'tactics', focus: 'fork' }); // worst first
    expect(plan[1]).toMatchObject({ activity: 'tactics', focus: 'pin' });
  });

  it('routes the endgame motif to endgames', () => {
    const p = profile({ motifs: [{ theme: 'endgame', rating: 1000, baseline: 1200, delta: -200, n: 4 }] });
    expect(buildCoachProgram(p, 30)[0]).toMatchObject({ activity: 'endgames' });
  });

  it('routes weak game dimensions to drills AND game modes', () => {
    const p = profile({ dimensions: [
      dim('openingAccuracy', 25), dim('timeManagement', 20), dim('resilience', 15), dim('endgameConversion', 30),
    ] });
    const acts = buildCoachProgram(p, 60).map((s) => `${s.activity}:${s.focus}`);
    expect(acts).toContain('repertoire:opening lines');
    expect(acts).toContain('play-steered:openingAccuracy');
    expect(acts).toContain('tactics:time');         // timeManagement → timed tactics
    expect(acts).toContain('comeback:defend & recover');
    expect(acts).toContain('endgames:endgame conversion');
  });

  it('respects the minute budget', () => {
    const p = profile({ motifs: [
      { theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 },
      { theme: 'pin', rating: 950, baseline: 1200, delta: -250, n: 4 },
      { theme: 'skewer', rating: 980, baseline: 1200, delta: -220, n: 4 },
    ] });
    const total = buildCoachProgram(p, 10).reduce((s, i) => s + i.minutes, 0);
    expect(total).toBeLessThanOrEqual(10);
  });

  it('falls back to a maintenance step when nothing is weak', () => {
    const plan = buildCoachProgram(profile(), 30);
    expect(plan).toHaveLength(1);
    expect(plan[0].activity).toBe('tactics');
  });
});

describe('profileToLeaks', () => {
  it('emits one worst-first leak per weak motif, no fens', () => {
    const p = profile({ motifs: [
      { theme: 'pin', rating: 1150, baseline: 1200, delta: -50, n: 4 },
      { theme: 'fork', rating: 900, baseline: 1200, delta: -300, n: 4 },
    ] });
    const leaks = profileToLeaks(p);
    expect(leaks.map((l) => l.key)).toEqual(['fork', 'pin']);
    expect(leaks[0].sampleFens).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/coach/program.test.ts`
Expected: FAIL — "Failed to resolve import './program'".

- [ ] **Step 3: Write the implementation**

```ts
// Coach program core (ADR-0045). PURE. Turns a CoachProfile into a worst-first,
// budgeted PlanItem[] routed to drills AND game modes. Deliberately does NOT call
// or mutate buildStudyPlan — Insights stays byte-identical (AP-COACH-1).

import type { PlanItem } from '../analysis/studyPlan';
import type { Leak } from '../analysis/fingerprint';
import type { CoachProfile } from './types';

const WEAKNESS_DELTA = -40;
const WEAKNESS_DIM = 35;

/** Deterministic focus → IMBALANCE_LIBRARY id (ids exist in analysis/scenarios.ts). */
export function scenarioForFocus(focus: string): string {
  const f = focus.toLowerCase();
  if (f.includes('endgame') || f.includes('rook')) return 'rook-up';
  if (f.includes('castl') || f.includes('attack') || f.includes('resilien')) return 'opp-castle';
  return 'iqp';
}

/** Synthesize ranked pseudo-leaks (weak motifs, worst-first) — for callers that want the leak shape. */
export function profileToLeaks(profile: CoachProfile): Leak[] {
  return profile.motifs
    .filter((m) => m.delta <= WEAKNESS_DELTA)
    .sort((a, b) => a.delta - b.delta)
    .map((m) => ({
      key: m.theme,
      motif: m.theme,
      phase: m.theme === 'endgame' ? 'endgame' : 'middlegame',
      count: Math.max(1, Math.round(-m.delta / 50)),
      avgWpl: Math.min(100, -m.delta / 5),
      sampleFens: [],
      severity: { mistake: 1, blunder: 0 },
    }));
}

export function buildCoachProgram(profile: CoachProfile, minutes = 30): PlanItem[] {
  const plan: PlanItem[] = [];
  let used = 0;
  const take = (m: number) => Math.min(m, Math.max(0, minutes - used));

  // 1) Weak motifs → themed tactics (endgame motif → endgames). Worst-first.
  const weakMotifs = profile.motifs.filter((m) => m.delta <= WEAKNESS_DELTA).sort((a, b) => a.delta - b.delta);
  for (const m of weakMotifs) {
    const mins = take(8);
    if (mins <= 0) break;
    if (m.theme === 'endgame') {
      plan.push({ activity: 'endgames', focus: 'endgame conversion', minutes: mins, reason: `Endgame puzzles −${-m.delta} vs your baseline — drill conversion.` });
    } else {
      plan.push({ activity: 'tactics', focus: m.theme, minutes: mins, reason: `${m.theme} −${-m.delta} vs your baseline — drill the pattern.` });
    }
    used += mins;
  }

  // 2) Weak game dimensions → matching drill / game mode. Worst-first.
  const weakDims = profile.dimensions.filter((d) => d.sampleSize > 0 && d.score <= WEAKNESS_DIM).sort((a, b) => a.score - b.score);
  for (const d of weakDims) {
    if (used >= minutes) break;
    if (d.dimension === 'endgameConversion') {
      const m = take(8); if (m > 0) { plan.push({ activity: 'endgames', focus: 'endgame conversion', minutes: m, reason: `Endgame conversion is a weak spot (score ${d.score}).` }); used += m; }
    } else if (d.dimension === 'openingAccuracy') {
      const m1 = take(6); if (m1 > 0) { plan.push({ activity: 'repertoire', focus: 'opening lines', minutes: m1, reason: `Opening accuracy is a weak spot (score ${d.score}).` }); used += m1; }
      const m2 = take(8); if (m2 > 0) { plan.push({ activity: 'play-steered', focus: 'openingAccuracy', minutes: m2, reason: 'Play a game where the bot steers into your opening gap.' }); used += m2; }
    } else if (d.dimension === 'timeManagement') {
      const m = take(6); if (m > 0) { plan.push({ activity: 'tactics', focus: 'time', minutes: m, reason: `Time management is a weak spot (score ${d.score}) — solve under a clock.` }); used += m; }
    } else if (d.dimension === 'resilience') {
      const m = take(8); if (m > 0) { plan.push({ activity: 'comeback', focus: 'defend & recover', minutes: m, reason: `Resilience is a weak spot (score ${d.score}) — practise worse positions.` }); used += m; }
    }
    // 'tactics' dim intentionally skipped — covered by per-motif steps.
  }

  // 3) Nothing flagged → light maintenance.
  if (plan.length === 0) {
    plan.push({ activity: 'tactics', focus: 'mixed', minutes: Math.min(10, minutes), reason: 'No clear weakness surfaced — keep your pattern recognition sharp.' });
  }
  return plan;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/coach/program.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/coach/program.ts src/coach/program.test.ts
git commit -m "feat(coach): buildCoachProgram routing core + tests"
```

---

## Task 4: Widen the activity / step-kind unions (additive)

**Files:**
- Modify: `src/analysis/studyPlan.ts:10`
- Modify: `src/analysis/session.ts:10`
- Test: `src/analysis/session.test.ts`

- [ ] **Step 1: Write the failing passthrough test**

Add to `src/analysis/session.test.ts`:

```ts
import { buildSession } from './session';
import type { PlanItem } from './studyPlan';

it('passes new coach game-mode kinds through buildSession unchanged', () => {
  const plan: PlanItem[] = [
    { activity: 'sparring', focus: 'iqp', minutes: 8, reason: 'r' },
    { activity: 'play-steered', focus: 'openingAccuracy', minutes: 8, reason: 'r' },
  ];
  const kinds = buildSession(plan, { includeReview: false }).steps.map((s) => s.kind);
  expect(kinds).toContain('sparring');
  expect(kinds).toContain('play-steered');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/analysis/session.test.ts`
Expected: FAIL — `'sparring'` not assignable to `PlanItem.activity`.

- [ ] **Step 3: Widen `PlanItem.activity` in `studyPlan.ts`**

Change line 10 from:
```ts
  activity: 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision';
```
to:
```ts
  activity: 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'vision' | 'sparring' | 'play-steered';
```

- [ ] **Step 4: Widen `SessionStepKind` in `session.ts`**

Change the union (lines 10-11) from:
```ts
export type SessionStepKind =
  | 'vision' | 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'review' | 'reflection';
```
to:
```ts
export type SessionStepKind =
  | 'vision' | 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'review' | 'reflection'
  | 'sparring' | 'play-steered';
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/analysis/session.test.ts && npm run check`
Expected: PASS, 0 type errors. (`buildSession` already does `kind: item.activity`; no logic change.)

- [ ] **Step 6: Commit**

```bash
git add src/analysis/studyPlan.ts src/analysis/session.ts src/analysis/session.test.ts
git commit -m "feat(coach): widen activity/step-kind unions for game modes (additive)"
```

---

## Task 5: App state — `coach` view + seeding signals

**Files:**
- Modify: `src/state/app.svelte.ts`

- [ ] **Step 1: Add `'coach'` to the `View` union**

In the `export type View =` union (line 10-32), add `| 'coach'` (e.g. after `| 'session'`).

- [ ] **Step 2: Add the seeding signals**

After the `activeSession` field (line 51), add:

```ts
  /** Set by a coach 'sparring' program step; consumed once by Sparring.svelte to auto-open a scenario. */
  sparringScenarioId = $state<string | null>(null);
  /** Set by a coach 'play-steered' program step; consumed once by Play.svelte to override the steer dimension. */
  steerDimension = $state<import('../analysis/weakness').Dimension | null>(null);
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/state/app.svelte.ts
git commit -m "feat(coach): add coach view + sparringScenarioId/steerDimension signals"
```

---

## Task 6: Persist the profile on `PlayerModel` (additive, no DB bump)

**Files:**
- Modify: `src/store/db.ts` (`interface PlayerModel`, line 51-68)

- [ ] **Step 1: Add the optional fields**

Inside `interface PlayerModel`, before `onboarded: boolean;`, add:

```ts
  /** Coach mode (ADR-0045): last assessment + the prior one for a delta. Additive;
   *  old records lack it and read `undefined`. NO DB_VERSION bump. */
  coachProfile?: import('../coach/types').CoachProfile;
  coachProfilePrev?: import('../coach/types').CoachProfile;
```

- [ ] **Step 2: Verify no migration is needed**

Confirm `DB_VERSION` (line 109) is still `4` and unchanged. Optional fields require no `upgrade` change (mirrors `conceptSeen?`/`visionStats?`).

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/db.ts
git commit -m "feat(coach): persist coachProfile on PlayerModel (additive, no DB bump)"
```

---

## Task 7: The Coach wizard view

**Files:**
- Create: `src/ui/Coach.svelte`

> **Pattern source:** `src/ui/Onboarding.svelte` — copy its ladder loop (`nextLadderPuzzle`/`onLadderMove`) and game loop (`startCalibrationGame`/`onGameMove`/`engineReply`) structure. The board markup is identical to `Onboarding.svelte` lines 251-261. The differences from Onboarding are: (a) the ladder runs once **per theme** in `THEMES`, collecting `ThemeProbeResult[]`; (b) the game is analysed via `runAnalysis(source:'played')` instead of seeding a rating; (c) the result builds + persists a `CoachProfile` and offers "Start coaching session".

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import Radar from './Radar.svelte';
  import { ChessGame } from '../game/ChessGame';
  import { PuzzleLadder } from '../calibration/Calibration';
  import { TacticalTrainer } from '../trainer/TacticalTrainer';
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { runAnalysis } from '../analysis/runAnalysis';
  import { buildWeaknessProfile } from '../analysis/weakness';
  import { buildCoachProfile, COACH_MOTIF_PROBES, COACH_LADDER_MIN, COACH_LADDER_MAX } from '../coach/diagnostic';
  import { buildCoachProgram } from '../coach/program';
  import { buildSession } from '../analysis/session';
  import type { CoachProfile, ThemeProbeResult } from '../coach/types';
  import { poolRating, poolOpponent } from '../store/playerModel';

  type Step = 'intro' | 'ladders' | 'offer-game' | 'game' | 'analysing' | 'result';
  let step = $state<Step>('intro');

  const THEMES: Array<{ theme: string; phase?: 'endgame' }> = [
    ...COACH_MOTIF_PROBES.map((t) => ({ theme: t })),
    { theme: 'endgame', phase: 'endgame' as const },
  ];
  let themeIdx = $state(0);
  const baseline = () => (app.model ? Math.round(app.model.puzzleRating.rating) : 1200);

  // Ladder state (per theme).
  let ladder: PuzzleLadder | null = null;
  let trainer = $state<TacticalTrainer | null>(null);
  let display = $state(new ChessGame());
  let fen = $state('');
  let orientation = $state<'white' | 'black'>('white');
  let feedback = $state('');
  const probes: ThemeProbeResult[] = [];

  // Game state.
  let game = $state(new ChessGame());
  let gameFen = $state('');
  let opponent: AdaptiveOpponent | null = null;
  let thinking = $state(false);
  let info = $state('');
  const GAME_MOVE_LIMIT = 24;

  let profile = $state<CoachProfile | null>(null);

  function startLadders() {
    themeIdx = 0;
    probes.length = 0;
    step = 'ladders';
    startThemeLadder();
  }

  function startThemeLadder() {
    const t = THEMES[themeIdx];
    const prior = app.model ? app.model.puzzleRating : { rating: 1200, rd: 250, vol: 0.06 };
    ladder = new PuzzleLadder(app.puzzles, prior);
    // Shorten the ladder for a quick per-theme probe.
    (ladder as unknown as { isDone(): boolean }).isDone = function (this: PuzzleLadder) {
      if (this.count >= COACH_LADDER_MAX) return true;
      return this.count >= COACH_LADDER_MIN && this.rating.rd <= 90;
    };
    nextProbePuzzle();
  }

  function nextProbePuzzle() {
    if (!ladder) return;
    const t = THEMES[themeIdx];
    if (ladder.isDone()) return finishThemeLadder();
    // Themed pull: filter by motif theme, or phase for the endgame probe.
    const puzzle = app.puzzles.next({
      rating: ladder.rating.rating,
      window: 300,
      exclude: ladder.attempted,
      themes: t.phase ? undefined : [t.theme],
      phase: t.phase,
    });
    if (!puzzle) return finishThemeLadder(); // empty theme → n stays at ladder.count
    ladder.attempted.add(puzzle.id);
    trainer = new TacticalTrainer(puzzle, Date.now());
    (ladder as unknown as { current: unknown }).current = { trainer, puzzle };
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    orientation = display.turn === 'w' ? 'white' : 'black';
    feedback = '';
  }

  function onLadderMove(from: string, to: string) {
    if (!trainer || !ladder) return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);
    if (res === 'wrong') { ladder.report(false); feedback = 'Missed.'; setTimeout(nextProbePuzzle, 450); }
    else if (res === 'solved') { ladder.report(true); feedback = 'Solved ✔'; setTimeout(nextProbePuzzle, 400); }
    else { display = new ChessGame(trainer.getFen()); fen = display.fen; }
  }

  function finishThemeLadder() {
    if (!ladder) return;
    const t = THEMES[themeIdx];
    probes.push({ theme: t.theme, rating: Math.round(ladder.rating.rating), n: ladder.count });
    themeIdx += 1;
    if (themeIdx >= THEMES.length) { step = 'offer-game'; return; }
    startThemeLadder();
  }

  async function startGame() {
    step = 'game';
    game = new ChessGame();
    gameFen = game.fen;
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(baseline()));
    thinking = true; info = 'Starting engine…';
    try { await opponent.applyStrength(); info = 'Your move — play naturally.'; }
    catch { return finishWithoutGame(); }
    thinking = false;
  }

  async function onGameMove(from: string, to: string) {
    if (!opponent || game.turn !== 'w' || thinking) return;
    await app.engine.resetVariant();
    const san = game.move(from, to, 'q');
    if (!san) return;
    gameFen = game.fen;
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) return finishGame();
    thinking = true;
    try { const uci = await opponent.pickMove(game.fen, 400); if (uci) { game.moveUci(uci); gameFen = game.fen; } } catch { /* ignore */ }
    thinking = false;
    if (game.terminal().over || game.history().length >= GAME_MOVE_LIMIT) finishGame();
  }

  async function finishGame() {
    step = 'analysing';
    info = 'Analysing your game…';
    let gameDimensions = null;
    try {
      const { analysis } = await runAnalysis(app.engine, app.puzzles, {
        gameId: `coach-${Date.now()}`,
        pgn: game.pgn(),
        playerColor: 'w',
        source: 'played',
        baseRating: baseline(),
        now: Date.now(),
      });
      gameDimensions = buildWeaknessProfile([analysis], baseline()).dimensions;
    } catch { /* fall through with no game dims */ }
    await commit(gameDimensions);
  }

  async function finishWithoutGame() { await commit(null); }

  async function commit(gameDimensions: import('../analysis/weakness').DimensionScore[] | null) {
    profile = buildCoachProfile({ puzzleRating: baseline(), probes, gameDimensions, assessedAt: Date.now() });
    if (app.model) {
      app.model.coachProfilePrev = app.model.coachProfile;
      app.model.coachProfile = profile;
      await app.persistModel(Date.now());
    }
    step = 'result';
  }

  function startCoaching() {
    if (!profile) return;
    const plan = buildCoachProgram(profile, 30);
    app.activeSession = { plan: buildSession(plan), current: 0, startedAt: Date.now(), reflection: '' };
    app.go('session');
  }
</script>

<section class="col center" style="max-width:680px;margin:0 auto">
  <h2>Personal coaching</h2>

  {#if step === 'intro'}
    <p class="muted">A short adaptive assessment across tactical motifs and (optionally) a quick game,
      then a program of drills and game modes aimed at your weak spots. Directional, not a grade.</p>
    <button onclick={startLadders} disabled={app.puzzles.size === 0}>Start the assessment →</button>
    {#if app.puzzles.size === 0}<p class="muted">Loading puzzles…</p>{/if}

  {:else if step === 'ladders'}
    <p class="muted">Probing <b>{THEMES[themeIdx].theme}</b> ({themeIdx + 1}/{THEMES.length}) — solve it.</p>
    <div class="board-wrap">
      <Board {fen} {orientation}
        turnColor={display.turn === 'w' ? 'white' : 'black'}
        movableColor={display.turn === 'w' ? 'white' : 'black'}
        dests={display.dests()} check={display.inCheck()} onMove={onLadderMove} />
    </div>
    <p class="feedback">{feedback}</p>

  {:else if step === 'offer-game'}
    <div class="panel col center">
      <h3>Assessment ladders done</h3>
      <p class="muted">Optional: play a short game (~12 moves) so we can also assess opening accuracy,
        time, and resilience — things puzzles can't measure.</p>
      <div class="row center">
        <button onclick={startGame}>Play the game →</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={finishWithoutGame}>Skip</button>
      </div>
    </div>

  {:else if step === 'game'}
    <p class="muted">{info}</p>
    <div class="board-wrap">
      <Board fen={gameFen} orientation="white"
        turnColor={game.turn === 'w' ? 'white' : 'black'}
        movableColor={!thinking && game.turn === 'w' ? 'white' : undefined}
        dests={!thinking && game.turn === 'w' ? game.dests() : new Map()}
        check={game.inCheck()} onMove={onGameMove} />
    </div>
    {#if thinking}<p class="feedback">Bot thinking…</p>{/if}

  {:else if step === 'analysing'}
    <p class="muted">{info}</p>

  {:else if step === 'result' && profile}
    <div class="panel col center" style="gap:0.75rem;width:100%">
      <h3>Your coaching profile</h3>
      <Radar dimensions={profile.dimensions} />
      <p class="muted" style="font-size:0.8rem">Directional — built from {profile.source.ladders ? 'adaptive puzzle probes' : 'no puzzle data'}{profile.source.game ? ' + one short game' : ''}. Small samples; treat as "where to focus".</p>
      <div class="row" style="gap:1.5rem;align-items:flex-start">
        <div class="col"><b>Strengths</b>{#each profile.strengths as s}<span>✔ {s}</span>{:else}<span class="muted">—</span>{/each}</div>
        <div class="col"><b>Focus on</b>{#each profile.weaknesses as w}<span>△ {w}</span>{:else}<span class="muted">—</span>{/each}</div>
      </div>
      <h4>Your program</h4>
      <ol style="text-align:left">
        {#each buildCoachProgram(profile, 30) as item}
          <li><b>{item.activity}</b> — {item.focus} <span class="muted">({item.minutes}m · {item.reason})</span></li>
        {/each}
      </ol>
      <div class="row center">
        <button onclick={startCoaching}>▶ Start coaching session</button>
        <button style="background:transparent;border:1px solid var(--border)" onclick={() => app.go('home')}>Later</button>
      </div>
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors.

> Note: the `isDone`/`current` overrides above access `PuzzleLadder` internals to shorten the probe. If `npm run check` rejects the casts, the cleaner fix is to add an optional `{ min, max }` ctor option to `PuzzleLadder` in `calibration/Calibration.ts` (additive, default 6/10) and pass `{ min: COACH_LADDER_MIN, max: COACH_LADDER_MAX }`. Prefer that if the cast is noisy — update `Calibration.ts` and its test accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Coach.svelte
git commit -m "feat(coach): Coach wizard view (themed ladders + game + profile/program)"
```

---

## Task 8: Session runner — route + seed coach game modes

**Files:**
- Modify: `src/ui/Session.svelte` (`TRAINER_VIEW` line 45-48; `launch()` line 91-100)

- [ ] **Step 1: Extend `TRAINER_VIEW`**

Change the map to add the new kinds:
```ts
  const TRAINER_VIEW: Record<string, import('../state/app.svelte').View> = {
    vision: 'vision', tactics: 'tactics', endgames: 'endgames',
    repertoire: 'repertoire', comeback: 'comeback', review: 'review',
    sparring: 'sparring', 'play-steered': 'play',
  };
```

- [ ] **Step 2: Seed the signals in `launch()`**

Add an import at the top of the script:
```ts
  import { scenarioForFocus } from '../coach/program';
  import type { Dimension } from '../analysis/weakness';
```
Then in `launch(s)`, before the `const view = TRAINER_VIEW[s.kind];` line, add:
```ts
    if (s.kind === 'sparring') app.sparringScenarioId = scenarioForFocus(s.focus);
    if (s.kind === 'play-steered') app.steerDimension = s.focus as Dimension;
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Session.svelte
git commit -m "feat(coach): Session runner routes + seeds sparring/play-steered steps"
```

---

## Task 9: Sparring consumes the scenario signal

**Files:**
- Modify: `src/ui/Sparring.svelte` (`onMount`, line 27-33)

- [ ] **Step 1: Auto-open the seeded scenario**

In `onMount`, after `scenarios = [...IMBALANCE_LIBRARY, ...w];`, add:
```ts
    if (app.sparringScenarioId) {
      const seeded = scenarios.find((s) => s.id === app.sparringScenarioId);
      app.sparringScenarioId = null; // consume once
      if (seeded) await start(seeded);
    }
```
(`start` is the existing scenario-start function in this component.)

- [ ] **Step 2: Typecheck + smoke**

Run: `npm run check`
Expected: 0 errors. Manual: from a coach program with a `sparring` step, "Open sparring" auto-loads the imbalance position (not the picker).

- [ ] **Step 3: Commit**

```bash
git add src/ui/Sparring.svelte
git commit -m "feat(coach): Sparring auto-opens a coach-seeded scenario"
```

---

## Task 10: Play consumes the steer-dimension override

**Files:**
- Modify: `src/ui/Play.svelte` (opening-steer block, around line 136-145)

- [ ] **Step 1: Override the steered dimension when set**

In the block that computes `weakest` from analysed games (before `opening = selectOpening('b', weakest, …)`), add an override:
```ts
      // Coach 'play-steered' override: steer to the coach-diagnosed dimension if set.
      let weakestDim = weakest;
      if (app.steerDimension) { weakestDim = app.steerDimension; app.steerDimension = null; }
```
Then pass `weakestDim` into `selectOpening('b', weakestDim, Math.random())` and `steeringNote(opening, weakestDim)`.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Play.svelte
git commit -m "feat(coach): Play honors coach steerDimension override"
```

---

## Task 11: Comeback Sparring fallback when empty (Q-C)

**Files:**
- Modify: `src/ui/Comeback.svelte` (the `status === 'empty'` branch, around line 123-126)

- [ ] **Step 1: Offer a defensive sparring fallback**

In the `empty` branch UI, add a button beside the existing message:
```svelte
      <button onclick={() => { app.sparringScenarioId = 'opp-castle'; app.go('sparring'); }}>
        Defensive sparring instead →
      </button>
```
(Imports `app` already present in this file.)

- [ ] **Step 2: Typecheck + smoke**

Run: `npm run check`
Expected: 0 errors. Manual: a coach resilience step on a fresh profile (no comeback positions) → Comeback shows the fallback button → Sparring opens `opp-castle`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Comeback.svelte
git commit -m "feat(coach): Comeback offers a defensive Sparring fallback when empty"
```

---

## Task 12: Entry points (render + navigation)

**Files:**
- Modify: `src/ui/App.svelte`, `src/ui/Home.svelte`, `src/ui/Insights.svelte`, `src/ui/Settings.svelte`

- [ ] **Step 1: Render `Coach` in `App.svelte`**

Import `Coach` and add the branch alongside the other views (match the file's existing `{:else if app.view === '…'}` pattern):
```svelte
  {:else if app.view === 'coach'}
    <Coach />
```
with `import Coach from './Coach.svelte';` at the top.

- [ ] **Step 2: Home entry**

In `src/ui/Home.svelte`, after the "Weakness dashboard" button (line 35), add:
```svelte
    <button onclick={() => app.go('coach')}>Personal coaching</button>
```

- [ ] **Step 3: Insights entry**

In `src/ui/Insights.svelte`, near the "Start session" button (line 82), add:
```svelte
    <button onclick={() => app.go('coach')} style="align-self:flex-start">▶ Coaching assessment</button>
```

- [ ] **Step 4: Settings re-run entry**

In `src/ui/Settings.svelte`, near the "Re-run skill evaluation" control, add an equivalent:
```svelte
    <button class="ghost" onclick={() => app.go('coach')}>Re-run coaching assessment</button>
```
(If Settings has no skill-eval button, place it in the same section as other navigation/ghost buttons.)

- [ ] **Step 5: Typecheck + build**

Run: `npm run check && npm run build`
Expected: 0 errors; build green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.svelte src/ui/Home.svelte src/ui/Insights.svelte src/ui/Settings.svelte
git commit -m "feat(coach): wire Coach view into App + Home/Insights/Settings entry points"
```

---

## Task 13: Docs — ADR-0045 + README (LAST)

**Files:**
- Modify: `decisions.md` (append-only), `README.md`

- [ ] **Step 1: Append ADR-0045 to `decisions.md`**

Append (do NOT amend prior ADRs):
```markdown
## ADR-0045 — Coach mode: active multi-dimensional diagnostic reusing the calibration method

**Context.** The weakness radar (ADR-0027) and the practice session (ADR-0039) are driven by analysed
*played* games — blank for a new/returning player. The launch calibration (ADR-0005) is the opposite:
an adaptive probe needing no history, but it outputs only two scalar ratings.

**Decision.** Add a re-runnable Coach mode that reuses the calibration method — the Glicko `PuzzleLadder`
run once per geometric motif (fork·pin·skewer·hangingPiece·discoveredAttack·mate) + an endgame-phase
probe, plus the optional calibration game analysed through `runAnalysis(source:'played')` — to build a
`CoachProfile` (per-motif deltas vs the puzzle-rating baseline + the 5-dim radar). The profile drives a
prioritized program of drills AND game modes via the existing `buildSession` runner.

- Profile persists as additive `PlayerModel.coachProfile? + coachProfilePrev?` (delta over re-runs).
  **No `DB_VERSION` bump** — schema stays v4 (precedent: ADR-0040 `conceptSeen?`, ADR-0043 `visionStats?`).
- Program routes to game modes via additive `SessionStepKind`/`PlanItem.activity` values `'sparring'`
  and `'play-steered'`, plus one-shot `app.sparringScenarioId` / `app.steerDimension` signals.
- Q-A: the diagnostic game is persisted via `runAnalysis(source:'played')` (feeds the loop, seeds
  downstream Comeback/Sparring/Play-steer). Q-B: program steps auto-seed the exact scenario/dimension.
  Q-C: resilience falls back to a defensive Sparring imbalance when no comeback positions exist.
  Q-D: `COACH_LADDER_MIN/MAX = 3/5` per theme.

**Honesty.** Directional, not a grade (cf. AP-CHESS-13/24): per-motif from 3–5 puzzles and one short game
are low-n; every score carries a sample-size / data-source label; empty-theme probes are dropped, never
scored as a weakness.

**Consequences.** `buildStudyPlan` (Insights) is untouched — `buildCoachProgram` is a separate core, the
union widening is type-only. Deferred: multi-day scheduling, a separate coach rating pool, Chess960 probe.

Cross-links: ADR-0005 (calibration), ADR-0027 (weakness fingerprint/study plan), ADR-0039 (session runner).
```

- [ ] **Step 2: Add a README line**

Under "### Train & retain" (or "### Play & calibrate"), add:
```markdown
- **Personal coaching** — a re-runnable adaptive assessment (the launch-eval method, run across tactical
  motifs + an optional short game) that maps your strengths and weak spots, then builds a dedicated
  program of drills **and** game modes targeting them. Directional pointers, not a grade.
```

- [ ] **Step 3: Commit**

```bash
git add decisions.md README.md
git commit -m "docs(coach): ADR-0045 + README feature line"
```

---

## Task 14: Final verification gates

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all prior 376 + new `coach/*` + session passthrough tests green; no regression.

- [ ] **Step 2: Type check**

Run: `npm run check`
Expected: `svelte-check` 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: green.

- [ ] **Step 4: Manual smoke (per spec §6)**

Home → Personal coaching → complete ladders → Skip game → profile renders (game-only dims show placeholders) → Start coaching session → `Session.svelte` resumes the coach program (no history rebuild) → a `sparring` step auto-opens its scenario; re-run from Settings → `coachProfilePrev` populated.

- [ ] **Step 5: Final commit (if any smoke fixes)**

```bash
git add -A && git commit -m "test(coach): verification pass green"
```

---

## Self-Review

**Spec coverage:**
- §2.1 types → Task 1 ✓; §2.2 diagnostic → Task 2 ✓; §2.3 program → Task 3 ✓; §2.4 unions → Task 4 ✓; §2.5 view/field → Tasks 5–6 ✓; §2.6 signals + reads → Tasks 8–11 ✓; §2.7 entry points → Task 12 ✓; §2.8 tests → Tasks 2,3,4 ✓; docs → Task 13 ✓.
- §4 A1–A11 each map to a task. Q-A (Task 7 `runAnalysis`), Q-B (Tasks 8–10), Q-C (Task 11), Q-D (Task 2 constants) ✓.
- §6 gates → Task 14 ✓. §9 anti-patterns honored: AP-COACH-1 (separate program core, Task 3), -3 (pure cores, Tasks 2-3), -4 (no DB bump, Task 6), -5 (Comeback fallback, Task 11), -7 (Coach pre-sets activeSession, Task 7), -8 (reads puzzleRating only, Task 7).

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" — every code step has full content. Test code is concrete.

**Type consistency:** `buildCoachProfile({puzzleRating, probes, gameDimensions, assessedAt})` signature identical in Task 2 def, Task 7 call. `ThemeProbeResult{theme,rating,n}` consistent Tasks 1/2/7. `buildCoachProgram(profile, minutes)` consistent Tasks 3/7. `scenarioForFocus` defined Task 3, used Task 8. New union members `'sparring'|'play-steered'` consistent Tasks 4/7/8. `app.sparringScenarioId`/`app.steerDimension` defined Task 5, consumed Tasks 8/9/10/11.

**Known risk flagged inline:** Task 7 Step 2 note — `PuzzleLadder` internal override may need an additive `{min,max}` ctor option in `Calibration.ts` if the cast fails type-check. Fallback path documented.
