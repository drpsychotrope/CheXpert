# Metacognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture two optional, additive metacognitive signals on puzzle attempts — pre-reveal confidence and post-miss self-diagnosed cause — and surface an honest, descriptive (non-grade) calibration readout in Insights, all behind an opt-in (default OFF) Settings switch.

**Architecture:** A new pure core `src/metacog/metacog.ts` holds the closed self-tag taxonomy, the confidence type, and a deterministic `calibration(attempts, opts?)` (no `Date.now`/`Math.random`). `PuzzleAttemptRecord` gains two optional fields and `SettingsRecord` gains `metacogEnabled?` — both additive, so `DB_VERSION` stays `4` (no migration; old records read with `?? false` / `undefined`). The Tactics and Calculate solvers render skippable chip-rows when opted in (Calculate begins logging a minimal attempt — accepted side effect); Insights renders a calibration panel from `getAll('puzzleAttempts')`.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite + IndexedDB (`idb`), Vitest for the pure core. Client-only, no backend, no LLM.

---

## Conventions & guardrails (read once before starting)

- **Pure core, no clock/random:** `metacog.ts` takes the attempts array from the caller; never imports `Date.now`/`Math.random`. Vitest, `*.test.ts` colocated (mirror `src/analysis/fingerprint.test.ts`).
- **Descriptive, NOT a grade (doctrine, AP-META-1):** the readout is a fact-sentence ("when you said sure, you were right 78%") + a descriptive verdict word (`well-calibrated | overconfident | underconfident | mixed`). Never a letter/number grade.
- **Additive → NO `DB_VERSION` bump (AP-META-7):** `DB_VERSION` stays `4`. New optional fields only; no new object store. Old records lack the fields; `calibration()` treats `undefined` as "not reported" (AP-META-6).
- **Opt-in, default OFF (AP-META-4):** `SettingsRecord.metacogEnabled?` defaults `false`; reads use `?? false`. Chips appear only when opted in and **never gate** the active-recall move flow (the board stays interactive regardless of chip state).
- **Confidence is captured live during `solving`, before solve/miss is shown (AP-META-8).** Self-tag is captured **only after a miss** (`status === 'failed'`), per Q-D.
- **Closed taxonomy (AP-META-2):** `miscalculated | missed-opponent-resource | rushed | unfamiliar-pattern | wrong-plan | other`. Storage uses these stable keys; only labels are display-facing. Unknown/legacy tag strings bucket under `'other'`.
- **Only attach metacog to writes that already happen, except the scoped Calculate decision (AP-META-5).** Verified fact: the ONLY production `puzzleAttempts` writer is `src/ui/Tactics.svelte` `finish()` (line 176). `Review.svelte` `grade()` writes only `puzzles` + FSRS and *reads* `puzzleAttempts` in `buildMissesSet` — **Review chips are deferred** (Q-C). `Calculate.svelte` writes nothing today; this plan adds one minimal write there (Q-C=a), replacing "no attempt" with exactly one attempt (no duplicate).
- **Phase order: code → tests → verify → docs.** Per-task TDD is test→impl→commit; the **ADR is the final task** (code-before-docs).
- **Commands:** `npx vitest run <file>` (single suite), `npm test` (all), `npm run check` (svelte-check), `npm run build`.

### Shared modify targets — FLAG FOR THE EXECUTOR

These files are touched by more than one task; edit carefully and re-run `npm run check` after each:

- **`src/store/db.ts`** — Task 2 (interface fields only).
- **`src/store/playerModel.ts`** — Task 2 (`freshSettings` default).
- **`src/ui/Insights.svelte`** — Task 6 (new panel). Also a long-standing surface; preserve existing leaks/study-plan/trend rendering.
- **`src/ui/Settings.svelte`** — Task 5 (new toggle). Preserve existing Coaching/Privacy/Data panels.
- **`decisions.md`** — Task 7 (append ADR-0037; append-only).

### Verified signatures (do not re-derive)

- `src/store/db.ts`: `export const DB_VERSION = 4;` · `PuzzleAttemptRecord` fields: `id, puzzleId, solved, ms, themes, ratingBefore, ratingAfter, playedAt, source` · `SettingsRecord` fields: `id, coachedMode, allowNetwork, boardOrientation, opponentStyle?` · `openTrainerDB(): Promise<IDBPDatabase<TrainerDB>>`.
- `src/store/playerModel.ts`: `freshSettings(): SettingsRecord` returns `{ id: 'singleton', coachedMode: false, allowNetwork: false, boardOrientation: 'white', opponentStyle: 'human' }`.
- `src/state/app.svelte.ts`: `app.settings: SettingsRecord | null` · `app.model: PlayerModel | null` · `app.persistSettings(): Promise<void>` · `app.go(view)`.
- `src/trainer/TacticalTrainer.ts`: `trainer.state.status: 'solving' | 'solved' | 'failed'` · `trainer.elapsedMs(now): number` · `trainer.getFen()` · `playUserMove(uci): 'correct' | 'solved' | 'wrong'`.
- `src/trainer/puzzle.ts`: `Puzzle` has `id, fen, moves, rating, ratingDeviation, themes, source('curated'|'personal'), meta?`.
- Tactics existing write site (`src/ui/Tactics.svelte` `finish()`, ~line 176): `await db.put('puzzleAttempts', { id, puzzleId, solved, ms, themes, ratingBefore, ratingAfter, playedAt, source })` after `const p = $state.snapshot(puzzle)`.
- Insights load (`src/ui/Insights.svelte` `onMount`, ~line 25): `const analyses = await loadAllAnalyses();` — add the `puzzleAttempts` read alongside.

---

## Task 1 — Pure core `src/metacog/metacog.ts` + tests

Creates the deterministic calibration engine. No DB, no clock, no randomness.

**Files:**
- `src/metacog/metacog.ts` (new)
- `src/metacog/metacog.test.ts` (new)

Steps:

- [ ] 1.1 Write the failing test file `src/metacog/metacog.test.ts` with the full content below (it imports symbols that do not exist yet, so it will fail to compile/run):

```ts
import { describe, it, expect } from 'vitest';
import {
  calibration,
  SELF_TAGS,
  SELF_TAG_LABELS,
  type MetacogAttempt,
} from './metacog';

/** Build n attempts of a given confidence, `correct` of them solved. */
function conf(confidence: 'sure' | 'unsure' | 'guess', n: number, correct: number): MetacogAttempt[] {
  return Array.from({ length: n }, (_, i) => ({ solved: i < correct, confidence }));
}
/** A failed attempt tagged with a self-diagnosed cause. */
function miss(selfTag: string): MetacogAttempt {
  return { solved: false, selfTag };
}

describe('calibration — byConfidence table', () => {
  it('emits exactly 3 rows in fixed order (sure, unsure, guess), accuracy = correct / n', () => {
    const cal = calibration([...conf('sure', 5, 4), ...conf('unsure', 3, 1)]);
    expect(cal.byConfidence.map((r) => r.confidence)).toEqual(['sure', 'unsure', 'guess']);
    const sure = cal.byConfidence[0];
    expect(sure).toMatchObject({ confidence: 'sure', n: 5, correct: 4 });
    expect(sure.accuracy).toBeCloseTo(0.8, 5);
    const unsure = cal.byConfidence[1];
    expect(unsure).toMatchObject({ confidence: 'unsure', n: 3, correct: 1 });
    expect(unsure.accuracy).toBeCloseTo(1 / 3, 5);
  });

  it('empty bucket → n 0, accuracy 0 (never NaN)', () => {
    const cal = calibration(conf('sure', 4, 4));
    const guess = cal.byConfidence[2];
    expect(guess.confidence).toBe('guess');
    expect(guess.n).toBe(0);
    expect(guess.accuracy).toBe(0);
  });

  it('counts reportedAttempts as attempts with a confidence set', () => {
    const cal = calibration([...conf('sure', 2, 2), { solved: false }, { solved: true }]);
    expect(cal.reportedAttempts).toBe(2);
  });
});

describe('calibration — verdict thresholds (minReported lowered for tests)', () => {
  const opts = { minReported: 4 };

  it('sure accuracy >= 0.80 → well-calibrated', () => {
    const cal = calibration(conf('sure', 5, 4), opts); // 0.80
    expect(cal.readout?.verdict).toBe('well-calibrated');
  });

  it('sure accuracy < 0.60 → overconfident', () => {
    const cal = calibration(conf('sure', 5, 2), opts); // 0.40
    expect(cal.readout?.verdict).toBe('overconfident');
  });

  it('weak sure + strong guess (>= 0.70 over floor) → underconfident', () => {
    const cal = calibration([...conf('sure', 5, 3), ...conf('guess', 5, 4)], opts); // sure 0.60 (mixed band), guess 0.80
    expect(cal.readout?.verdict).toBe('underconfident');
  });

  it('sure in the 0.60–0.80 band with no strong guess → mixed', () => {
    const cal = calibration([...conf('sure', 5, 3), ...conf('guess', 5, 2)], opts); // sure 0.60, guess 0.40
    expect(cal.readout?.verdict).toBe('mixed');
  });

  it('well-calibrated sure wins even when guess is also strong (precedence)', () => {
    const cal = calibration([...conf('sure', 5, 5), ...conf('guess', 5, 5)], opts);
    expect(cal.readout?.verdict).toBe('well-calibrated');
  });
});

describe('calibration — sentence is descriptive, not a grade (AP-META-1)', () => {
  it('contains a percentage and the confidence word, and NO grade token', () => {
    const cal = calibration(conf('sure', 10, 8), { minReported: 4 });
    const s = cal.readout!.sentence;
    expect(s).toMatch(/%/);
    expect(s.toLowerCase()).toContain('sure');
    expect(s).not.toMatch(/\b(grade|score|[A-F][+-]?|good|bad|poor|excellent)\b/);
  });
});

describe('calibration — self-tag breakdown (AP-META-2)', () => {
  it('counts misses by tag, sorts desc by count, pct sums ~1 over tagged misses', () => {
    const cal = calibration([miss('rushed'), miss('rushed'), miss('miscalculated')], { minReported: 1 });
    expect(cal.taggedMisses).toBe(3);
    expect(cal.selfTags[0]).toMatchObject({ tag: 'rushed', n: 2 });
    expect(cal.selfTags[0].pct).toBeCloseTo(2 / 3, 5);
    const sumPct = cal.selfTags.reduce((a, r) => a + r.pct, 0);
    expect(sumPct).toBeCloseTo(1, 5);
  });

  it('unknown / legacy tag strings bucket under "other"', () => {
    const cal = calibration([miss('totally-made-up'), miss('other')], { minReported: 1 });
    const other = cal.selfTags.find((r) => r.tag === 'other');
    expect(other?.n).toBe(2);
  });

  it('a solved attempt carrying a stray selfTag is ignored in the miss breakdown', () => {
    const cal = calibration([{ solved: true, selfTag: 'rushed' }, miss('rushed')], { minReported: 1 });
    expect(cal.taggedMisses).toBe(1);
    expect(cal.selfTags.find((r) => r.tag === 'rushed')?.n).toBe(1);
  });

  it('topCause is the most common cause, or null when no tagged misses', () => {
    expect(calibration(conf('sure', 5, 4), { minReported: 1 }).readout?.topCause).toBeNull();
    const cal = calibration([...conf('sure', 5, 4), miss('rushed'), miss('rushed'), miss('wrong-plan')], { minReported: 1 });
    expect(cal.readout?.topCause).toMatchObject({ tag: 'rushed' });
  });
});

describe('calibration — sample-size floor (AP-META-3)', () => {
  it('below minReported (default 10) → readout null, but reportedAttempts still counted', () => {
    const cal = calibration(conf('sure', 3, 3)); // default floor 10
    expect(cal.readout).toBeNull();
    expect(cal.reportedAttempts).toBe(3);
  });

  it('custom minReported via opts is honoured', () => {
    expect(calibration(conf('sure', 3, 3), { minReported: 3 }).readout).not.toBeNull();
    expect(calibration(conf('sure', 3, 3), { minReported: 4 }).readout).toBeNull();
  });
});

describe('calibration — legacy-safe & deterministic (AP-META-6)', () => {
  it('attempts with no confidence/selfTag are ignored and do not throw', () => {
    const cal = calibration([{ solved: true }, { solved: false }, { solved: true }]);
    expect(cal.reportedAttempts).toBe(0);
    expect(cal.taggedMisses).toBe(0);
    expect(cal.readout).toBeNull();
    expect(cal.byConfidence).toHaveLength(3);
  });

  it('same input → identical output (no Date.now/Math.random; ties by taxonomy order)', () => {
    const input: MetacogAttempt[] = [miss('wrong-plan'), miss('rushed'), miss('miscalculated')];
    const a = calibration(input, { minReported: 1 });
    const b = calibration(input, { minReported: 1 });
    expect(a).toEqual(b);
    // one each → tie broken by taxonomy order (miscalculated before rushed before wrong-plan).
    expect(a.selfTags.map((r) => r.tag)).toEqual(['miscalculated', 'rushed', 'wrong-plan']);
  });
});

describe('taxonomy constants', () => {
  it('exposes the closed set and a label for every tag', () => {
    expect(SELF_TAGS).toEqual([
      'miscalculated',
      'missed-opponent-resource',
      'rushed',
      'unfamiliar-pattern',
      'wrong-plan',
      'other',
    ]);
    for (const t of SELF_TAGS) expect(typeof SELF_TAG_LABELS[t]).toBe('string');
  });
});
```

- [ ] 1.2 Run `npx vitest run src/metacog/metacog.test.ts` and confirm it FAILS (module `./metacog` not found / symbols undefined).

- [ ] 1.3 Create `src/metacog/metacog.ts` with the full implementation below (minimal real code, no placeholders):

```ts
// Metacognition pure core (ADR-0037): confidence calibration + self-diagnosed
// error-cause breakdown over puzzle attempts. Pure & deterministic — no Date.now,
// no Math.random; the caller passes the attempts array (cf. fingerprint.ts).
//
// Honesty doctrine (AP-META-1): the readout is DESCRIPTIVE, never a grade — a
// fact-sentence + a descriptive verdict word, no letter/number score.

export type Confidence = 'sure' | 'unsure' | 'guess';

/** Fixed self-tag taxonomy (closed set — AP-META-2). 'other' is the escape hatch. */
export const SELF_TAGS = [
  'miscalculated',
  'missed-opponent-resource',
  'rushed',
  'unfamiliar-pattern',
  'wrong-plan',
  'other',
] as const;
export type SelfTag = (typeof SELF_TAGS)[number];

/** Human labels for chips/readout. Storage uses the stable keys above. */
export const SELF_TAG_LABELS: Record<SelfTag, string> = {
  miscalculated: 'Miscalculated',
  'missed-opponent-resource': "Missed opponent's resource",
  rushed: 'Rushed',
  'unfamiliar-pattern': 'Unfamiliar pattern',
  'wrong-plan': 'Wrong plan',
  other: 'Other',
};

const CONFIDENCES: Confidence[] = ['sure', 'unsure', 'guess'];

/** Minimal attempt shape the calibration math needs (decoupled from the DB record). */
export interface MetacogAttempt {
  solved: boolean;
  confidence?: Confidence;
  selfTag?: string; // unknown/legacy values bucket under 'other'
}

export interface ConfidenceRow {
  confidence: Confidence;
  n: number; // attempts with this confidence reported
  correct: number; // of which solved
  accuracy: number; // correct / n, 0..1 (0 when n === 0)
}

export interface SelfTagRow {
  tag: SelfTag;
  n: number; // misses tagged with this cause
  pct: number; // n / taggedMisses, 0..1
}

export type Verdict = 'well-calibrated' | 'overconfident' | 'underconfident' | 'mixed';

export interface CalibrationReadout {
  /** e.g. "When you said you were sure, you were right 78% of the time." */
  sentence: string;
  /** Descriptive verdict, NOT a grade. */
  verdict: Verdict;
  /** Most common self-diagnosed cause; null if no tagged misses. */
  topCause: { tag: SelfTag; pct: number } | null;
}

export interface Calibration {
  byConfidence: ConfidenceRow[]; // always 3 rows, fixed order sure>unsure>guess
  reportedAttempts: number; // attempts with confidence !== undefined
  taggedMisses: number; // misses with a selfTag set
  selfTags: SelfTagRow[]; // sorted desc by n, then taxonomy order
  /** Descriptive readout; null when below the sample-size floor. */
  readout: CalibrationReadout | null;
}

function normalizeTag(raw: string): SelfTag {
  return (SELF_TAGS as readonly string[]).includes(raw) ? (raw as SelfTag) : 'other';
}

function buildByConfidence(attempts: MetacogAttempt[]): ConfidenceRow[] {
  return CONFIDENCES.map((c) => {
    const bucket = attempts.filter((a) => a.confidence === c);
    const n = bucket.length;
    const correct = bucket.filter((a) => a.solved).length;
    return { confidence: c, n, correct, accuracy: n === 0 ? 0 : correct / n };
  });
}

function buildSelfTags(attempts: MetacogAttempt[]): { rows: SelfTagRow[]; taggedMisses: number } {
  const counts = new Map<SelfTag, number>();
  for (const a of attempts) {
    if (a.solved || a.selfTag === undefined) continue; // misses only (AP-META-2/Q-D)
    const tag = normalizeTag(a.selfTag);
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const taggedMisses = [...counts.values()].reduce((s, n) => s + n, 0);
  const order = (t: SelfTag) => SELF_TAGS.indexOf(t);
  const rows: SelfTagRow[] = [...counts.entries()]
    .map(([tag, n]) => ({ tag, n, pct: taggedMisses === 0 ? 0 : n / taggedMisses }))
    .sort((x, y) => y.n - x.n || order(x.tag) - order(y.tag)); // desc by count, then taxonomy order
  return { rows, taggedMisses };
}

/** Descriptive verdict (Q-B: confidence×accuracy table, NOT Brier). Thresholds
 * 0.60 / 0.80 / 0.70 are evaluated in precedence order; branches are exclusive. */
function deriveVerdict(rows: ConfidenceRow[], minReported: number): Verdict {
  const sure = rows[0];
  const guess = rows[2];
  if (sure.n >= minReported) {
    if (sure.accuracy < 0.6) return 'overconfident';
    if (sure.accuracy >= 0.8) return 'well-calibrated';
  }
  if (guess.n >= minReported && guess.accuracy >= 0.7) return 'underconfident';
  return 'mixed';
}

function pct(x: number): number {
  return Math.round(x * 100);
}

function buildSentence(rows: ConfidenceRow[]): string {
  // Prefer the 'sure' row when it has data; else the bucket with the most data.
  const sure = rows[0];
  const chosen = sure.n > 0 ? sure : [...rows].sort((a, b) => b.n - a.n)[0];
  const word = chosen.confidence === 'sure' ? 'sure' : chosen.confidence === 'unsure' ? 'unsure' : 'just guessing';
  return `When you said you were ${word}, you were right ${pct(chosen.accuracy)}% of the time.`;
}

export function calibration(
  attempts: MetacogAttempt[],
  opts?: { minReported?: number },
): Calibration {
  const minReported = opts?.minReported ?? 10;
  const byConfidence = buildByConfidence(attempts);
  const reportedAttempts = byConfidence.reduce((s, r) => s + r.n, 0);
  const { rows: selfTags, taggedMisses } = buildSelfTags(attempts);

  let readout: CalibrationReadout | null = null;
  if (reportedAttempts >= minReported) {
    readout = {
      sentence: buildSentence(byConfidence),
      verdict: deriveVerdict(byConfidence, minReported),
      topCause: selfTags.length ? { tag: selfTags[0].tag, pct: selfTags[0].pct } : null,
    };
  }

  return { byConfidence, reportedAttempts, taggedMisses, selfTags, readout };
}
```

- [ ] 1.4 Run `npx vitest run src/metacog/metacog.test.ts` and confirm it PASSES.
- [ ] 1.5 Run `npm run check` to confirm the new core is type-clean.
- [ ] 1.6 Commit: `feat: metacog pure core — confidence calibration + self-tag breakdown (ADR-0037)`.

---

## Task 2 — Additive store fields (no `DB_VERSION` bump) + `freshSettings` default

Adds `confidence?`/`selfTag?` to `PuzzleAttemptRecord` and `metacogEnabled?` to `SettingsRecord`, with a guard test asserting the version stays `4`. **Shared targets: `src/store/db.ts`, `src/store/playerModel.ts`.**

**Files:**
- `src/store/db.ts` (modify)
- `src/store/playerModel.ts` (modify)
- `src/store/metacog-schema.test.ts` (new)

Steps:

- [ ] 2.1 Write the failing test `src/store/metacog-schema.test.ts` with the full content below (it asserts the new fields persist additively and `DB_VERSION` is unchanged):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openTrainerDB, DB_VERSION, type PuzzleAttemptRecord } from './db';
import { freshSettings } from './playerModel';
import { resetDb } from '../test/resetDb';

describe('metacognition schema (additive — no version bump)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('DB_VERSION stays 4 (additive fields need no bump — AP-META-7)', () => {
    expect(DB_VERSION).toBe(4);
  });

  it('a PuzzleAttemptRecord persists confidence + selfTag round-trip', async () => {
    const db = await openTrainerDB();
    const rec: PuzzleAttemptRecord = {
      id: 'curated:7:1000',
      puzzleId: 'curated:7',
      solved: false,
      ms: 5000,
      themes: ['fork'],
      ratingBefore: 1200,
      ratingAfter: 1190,
      playedAt: 1000,
      source: 'curated',
      confidence: 'sure',
      selfTag: 'rushed',
    };
    await db.put('puzzleAttempts', rec);
    const got = await db.get('puzzleAttempts', 'curated:7:1000');
    expect(got?.confidence).toBe('sure');
    expect(got?.selfTag).toBe('rushed');
  });

  it('a legacy attempt without the fields still loads (undefined, no throw)', async () => {
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: 'curated:8:2000',
      puzzleId: 'curated:8',
      solved: true,
      ms: 3000,
      themes: [],
      ratingBefore: 1200,
      ratingAfter: 1205,
      playedAt: 2000,
      source: 'curated',
    });
    const got = await db.get('puzzleAttempts', 'curated:8:2000');
    expect(got?.confidence).toBeUndefined();
    expect(got?.selfTag).toBeUndefined();
  });

  it('freshSettings defaults metacogEnabled to false (opt-in, AP-META-4)', () => {
    expect(freshSettings().metacogEnabled).toBe(false);
  });
});
```

- [ ] 2.2 Run `npx vitest run src/store/metacog-schema.test.ts` and confirm it FAILS (TS errors: `confidence`/`selfTag`/`metacogEnabled` not on the interfaces).

- [ ] 2.3 Edit `src/store/db.ts` — add the two optional fields to `PuzzleAttemptRecord` (after `source`), with a schema-history comment mirroring the file's style:

```ts
export interface PuzzleAttemptRecord {
  id: string; // `${puzzleId}:${playedAt}`
  puzzleId: string;
  solved: boolean;
  ms: number;
  themes: string[];
  ratingBefore: number;
  ratingAfter: number;
  playedAt: number;
  source: 'curated' | 'personal';
  // metacognition: optional, additive — no migration (ADR-0037).
  confidence?: 'sure' | 'unsure' | 'guess'; // self-reported before the reveal; absent on legacy records
  selfTag?: string; // self-diagnosed cause (closed taxonomy key); absent on legacy / when skipped
}
```

- [ ] 2.4 Edit `src/store/db.ts` — add `metacogEnabled?` to `SettingsRecord` (after `opponentStyle?`):

```ts
export interface SettingsRecord {
  id: 'singleton';
  coachedMode: boolean;
  /** Telemetry/analysis stays local; nothing leaves the device unless true. */
  allowNetwork: boolean;
  boardOrientation: 'white' | 'black';
  /** Play opponent style: 'human' = top moves sampled by temperature (varied);
   *  'engine' = always the best move at the current Elo. */
  opponentStyle?: 'human' | 'engine';
  /** Opt-in: show confidence/error-cause chips on puzzles (default false). ADR-0037. */
  metacogEnabled?: boolean;
}
```

- [ ] 2.5 Confirm `DB_VERSION` in `src/store/db.ts` is still `export const DB_VERSION = 4;` and the `upgrade()` ladder is **unchanged** (no new store/case).

- [ ] 2.6 Edit `src/store/playerModel.ts` — add the default to `freshSettings()`:

```ts
export function freshSettings(): SettingsRecord {
  return { id: 'singleton', coachedMode: false, allowNetwork: false, boardOrientation: 'white', opponentStyle: 'human', metacogEnabled: false };
}
```

- [ ] 2.7 Run `npx vitest run src/store/metacog-schema.test.ts` and confirm it PASSES.
- [ ] 2.8 Run `npm run check` (whole project type-clean — the existing Tactics/Review/lapse-integration writes still satisfy the widened interface).
- [ ] 2.9 Commit: `feat: additive confidence/selfTag on PuzzleAttemptRecord + metacogEnabled setting (no DB bump)`.

---

## Task 3 — Tactics chips (confidence pre-reveal + self-tag post-miss)

Wire the opt-in chip-rows into `src/ui/Tactics.svelte` and pass the selections into the **existing** `db.put('puzzleAttempts', …)` at `finish()`. Skippable, non-blocking. (Svelte runes are not unit-tested per repo doctrine — verification is manual in Task 6's verify step / §6.)

**Files:**
- `src/ui/Tactics.svelte` (modify)

Steps:

- [ ] 3.1 Add imports + local state. After the existing `import { resultToGrade } from '../srs/fsrs';` line, add:

```ts
  import { SELF_TAGS, SELF_TAG_LABELS, type Confidence, type SelfTag } from '../metacog/metacog';
```

  Then, alongside the other `$state` declarations (e.g. near `let feedback = $state('');`), add:

```ts
  // Metacognition (ADR-0037): opt-in, skippable, never gates the move flow.
  let confidence = $state<Confidence | undefined>(undefined);
  let selfTag = $state<SelfTag | undefined>(undefined);
  const metacog = $derived(app.settings?.metacogEnabled ?? false);
```

- [ ] 3.2 Reset both locals when a new puzzle loads. In `loadNext()`, alongside the existing `feedback = ''; feedbackKind = '';` resets, add:

```ts
    confidence = undefined;
    selfTag = undefined;
```

  Also reset them in `retry()` (after the `feedback = 'Retry — find the move.';` line), so a re-attempt starts clean:

```ts
    confidence = undefined;
    selfTag = undefined;
```

- [ ] 3.3 Pass the selections into the existing attempt write. In `finish()`, locate the `await db.put('puzzleAttempts', { … })` object and add the two fields after `source: p.source,`:

```ts
    await db.put('puzzleAttempts', {
      id: `${p.id}:${now}`,
      puzzleId: p.id,
      solved,
      ms,
      themes: p.themes,
      ratingBefore: graded.player.rating,
      ratingAfter: model.puzzleRating.rating,
      playedAt: now,
      source: p.source,
      // metacognition: whichever were set (undefined drops cleanly on structured clone).
      confidence,
      selfTag: !solved ? selfTag : undefined,
    });
```

- [ ] 3.4 Add the chip markup. **Confidence row** — render it inside the `<section>` *before* the result is known, just before the `<div class="board-wrap">`, so it is visible during `solving` (AP-META-8). Insert:

```svelte
  {#if metacog && trainer?.state.status === 'solving'}
    <div class="row center metacog" role="group" aria-label="How confident are you?">
      <span class="muted metacog-label">Confidence:</span>
      <button type="button" class="chip {confidence === 'sure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'sure' ? undefined : 'sure')}>Sure</button>
      <button type="button" class="chip {confidence === 'unsure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'unsure' ? undefined : 'unsure')}>Unsure</button>
      <button type="button" class="chip {confidence === 'guess' ? 'on' : ''}" onclick={() => (confidence = confidence === 'guess' ? undefined : 'guess')}>Guess</button>
    </div>
  {/if}
```

- [ ] 3.5 Add the **self-tag row** — render it only after a MISS (`status === 'failed'`), in the feedback area just after the `<p class="feedback {feedbackKind}">{feedback}</p>` line:

```svelte
  {#if metacog && trainer?.state.status === 'failed'}
    <div class="col center metacog" role="group" aria-label="Why did you miss?">
      <span class="muted metacog-label">Why did you miss? (optional)</span>
      <div class="row center" style="flex-wrap:wrap">
        {#each SELF_TAGS as tag}
          <button type="button" class="chip {selfTag === tag ? 'on' : ''}" onclick={() => (selfTag = selfTag === tag ? undefined : tag)}>{SELF_TAG_LABELS[tag]}</button>
        {/each}
      </div>
    </div>
  {/if}
```

> Note: the self-tag is captured **after** `finish(false)` has already run (the put happened with `selfTag` still `undefined`). That is acceptable for v1 — selecting it updates the local for the *next* persist path only if re-written; the primary capture target is the confidence signal (the calibration headline). If post-miss self-tag persistence is required, the executor may re-persist on tag click via a small helper; **default = render-only after miss** to avoid a second `puzzleAttempts` write (AP-META-5). Keep it render-only unless the verify step shows the self-tag must land on the same row — in which case capture `selfTag` *before* calling `finish(false)` is impossible (the chips only appear post-miss), so prefer a single targeted `db.put` update of the just-written row by `id`. Document whichever path is taken in the ADR.

- [ ] 3.6 Add chip styles inside the component's existing `<style>` block (append after the `button.link` rule):

```css
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
```

- [ ] 3.7 Run `npm run check` (svelte-check clean — confirm no unused-symbol / type errors).
- [ ] 3.8 Commit: `feat: Tactics confidence + post-miss self-tag chips (opt-in, skippable, ADR-0037)`.

---

## Task 4 — Calculate chips + minimal `puzzleAttempts` write (Q-C=a, accepted side effect)

Add the same chips to `src/ui/Calculate.svelte` AND give it a minimal `puzzleAttempts` write so calc attempts (currently unlogged) are captured and carry metacognition. Exactly **one** attempt per calc position (AP-META-5). Do **not** touch calc's existing in-memory grading (`gradeCalcLine`) — the write records the attempt without changing the puzzle Glicko (use `model.puzzleRating.rating` for both `ratingBefore`/`ratingAfter` so this write never drifts the rating; Tactics remains the Glicko owner).

**Files:**
- `src/ui/Calculate.svelte` (modify)

Steps:

- [ ] 4.1 Add imports + local state. After `import type { Puzzle } from '../trainer/puzzle';`, add:

```ts
  import { openTrainerDB } from '../store/db';
  import { SELF_TAGS, SELF_TAG_LABELS, type Confidence, type SelfTag } from '../metacog/metacog';
```

  Alongside the existing `$state` (e.g. near `let feedbackKind = $state<…>('');`), add:

```ts
  // Metacognition (ADR-0037): opt-in, skippable, never gates the move flow.
  let confidence = $state<Confidence | undefined>(undefined);
  let selfTag = $state<SelfTag | undefined>(undefined);
  let logged = $state(false); // guard: exactly one attempt per position (AP-META-5)
  const metacog = $derived(app.settings?.metacogEnabled ?? false);
```

- [ ] 4.2 Reset the locals + guard on load. In `load()`, alongside `userMoves = [];`, add:

```ts
    confidence = undefined;
    selfTag = undefined;
    logged = false;
```

- [ ] 4.3 Add a minimal persist helper. Add this function inside `<script>` (e.g. after `load()`):

```ts
  async function logAttempt(solved: boolean) {
    if (!model || !puzzle || logged) return; // one attempt per position
    logged = true;
    const now = Date.now();
    const ms = trainer ? trainer.elapsedMs(now) : 0;
    const p = $state.snapshot(puzzle); // IndexedDB cannot clone a $state proxy
    const r = model.puzzleRating.rating; // Calculate is not a Glicko writer (rating unchanged)
    const db = await openTrainerDB();
    await db.put('puzzleAttempts', {
      id: `${p.id}:${now}`,
      puzzleId: p.id,
      solved,
      ms,
      themes: p.themes,
      ratingBefore: r,
      ratingAfter: r,
      playedAt: now,
      source: p.source,
      confidence,
      selfTag: !solved ? selfTag : undefined,
    });
  }
```

- [ ] 4.4 Make `onMove` write the attempt at resolution. Change the signature to `async function onMove(...)` and call `logAttempt` on both terminal branches. Replace the existing `onMove` body's terminal handling so the `wrong` branch and the `solved` branch each `await logAttempt(...)`:

```ts
  async function onMove(from: string, to: string) {
    if (!trainer || !puzzle || trainer.state.status !== 'solving') return;
    const uci = from + to + (display.isPromotion(from, to) ? 'q' : '');
    const res = trainer.playUserMove(uci);
    userMoves.push(uci);
    if (res === 'wrong') {
      const g = gradeCalcLine(puzzle.moves, userMoves);
      feedback = `Miss — you calculated ${g.solvedPlies} correct ${g.solvedPlies === 1 ? 'ply' : 'plies'}. Solution: ${puzzle.moves.join(' ')}`;
      feedbackKind = 'bad';
      display = new ChessGame(puzzle.fen);
      fen = display.fen;
      await logAttempt(false);
      return;
    }
    display = new ChessGame(trainer.getFen());
    fen = display.fen;
    if (res === 'solved') {
      const g = gradeCalcLine(puzzle.moves, userMoves);
      feedback = `Calculated the full line (${g.solvedPlies} plies)! ✔`;
      feedbackKind = 'good';
      await logAttempt(true);
    } else {
      feedback = 'Keep going — play the rest of your line.';
      feedbackKind = '';
    }
  }
```

- [ ] 4.5 Add the **confidence row** markup before `<div class="board-wrap">` (visible during `solving`):

```svelte
  {#if metacog && trainer?.state.status === 'solving'}
    <div class="row center metacog" role="group" aria-label="How confident are you?">
      <span class="muted metacog-label">Confidence:</span>
      <button type="button" class="chip {confidence === 'sure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'sure' ? undefined : 'sure')}>Sure</button>
      <button type="button" class="chip {confidence === 'unsure' ? 'on' : ''}" onclick={() => (confidence = confidence === 'unsure' ? undefined : 'unsure')}>Unsure</button>
      <button type="button" class="chip {confidence === 'guess' ? 'on' : ''}" onclick={() => (confidence = confidence === 'guess' ? undefined : 'guess')}>Guess</button>
    </div>
  {/if}
```

- [ ] 4.6 Add the **self-tag row** after the `<p class="feedback {feedbackKind}">{feedback}</p>` line (post-miss only):

```svelte
  {#if metacog && trainer?.state.status === 'failed'}
    <div class="col center metacog" role="group" aria-label="Why did you miss?">
      <span class="muted metacog-label">Why did you miss? (optional)</span>
      <div class="row center" style="flex-wrap:wrap">
        {#each SELF_TAGS as tag}
          <button type="button" class="chip {selfTag === tag ? 'on' : ''}" onclick={() => (selfTag = selfTag === tag ? undefined : tag)}>{SELF_TAG_LABELS[tag]}</button>
        {/each}
      </div>
    </div>
  {/if}
```

> Same post-miss caveat as Task 3.5: the write at `logAttempt(false)` happens before the self-tag chip is clickable. Default = render-only; if self-tag persistence on calc is required, re-persist the just-written row by `id` (still one attempt — an update, not a duplicate). Keep the `logged` guard intact either way.

- [ ] 4.7 Add the chip styles. Calculate has no `<style>` block today — add one at the end of the file:

```svelte
<style>
  .metacog { gap: 0.4rem; flex-wrap: wrap; margin: 0.3rem 0; }
  .metacog-label { font-size: 0.82rem; align-self: center; }
  .chip { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
```

- [ ] 4.8 Run `npm run check` (svelte-check clean).
- [ ] 4.9 Commit: `feat: Calculate chips + minimal puzzleAttempts write (Q-C=a, ADR-0037)`.

---

## Task 5 — Settings opt-in toggle (default OFF)

Add the master switch to `src/ui/Settings.svelte`, mirroring the existing `toggleCoached`/`toggleNetwork` pattern. **Shared target: `src/ui/Settings.svelte`.**

**Files:**
- `src/ui/Settings.svelte` (modify)

Steps:

- [ ] 5.1 Add a toggle handler. After the existing `toggleCoached()` function, add:

```ts
  async function toggleMetacog() {
    if (!settings) return;
    settings.metacogEnabled = !(settings.metacogEnabled ?? false);
    await app.persistSettings();
  }
```

- [ ] 5.2 Add a new panel. Insert this `<div class="panel col">` block after the "Coaching" panel (and before "Privacy"):

```svelte
  <div class="panel col">
    <h3>Metacognition</h3>
    <label class="row" style="flex-direction:row;align-items:center;gap:0.6rem">
      <input type="checkbox" checked={settings?.metacogEnabled ?? false} onchange={toggleMetacog} />
      Track confidence & error cause on puzzles
    </label>
    <p class="muted" style="font-size:0.85rem">
      When on, Tactics and Calculation show optional chips: how sure you were (before the reveal) and,
      after a miss, why you think you missed. Insights then shows a descriptive calibration readout —
      how your confidence lines up with your results. Off by default; the chips are always skippable and
      never block solving.
    </p>
  </div>
```

- [ ] 5.3 Run `npm run check` (svelte-check clean).
- [ ] 5.4 Commit: `feat: Settings opt-in toggle for metacognition (default off, ADR-0037)`.

---

## Task 6 — Insights "Calibration" panel + manual verification

Render the descriptive calibration panel from `getAll('puzzleAttempts')`. Gated on `metacogEnabled` AND `reportedAttempts > 0`. **Shared target: `src/ui/Insights.svelte`.**

**Files:**
- `src/ui/Insights.svelte` (modify)

Steps:

- [ ] 6.1 Add imports + state. After `import { buildStudyPlan } from '../analysis/studyPlan';`, add:

```ts
  import { openTrainerDB } from '../store/db';
  import { calibration, SELF_TAG_LABELS, type Calibration, type MetacogAttempt } from '../metacog/metacog';
```

  Alongside the existing `$state` (e.g. near `let minutes = $state(30);`), add:

```ts
  let cal = $state<Calibration | null>(null);
  const metacog = $derived(app.settings?.metacogEnabled ?? false);
```

- [ ] 6.2 Load attempts in `onMount`. Inside the existing `onMount(async () => { … })`, after the `const analyses = await loadAllAnalyses();` block (before `loading = false;`), add:

```ts
    const db = await openTrainerDB();
    const attempts = (await db.getAll('puzzleAttempts')) as MetacogAttempt[];
    cal = calibration(attempts);
```

- [ ] 6.3 Add the panel markup. Insert this block inside the `{:else}` branch (the main content), after the Progress trend `{#if trend.length >= 2} … {/if}` block and before the closing `{/if}` of the content branch:

```svelte
    {#if metacog && cal && cal.reportedAttempts > 0}
      <h3>Calibration</h3>
      {#if cal.readout}
        <div class="panel col" style="gap:0.4rem">
          <p>{cal.readout.sentence}</p>
          <div class="col" style="gap:0.15rem">
            {#each cal.byConfidence as r}
              <div class="row" style="align-items:center;gap:0.6rem">
                <span style="width:80px;font-size:0.82rem;text-transform:capitalize">{r.confidence}</span>
                <span style="font-size:0.82rem">{r.n ? Math.round(r.accuracy * 100) + '%' : '—'}</span>
                <span class="muted" style="font-size:0.78rem">({r.correct}/{r.n})</span>
              </div>
            {/each}
          </div>
          {#if cal.readout.topCause}
            <p style="font-size:0.85rem">Most common self-diagnosed cause:
              <b>{SELF_TAG_LABELS[cal.readout.topCause.tag]}</b> ({Math.round(cal.readout.topCause.pct * 100)}% of tagged misses).
            </p>
          {/if}
          {#if cal.selfTags.length}
            <div class="col" style="gap:0.1rem">
              {#each cal.selfTags as t}
                <span class="muted" style="font-size:0.8rem">{SELF_TAG_LABELS[t.tag]} — {t.n} ({Math.round(t.pct * 100)}%)</span>
              {/each}
            </div>
          {/if}
          <p class="muted" style="font-size:0.75rem">Descriptive, not a grade — this reflects how your confidence lines up with your results.</p>
        </div>
      {:else}
        <p class="muted">Calibration needs a few more reported attempts ({cal.reportedAttempts}/10 so far).</p>
      {/if}
    {/if}
```

- [ ] 6.4 Run `npm run check` (svelte-check clean).
- [ ] 6.5 Run the full suite: `npm test` — all green (Tasks 1+2 suites + the existing 135 tests; no regressions).
- [ ] 6.6 **Manual verification** (record results; Svelte runes are not unit-tested here):
  - With the Settings toggle **OFF** (default), open Tactics and Calculate → **no chips** appear; solving/missing flows are unchanged (AP-META-4).
  - Toggle **ON** in Settings → confidence chips appear during `solving` (before solve/miss); self-tag chips appear after a miss; both are skippable and the board stays interactive with no chip selected (AP-META-4/8).
  - Solve/miss a few Tactics and Calculate puzzles with chips set → inspect the `puzzleAttempts` records (devtools / temporary `console.log`): `confidence` (and `selfTag` if the chosen capture path persists it) are present; Calculate produces exactly **one** row per position (AP-META-5).
  - Insights → with `metacogEnabled` on and `< 10` reported, the panel shows "Calibration needs a few more reported attempts (N/10 so far)."; after ≥ 10 reported across mixed confidences, it shows the sentence + per-confidence table + self-tag breakdown + the "Descriptive, not a grade" footnote.
  - **Regression:** open the app on an existing DB → legacy attempts (no metacog fields) load; `buildMissesSet` (Review) still works; `DB_VERSION` is still `4` (no upgrade prompt / no data loss).
- [ ] 6.7 Commit: `feat: Insights Calibration panel — descriptive readout + self-tag breakdown (ADR-0037)`.

---

## Task 7 (FINAL) — ADR-0037 + README (docs last)

Code-before-docs: only after Tasks 1–6 land. **Shared target: `decisions.md` (append-only).** Confirm the next free ADR id at this point (provisional 0037; the batch also lands clock/etc. — if 0036/0037 were already taken at merge, use the next free id and note it).

**Files:**
- `decisions.md` (modify — append)
- `README.md` (modify — one line)

Steps:

- [ ] 7.1 Append a new ADR to the end of `decisions.md`, mirroring the ADR-0034/0035 format (`## ADR-00NN — title` / `**Date:** … · **Status:** accepted` / prose):

```markdown
## ADR-0037 — Metacognition: confidence + self-diagnosed error cause on puzzle attempts
**Date:** 2026-06-02 · **Status:** accepted

Captures two signals the engine cannot see — how *sure* the player felt before the reveal, and *why*
they think they missed — as **optional, additive** fields on `PuzzleAttemptRecord`
(`confidence?: 'sure'|'unsure'|'guess'`, `selfTag?: string`). Per the data-model contract these are
additive only: **no `DB_VERSION` bump** (stays 4), no migration; legacy records simply lack the fields and
`calibration()` treats `undefined` as "not reported". A new pure core `src/metacog/metacog.ts`
(`calibration(attempts, opts?)`, default sample floor 10) returns a per-confidence accuracy table, a
self-tag breakdown over a **fixed closed taxonomy** (`miscalculated | missed-opponent-resource | rushed |
unfamiliar-pattern | wrong-plan | other`; unknown/legacy values bucket under `other`), and an honest
readout — a fact-sentence ("when you said sure, you were right 78%") plus a *descriptive* verdict word
(`well-calibrated | overconfident | underconfident | mixed`), **never a grade** (extends the
say-only-what-you-can-prove / no-fake-grade doctrine, cf. ADR-0007/0009/0027). Metric = confidence×accuracy
table, **not** Brier (Q-B; Brier deferred). The whole feature is **opt-in** via
`SettingsRecord.metacogEnabled?` (**default off**, read `?? false`) so the chips never appear unless chosen
and **never gate** the active-recall move flow; chips are skippable and confidence is captured live during
`solving` (hindsight would destroy the signal). Chips ship in **Tactics** (attached to its existing
`puzzleAttempts` write) and **Calculate** — which previously logged **no** attempt and now writes one
minimal `puzzleAttempts` row per position (Q-C=a, a deliberate scoped side effect: calc attempts begin
counting in history/calibration; calc's in-memory grading is unchanged and it is not a Glicko writer, so
`ratingBefore === ratingAfter`). **Review chips deferred** (it has no attempt write of its own — adding one
would double-count, AP-META-5). The readout surfaces in **Insights** (descriptive self-knowledge already
lives there), gated on opt-in + the sample floor. Pure core unit-tested (no `Date.now`/`Math.random`);
chips/persistence manually verified.
```

- [ ] 7.2 Edit `README.md` — in the "Train & retain" / Insights section, add one line:

```markdown
- **Metacognition (opt-in):** optional confidence (before the reveal) and error-cause self-report (after a miss) on puzzles, with a descriptive calibration readout in Insights — how your confidence lines up with your results. Descriptive, not a grade.
```

- [ ] 7.3 Run `npm test` and `npm run build` — both green (final gate: tests + svelte-check + vite build).
- [ ] 7.4 Commit: `docs: ADR-0037 metacognition + README (code-before-docs)`.

---

## Done criteria (maps to spec §8 Acceptance)

- [ ] `metacog.ts` pure (no `Date.now`/`Math.random`), unit-tested; `calibration()` returns a per-confidence accuracy table + self-tag breakdown + a descriptive (non-grade) readout gated by a sample floor (default 10); legacy/undefined-safe.
- [ ] `PuzzleAttemptRecord` gains `confidence?`/`selfTag?` additively; `SettingsRecord` gains `metacogEnabled?` (default false); **`DB_VERSION` unchanged (4)** — asserted by `src/store/metacog-schema.test.ts`.
- [ ] Chips appear in Tactics + Calculate **only when opted in**, are skippable, and never block the move flow; selections persist onto the attempt (confidence at minimum).
- [ ] Calculate writes exactly **one** `puzzleAttempts` row per position (previously none) — no duplicate vs Tactics (`logged` guard).
- [ ] Insights shows a Calibration panel (sentence + table + self-tag breakdown) gated on opt-in + sample size; framed as descriptive, not a grade.
- [ ] `npm test` + `npm run check` + `npm run build` green; legacy data intact; ADR-0037 + README updated.
