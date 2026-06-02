# Efficacy Readout + Practice-Session Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a descriptive per-motif before/after efficacy readout (shipped first) and a guided deliberate-practice session runner that drives the existing trainers end-to-end, both as pure cores + thin UI, with zero schema change.

**Architecture:** Two pure, `Date`-free analysis cores (`efficacy.ts`, `session.ts`) feed two thin Svelte 5 surfaces (an Insights "Did it move?" panel and a new `'session'` View). The efficacy readout reuses a shared `leakKey(ply)` helper extracted from `fingerprint.ts` so the readout and the leak list never disagree about what "fork" means; the runner reuses `buildStudyPlan` + the Insights/`drillTarget` leak→trainer mapping and launches the real trainers via existing `app` signal flags. No new IndexedDB object store, no `DB_VERSION` bump (stays v4); session reflection is display-only and not persisted.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite, Vitest (pure-core unit tests), IndexedDB via `idb` (read-only here, no schema touch).

---

## Decisions locked (spec §0.6 — build to these, do NOT revisit)

- **Q-A = SPLIT, readout first.** PHASE 1 (efficacy readout: `efficacy.ts` + shared `leakKey` + Insights panel) ships and is committed **before** PHASE 2 (session runner). The readout is independently shippable and revertable (zero-schema, zero-nav).
- **Q-B = DERIVE, NO bump.** The `sessions` object store and `src/store/sessionStore.ts` are **NOT built**. `DB_VERSION` stays **4**. No `SessionRecord`, no `saveSession`, no `db.ts`/`db.test.ts` change. Session reflection is **display-only, never persisted** (documented limitation; persistence is a §11 follow-up). Spec §4.5 and §5.3 are therefore **N/A and intentionally skipped**.
- **Q-C** = verbatim honesty caveat (the spec-fixed string in §4.4) shown wherever a Δ appears.
- **Q-D** = two-window early/recent split at the **median** `analyzedAt`, phase-scoped denominator, `minMoves` gate (default 20).
- **Q-E** = runner launches the existing trainers via signal flags + `app.go(...)` (no trainer reimplementation). This plan uses the **flag + `app.go`** orchestration (the trainer renders; the user returns to the session via the top-nav "Session" arm), keeping the core pure.
- **Q-F** = Review step included when `dueCount(now) > 0`.
- **Q-G** = entry is an Insights "Start session" button; **no new top-nav button is required by the spec**, but this plan adds a minimal "Session" nav arm so the user can return to the runner after a trainer launches (Q-E orchestration). This is additive and does not change any existing route.

## Shared modify targets (flag for the executor — touched by more than one task / shared with other specs)

- `src/analysis/fingerprint.ts` — Task 1 extracts `leakKey(ply)`; `buildFingerprint` behavior MUST stay byte-identical.
- `src/ui/Insights.svelte` — Task 3 adds the "Did it move?" panel; Task 9 adds the "Start session" button. Two separate tasks edit this file.
- `src/state/app.svelte.ts` — Task 6 adds `'session'` to the `View` union (and no other change).
- `src/ui/App.svelte` — Task 7 adds the `'session'` route arm + nav button.

> The `time-controls` spec separately reshapes `PlayerModel.gameRating` → `gameRatings`. This plan does **not** touch ratings and mirrors the *current* `app.model?.gameRating.rating ?? 1200` access verbatim. If `time-controls` has already landed when this executes, update that one read to the new shape; otherwise leave it as written here.

## Pre-flight verification (run once before Task 1)

- [ ] Confirm baseline is green: `npm test` (expect 135 passing), `npm run check` (svelte-check 0 errors), `npm run build` (green).
- [ ] Confirm targets are net-new: `src/analysis/efficacy.ts`, `src/analysis/session.ts`, `src/ui/Session.svelte` do **not** exist yet.
- [ ] Confirm `src/store/db.ts` has `export const DB_VERSION = 4;` and `src/store/db.test.ts` asserts a 10-store enumeration — these MUST remain untouched by this plan.

---

# PHASE 1 — Efficacy readout (independently shippable: zero-schema, zero-nav)

## Task 1 — Extract a shared `leakKey(ply)` from `fingerprint.ts`

**Why:** `efficacy.ts` must cluster motifs with the **exact** rule `buildFingerprint` uses, or the Insights leak and its efficacy number will disagree (AP-ES-1). Extract one exported helper and have `buildFingerprint` call it, so there is a single source of truth.

**Files:**
- `src/analysis/fingerprint.ts` (modify — extract + reuse helper; **behavior identical**)
- `src/analysis/fingerprint.test.ts` (create — parity test; this file does not exist yet)

Steps:

1. - [ ] Write a failing test asserting the new `leakKey` export matches the inline rule used by `buildFingerprint`. Create `src/analysis/fingerprint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFingerprint, leakKey } from './fingerprint';
import type { GameAnalysis, PlyAnalysis } from './types';

/** Minimal player ply factory (only fields the fingerprint reads). */
function ply(p: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 0, moveNumber: 1, color: 'w', san: 'Nf3', uci: 'g1f3',
    fenBefore: 'fen', fenAfter: 'fen2',
    bestUci: null, bestWhiteCp: 0, playedWhiteCp: 0, cpLoss: 0,
    winProbLoss: 10, severity: 'mistake', phase: 'middlegame',
    ...p,
  } as PlyAnalysis;
}

function game(plies: PlyAnalysis[]): GameAnalysis {
  return {
    gameId: 'g', source: 'played', playerColor: 'w', analyzedAt: 1, movetimeMs: 100,
    plies,
    byPhase: {
      opening: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      middlegame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
      endgame: { plies: 0, acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
    },
    acpl: 0, blunders: 0, mistakes: 0, inaccuracies: 0, puzzlesGenerated: 0,
  };
}

describe('leakKey', () => {
  it('uses the confident motif tag when confidence is high', () => {
    const p = ply({ motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } });
    expect(leakKey(p)).toBe('fork');
  });

  it('falls back to `${phase}:${severity}` for a low-confidence ply', () => {
    const p = ply({ phase: 'endgame', severity: 'blunder', motif: { tag: 'x', tags: ['x'], confidence: 'low' } });
    expect(leakKey(p)).toBe('endgame:blunder');
  });

  it('falls back when there is no motif at all', () => {
    const p = ply({ phase: 'opening', severity: 'mistake', motif: undefined });
    expect(leakKey(p)).toBe('opening:mistake');
  });

  it('agrees with the key buildFingerprint produces on the same fixture', () => {
    const confident = ply({ motif: { tag: 'pin', tags: ['pin'], confidence: 'high' } });
    const fallback = ply({ phase: 'endgame', severity: 'blunder', motif: undefined });
    const { leaks } = buildFingerprint([game([confident, fallback])]);
    const keys = leaks.map((l) => l.key).sort();
    expect(keys).toEqual(['endgame:blunder', 'pin'].sort());
    expect(keys).toContain(leakKey(confident));
    expect(keys).toContain(leakKey(fallback));
  });
});
```

2. - [ ] Run `npx vitest run src/analysis/fingerprint.test.ts` — expect FAIL (`leakKey` is not exported).

3. - [ ] Add the `leakKey` export to `src/analysis/fingerprint.ts` and rewire `buildFingerprint` to call it (no behavior change). Insert this exported function just below the `Leak` interface (before `buildFingerprint`):

```ts
/** Stable cluster key for a player mistake ply: a confident motif tag, else
 *  `${phase}:${severity}`. SINGLE source of truth shared by buildFingerprint and
 *  the efficacy readout so they never disagree about what "fork" means (AP-ES-1). */
export function leakKey(p: PlyAnalysis): string {
  return p.motif && p.motif.confidence === 'high' ? p.motif.tag : `${p.phase}:${p.severity}`;
}
```

   Then in the `buildFingerprint` loop, replace the inline key computation. Change:

```ts
      const confident = p.motif && p.motif.confidence === 'high';
      const key = confident ? p.motif!.tag : `${p.phase}:${p.severity}`;
      const label = confident ? p.motif!.tag : `${p.phase} ${p.severity}`;
```

   to:

```ts
      const confident = p.motif && p.motif.confidence === 'high';
      const key = leakKey(p);
      const label = confident ? p.motif!.tag : `${p.phase} ${p.severity}`;
```

   (The `label` keeps its space-separated display form; only the `key` is centralized. `confident` is still used for `label`.)

4. - [ ] Run `npx vitest run src/analysis/fingerprint.test.ts` — expect PASS.

5. - [ ] Run `npx vitest run src/analysis/studyPlan.test.ts` to confirm the fingerprint refactor did not perturb downstream consumers — expect PASS. Then `npm run check` — expect 0 errors.

6. - [ ] Commit: `refactor: extract shared leakKey helper from fingerprint (ADR-0039 prep)`

---

## Task 2 — Pure `motifEfficacy` core (`src/analysis/efficacy.ts`)

**Why:** Answer the README's honesty question ("did my fork-miss rate actually fall?") as a **descriptive**, phase-scoped, before/after miss-rate — pure, no `Date`, never a verdict string.

**Files:**
- `src/analysis/efficacy.ts` (create)
- `src/analysis/efficacy.test.ts` (create)

Steps:

1. - [ ] Write the failing test. Create `src/analysis/efficacy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { motifEfficacy } from './efficacy';
import { buildFingerprint } from './fingerprint';
import type { GameAnalysis, PlyAnalysis } from './types';

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
    gameId: `g${analyzedAt}`, source: 'played', playerColor, analyzedAt, movetimeMs: 100,
    plies,
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

/** A game with `misses` fork-mistakes and `clean` good middlegame moves. */
function mg(at: number, misses: number, cleanMoves: number): GameAnalysis {
  const plies = [
    ...Array.from({ length: misses }, () => fork('mistake')),
    ...Array.from({ length: cleanMoves }, () => clean()),
  ];
  return game(at, plies);
}

describe('motifEfficacy', () => {
  it('reports a negative deltaPct when fork-misses fall from early→recent', () => {
    // early (at 1,2): high miss density; recent (at 3,4): low.
    const analyses = [mg(1, 8, 12), mg(2, 8, 12), mg(3, 2, 18), mg(4, 2, 18)];
    const r = motifEfficacy(analyses, 'fork', { minMoves: 5 });
    expect(r.early.missRate).toBeGreaterThan(r.recent.missRate);
    expect(r.deltaPct).toBeLessThan(0); // improved
    expect(r.enoughData).toBe(true);
    expect(r.motifKey).toBe('fork');
  });

  it('reports a positive deltaPct when misses rise', () => {
    const analyses = [mg(1, 2, 18), mg(2, 2, 18), mg(3, 8, 12), mg(4, 8, 12)];
    const r = motifEfficacy(analyses, 'fork', { minMoves: 5 });
    expect(r.deltaPct).toBeGreaterThan(0);
  });

  it('keys exactly like buildFingerprint (parity)', () => {
    const analyses = [mg(1, 4, 8), mg(2, 4, 8)];
    const topKey = buildFingerprint(analyses).leaks[0].key;
    const r = motifEfficacy(analyses, topKey, { minMoves: 1 });
    expect(r.motifKey).toBe(topKey);
    expect(r.early.misses + r.recent.misses).toBeGreaterThan(0);
  });

  it('uses a phase-scoped denominator: unrelated-phase moves do not move the rate', () => {
    const base = [mg(1, 4, 6), mg(2, 4, 6)];
    const r1 = motifEfficacy(base, 'fork', { minMoves: 1 });
    // Add many clean ENDGAME player moves — different phase than the fork misses.
    const withEndgame = [
      game(1, [...base[0].plies, ...Array.from({ length: 50 }, () => ply({ phase: 'endgame', severity: 'good' }))]),
      base[1],
    ];
    const r2 = motifEfficacy(withEndgame, 'fork', { minMoves: 1 });
    expect(r2.early.missRate).toBeCloseTo(r1.early.missRate, 5);
  });

  it('ignores opponent plies (player-moves only)', () => {
    const playerForks = [fork('mistake'), fork('mistake'), clean(), clean()];
    const oppForks = [
      ply({ color: 'b', severity: 'mistake', motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } }),
    ];
    const analyses = [game(1, [...playerForks, ...oppForks], 'w'), game(2, [...playerForks], 'w')];
    const r = motifEfficacy(analyses, 'fork', { minMoves: 1 });
    // 4 player misses total across two windows; opponent fork excluded.
    expect(r.early.misses + r.recent.misses).toBe(4);
  });

  it('gates enoughData=false below minMoves and suppresses no data via zeros, never a verdict string', () => {
    const r = motifEfficacy([mg(1, 1, 1), mg(2, 1, 1)], 'fork', { minMoves: 20 });
    expect(r.enoughData).toBe(false);
    // Type guarantee: the readout exposes numbers, never a verdict label.
    expect(typeof r.deltaPct).toBe('number');
    expect((r as Record<string, unknown>).verdict).toBeUndefined();
  });

  it('returns a zeroed readout for empty input without throwing', () => {
    const r = motifEfficacy([], 'fork');
    expect(r.early).toEqual({ missRate: 0, playerMoves: 0, misses: 0 });
    expect(r.recent).toEqual({ missRate: 0, playerMoves: 0, misses: 0 });
    expect(r.deltaPct).toBe(0);
    expect(r.enoughData).toBe(false);
  });

  it('is deterministic (no Date/random)', () => {
    const a = [mg(1, 4, 8), mg(2, 4, 8), mg(3, 2, 10), mg(4, 2, 10)];
    expect(motifEfficacy(a, 'fork')).toEqual(motifEfficacy(a, 'fork'));
  });
});
```

2. - [ ] Run `npx vitest run src/analysis/efficacy.test.ts` — expect FAIL (module missing).

3. - [ ] Implement the core. Create `src/analysis/efficacy.ts`:

```ts
// Descriptive per-motif before/after miss-rate (ADR-0039). Answers the README's
// honesty question — "I drilled forks; did my fork-miss rate fall?" — as a TWO-window,
// phase-scoped, DESCRIPTIVE statement. No causal claim, no verdict string, no LLM.
// Pure: NO Date, NO Math.random (the caller pins the split boundary; default = median
// analyzedAt). Shares fingerprint's cluster rule via leakKey so a leak and its efficacy
// number can never disagree (AP-ES-1).

import type { GameAnalysis, GamePhase, PlyAnalysis } from './types';
import { leakKey } from './fingerprint';

export interface EfficacyWindow {
  missRate: number;    // misses ÷ phase-scoped player moves, 0..1 (0 when no moves in scope)
  playerMoves: number; // player plies in the motif's phase(s) within this window
  misses: number;      // player mistakes/blunders of this motif within this window
}

export interface EfficacyReadout {
  motifKey: string;            // the leak key being measured (e.g. 'fork', 'endgame:blunder')
  label: string;              // display label (motif tag, or `phase severity`)
  early: EfficacyWindow;      // older window
  recent: EfficacyWindow;     // newer window
  deltaPct: number;           // recent.missRate - early.missRate (negative = improved); 0 when not enough data
  enoughData: boolean;        // both windows have ≥ minMoves player plies in scope
}

const ZERO: EfficacyWindow = { missRate: 0, playerMoves: 0, misses: 0 };

function isFlagged(p: PlyAnalysis): boolean {
  return p.severity === 'mistake' || p.severity === 'blunder';
}

/** Display label matching buildFingerprint's label form for this key. */
function labelFor(motifKey: string): string {
  return motifKey.includes(':') ? motifKey.replace(':', ' ') : motifKey;
}

/** Descriptive before/after miss-rate for ONE motif/leak across the player's analysed
 *  games. Splits the player's flagged plies by analyzedAt into older vs newer halves
 *  (or at opts.splitAt). miss = a player ply flagged mistake|blunder whose leakKey ===
 *  motifKey. denominator = player plies in the SAME phase(s) the motif occurs in, so the
 *  rate reads "when this kind of position arose, how often did I get it wrong" — NOT a
 *  microscopic fraction of all moves (AP-ES-3). Caller MUST attach the honesty caveat
 *  (§4.4). NEVER returns a verdict string. */
export function motifEfficacy(
  analyses: GameAnalysis[],
  motifKey: string,
  opts: { minMoves?: number; splitAt?: number } = {},
): EfficacyReadout {
  const minMoves = opts.minMoves ?? 20;
  const label = labelFor(motifKey);

  // 1) Determine the phase(s) where this motif's misses occur, across ALL data, so the
  //    denominator is scoped consistently in both windows (mirrors Leak.phase union).
  const phases = new Set<GamePhase>();
  for (const a of analyses) {
    for (const p of a.plies) {
      if (p.color !== a.playerColor) continue;
      if (isFlagged(p) && leakKey(p) === motifKey) phases.add(p.phase);
    }
  }

  // 2) Collect player plies in scope (those phases), each tagged with analyzedAt + whether
  //    it is a miss of this motif. Player-moves only; opponent plies ignored.
  interface Scoped { at: number; miss: boolean }
  const scoped: Scoped[] = [];
  for (const a of analyses) {
    for (const p of a.plies) {
      if (p.color !== a.playerColor) continue;
      if (!phases.has(p.phase)) continue;
      const miss = isFlagged(p) && leakKey(p) === motifKey;
      scoped.push({ at: a.analyzedAt, miss });
    }
  }

  if (scoped.length === 0) {
    return { motifKey, label, early: { ...ZERO }, recent: { ...ZERO }, deltaPct: 0, enoughData: false };
  }

  // 3) Split by analyzedAt at the median (default) or the caller-pinned boundary.
  const times = scoped.map((s) => s.at).sort((x, y) => x - y);
  const splitAt = opts.splitAt ?? times[Math.floor((times.length - 1) / 2)];
  // Plies strictly before the boundary are "early"; the boundary and later are "recent".
  // Median-of-sorted guarantees ≥1 ply each side whenever ≥2 distinct timestamps exist.
  const early = aggregate(scoped.filter((s) => s.at < splitAt));
  const recent = aggregate(scoped.filter((s) => s.at >= splitAt));

  const enoughData = early.playerMoves >= minMoves && recent.playerMoves >= minMoves;
  const deltaPct = enoughData ? recent.missRate - early.missRate : 0;

  return { motifKey, label, early, recent, deltaPct, enoughData };
}

function aggregate(plies: { miss: boolean }[]): EfficacyWindow {
  const playerMoves = plies.length;
  const misses = plies.reduce((n, p) => n + (p.miss ? 1 : 0), 0);
  return { playerMoves, misses, missRate: playerMoves > 0 ? misses / playerMoves : 0 };
}
```

4. - [ ] Run `npx vitest run src/analysis/efficacy.test.ts` — expect PASS.

5. - [ ] Run `npm run check` — expect 0 errors.

6. - [ ] Commit: `feat: descriptive motif efficacy core (ADR-0039)`

---

## Task 3 — Insights "Did it move?" panel (readout is shippable here)

**Why:** Surface the readout for the top ~3 leaks with the **verbatim honesty caveat** and sample-size gating (Q-C, AP-ES-4). This is the end of the independently-shippable readout slice.

**Files:**
- `src/ui/Insights.svelte` (modify — add panel + import + a tiny formatter; no test, UI is manual)

Steps:

1. - [ ] Add the import. In the `<script lang="ts">` block of `src/ui/Insights.svelte`, after the existing `import { buildStudyPlan } ...` line, add:

```ts
  import { motifEfficacy, type EfficacyReadout } from '../analysis/efficacy';
```

2. - [ ] Hold the loaded analyses so the panel can compute readouts, and compute the top-3 readouts reactively. In the `<script>`, after `let minutes = $state(30);` add:

```ts
  let analysesAll = $state<import('../analysis/types').GameAnalysis[]>([]);

  // Descriptive before/after miss-rate for the top ~3 leaks (Q-D windows + minMoves gate).
  const efficacy = $derived<EfficacyReadout[]>(
    analysesAll.length ? leaks.slice(0, 3).map((l) => motifEfficacy(analysesAll, l.key)) : [],
  );
```

3. - [ ] Store the analyses inside the existing `onMount`. Change the `onMount` body so the loaded array is retained — replace:

```ts
  onMount(async () => {
    const analyses = await loadAllAnalyses();
    if (analyses.length) {
      leaks = buildFingerprint(analyses).leaks;
      trend = weaknessTrend(analyses, { window: 5 });
      weakest = buildWeaknessProfile(analyses, model?.gameRating.rating ?? 1200).weakest;
    }
    loading = false;
  });
```

   with:

```ts
  onMount(async () => {
    const analyses = await loadAllAnalyses();
    analysesAll = analyses;
    if (analyses.length) {
      leaks = buildFingerprint(analyses).leaks;
      trend = weaknessTrend(analyses, { window: 5 });
      weakest = buildWeaknessProfile(analyses, model?.gameRating.rating ?? 1200).weakest;
    }
    loading = false;
  });
```

   (The `model?.gameRating.rating ?? 1200` read is left exactly as-is — see "Shared modify targets".)

4. - [ ] Add the panel markup. Immediately **after** the "Your top leaks" block (after the `{/if}` that closes the leaks `{#if leaks.length}…{:else}…{/if}`, i.e. just before the `<h3>Study plan` heading), insert:

```svelte
    {#if efficacy.length}
      <h3>Did it move?</h3>
      <p class="muted" style="font-size:0.75rem">
        Descriptive, not proof. This shows your before/after miss-rate; it does not prove the training
        caused the change. "Personalised beats generic" stays plausible, not proven — the data is local so
        you can watch it for yourself.
      </p>
      <div class="col" style="gap:0.3rem">
        {#each efficacy as e (e.motifKey)}
          <div class="panel" style="opacity:{e.enoughData ? 1 : 0.5}">
            <b>{e.label}</b>
            {#if e.enoughData}
              <span style="font-size:0.85rem">
                miss rate {Math.round(e.early.missRate * 100)}% → {Math.round(e.recent.missRate * 100)}%
                <span style="color:{e.deltaPct <= 0 ? 'var(--good)' : 'var(--bad)'}">
                  ({e.deltaPct <= 0 ? '' : '+'}{Math.round(e.deltaPct * 100)} pts)
                </span>
              </span>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:80px;height:20px;background:var(--panel-2);border-radius:3px;vertical-align:middle">
                <polyline
                  points="0,{100 - Math.round(e.early.missRate * 100)} 100,{100 - Math.round(e.recent.missRate * 100)}"
                  fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke" />
              </svg>
              <br /><span class="muted" style="font-size:0.75rem">
                {e.early.misses}/{e.early.playerMoves} early · {e.recent.misses}/{e.recent.playerMoves} recent
              </span>
            {:else}
              <span class="muted" style="font-size:0.8rem">too little data to read a trend</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
```

   Notes for the implementer: the caveat paragraph is the spec-fixed §4.4 string (Q-C) and MUST stay verbatim; it sits in the panel header so it is present whenever any Δ shows. The Δ is coloured with the existing `--good`/`--bad` pattern (a *drop* in miss-rate is good, hence `deltaPct <= 0` → `--good`). The two-point polyline mirrors the existing `spark`/SVG approach already in this file.

5. - [ ] Run `npm run check` — expect 0 errors. Manually sanity-check (optional): `npm run build` green.

6. - [ ] Commit: `feat: descriptive efficacy readout (ADR-0039)`

> PHASE 1 is now complete and independently shippable/revertable. Rollback = delete `efficacy.ts` + `efficacy.test.ts` + this Insights panel; revert `leakKey` back to inline if desired. Zero schema, zero nav, zero data impact.

---

# PHASE 2 — Session runner (after readout; derive / no store, no schema)

## Task 4 — Pure `buildSession` core (`src/analysis/session.ts`)

**Why:** Wrap a deterministic `PlanItem[]` into ordered executable `SessionStep[]`, optionally insert a Review slot, and append a terminal reflection step — pure, no `Date`, reusing the same leak→trainer mapping the UI uses (AP-ES-2) so routes never drift.

**Files:**
- `src/analysis/session.ts` (create)
- `src/analysis/session.test.ts` (create)

Steps:

1. - [ ] Write the failing test. Create `src/analysis/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSession } from './session';
import type { PlanItem } from './studyPlan';

const item = (activity: PlanItem['activity'], focus: string, minutes: number): PlanItem => ({
  activity, focus, minutes, reason: `${focus} reason`,
});

describe('buildSession', () => {
  it('maps each PlanItem to a same-kind step, preserving order, focus and reason', () => {
    const plan = [item('vision', 'board vision', 3), item('tactics', 'fork', 8), item('endgames', 'endgame: K+P', 6)];
    const { steps } = buildSession(plan, { includeReview: false });
    // vision, tactics, endgames, reflection
    expect(steps.map((s) => s.kind)).toEqual(['vision', 'tactics', 'endgames', 'reflection']);
    expect(steps[0].focus).toBe('board vision');
    expect(steps[1].reason).toBe('fork reason');
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('derives tactics themes/timed from the focus the same way the UI does', () => {
    const plan = [item('tactics', 'fork', 8)];
    const timed = [item('tactics', 'time management', 8)];
    const s1 = buildSession(plan, { includeReview: false }).steps[0];
    const s2 = buildSession(timed, { includeReview: false }).steps[0];
    expect(s1.themes).toEqual(['fork']);
    expect(s1.timed).toBe(false);
    expect(s2.timed).toBe(true);
  });

  it('inserts a review step after the drills and before reflection iff includeReview', () => {
    const plan = [item('vision', 'board vision', 3), item('tactics', 'fork', 8)];
    const withReview = buildSession(plan, { includeReview: true });
    const kinds = withReview.steps.map((s) => s.kind);
    expect(kinds).toEqual(['vision', 'tactics', 'review', 'reflection']);
    const without = buildSession(plan, { includeReview: false });
    expect(without.steps.some((s) => s.kind === 'review')).toBe(false);
  });

  it('always ends on a reflection step and sums totalMinutes incl. reflection', () => {
    const plan = [item('tactics', 'fork', 8), item('endgames', 'endgame', 6)];
    const session = buildSession(plan, { includeReview: true, reviewMinutes: 5 });
    expect(session.steps[session.steps.length - 1].kind).toBe('reflection');
    // 8 + 6 + 5 (review) + 0.5 (reflection)
    expect(session.totalMinutes).toBeCloseTo(19.5, 5);
  });

  it('an empty plan yields a session with only the reflection step (length 1, no throw)', () => {
    const session = buildSession([], { includeReview: false });
    expect(session.steps).toHaveLength(1);
    expect(session.steps[0].kind).toBe('reflection');
  });

  it('is deterministic (no Date/random)', () => {
    const plan = [item('vision', 'board vision', 3), item('tactics', 'fork', 8)];
    expect(buildSession(plan, { includeReview: true })).toEqual(buildSession(plan, { includeReview: true }));
  });
});
```

2. - [ ] Run `npx vitest run src/analysis/session.test.ts` — expect FAIL (module missing).

3. - [ ] Implement the core. Create `src/analysis/session.ts`:

```ts
// Deliberate-practice session runner core (ADR-0039). Wraps a deterministic study plan
// (buildStudyPlan output) into an ordered, executable session: each PlanItem → one
// SessionStep, an optional spaced-Review slot after the drills, and a terminal reflection
// step. Pure: NO Date, NO Math.random (the UI stamps elapsed time + ids at the boundary).
// Reuses the Insights/drillTarget leak→trainer mapping for tactics steps — does NOT
// re-derive a parallel routing (AP-ES-2). MUST NOT import Svelte or `app`.

import type { PlanItem } from './studyPlan';

export type SessionStepKind =
  | 'vision' | 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'review' | 'reflection';

export interface SessionStep {
  index: number;          // 0-based position in the runner
  kind: SessionStepKind;
  focus: string;          // from PlanItem.focus, or 'Reflect on this session'
  minutes: number;        // planned minutes (reflection = 0.5, rendered as "~20s")
  reason: string;         // carried from PlanItem, for the runner's "why this" line
  themes?: string[];      // tactics → app.tacticsFilterThemes
  timed?: boolean;        // tactics → app.tacticsTimed (time-management focus)
}

export interface SessionPlan {
  steps: SessionStep[];
  totalMinutes: number;   // sum of step.minutes (incl. reflection)
}

const REFLECTION_MINUTES = 0.5;

/** Derive tactics themes/timed from a PlanItem focus the SAME way Insights.drillLeak /
 *  drillTarget do (AP-ES-2): a time-management focus runs timed Tactics; any other focus
 *  filters Tactics to that motif key. Kept here (string-level) so the core has no `app`
 *  import; the UI maps step.themes → app.tacticsFilterThemes and step.timed → app.tacticsTimed. */
function tacticsRouting(focus: string): { themes?: string[]; timed: boolean } {
  const f = focus.toLowerCase();
  if (f.includes('time')) return { timed: true };
  return { themes: [focus], timed: false };
}

/** Wrap a study plan into an executable session. Pure + deterministic. */
export function buildSession(
  plan: PlanItem[],
  opts: { includeReview?: boolean; reviewMinutes?: number } = {},
): SessionPlan {
  const includeReview = opts.includeReview ?? true;
  const reviewMinutes = opts.reviewMinutes ?? 5;

  const steps: SessionStep[] = [];

  for (const item of plan) {
    const base: SessionStep = {
      index: steps.length,
      kind: item.activity, // PlanItem.activity ⊂ SessionStepKind
      focus: item.focus,
      minutes: item.minutes,
      reason: item.reason,
    };
    if (item.activity === 'tactics') {
      const r = tacticsRouting(item.focus);
      base.themes = r.themes;
      base.timed = r.timed;
    }
    steps.push(base);
  }

  if (includeReview) {
    steps.push({
      index: steps.length,
      kind: 'review',
      focus: 'Spaced review of due cards',
      minutes: reviewMinutes,
      reason: 'Cards are due — reinforce what you have already learned.',
    });
  }

  steps.push({
    index: steps.length,
    kind: 'reflection',
    focus: 'Reflect on this session',
    minutes: REFLECTION_MINUTES,
    reason: 'What did you notice? What will you do differently next time?',
  });

  const totalMinutes = steps.reduce((sum, s) => sum + s.minutes, 0);
  return { steps, totalMinutes };
}
```

4. - [ ] Run `npx vitest run src/analysis/session.test.ts` — expect PASS.

5. - [ ] Run `npm run check` — expect 0 errors.

6. - [ ] Commit: `feat: deliberate-practice session core (ADR-0039)`

---

## Task 5 — Add `'session'` to the `View` union

**Why:** The runner needs its own route. Single-line additive change to the shared `View` type (no other change to `app.svelte.ts`).

**Files:**
- `src/state/app.svelte.ts` (modify — `View` union only)

Steps:

1. - [ ] In `src/state/app.svelte.ts`, add `'session'` to the `View` union. Change:

```ts
  | 'analysis-board'
  | 'settings';
```

   to:

```ts
  | 'analysis-board'
  | 'session'
  | 'settings';
```

   (No signal flag is added: the runner reuses the existing `tacticsFilterThemes` / `tacticsTimed` flags + `app.go(...)` to launch trainers — Q-E.)

2. - [ ] Run `npm run check` — expect 0 errors (no consumer breaks; the union only widened). It will FAIL only if a `switch (app.view)` somewhere is exhaustive without a default — verify none is; `App.svelte` uses an if/else chain with a final `{:else}` fallback, so it is safe.

3. - [ ] Commit deferred — fold into Task 7 (route arm) so the union + its only consumer land together. (No standalone commit for a dangling enum value.)

---

## Task 6 — `Session.svelte` runner view

**Why:** Step through the derived `SessionPlan`, launching the **existing** trainers (no reimplementation — AP-ES-5), tracking elapsed time at the UI boundary, ending on a soft ~20s reflection step that is **display-only, never persisted** (Q-B, AP-ES-6/7).

**Files:**
- `src/ui/Session.svelte` (create)

Steps:

1. - [ ] Create `src/ui/Session.svelte`:

```svelte
<script lang="ts">
  // Deliberate-practice session runner (ADR-0039). Derives a session on mount from the
  // SAME pipeline Insights uses (buildFingerprint → buildWeaknessProfile.weakest →
  // buildStudyPlan → buildSession), then steps through it. Non-reflection steps LAUNCH the
  // existing trainers via signal flags + app.go (Q-E, AP-ES-5) — no trainer logic is
  // reimplemented here. The reflection step is a soft, non-blocking ~20s prompt whose note
  // is DISPLAY-ONLY and NEVER persisted (Q-B, AP-ES-6/7). No Date in any core (the cores
  // are pure; Date.now() lives only at this boundary).
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import { buildFingerprint } from '../analysis/fingerprint';
  import { buildWeaknessProfile } from '../analysis/weakness';
  import { buildStudyPlan } from '../analysis/studyPlan';
  import { buildSession, type SessionPlan, type SessionStep } from '../analysis/session';
  import { dueCount } from '../srs/SrsStore';

  let loading = $state(true);
  let session = $state<SessionPlan | null>(null);
  let current = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let reflection = $state(''); // display-only, NEVER persisted (Q-B)
  let reflectTimerDone = $state(false);

  const minutes = 30; // same default budget as Insights

  const model = $derived(app.model);
  const step = $derived<SessionStep | null>(session ? session.steps[current] ?? null : null);
  const elapsedMin = $derived(now && startedAt ? (now - startedAt) / 60000 : 0);
  const remainingMin = $derived(
    session ? Math.max(0, Math.round(session.totalMinutes - elapsedMin)) : 0,
  );

  // Launch destinations for non-reflection steps (reuse existing trainer routes).
  const TRAINER_VIEW: Record<string, import('../state/app.svelte').View> = {
    vision: 'vision', tactics: 'tactics', endgames: 'endgames',
    repertoire: 'repertoire', comeback: 'comeback', review: 'review',
  };

  onMount(async () => {
    startedAt = Date.now();
    now = startedAt;
    const analyses = await loadAllAnalyses();
    const leaks = analyses.length ? buildFingerprint(analyses).leaks : [];
    const weakest = analyses.length
      ? buildWeaknessProfile(analyses, model?.gameRating.rating ?? 1200).weakest
      : null;
    const plan = buildStudyPlan(leaks, weakest, minutes);
    const includeReview = (await dueCount(Date.now())) > 0; // Q-F: reserve a Review slot only when due
    session = buildSession(plan, { includeReview });
    loading = false;
    // Lightweight elapsed-time tick (UI-owned; never in a core).
    const id = setInterval(() => { now = Date.now(); }, 1000);
    return () => clearInterval(id);
  });

  function launch(s: SessionStep) {
    if (s.kind === 'tactics') {
      app.tacticsFilterThemes = s.themes ?? null;
      app.tacticsTimed = s.timed ?? false;
    }
    const view = TRAINER_VIEW[s.kind];
    if (view) app.go(view); // return to the session via the "Session" nav arm (Q-E orchestration)
  }

  function advance() {
    if (session && current < session.steps.length - 1) {
      current += 1;
      reflectTimerDone = false;
      if (step && step.kind === 'reflection') startReflectTimer();
    }
  }

  function startReflectTimer() {
    // Soft, informational ~20s prompt — NEVER blocks "Finish" (AP-ES-7).
    setTimeout(() => { reflectTimerDone = true; }, 20000);
  }

  function finish() {
    // Reflection is DISPLAY-ONLY — nothing is persisted (Q-B). Just route back.
    app.go('insights');
  }
</script>

<section class="col" style="max-width:680px;margin:0 auto">
  <h2>Practice session</h2>
  {#if loading}
    <p class="muted">Building your session…</p>
  {:else if session && step}
    <p class="muted" style="font-size:0.82rem">
      Step {current + 1} of {session.steps.length} · ~{remainingMin} min left
    </p>

    {#if step.kind === 'reflection'}
      <div class="panel col" style="gap:0.5rem">
        <b>{step.focus}</b>
        <p class="muted" style="font-size:0.85rem">{step.reason}</p>
        <textarea
          bind:value={reflection}
          rows="4"
          placeholder="What did you notice? What will you do differently?"
          style="width:100%"></textarea>
        <p class="muted" style="font-size:0.72rem">
          {reflectTimerDone ? 'Take as long as you like.' : 'Sit with it for ~20s — then finish whenever you are ready.'}
          Notes are shown here only and are not saved.
        </p>
        <button onclick={finish}>Finish</button>
      </div>
    {:else}
      <div class="panel col" style="gap:0.4rem">
        <b>{step.minutes}m · {step.kind}</b> — {step.focus}
        <span class="muted" style="font-size:0.82rem">{step.reason}</span>
        <div class="row" style="gap:0.5rem">
          <button onclick={() => launch(step)}>Open {step.kind} →</button>
          <button onclick={advance}>Done / Skip</button>
        </div>
        <span class="muted" style="font-size:0.72rem">
          Launches the real trainer. Come back here (Session) to continue.
        </span>
      </div>
    {/if}
  {:else}
    <p class="muted">No session available.</p>
    <button onclick={() => app.go('insights')}>Back to Insights</button>
  {/if}
</section>
```

   Implementer notes:
   - This uses the **flag + `app.go`** orchestration (Q-E): "Open {kind}" sets the existing flags and routes to the real trainer; the user returns to the runner via the "Session" nav arm (added in Task 7). No Board/onMove/puzzle loop is rebuilt here (AP-ES-5).
   - `Date.now()` appears **only** at this UI boundary (start time + 1s tick); both cores stay pure (AP-ES-8).
   - The reflection note lives in local `$state` only and is dropped on `finish` (Q-B / AP-ES-6). The ~20s timer never blocks Finish (AP-ES-7).
   - Empty/low-data is handled by `buildStudyPlan` (warm-up only) + the always-appended reflection step, so the runner is never blank/broken.
   - `model?.gameRating.rating ?? 1200` mirrors the current Insights read — see "Shared modify targets".

2. - [ ] Run `npm run check` — expect 0 errors. (Commit folded into Task 7 so the view and its route land together.)

---

## Task 7 — Route `'session'` in `App.svelte` + add the "Session" nav arm

**Why:** Make the new view reachable and routable. The nav arm is the return path for Q-E (after a trainer launch, the user clicks "Session" to resume).

**Files:**
- `src/ui/App.svelte` (modify — import, route arm, nav button)

Steps:

1. - [ ] Add the import. After `import Sparring from './Sparring.svelte';` add:

```svelte
  import Session from './Session.svelte';
```

2. - [ ] Add the route arm. In the `<main>` if/else chain, after the `{:else if app.view === 'sparring'}` / `<Sparring />` arm (and before `analysis-board`), insert:

```svelte
  {:else if app.view === 'session'}
    <Session />
```

3. - [ ] Add a nav button so the runner is reachable on return from a trainer. In the `{#if booted && app.model?.onboarded}` header block, after the `<button onclick={() => app.go('insights')}>Insights</button>` line, add:

```svelte
    <button onclick={() => app.go('session')}>Session</button>
```

4. - [ ] Run `npm run check` — expect 0 errors. `npm run build` — expect green.

5. - [ ] Run the full suite `npm test` — expect all PASS (135 prior + new `fingerprint`, `efficacy`, `session` suites; `db.test.ts` still asserts v4 / 10 stores, untouched).

6. - [ ] Commit: `feat: deliberate-practice session runner (ADR-0039)`

---

## Task 8 — Insights "Start session" entry button

**Why:** Q-G — one-click entry into the runner from Insights (no extra top-nav requirement beyond the Session arm already added). Kept as its own task because it touches `Insights.svelte` again, separately from Task 3.

**Files:**
- `src/ui/Insights.svelte` (modify — add a "Start session" button)

Steps:

1. - [ ] Add the entry button at the top of the populated branch. Inside the `{:else}` of the main `{#if loading}…{:else if leaks.length === 0 …}…{:else}` block (the branch that renders "Your top leaks"), immediately **before** `<h3>Your top leaks</h3>`, insert:

```svelte
    <button onclick={() => app.go('session')} style="align-self:flex-start">▶ Start session</button>
```

   (`app` is already imported in `Insights.svelte`; no new import needed.)

2. - [ ] Run `npm run check` — expect 0 errors. Manual: Insights → "Start session" → runner builds (warm-up → leak drill → optional Review when due → reflection); "Open {kind}" launches the real trainer; "Session" nav returns to the runner; "Finish" routes to Insights; nav unaffected.

3. - [ ] Commit: `feat: Start-session entry on Insights (ADR-0039)`

---

# PHASE Z — Docs (FINAL task; code-before-docs)

## Task 9 — Append ADR-0039 + upgrade README "Honesty notes"

**Why:** Doctrine requires docs last. Record the runner/readout design, the locked Q-A (split, readout-first) and Q-B (derive, no store, no bump) decisions, and the honesty posture; upgrade the README "could one day be measured" line to reflect the now-shipping descriptive readout.

**Files:**
- `decisions.md` (modify — append ADR-0039; append-only)
- `README.md` (modify — Honesty notes + the differentiating loop)

Steps:

1. - [ ] Append ADR-0039 to the end of `decisions.md` (after ADR-0035; this is the next free id, confirmed against the decisions log and `reports/specs-batch-3_decisions-applied.md`):

```markdown
## ADR-0039 — Deliberate-practice session runner + descriptive efficacy readout
**Date:** 2026-06-02 · **Status:** accepted

Adds two related pieces, **shipped split** (Q-A): a **descriptive efficacy readout** first, then a
**guided session runner** — behind one ADR, each independently revertable.

**Efficacy readout (shipped first).** `src/analysis/efficacy.ts` `motifEfficacy(analyses, motifKey, opts?)`
reports a **two-window** (early vs recent, split at the **median** `analyzedAt`) per-motif **miss-rate**
with a **phase-scoped denominator** (misses ÷ player plies in the motif's phase(s), not ÷ all moves —
AP-ES-3) and a `minMoves` gate (default 20; below it, `enoughData=false` and the UI greys the row + drops
the Δ). It shares fingerprint's cluster rule via an extracted `leakKey(ply)` helper so a leak and its
efficacy number can never disagree (AP-ES-1). The Insights "Did it move?" panel renders before→after +
signed Δ for the top ~3 leaks, carrying the **verbatim** honesty caveat (Q-C): *descriptive, not proof;
does not prove training caused the change; "personalised beats generic" stays plausible, not proven.* The
core is **pure** (no `Date`/random), returns numbers only — **never a verdict string** (AP-ES-4/8).

**Session runner (shipped second).** `src/analysis/session.ts` `buildSession(plan, opts?)` wraps the
existing `buildStudyPlan` output into ordered `SessionStep[]`, inserts a spaced-**Review** slot **only when
`dueCount(now) > 0`** (Q-F), and appends a terminal **reflection** step. It reuses the Insights/`drillTarget`
leak→trainer routing rather than re-deriving it (AP-ES-2) and is **pure** (no `Date`/random; the UI stamps
elapsed time). `Session.svelte` (new `'session'` View) steps through it, **launching the existing trainers
via signal flags + `app.go`** (Q-E) — no trainer is reimplemented (AP-ES-5). Entry is an Insights "Start
session" button (Q-G); a "Session" nav arm is the return path after a trainer launch.

**Q-B — derive, NO schema change.** The `sessions` object store and `sessionStore.ts` are **NOT built**;
**`DB_VERSION` stays 4** (no v4→v5 bump; `db.ts`/`db.test.ts` untouched). Session **reflection is
display-only and NOT persisted** — a documented limitation; persisting session history + notes (and pinning
the efficacy split to "when you started drilling motif X") is a **§11 follow-up**. The bump would be
justified ONLY by storing reflection notes + explicit session boundaries (AP-ES-9); since we derive, we do
not bump.

**Honesty / doctrine.** Descriptive only — **no causal claim** ("training improved you"), no precise grade,
no LLM/NLP over the reflection free-text (store/display only — here, not even stored — AP-ES-6), no network,
no engine in either core. Mirrors AP-CHESS-13/43 and the README Honesty note; cross-links **ADR-0027**
(weakness fingerprint + study plan + progress, which these extend) and **ADR-0007/0009** (honest tagging /
directional-not-a-grade). New anti-patterns **AP-ES-1…9** map to the next free **AP-CHESS** range (≥ 68).
```

2. - [ ] Upgrade the README "Honesty notes". In `README.md`, replace the first bullet:

```markdown
- **"Personalised beats generic" is plausible, not proven.** The loop is built because the mechanism
  is sound (you train your actual weaknesses), not because a controlled study proves it. The model
  stays local so the effect could one day be measured for real.
```

   with:

```markdown
- **"Personalised beats generic" is plausible, not proven.** The loop is built because the mechanism
  is sound (you train your actual weaknesses), not because a controlled study proves it. Insights now
  shows a **descriptive** local before/after miss-rate per leak ("did drilling forks move my fork-miss
  rate?") so you can watch the effect for yourself — but it is **not** a controlled study and makes no
  causal claim. The model stays local.
```

3. - [ ] Add the runner to the differentiating loop. In `README.md`, find the "Closing the loop" item under "Project history" (item 4) and append a sentence noting the guided session runner. Change:

```markdown
4. **Closing the loop** — weakness-steering opponent, NL explanations, Woodpecker, guess-the-move,
   calculation/vision drills.
```

   to:

```markdown
4. **Closing the loop** — weakness-steering opponent, NL explanations, Woodpecker, guess-the-move,
   calculation/vision drills, and a guided practice-**session** runner that walks the study plan
   end-to-end through the real trainers, ending in a reflection.
```

4. - [ ] Run `npm test` + `npm run check` + `npm run build` one final time — expect all green (docs-only changes do not affect tests, but confirm nothing regressed).

5. - [ ] Commit: `docs: ADR-0039 + Honesty-notes efficacy/session upgrade`

---

## Final verification checklist

- [ ] `npm test` green — includes new `fingerprint.test.ts`, `efficacy.test.ts`, `session.test.ts`; `db.test.ts` still asserts `DB_VERSION === 4` + exactly 10 stores (untouched).
- [ ] `npm run check` — svelte-check 0 errors.
- [ ] `npm run build` — green.
- [ ] **No new object store, no `DB_VERSION` bump** anywhere; `src/store/db.ts` and `src/store/db.test.ts` are byte-unchanged.
- [ ] `src/store/sessionStore.ts` was **never created**; no `SessionRecord`/`saveSession`; reflection is display-only.
- [ ] The verbatim §4.4 honesty caveat is present in the Insights "Did it move?" panel header wherever a Δ can show.
- [ ] `efficacy.ts` and `session.ts` contain **no** `Date`/`Math.random`; both import nothing from Svelte or `app`.
- [ ] `buildFingerprint` behavior is unchanged after the `leakKey` extraction (fingerprint parity test + studyPlan test pass).
- [ ] Manual: Insights "Did it move?" shows before/after with caveat and greys under low data; "Start session" → runner → real trainers via flags → reflection (soft 20s, non-blocking) → Finish; nav unaffected; app still opens at DB v4 with prior data intact.
