# Critical-Moment ("When to Think") Drill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "when to think" recognition drill that presents player-to-move positions from the user's own analysed games, asks them to call each one CRITICAL (invest time) or ROUTINE (play fast), and reveals the real win-probability swing that hung on the move — training decision-allocation upstream of the clock, with no engine re-evaluation and no schema change.

**Architecture:** A pure, unit-tested selector (`src/analysis/criticalMomentDrill.ts`) reuses the stored `gameAnalyses` machinery (the home of `criticalMoments.ts`) to label plies from `PlyAnalysis.winProbLoss` and build a balanced, deterministically-shuffled drill set (rand injected — no `Math.random`/`Date.now` in the core). A new `WhenToThink.svelte` view renders a read-only mini-board (the `EvalGraph`/`Comeback` board precedent), scores the binary call, and reveals the raw swing plus the existing `explainPly` text. A curated static FEN fallback set keeps the drill non-empty before any game is analysed. Wiring is additive: a new `'when-to-think'` member on the `View` union + one route arm in `App.svelte` + a companion link on the Dashboard `timeManagement` row (no `weakness.ts` change).

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite + Vitest (jsdom) + IndexedDB (idb), chess.js 1.4.0 (used only in the fallback legality test, never at drill time). No new dependency.

---

## Context & invariants (read before any task)

**Doctrine (enforced by acceptance criteria + anti-patterns):**
- **No engine at drill time** (AP-CMD-3): never call `engine.evaluate` / `analyzeLines` / `runAnalysis`. The drill derives everything from stored `gameAnalyses` (comeback / eval-graph precedent).
- **No schema change** (AP-CMD-6): no `DB_VERSION` bump, no new object store, no new `PlyAnalysis` field. Positions derive on the fly.
- **Pure core** (AP-CMD-4): `criticalMomentDrill.ts` contains **no** `Math.random`, **no** `Date.now`, **no** engine/chess.js import. The shuffle `rand: () => number` is injected by the caller; the view passes `Math.random` at the call site.
- **Binary scoring, raw swing — NEVER an accuracy %** (AP-CMD-1, ADR-0009/0021 honesty): the running tally is framed as practice, never a graded "time-management score" or accuracy percentage. The reveal shows the actual `winProbLoss` number, not a derived grade.
- **Honest label** (AP-CMD-2): the CRITICAL label is *realised* `winProbLoss` (how much was actually lost), NOT a proven "only-move" margin — there is no second-best line in stored analysis (ADR-0006: one eval per position; §0.5 of the spec). Copy says "a moment where a wrong move proved expensive", never "the only move".
- **Read-only board** (AP-CMD-5): the mini-board is `viewOnly`; the player calls Critical/Routine, never moves a piece.
- **Player-to-move only** (AP-CMD-8): only plies where `ply.color === analysis.playerColor` become drill items.
- **Balance + shuffle** (AP-CMD-7): balance CRITICAL/ROUTINE *when possible* (top up from the larger side, never empty-on-imbalance) and always Fisher–Yates shuffle via the injected rand.

**Resolved decisions (from `reports/specs-batch-3_decisions-applied.md`, all rec):**
- Q-A: CRITICAL = `winProbLoss >= 15`; ROUTINE = `winProbLoss <= 3`; the band `(3, 15)` is ambiguous and **excluded**.
- Q-B: drop the "only-move"/`secondBestCp` signal now (deferred to §11).
- Q-C: ROUTINE excludes **trivial recaptures** (a ROUTINE ply that recaptures on the prior ply's destination square).
- Q-D: **binary** scoring; show the raw swing (no graded score).
- Q-E: **curated static FEN fallback** set (small, in-repo) when no analyses yield items.
- Q-F: **Dashboard-only** (no top-nav button).
- Q-G: **companion** link on the `timeManagement` row (additive; **no `weakness.ts` change**; the existing Drill button keeps routing to timed Tactics).
- ADR id: **ADR-0038** (provisional; current max in `decisions.md` = ADR-0035).

**Verified anchors (real signatures — do not re-derive):**
- `src/analysis/types.ts` — `PlyAnalysis extends ParsedPly`. Fields available: `color: 'w'|'b'`, `fenBefore`, `fenAfter`, `uci`, `san`, `moveNumber`, `winProbLoss: number` (mover-POV 0..100), `bestWhiteCp`, `playedWhiteCp`, `cpLoss`, `severity`, `phase`, `captured?: string`, `mate?`, `motif?`, `bestUci: string | null`, `ply: number`. **No second-best line.**
- `GameAnalysis` — `{ gameId, source, playerColor: 'w'|'b', analyzedAt, movetimeMs, plies: PlyAnalysis[], byPhase, acpl, blunders, mistakes, inaccuracies, puzzlesGenerated }`.
- `src/analysis/criticalMoments.ts` — exports `winCurve(analysis)`, `criticalMoments(analysis, {max, minLoss})`, interfaces `CurvePoint`, `CriticalMoment`, `CriticalOptions`. Side tag = `ply.color === analysis.playerColor ? 'player' : 'opponent'`. Pure; no engine/chess.js.
- `src/analysis/explain.ts` — `explainPly(ply): { headline: string; reasons: string[]; better: string | null }`. Pure; fact-derived; safe for any ply (good/best returns a short affirmation with empty `reasons`).
- `src/analysis/runAnalysis.ts` — `loadAllAnalyses(): Promise<GameAnalysis[]>` reads the `gameAnalyses` store.
- `src/ui/Board.svelte` — props `{ fen, orientation?, turnColor?, movableColor?, dests?, viewOnly?, lastMove?, check?, onMove? }`. For a read-only board: `<Board {fen} {orientation} viewOnly />`.
- `src/ui/Comeback.svelte` — the mirror for a Dashboard-reached drill view (onMount → `loadAllAnalyses()` → pure selector → board + reveal + Next; empty-state panel).
- `src/state/app.svelte.ts` — `View` union (19 members incl. `'comeback'`); `app.go(view)`; cross-view flags `tacticsTimed`, `tacticsFilterThemes`, `analysisFen`.
- `src/ui/App.svelte` — import block + `{:else if app.view === '…'}` route chain; `comeback` arm at lines ~17 (import) and ~83 (route).
- `src/ui/Dashboard.svelte` — `dimLabels`, `drill(dim)`, the `{#each profile.dimensions as d}` row block; each row's Drill button calls `drill(d.dimension)`.
- `src/guess/games.ts` — `MASTER_GAMES` precedent for an in-repo curated dataset whose legality is asserted by a test (chess.js validates at load; the test asserts every line is legal).
- **uci format** (`src/analysis/pgn.ts` line 63): `uci = mv.from + mv.to + (mv.promotion ?? '')` → `uci.slice(2,4)` is the **destination** square.
- Vitest runs under `jsdom` (`vite.config.ts`); Vite's `?raw` import suffix is available for the source-guard test (no new dependency).

**Shared modify targets (flag for the executor — coordinate if other batch-3 specs run in parallel):**
- `src/state/app.svelte.ts` — add `'when-to-think'` to the `View` union (Task 3).
- `src/ui/App.svelte` — add import + route arm (Task 3).
- `src/ui/Dashboard.svelte` — add the companion link on the `timeManagement` row (Task 4).
- `decisions.md` — append ADR-0038 (Task 5, append-only).
> Note: `time-controls` (the sibling spec) also edits `app.svelte.ts` (PlayerModel reshape) and may touch `Dashboard.svelte`. These edits are **non-overlapping** (a new union member + a new button), but if both branches are open, re-base and re-verify the `View` union and the Dashboard row block before committing.

**Pre-flight gates (re-verify at execution time; abort and reconcile if any fail):**
1. `criticalMoments.ts` still exports `CriticalMoment` + `criticalMoments()`; `PlyAnalysis` still carries `winProbLoss`, `bestWhiteCp`, `playedWhiteCp`, `severity`, `captured?`, `phase`, `uci`, `color`, `fenBefore`.
2. `explainPly(ply)` signature unchanged and pure.
3. `loadAllAnalyses()` returns `GameAnalysis[]`.
4. `Board.svelte` still exposes `viewOnly`, `fen`, `orientation`.
5. `View` union + `App.svelte` routing editable (mirror the `comeback` add).
6. `npm test` baseline green (README: 135 tests); `npm run check` clean.

---

## Task 1 — Pure selector `criticalMomentDrill.ts` (+ tests)

Build the pure core: label plies, build a balanced/shuffled drill set with injected rand, and grade a binary call. Reuse the `criticalMoments.ts` side-tagging idea (`ply.color === analysis.playerColor`).

**Files:**
- `src/analysis/criticalMomentDrill.ts` (new)
- `src/analysis/criticalMomentDrill.test.ts` (new)

Steps:

- [ ] **1.1 Write the failing test file** `src/analysis/criticalMomentDrill.test.ts` with the FULL content below. It defines its own synthetic `GameAnalysis[]` (mirroring `criticalMoments.test.ts`'s `mkPly`/`mkAnalysis` helpers) and a deterministic LCG so shuffle order is reproducible. The final `describe` block is the **no-`Math.random`/`Date.now` source guard**, implemented with a Vite `?raw` import of the module text (no new dependency).

```ts
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
```

- [ ] **1.2 Run the test — expect FAIL** (module does not exist yet):
  `npx vitest run src/analysis/criticalMomentDrill.test.ts`
  Expected: import resolution / "labelPly is not a function" failures. (The `?raw` import also fails until the file exists — that is fine.)

- [ ] **1.3 Write the minimal implementation** `src/analysis/criticalMomentDrill.ts` with the FULL content below. No `Math.random`, no `Date.now`, no engine/chess.js import — rand is a parameter.

```ts
// Pure selector + scorer for the "when to think" critical-moment drill (ADR-0038).
// From the player's STORED game analyses, label each player-to-move ply CRITICAL
// (a moment where a wrong move proved expensive) or ROUTINE (play fast) using the
// realised win-probability swing `PlyAnalysis.winProbLoss` — NOT a second-best
// "only-move" margin, which stored analysis does not carry (one eval/position,
// ADR-0006; spec §0.5). Reuses the side-tagging idea from criticalMoments.ts.
//
// NO engine work and NO chess.js here — everything derives from the stored
// GameAnalysis (comeback / eval-graph precedent). NO Math.random / Date.now: the
// shuffle randomness is INJECTED by the caller (`rand`), so the core stays pure
// and deterministically testable (AP-CMD-4).

import type { GameAnalysis, PlyAnalysis } from './types';

export type DrillLabel = 'critical' | 'routine';

export interface DrillItem {
  gameId: string;
  /** Index into the source analysis's `plies`. */
  plyIndex: number;
  /** The analysed ply — carries fenBefore, uci, san, winProbLoss, severity, … */
  ply: PlyAnalysis;
  /** Convenience mirror of `ply.fenBefore` (the board prop). */
  fenBefore: string;
  /** The GROUND TRUTH for this position. */
  label: DrillLabel;
  /** The realised swing that hung on the move — the reveal value (NOT a grade). */
  winProbLoss: number;
}

export interface CallResult {
  correct: boolean;
  truth: DrillLabel;
  call: DrillLabel;
}

export interface DrillOptions {
  /** Win% loss at/above which a player ply is CRITICAL (default 15, Q-A). */
  criticalLoss?: number;
  /** Win% loss at/below which a player ply is ROUTINE (default 3). The open band
   *  (routineLoss, criticalLoss) is "ambiguous" and is NOT used as a drill item. */
  routineLoss?: number;
  /** Max items in the built set (default 12). */
  max?: number;
  /** Drop trivial recaptures from ROUTINE candidates (default true, Q-C). */
  excludeRecaptures?: boolean;
}

const DEFAULTS = {
  criticalLoss: 15,
  routineLoss: 3,
  max: 12,
  excludeRecaptures: true,
} as const;

/**
 * Label one ply from its realised win-prob swing. CRITICAL if `winProbLoss >=
 * criticalLoss`, ROUTINE if `<= routineLoss`, else `null` (ambiguous band —
 * excluded from the drill). Player-to-move filtering is the caller's job
 * (`buildDrillSet`). Honesty: this is the *realised* swing, not a proven
 * "only-move" signal (AP-CMD-2, spec §0.5).
 */
export function labelPly(ply: PlyAnalysis, opts: DrillOptions = {}): DrillLabel | null {
  const criticalLoss = opts.criticalLoss ?? DEFAULTS.criticalLoss;
  const routineLoss = opts.routineLoss ?? DEFAULTS.routineLoss;
  if (ply.winProbLoss >= criticalLoss) return 'critical';
  if (ply.winProbLoss <= routineLoss) return 'routine';
  return null;
}

/** A plain recapture: this ply captures on the square the previous ply moved TO.
 *  `uci = from+to+promo` (pgn.ts), so `slice(2,4)` is the destination. No chess.js. */
function isTrivialRecapture(ply: PlyAnalysis, prev: PlyAnalysis | undefined): boolean {
  if (!prev) return false;
  if (ply.captured == null) return false;
  if (ply.uci.length < 4 || prev.uci.length < 4) return false;
  return prev.uci.slice(2, 4) === ply.uci.slice(2, 4);
}

/**
 * Build a balanced, deterministically-shuffled drill set from stored analyses.
 * - Collect every PLAYER-to-move ply (`ply.color === analysis.playerColor`).
 * - Label via `labelPly`; skip the ambiguous band (`null`).
 * - When `excludeRecaptures`, drop ROUTINE plies that are trivial recaptures
 *   (never CRITICAL ones — a recapture can itself be a blunder).
 * - Dedup by `fenBefore`.
 * - Balance: take up to `ceil(max/2)` from each label, then top up from the
 *   larger side if one is short (best-effort — never empty-on-imbalance, AP-CMD-7).
 * - Shuffle the result with a Fisher–Yates pass driven by the INJECTED `rand`.
 * - Cap at `max`.
 */
export function buildDrillSet(
  analyses: GameAnalysis[],
  rand: () => number,
  opts: DrillOptions = {},
): DrillItem[] {
  const max = opts.max ?? DEFAULTS.max;
  const excludeRecaptures = opts.excludeRecaptures ?? DEFAULTS.excludeRecaptures;

  const critical: DrillItem[] = [];
  const routine: DrillItem[] = [];
  const seenFens = new Set<string>();

  for (const analysis of analyses) {
    const plies = analysis.plies;
    for (let i = 0; i < plies.length; i++) {
      const ply = plies[i];
      if (ply.color !== analysis.playerColor) continue; // player-to-move only (AP-CMD-8)
      const label = labelPly(ply, opts);
      if (label == null) continue; // ambiguous band excluded
      if (label === 'routine' && excludeRecaptures && isTrivialRecapture(ply, plies[i - 1])) {
        continue; // trivial recapture: correct-but-uninstructive ROUTINE (Q-C)
      }
      if (seenFens.has(ply.fenBefore)) continue; // dedup by fenBefore
      seenFens.add(ply.fenBefore);
      const item: DrillItem = {
        gameId: analysis.gameId,
        plyIndex: i,
        ply,
        fenBefore: ply.fenBefore,
        label,
        winProbLoss: ply.winProbLoss,
      };
      (label === 'critical' ? critical : routine).push(item);
    }
  }

  // Balance: half from each side, then top up from whichever side has surplus.
  const half = Math.ceil(max / 2);
  const picked: DrillItem[] = [...critical.slice(0, half), ...routine.slice(0, half)];
  if (picked.length < max) {
    const leftoverCrit = critical.slice(half);
    const leftoverRoutine = routine.slice(half);
    for (const it of [...leftoverCrit, ...leftoverRoutine]) {
      if (picked.length >= max) break;
      picked.push(it);
    }
  }

  shuffleInPlace(picked, rand);
  return picked.slice(0, max);
}

/** Fisher–Yates using the injected rand (deterministic in tests). */
function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/** Grade one CRITICAL/ROUTINE call. Binary (Q-D): correct iff it matches the
 *  ground-truth label. No accuracy %, no graded partial credit (AP-CMD-1). */
export function scoreCall(item: DrillItem, call: DrillLabel): CallResult {
  return { correct: call === item.label, truth: item.label, call };
}
```

- [ ] **1.4 Run the test — expect PASS:** `npx vitest run src/analysis/criticalMomentDrill.test.ts`
  If the balance test fails on counts, re-check `half = ceil(max/2)` and the slice boundaries. If the determinism test's "different seed → different order" is flaky, the shuffle is the only entropy source — confirm `rand` is actually consumed (it is, in `shuffleInPlace`).

- [ ] **1.5 Commit:** `git add src/analysis/criticalMomentDrill.ts src/analysis/criticalMomentDrill.test.ts && git commit -m "feat: pure critical-moment drill selector (labelPly/buildDrillSet/scoreCall) (ADR-0038)"`

---

## Task 2 — Curated static FEN fallback set (+ legality test)

A small in-repo set so the drill is non-empty before any game is analysed (Q-E). Each entry carries a pre-labelled `winProbLoss` (a representative number) and an `explain`-ready synthetic `PlyAnalysis`, so the view can feed the fallback through the **same** reveal path. Legality is asserted by a test (MASTER_GAMES precedent).

**Files:**
- `src/analysis/criticalMomentFallback.ts` (new)
- `src/analysis/criticalMomentFallback.test.ts` (new)

Design note: the fallback must produce real `DrillItem`s so `WhenToThink.svelte` has one code path. We expose `fallbackDrillItems(): DrillItem[]` returning fully-formed items (a synthetic `PlyAnalysis` per entry whose `fenBefore` is a legal FEN, `winProbLoss` matches the intended label, `severity`/`bestUci`/`san` set so `explainPly` yields sensible text). The set is hand-balanced (≈ equal CRITICAL/ROUTINE) and order is fixed in source; the **view** shuffles it via the same injected `Math.random` through `buildDrillSet`-style handling — but since these are already `DrillItem`s, the view will shuffle them with a local Fisher–Yates that also takes injected rand (re-exported from the selector). To avoid duplicating shuffle logic, we expose the raw items here and let the view call a shared shuffle. Keep this module free of `Math.random`/`Date.now` too.

Steps:

- [ ] **2.1 Write the failing test** `src/analysis/criticalMomentFallback.test.ts` (FULL content). It asserts: every FEN is legal and has legal moves (chess.js — allowed in tests), the bundled `winProbLoss` agrees with each item's `label` under the default thresholds (`labelPly`), the set is non-empty and reasonably balanced, and `fenBefore` mirrors `ply.fenBefore`.

```ts
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { fallbackDrillItems } from './criticalMomentFallback';
import { labelPly } from './criticalMomentDrill';

describe('fallbackDrillItems', () => {
  const items = fallbackDrillItems();

  it('is non-empty and contains both labels', () => {
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.some((it) => it.label === 'critical')).toBe(true);
    expect(items.some((it) => it.label === 'routine')).toBe(true);
  });

  it('every FEN is legal and has at least one legal move', () => {
    for (const it of items) {
      // chess.js throws on an invalid FEN — a typo can't ship.
      const c = new Chess(it.fenBefore);
      expect(c.moves().length).toBeGreaterThan(0);
      expect(it.fenBefore).toBe(it.ply.fenBefore); // mirror invariant
    }
  });

  it('each bundled winProbLoss agrees with the item label under default thresholds', () => {
    for (const it of items) {
      expect(it.winProbLoss).toBe(it.ply.winProbLoss);
      expect(labelPly(it.ply)).toBe(it.label);
    }
  });

  it('gives every item a stable, unique gameId/fen so dedup and keys are safe', () => {
    const fens = items.map((it) => it.fenBefore);
    expect(new Set(fens).size).toBe(fens.length);
    expect(items.every((it) => it.gameId.startsWith('fallback'))).toBe(true);
  });
});
```

- [ ] **2.2 Run — expect FAIL:** `npx vitest run src/analysis/criticalMomentFallback.test.ts` (module missing).

- [ ] **2.3 Write the implementation** `src/analysis/criticalMomentFallback.ts` (FULL content). Uses real, well-known legal FENs. CRITICAL entries get `winProbLoss >= 15` and a `severity`/`bestUci` so `explainPly` is meaningful; ROUTINE entries get `winProbLoss <= 3`. No `Math.random`/`Date.now`; no chess.js import (legality is the test's job, not runtime).

```ts
// Curated static fallback for the "when to think" drill (Q-E, ADR-0038): a small
// in-repo set so the drill works BEFORE any of the player's games are analysed.
// Each entry is a fully-formed DrillItem with a synthetic PlyAnalysis whose
// fenBefore is a LEGAL position and whose winProbLoss matches its label under the
// default thresholds (asserted by criticalMomentFallback.test.ts — the MASTER_GAMES
// legality-test precedent). No engine, no chess.js, no Math.random/Date.now here.

import type { DrillItem, DrillLabel } from './criticalMomentDrill';
import type { GamePhase, PlyAnalysis, Severity } from './types';

interface FallbackSeed {
  id: string;
  fen: string; // legal FEN, player to move
  label: DrillLabel;
  winProbLoss: number; // must satisfy the label under default thresholds
  san: string; // the move actually played from this position (for explain text)
  uci: string;
  bestUci: string | null;
  severity: Severity;
  phase: GamePhase;
  moveNumber: number;
  color: 'w' | 'b'; // side to move in `fen`
}

// Hand-picked, hand-balanced. CRITICAL = a moment where a wrong move proved
// expensive (not "the only move" — honest framing, AP-CMD-2). ROUTINE = a quiet
// position where almost anything reasonable keeps the eval.
const SEEDS: FallbackSeed[] = [
  // --- CRITICAL (winProbLoss >= 15) ---
  {
    id: 'fallback-legalls-mate',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    label: 'critical',
    winProbLoss: 28,
    san: 'Ng5',
    uci: 'f3g5',
    bestUci: 'b1c3',
    severity: 'mistake',
    phase: 'opening',
    moveNumber: 4,
    color: 'w',
  },
  {
    id: 'fallback-fried-liver',
    fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
    label: 'critical',
    winProbLoss: 22,
    san: 'Nxf7',
    uci: 'g5f7',
    bestUci: 'e1g1',
    severity: 'mistake',
    phase: 'opening',
    moveNumber: 6,
    color: 'w',
  },
  {
    id: 'fallback-greek-gift',
    fen: 'rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 3 7',
    label: 'critical',
    winProbLoss: 18,
    san: 'Bd3',
    uci: 'd2d3',
    bestUci: 'f1d3',
    severity: 'inaccuracy',
    phase: 'middlegame',
    moveNumber: 7,
    color: 'w',
  },
  {
    id: 'fallback-back-rank',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    label: 'critical',
    winProbLoss: 35,
    san: 'Rd8+',
    uci: 'd1d8',
    bestUci: 'd1d8',
    severity: 'mistake',
    phase: 'endgame',
    moveNumber: 1,
    color: 'w',
  },
  // --- ROUTINE (winProbLoss <= 3) ---
  {
    id: 'fallback-start',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    label: 'routine',
    winProbLoss: 1,
    san: 'e4',
    uci: 'e2e4',
    bestUci: 'e2e4',
    severity: 'good',
    phase: 'opening',
    moveNumber: 1,
    color: 'w',
  },
  {
    id: 'fallback-italian-quiet',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    label: 'routine',
    winProbLoss: 2,
    san: 'Bc5',
    uci: 'f8c5',
    bestUci: 'f8c5',
    severity: 'good',
    phase: 'opening',
    moveNumber: 3,
    color: 'b',
  },
  {
    id: 'fallback-symmetric-middlegame',
    fen: 'r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R2Q1RK1 w - - 0 9',
    label: 'routine',
    winProbLoss: 0,
    san: 'Re1',
    uci: 'f1e1',
    bestUci: 'f1e1',
    severity: 'good',
    phase: 'middlegame',
    moveNumber: 9,
    color: 'w',
  },
  {
    id: 'fallback-king-pawn-endgame',
    fen: '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1',
    label: 'routine',
    winProbLoss: 2,
    san: 'Kd4',
    uci: 'e3d4',
    bestUci: 'e3d4',
    severity: 'good',
    phase: 'endgame',
    moveNumber: 1,
    color: 'w',
  },
];

function seedToItem(s: FallbackSeed): DrillItem {
  const ply: PlyAnalysis = {
    ply: 0,
    moveNumber: s.moveNumber,
    color: s.color,
    san: s.san,
    uci: s.uci,
    fenBefore: s.fen,
    fenAfter: s.fen, // unused by the reveal; explainPly's positional fallback tolerates it
    bestUci: s.bestUci,
    bestWhiteCp: 0,
    playedWhiteCp: 0,
    cpLoss: 0,
    winProbLoss: s.winProbLoss,
    severity: s.severity,
    phase: s.phase,
  };
  return {
    gameId: s.id,
    plyIndex: 0,
    ply,
    fenBefore: s.fen,
    label: s.label,
    winProbLoss: s.winProbLoss,
  };
}

/** The curated fallback drill items (fixed order; the view shuffles them). */
export function fallbackDrillItems(): DrillItem[] {
  return SEEDS.map(seedToItem);
}
```

- [ ] **2.4 Run — expect PASS:** `npx vitest run src/analysis/criticalMomentFallback.test.ts`
  If a FEN is rejected by chess.js, fix that FEN (most likely a halfmove/fullmove or castling-rights typo) — do NOT loosen the test. If `labelPly` disagrees with a `label`, adjust that seed's `winProbLoss` (CRITICAL ≥ 15, ROUTINE ≤ 3).

- [ ] **2.5 Commit:** `git add src/analysis/criticalMomentFallback.ts src/analysis/criticalMomentFallback.test.ts && git commit -m "feat: curated static FEN fallback set for the when-to-think drill (ADR-0038)"`

---

## Task 3 — New `when-to-think` view + wiring

Add the `View` union member, the `App.svelte` route arm (mirror `comeback`), and the `WhenToThink.svelte` view. The view loads the player's own analyses → `buildDrillSet(analyses, Math.random, {})`; if that is empty, it falls back to the curated set (shuffled with the same injected `Math.random`). It renders a read-only board, two buttons, scores the binary call, and reveals the raw swing + `explainPly` text. **No engine call. No accuracy %.**

**Files (SHARED — see "Shared modify targets"):**
- `src/state/app.svelte.ts` (edit — add `'when-to-think'` to `View`)
- `src/ui/App.svelte` (edit — import + route arm)
- `src/ui/WhenToThink.svelte` (new)

> No automated test for the Svelte view (repo convention: pure cores are unit-tested, views are manually verified). The verification gate is `npm run check` (type-clean) + the manual script in Task 6. Re-export a shared shuffle from the selector so the view does not introduce its own `Math.random` indirection beyond the single injected call.

Steps:

- [ ] **3.1 Add a shared shuffle export to the selector** so the view can shuffle the fallback `DrillItem[]` with the same injected-rand discipline (avoids a second shuffle implementation and keeps `Math.random` at the call site only). Edit `src/analysis/criticalMomentDrill.ts`: change the `shuffleInPlace` declaration to an exported function and add a pure `shuffled` helper. Replace:

```ts
/** Fisher–Yates using the injected rand (deterministic in tests). */
function shuffleInPlace<T>(arr: T[], rand: () => number): void {
```

with:

```ts
/** Fisher–Yates using the injected rand (deterministic in tests). Exported so
 *  callers (e.g. the fallback path in the view) can shuffle pre-built items with
 *  the SAME injected-rand discipline — no second Math.random site. */
export function shuffleInPlace<T>(arr: T[], rand: () => number): void {
```

  Then add, immediately after `shuffleInPlace`:

```ts
/** Pure: a shuffled COPY (does not mutate the input). */
export function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const copy = arr.slice();
  shuffleInPlace(copy, rand);
  return copy;
}
```

- [ ] **3.2 Extend the purity test** to cover the new export and keep the guard honest. In `src/analysis/criticalMomentDrill.test.ts`, inside `describe('buildDrillSet', …)` (or a new `describe('shuffled', …)`), add:

```ts
import { shuffled } from './criticalMomentDrill';
// ...
describe('shuffled', () => {
  it('returns a reordered copy without mutating the input (deterministic per seed)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(input, seeded(5));
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input); // same multiset
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // input untouched
    expect(shuffled(input, seeded(5))).toEqual(out); // same seed → same order
  });
});
```
  (Place the new `import { shuffled }` next to the existing import from `./criticalMomentDrill`, or merge it into that import statement.)

- [ ] **3.3 Run — expect PASS:** `npx vitest run src/analysis/criticalMomentDrill.test.ts` (the purity guard still passes — `shuffled` introduces no `Math.random`/`Date.now`).

- [ ] **3.4 Add `'when-to-think'` to the `View` union** in `src/state/app.svelte.ts`. Replace:

```ts
  | 'analysis-board'
  | 'settings';
```

with:

```ts
  | 'analysis-board'
  | 'when-to-think'
  | 'settings';
```

- [ ] **3.5 Wire the route in `src/ui/App.svelte`.** Add the import next to the `Comeback` import (after line 17 `import Comeback from './Comeback.svelte';`):

```ts
  import WhenToThink from './WhenToThink.svelte';
```

  And add the route arm immediately after the `comeback` arm (after the `<Comeback />` block, before `{:else if app.view === 'insights'}`):

```svelte
  {:else if app.view === 'when-to-think'}
    <WhenToThink />
```

- [ ] **3.6 Create `src/ui/WhenToThink.svelte`** with the FULL content below. Mirrors `Comeback.svelte`'s lifecycle and empty-state pattern. Injects `Math.random` at the call site (AP-CMD-4). Read-only board (AP-CMD-5). Reveals the raw `winProbLoss` and `explainPly` text. The tally is framed as practice, never an accuracy % (AP-CMD-1).

```svelte
<script lang="ts">
  // "When to think" critical-moment drill (ADR-0038): recognition trainer over the
  // player's STORED game analyses. Show a player-to-move position on a READ-ONLY
  // board, ask CRITICAL (invest time) vs ROUTINE (play fast), then reveal the REAL
  // win-probability swing that hung on the move + the existing explainPly text.
  // NO engine call (comeback/eval-graph precedent). NO accuracy grade — the tally
  // is directional practice (honesty doctrine, ADR-0021; AP-CMD-1). Reached from
  // the Dashboard time-management row (no top-nav entry, Q-F).
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte';
  import Board from './Board.svelte';
  import { loadAllAnalyses } from '../analysis/runAnalysis';
  import {
    buildDrillSet,
    scoreCall,
    shuffled,
    type DrillItem,
    type DrillLabel,
    type CallResult,
  } from '../analysis/criticalMomentDrill';
  import { fallbackDrillItems } from '../analysis/criticalMomentFallback';
  import { explainPly, type Explanation } from '../analysis/explain';

  let items = $state<DrillItem[]>([]);
  let idx = $state(0);
  let status = $state<'loading' | 'empty' | 'drilling'>('loading');
  let usingFallback = $state(false);
  let revealed = $state(false);
  let result = $state<CallResult | null>(null);
  let right = $state(0);
  let total = $state(0);

  const current = $derived(items[idx] ?? null);
  const hasNext = $derived(idx + 1 < items.length);
  // POV from the side to move in fenBefore: FEN field 2 is 'w' or 'b'.
  const toMove = $derived(current ? (current.fenBefore.split(' ')[1] === 'b' ? 'black' : 'white') : 'white');
  const explanation = $derived<Explanation | null>(current ? explainPly(current.ply) : null);

  onMount(async () => {
    let built: DrillItem[] = [];
    try {
      // Rand injected AT THE CALL SITE (AP-CMD-4); core stays pure.
      built = buildDrillSet(await loadAllAnalyses(), Math.random, {});
    } catch {
      built = [];
    }
    if (built.length === 0) {
      // Fallback: same scoreCall/reveal path; shuffle with the same injected rand.
      built = shuffled(fallbackDrillItems(), Math.random);
      usingFallback = true;
    }
    items = built;
    status = items.length === 0 ? 'empty' : 'drilling';
  });

  function call(label: DrillLabel) {
    if (!current || revealed) return;
    result = scoreCall(current, label);
    revealed = true;
    total += 1;
    if (result.correct) right += 1;
  }

  function next() {
    if (hasNext) idx += 1;
    revealed = false;
    result = null;
  }

  function restart() {
    items = shuffled(items, Math.random);
    idx = 0;
    revealed = false;
    result = null;
    right = 0;
    total = 0;
  }

  const atEnd = $derived(revealed && !hasNext);
</script>

<section class="col center" style="max-width:680px;margin:0 auto">
  <h2>When to think</h2>

  {#if status === 'loading'}
    <p class="muted">Loading positions from your games…</p>
  {:else if status === 'empty'}
    <div class="panel col center">
      <p>No positions to drill yet.</p>
      <p class="muted">Analyse a game and your own critical moments will appear here to practise.</p>
      <button onclick={() => app.go('import')}>Analyse a game →</button>
    </div>
  {:else if current}
    <p class="muted">
      Position {idx + 1} / {items.length}{usingFallback ? ' · sample positions (analyse a game to drill your own)' : ''}.
      Recognising critical moments is a trainable feel — this is practice, not a graded verdict.
    </p>

    <div class="board-wrap">
      <Board fen={current.fenBefore} orientation={toMove} viewOnly />
    </div>

    <p class="prompt">
      <b>{toMove === 'white' ? 'White' : 'Black'} to move</b> — would you stop and think here?
    </p>

    {#if !revealed}
      <div class="row center">
        <button onclick={() => call('critical')}>Critical (invest time)</button>
        <button class="ghost" onclick={() => call('routine')}>Routine (play fast)</button>
      </div>
    {:else if result}
      <div class="panel col reveal {result.correct ? 'good' : 'bad'}">
        <p class="verdict">
          {result.correct ? 'Correct' : 'Not quite'} — this was a
          <b>{result.truth === 'critical' ? 'CRITICAL' : 'ROUTINE'}</b> moment.
        </p>
        <p class="swing">
          {#if result.truth === 'critical'}
            About <b>{Math.round(current.winProbLoss)}%</b> in winning chances hung on this move —
            a moment where a wrong choice proved expensive.
          {:else}
            Only about <b>{Math.round(current.winProbLoss)}%</b> in winning chances hung on this — a
            position to play quickly.
          {/if}
        </p>
        {#if explanation}
          <p class="headline">{explanation.headline}</p>
          {#each explanation.reasons as reason}
            <p class="muted reason">{reason}</p>
          {/each}
          {#if explanation.better}<p class="better">{explanation.better}</p>{/if}
        {/if}
      </div>

      <div class="row center">
        {#if hasNext}
          <button onclick={next}>Next →</button>
        {/if}
        <button class="ghost" onclick={restart}>Restart</button>
        <button class="ghost" onclick={() => app.go('dashboard')}>Back to dashboard</button>
      </div>
    {/if}

    <p class="tally muted">
      You've called {total} {total === 1 ? 'position' : 'positions'} · {right} matched the game's outcome.
      {#if atEnd}That's the set — recognising critical moments is a feel you build with practice.{/if}
    </p>
  {/if}
</section>

<style>
  .board-wrap { display: flex; justify-content: center; }
  .prompt { margin: 0.4rem 0; }
  .reveal { gap: 0.3rem; padding: 0.75rem; }
  .reveal.good { border-left: 3px solid var(--good); }
  .reveal.bad { border-left: 3px solid var(--bad); }
  .verdict { margin: 0; font-weight: 700; }
  .swing { margin: 0.2rem 0; }
  .headline { margin: 0.3rem 0 0; font-weight: 600; }
  .reason { font-size: 0.85rem; margin: 0.1rem 0; }
  .better { margin: 0.2rem 0 0; }
  .tally { font-size: 0.85rem; }
  button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>
```

- [ ] **3.7 Type-check:** `npm run check` — must be clean. Common fixes: ensure every imported symbol (`shuffled`, `CallResult`, `Explanation`, `DrillLabel`) is actually exported from its module (Task 1/3.1 added `shuffled`; `Explanation` is exported by `explain.ts`); confirm the `Board` orientation prop accepts `'white' | 'black'` (it does).

- [ ] **3.8 Commit:** `git add src/state/app.svelte.ts src/ui/App.svelte src/ui/WhenToThink.svelte src/analysis/criticalMomentDrill.ts src/analysis/criticalMomentDrill.test.ts && git commit -m "feat: when-to-think drill view + route wiring (ADR-0038)"`

---

## Task 4 — Dashboard companion link on the `timeManagement` row

Additive (Q-G): keep the existing Drill button (routes to timed Tactics via `drillTarget`); add a second, secondary link **only on the `timeManagement` row** that calls `app.go('when-to-think')`. **No `weakness.ts` change.**

**Files (SHARED):**
- `src/ui/Dashboard.svelte` (edit)

Steps:

- [ ] **4.1 Add the companion link** in `src/ui/Dashboard.svelte`. In the `{#each profile.dimensions as d}` block, the row currently ends with a single Drill button:

```svelte
          <button onclick={() => drill(d.dimension)}>{d.dimension === 'resilience' ? 'Defend' : 'Drill'}</button>
```

  Wrap the action(s) so the `timeManagement` row also offers the recognition drill. Replace that single-button line with:

```svelte
          <div class="row" style="gap:0.4rem;align-items:center">
            <button onclick={() => drill(d.dimension)}>{d.dimension === 'resilience' ? 'Defend' : 'Drill'}</button>
            {#if d.dimension === 'timeManagement'}
              <button class="link" onclick={() => app.go('when-to-think')}>Train when to think →</button>
            {/if}
          </div>
```

  (The `.link` class already exists in `Dashboard.svelte`'s `<style>`. `app` is already imported.)

- [ ] **4.2 Type-check:** `npm run check` — clean.

- [ ] **4.3 Commit:** `git add src/ui/Dashboard.svelte && git commit -m "feat: Dashboard companion 'when to think' link on the time-management row (ADR-0038)"`

---

## Task 5 — Verification (full suite + build + manual + diff guards)

This is a verification-only task (no new code). Confirm the doctrine held.

Steps:

- [ ] **5.1 Full unit suite:** `npm test` — all baseline tests (README: 135) plus the new `criticalMomentDrill` (3 describes incl. purity + `shuffled`) and `criticalMomentFallback` tests pass.

- [ ] **5.2 Type/build:** `npm run check` clean; `npm run build` succeeds (svelte-check + vite build).

- [ ] **5.3 Diff guards (grep the diff — must all be empty/absent):**
  - No engine at drill time: the new source files contain no `runAnalysis(`, `analyzeLines`, `engine.evaluate`, or `EngineClient` import. (`Grep` for these across `src/analysis/criticalMomentDrill.ts`, `src/analysis/criticalMomentFallback.ts`, `src/ui/WhenToThink.svelte`.) Note: `WhenToThink.svelte` legitimately imports `loadAllAnalyses` (a READ of stored analyses) — that is allowed; it must NOT call `runAnalysis`.
  - No new dependency: `package.json` `dependencies`/`devDependencies` unchanged.
  - No schema change: no `DB_VERSION`, no new `openTrainerDB` object store, no new `PlyAnalysis` field in `types.ts`.
  - No accuracy %: the diff contains no "accuracy" grade string or a `%`-suffixed *score* presented as a verdict. (The reveal's `{winProbLoss}%` is the raw swing — that is the intended, honest number, not a grade.)
  - No `Math.random`/`Date.now` in `criticalMomentDrill.ts` or `criticalMomentFallback.ts` (the purity unit test already enforces this for the selector; confirm the fallback too).

- [ ] **5.4 Manual smoke (the app):** start the app (`npm run dev`), complete onboarding if needed, then:
  - From the **Dashboard** time-management row, click **"Train when to think →"** → the `WhenToThink` view opens.
  - With **zero analysed games**: the **fallback** set loads (caption shows "sample positions") on a **read-only** board (you cannot drag a piece — AP-CMD-5).
  - Click **Critical** or **Routine** → it scores immediately and the reveal shows the **truth**, the **raw win-prob swing** (e.g. "About 28% in winning chances hung on this move"), and the **explainPly** headline/reasons/better. The tally updates ("N positions · M matched").
  - **Next** cycles through; reaching the last item shows the honest end framing; **Restart** reshuffles; **Back to dashboard** returns.
  - After analysing at least one real game (Analyse view), reopening **When to think** loads positions from **your own games** (caption has no "sample" note) and only **your** moves appear (no opponent-to-move positions — AP-CMD-8).
  - Confirm the tally is never labelled an "accuracy" or "score out of 100" (AP-CMD-1).

- [ ] **5.5 Commit (only if any verification fix was needed):** otherwise skip. If a manual issue surfaced (e.g. board interactive, or fallback not loading), fix in the relevant Task-3 file, re-run 5.1–5.4, then commit `fix: <issue> in when-to-think drill (ADR-0038)`.

---

## Task 6 — Docs: append ADR-0038 (FINAL task, code-before-docs)

Append the ADR to `decisions.md` (append-only) and add a short README note. This is the last task per the phase order (code → tests → verify → docs).

**Files (SHARED):**
- `decisions.md` (append)
- `README.md` (edit — small note; optional if no matching section exists, see 6.2)

Steps:

- [ ] **6.1 Append ADR-0038** to `decisions.md` (after the ADR-0035 block, append-only — do not edit prior entries). Use this exact block:

```md
## ADR-0038 — Critical-moment ("when to think") drill: recognition over stored win-prob swings; no engine at drill time
**Date:** 2026-06-02 · **Status:** accepted

Time trouble is a decision-allocation problem, not a clock-speed one. New recognition drill: show a
player-to-move position from the user's own analysed games on a READ-ONLY board, ask **CRITICAL**
(invest time) vs **ROUTINE** (play fast), then reveal the REAL win-probability swing that hung on the
move plus the existing `explainPly` text. No clock — the trained skill is *recognising* the critical
moment, upstream of managing the clock.

Pure selector `src/analysis/criticalMomentDrill.ts`: `labelPly` tags a player ply from its **realised**
`winProbLoss` — CRITICAL `>= 15`, ROUTINE `<= 3`, the band `(3,15)` is **ambiguous and excluded**
(Q-A). `buildDrillSet(analyses, rand, opts)` collects PLAYER-to-move plies only (`ply.color ===
playerColor`), excludes **trivial recaptures** from ROUTINE (a ply that recaptures on the previous
ply's destination square; never a CRITICAL one — a recapture can itself blunder, Q-C), dedups by
`fenBefore`, balances CRITICAL/ROUTINE *best-effort* (tops up from the larger side; never
empty-on-imbalance) and **Fisher–Yates shuffles via an INJECTED `rand`** — no `Math.random`/`Date.now`
in the core (AP-CMD-4). `scoreCall` is **binary** (Q-D): correct iff the call matches the truth; the
UI shows the **raw swing**, never an accuracy % (AP-CMD-1, honesty doctrine).

**Honesty (AP-CMD-2):** the CRITICAL label is the *realised* swing, NOT a proven "only-move" margin.
Stored analysis has ONE eval per position and no second-best line (ADR-0006), so `bestCp − secondBestCp`
is not available. Recovering a true uniqueness margin would need MultiPV at drill time (violates the
no-engine-at-drill-time doctrine, comeback/eval-graph precedent) or persisting a margin during analysis
(a `BatchAnalyzer` change) — **deferred (Q-B, §11)**. Copy says "a moment where a wrong move proved
expensive", never "the only move".

**Fallback (Q-E):** a curated static FEN set (`src/analysis/criticalMomentFallback.ts`) keeps the drill
non-empty before any game is analysed; legality + label-agreement asserted by a test (MASTER_GAMES
precedent). It feeds the SAME `scoreCall`/reveal path.

**Access (Q-F/Q-G):** Dashboard-reached, **no top-nav button**. The `timeManagement` row keeps its
existing Drill button (timed Tactics, ADR-0024) and gains an **additive** companion link "Train when to
think →" → `app.go('when-to-think')`. **No `weakness.ts` change** (`drillTarget` unchanged). New
`'when-to-think'` member on the `View` union + one route arm in `App.svelte`.

**No schema change** (AP-CMD-6): positions derive on the fly from the stored `gameAnalyses`; no
`DB_VERSION` bump, no object store, no `PlyAnalysis` field. **No new dependency** (AP-CMD-3); chess.js
appears only in the fallback legality TEST, never at drill time.

Cross-links: ADR-0006 (one eval per position — why no only-move margin), ADR-0021 (criticalMoments /
no accuracy grade), ADR-0024 (time-management drill routing), ADR-0025 (comeback: Dashboard-reached,
derive-on-the-fly precedent). Anti-patterns AP-CMD-1…8 (spec §9). Append-only; supersedes nothing.
```

- [ ] **6.2 README note (best-effort).** In `README.md`, find the "Train & retain" / differentiating-loop / drills section (search for "Comeback" or "Time management"). Add one line that the time-management dimension now also offers a recognition drill, with honest framing. Example sentence to insert near the comeback/time-management mention:

```md
- **When to think** — a recognition drill: call positions from your own games CRITICAL (invest time) or ROUTINE (play fast) and see the real win-probability swing that hung on the move. Recognition practice, not a graded method (no clock, no accuracy %).
```
  If no such section exists, skip the README edit (do not invent a new top-level section) and note it in the return value.

- [ ] **6.3 Final commit:** `git add decisions.md README.md && git commit -m "docs: ADR-0038 — when-to-think critical-moment drill"`
  (If README was not edited, commit `decisions.md` alone.)

---

## Self-review checklist (run before declaring done)

- [ ] **Spec coverage:** §2 In-scope items all delivered — `criticalMomentDrill.ts` (labelPly/buildDrillSet/scoreCall), `WhenToThink.svelte`, `View` union + route, Dashboard companion link, fallback set, ADR-0038. §5 test coverage matched (labelPly thresholds incl. boundaries; player-to-move-only; balance + top-up; determinism per seed; excludeRecaptures both ways; CRITICAL recapture kept; dedup; empty input; scoreCall both directions; purity guard).
- [ ] **No accuracy-% leak (AP-CMD-1):** the only `%` shown is the raw `winProbLoss` swing; the tally says "N matched the game's outcome", framed as practice — no "accuracy", no "/100", no derived grade. Verified in `WhenToThink.svelte` copy.
- [ ] **Honest CRITICAL label (AP-CMD-2):** reveal copy says "a moment where a wrong choice proved expensive", never "the only move". ADR records *why* (no second-best line, ADR-0006).
- [ ] **No engine / no chess.js at drill time (AP-CMD-3):** selector + fallback import neither; the view imports only `loadAllAnalyses` (a read). chess.js is confined to the fallback legality test.
- [ ] **Pure core (AP-CMD-4):** purity unit test asserts no `Math.random`/`Date.now`/engine/chess.js in `criticalMomentDrill.ts`; rand injected as `Math.random` at the view call site.
- [ ] **Read-only board (AP-CMD-5):** `<Board … viewOnly />`, no `onMove`.
- [ ] **No schema change (AP-CMD-6):** no `DB_VERSION`, store, or `PlyAnalysis` field touched.
- [ ] **Balance + shuffle (AP-CMD-7):** `buildDrillSet` tops up + Fisher–Yates; tests cover both.
- [ ] **Player-to-move only (AP-CMD-8):** `ply.color === analysis.playerColor` filter; test asserts opponent plies never appear.
- [ ] **Signature consistency:** `labelPly(ply, opts?)`, `buildDrillSet(analyses, rand, opts?)`, `scoreCall(item, call)`, `shuffled(arr, rand)`, `fallbackDrillItems()`, `explainPly(ply)`, `loadAllAnalyses()`, `Board {fen, orientation, viewOnly}` — all match the real anchors. No undefined references.
- [ ] **Shared targets flagged:** `app.svelte.ts`, `App.svelte`, `Dashboard.svelte`, `decisions.md` — listed up front; non-overlapping with `time-controls` edits but re-verify if parallel.
- [ ] **Docs last:** ADR-0038 is the final task (Task 6), after code + tests + verify.
