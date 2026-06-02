# Time Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chess clocks + Lichess-style time-control categories to the Play screen and split the single game rating / single adaptive bot into per-time-control pools (`RatingPool`), via a load-path migration that needs no `DB_VERSION` bump.

**Architecture:** Two new pure cores (`src/clock/Clock.ts` increment-on-press Fischer clock; `src/clock/categories.ts` band classifier + presets + FIDE insufficient-mating-material helper) are unit-tested with no `Date`/`Math.random` inside — `Play.svelte` measures elapsed via `performance.now()` and injects it. A new `src/rating/pools.ts` defines the `RatingPool` union; `db.ts` reshapes `PlayerModel` (`gameRatings`/`opponentByPool`) and adds `GameRecord.timeControl` + `SettingsRecord.lastTimeControl`; `playerModel.ts` migrates legacy single-rating records in the load path (DB stays v4). `Play.svelte` drives a tick loop during BOTH `playing` and `thinking` so the bot's clock decrements, presses on every move, computes a clock-aware bot movetime budget, and rates the finished game into exactly the selected pool.

**Tech Stack:** Svelte 5 runes, TypeScript, Vite, IndexedDB (`idb`), Vitest, chess.js 1.4.0, Stockfish 18 (via existing `EngineClient`), Glicko-2.

---

## Notes for the executor

- **Shared-modify targets (sequence with sibling specs in batch 3):** `src/store/db.ts` and `src/state/app.svelte.ts` are touched by other batch-3 specs (`chess960` adds `GameRecord.variant`/`startFen`; `metacognition` adds `PuzzleAttemptRecord.confidence`/`selfTag`; `efficacy-session` may add a `sessions` store; several add `View` members / signal flags to `app.svelte.ts`). This plan only **adds** fields/exports to those files (no removals beyond the documented `PlayerModel` field reshape), so merges are additive. If `chess960` already shipped and added the `chess960` member to `RatingPool`, Task 3 is idempotent — keep the single definition in `src/rating/pools.ts` and do not duplicate it.
- **Doctrine:** pure cores have no `Date.now`/`Math.random`/`performance.now` inside (AP-TC-1); the Play loop injects elapsed. Field additions migrate in the load path — **never bump `DB_VERSION`** (AP-TC-2). Phase order is code → tests → verify → docs; the ADR is the final task (code before docs).
- **Commands:** single test = `npx vitest run <file>`; full suite = `npm test`; types = `npm run check`; build = `npm run build`.
- **Baseline to preserve:** 135 tests green, `svelte-check` clean, build green.

---

## Task 1 — `src/clock/Clock.ts` pure core: `initClock`, `tick`, `press`, `flagged`, `startClock`, `stopClock`

Pure, immutable, Date-free chess clock. State `{ whiteMs, blackMs, incMs, side, running }`. `tick` decrements only the running side (clamped ≥ 0); `press(mover)` adds Fischer increment to the mover then flips `side`; `flagged` reports the side at/below 0. Mirrors the immutable-transition style of `recordGame` in `AdaptiveOpponent.ts`. (Spec §2.1, §4.1, §5.)

**Files:**
- Create: `src/clock/Clock.ts`
- Create (test): `src/clock/Clock.test.ts`

**Steps:**

- [ ] 1. Write the failing test file `src/clock/Clock.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { initClock, tick, press, flagged, startClock, stopClock } from './Clock';

  describe('Clock pure core', () => {
    it('initClock sets both sides, the increment, the side on move, and running=false', () => {
      const s = initClock(60_000, 0, 'w');
      expect(s).toEqual({ whiteMs: 60_000, blackMs: 60_000, incMs: 0, side: 'w', running: false });
    });

    it('initClock defaults the side to white', () => {
      expect(initClock(180_000, 2_000).side).toBe('w');
    });

    it('startClock / stopClock toggle running and return a new object', () => {
      const s = initClock(60_000, 0);
      const started = startClock(s);
      expect(started.running).toBe(true);
      expect(started).not.toBe(s);
      expect(stopClock(started).running).toBe(false);
    });

    it('tick decrements ONLY the running side', () => {
      const s = startClock(initClock(60_000, 0, 'w'));
      const after = tick(s, 1_000);
      expect(after.whiteMs).toBe(59_000);
      expect(after.blackMs).toBe(60_000);
    });

    it('tick decrements black when black is on the move', () => {
      const s = startClock({ ...initClock(60_000, 0, 'b') });
      const after = tick(s, 2_500);
      expect(after.blackMs).toBe(57_500);
      expect(after.whiteMs).toBe(60_000);
    });

    it('tick clamps at 0 (never negative)', () => {
      const s = startClock(initClock(1_000, 0, 'w'));
      const after = tick(s, 5_000);
      expect(after.whiteMs).toBe(0);
    });

    it('tick is a no-op when not running', () => {
      const s = initClock(60_000, 0, 'w');
      expect(tick(s, 1_000)).toEqual(s);
    });

    it('press adds the Fischer increment to the mover and flips the side', () => {
      const s = startClock(initClock(180_000, 2_000, 'w'));
      const after = press(s, 'w');
      expect(after.whiteMs).toBe(182_000);
      expect(after.side).toBe('b');
    });

    it('press adds 0 when the increment is 0 (bullet 1+0)', () => {
      const s = startClock(initClock(60_000, 0, 'w'));
      const after = press(s, 'w');
      expect(after.whiteMs).toBe(60_000);
      expect(after.side).toBe('b');
    });

    it('press is ignored when the mover is not the side on the move', () => {
      const s = startClock(initClock(60_000, 2_000, 'w'));
      expect(press(s, 'b')).toEqual(s);
    });

    it('press does NOT add the increment if the mover is already flagged (time at 0)', () => {
      const s = startClock({ whiteMs: 0, blackMs: 60_000, incMs: 2_000, side: 'w', running: true });
      const after = press(s, 'w');
      expect(after.whiteMs).toBe(0);
      expect(after.side).toBe('b');
    });

    it('flagged returns the side at or below 0, else null', () => {
      expect(flagged(initClock(60_000, 0, 'w'))).toBeNull();
      expect(flagged({ whiteMs: 0, blackMs: 5_000, incMs: 0, side: 'w', running: true })).toBe('w');
      expect(flagged({ whiteMs: 5_000, blackMs: 0, incMs: 0, side: 'b', running: true })).toBe('b');
    });

    it('all transitions return a new object (immutability)', () => {
      const s = startClock(initClock(60_000, 1_000, 'w'));
      expect(tick(s, 100)).not.toBe(s);
      expect(press(s, 'w')).not.toBe(s);
    });

    it('determinism: identical inputs produce identical state', () => {
      const a = press(tick(startClock(initClock(60_000, 1_000, 'w')), 1_234), 'w');
      const b = press(tick(startClock(initClock(60_000, 1_000, 'w')), 1_234), 'w');
      expect(a).toEqual(b);
    });

    it('sequence: bullet 1+0, white burns all time, flags white', () => {
      let s = startClock(initClock(60_000, 0, 'w'));
      s = tick(s, 30_000); // white -> 30s
      s = press(s, 'w');   // flip to black
      s = tick(s, 10_000); // black -> 50s
      s = press(s, 'b');   // flip to white
      s = tick(s, 40_000); // white 30 -> 0, flags
      expect(flagged(s)).toBe('w');
    });
  });
  ```

- [ ] 2. Run it and confirm it FAILS (expected: `Failed to resolve import "./Clock"` — the module does not exist yet):
  ```
  npx vitest run src/clock/Clock.test.ts
  ```

- [ ] 3. Create `src/clock/Clock.ts` with the full implementation:
  ```ts
  // Pure chess-clock core (spec §4.1, AP-TC-1, AP-TC-5).
  //
  // State machine for a two-sided Fischer-increment clock. NO Date.now() and NO
  // Math.random() / performance.now() inside — the Play loop measures elapsed ms
  // via performance.now() deltas and passes them to tick(). Mirrors the
  // rand-injection discipline in humanMove.ts and the immutable transitions in
  // AdaptiveOpponent.recordGame. Every transition returns a NEW object.

  export type Side = 'w' | 'b';

  export interface ClockState {
    whiteMs: number;
    blackMs: number;
    incMs: number;
    /** Whose clock is currently running. */
    side: Side;
    running: boolean;
  }

  /** Build a clock with both sides at `initialMs`, the given Fischer increment, and `running=false`. */
  export function initClock(initialMs: number, incMs: number, side: Side = 'w'): ClockState {
    return { whiteMs: initialMs, blackMs: initialMs, incMs, side, running: false };
  }

  export function startClock(s: ClockState): ClockState {
    return { ...s, running: true };
  }

  export function stopClock(s: ClockState): ClockState {
    return { ...s, running: false };
  }

  /** Subtract `elapsedMs` from the running side; clamps at 0 (never negative). No-op if !running. */
  export function tick(s: ClockState, elapsedMs: number): ClockState {
    if (!s.running) return s;
    if (s.side === 'w') return { ...s, whiteMs: Math.max(0, s.whiteMs - elapsedMs) };
    return { ...s, blackMs: Math.max(0, s.blackMs - elapsedMs) };
  }

  /**
   * Move-completion event: the side that just moved (`mover`) presses. Adds the Fischer
   * increment to the mover, then flips `side` to the opponent. Ignored if `mover` is not
   * the side on the move. The increment is NOT added if the mover is already flagged
   * (time at 0) — you cannot gain time after flagging.
   */
  export function press(s: ClockState, mover: Side): ClockState {
    if (mover !== s.side) return s;
    const other: Side = mover === 'w' ? 'b' : 'w';
    if (mover === 'w') {
      const whiteMs = s.whiteMs > 0 ? s.whiteMs + s.incMs : s.whiteMs;
      return { ...s, whiteMs, side: other };
    }
    const blackMs = s.blackMs > 0 ? s.blackMs + s.incMs : s.blackMs;
    return { ...s, blackMs, side: other };
  }

  /** Returns the flagged side ('w'|'b') if its time is ≤ 0, else null. */
  export function flagged(s: ClockState): Side | null {
    if (s.whiteMs <= 0) return 'w';
    if (s.blackMs <= 0) return 'b';
    return null;
  }
  ```

- [ ] 4. Run the test again and confirm it PASSES:
  ```
  npx vitest run src/clock/Clock.test.ts
  ```

- [ ] 5. Commit:
  ```
  git add src/clock/Clock.ts src/clock/Clock.test.ts
  git commit -m "feat: pure Fischer chess-clock core (Clock.ts) (ADR-0036)"
  ```

---

## Task 2 — `src/clock/categories.ts`: `categoryFor` band + `TIME_CONTROL_PRESETS` + `fmtClock`

Pure category classifier (band on `initialSec + 40·incrementSec`), the Q-A preset table, and a `mm:ss`/`ss.s` formatting helper used by the Play clock read-outs. (Spec §2.2, §4.2, §4.6, §5.) The FIDE insufficient-material helper is added in Task 3 (separate concern + its own FEN-parse logic).

**Files:**
- Create: `src/clock/categories.ts`
- Create (test): `src/clock/categories.test.ts`

**Steps:**

- [ ] 1. Write the failing test file `src/clock/categories.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { categoryFor, TIME_CONTROL_PRESETS, fmtClock, type Category } from './categories';

  describe('categoryFor band classifier', () => {
    it('maps each timed preset into its intended band', () => {
      const expected: Record<string, Category> = {
        '1+0': 'bullet', '2+1': 'bullet',
        '3+2': 'blitz', '5+0': 'blitz',
        '10+0': 'rapid', '15+10': 'rapid',
        '30+0': 'classical',
      };
      for (const p of TIME_CONTROL_PRESETS) {
        if (p.untimed) continue;
        const want = expected[`${p.initialSec / 60 % 1 === 0 ? p.initialSec / 60 : p.initialSec}+${p.incrementSec}`];
        // The map above is keyed by minutes+inc for the standard presets; only assert known ones.
        if (want) expect(categoryFor(p.initialSec, p.incrementSec)).toBe(want);
      }
    });

    it('classifies the canonical presets directly', () => {
      expect(categoryFor(60, 0)).toBe('bullet'); // est 60
      expect(categoryFor(120, 1)).toBe('bullet'); // est 160
      expect(categoryFor(180, 2)).toBe('blitz'); // est 260
      expect(categoryFor(300, 0)).toBe('blitz'); // est 300
      expect(categoryFor(600, 0)).toBe('rapid'); // est 600
      expect(categoryFor(900, 10)).toBe('rapid'); // est 1300
      expect(categoryFor(1800, 0)).toBe('classical'); // est 1800
    });

    it('respects the band boundaries (178/179, 478/479, 1498/1499)', () => {
      expect(categoryFor(178, 0)).toBe('bullet');
      expect(categoryFor(179, 0)).toBe('blitz');
      expect(categoryFor(478, 0)).toBe('blitz');
      expect(categoryFor(479, 0)).toBe('rapid');
      expect(categoryFor(1498, 0)).toBe('rapid');
      expect(categoryFor(1499, 0)).toBe('classical');
    });

    it('uses initial + 40*increment as the estimate (increment pushes up a band)', () => {
      // 2+1 = 120 + 40 = 160 -> bullet; 2+2 = 120 + 80 = 200 -> blitz.
      expect(categoryFor(120, 1)).toBe('bullet');
      expect(categoryFor(120, 2)).toBe('blitz');
    });
  });

  describe('TIME_CONTROL_PRESETS table', () => {
    it('contains the Q-A seed: bullet 1+0/2+1, blitz 3+2/5+0, rapid 10+0/15+10, classical 30+0, No clock, Custom', () => {
      const labels = TIME_CONTROL_PRESETS.map((p) => p.label);
      expect(labels).toEqual([
        'Bullet 1+0', 'Bullet 2+1', 'Blitz 3+2', 'Blitz 5+0',
        'Rapid 10+0', 'Rapid 15+10', 'Classical 30+0', 'No clock', 'Custom',
      ]);
    });

    it('marks exactly the "No clock" preset as untimed', () => {
      expect(TIME_CONTROL_PRESETS.filter((p) => p.untimed).map((p) => p.label)).toEqual(['No clock']);
    });

    it('every preset has a unique id', () => {
      const ids = TIME_CONTROL_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('the standard timed presets carry the right seconds', () => {
      const bullet = TIME_CONTROL_PRESETS.find((p) => p.id === 'bullet-1-0');
      expect(bullet).toMatchObject({ initialSec: 60, incrementSec: 0 });
      const rapidInc = TIME_CONTROL_PRESETS.find((p) => p.id === 'rapid-15-10');
      expect(rapidInc).toMatchObject({ initialSec: 900, incrementSec: 10 });
    });
  });

  describe('fmtClock', () => {
    it('formats minutes:seconds above 20 s', () => {
      expect(fmtClock(125_000)).toBe('2:05');
      expect(fmtClock(60_000)).toBe('1:00');
      expect(fmtClock(20_001)).toBe('0:21'); // ceil to whole seconds above the 20s threshold
    });

    it('formats seconds with one decimal at or below 20 s', () => {
      expect(fmtClock(19_900)).toBe('19.9');
      expect(fmtClock(5_400)).toBe('5.4');
    });

    it('shows 0:00 at or below zero', () => {
      expect(fmtClock(0)).toBe('0:00');
      expect(fmtClock(-50)).toBe('0:00');
    });
  });
  ```

- [ ] 2. Run it and confirm it FAILS (expected: `Failed to resolve import "./categories"`):
  ```
  npx vitest run src/clock/categories.test.ts
  ```

- [ ] 3. Create `src/clock/categories.ts` with the classifier, presets, and formatter (the FIDE helper is appended in Task 3):
  ```ts
  // Time-control categories + presets + clock formatting (spec §4.2, §4.6, Q-A).
  // Pure: no Date / Math.random inside.

  export type Category = 'bullet' | 'blitz' | 'rapid' | 'classical';

  /**
   * Lichess-style band on the estimate = initialSec + 40 * incrementSec.
   *   est < 179        -> 'bullet'    (1+0 = 60, 2+1 = 160)
   *   179 <= est < 479 -> 'blitz'     (3+2 = 260, 5+0 = 300)
   *   479 <= est < 1499-> 'rapid'     (10+0 = 600, 15+10 = 1300)
   *   est >= 1499      -> 'classical' (30+0 = 1800)
   */
  export function categoryFor(initialSec: number, incrementSec: number): Category {
    const est = initialSec + 40 * incrementSec;
    if (est < 179) return 'bullet';
    if (est < 479) return 'blitz';
    if (est < 1499) return 'rapid';
    return 'classical';
  }

  export interface TimeControlPreset {
    id: string;
    label: string;
    initialSec: number;
    incrementSec: number;
    /** "No clock" — preserves today's untimed Play behavior; rated into the classical pool (Q-B=a). */
    untimed?: boolean;
  }

  /** Q-A seed (see spec §0.5). "Custom" is a sentinel the UI expands into initial/increment inputs. */
  export const TIME_CONTROL_PRESETS: TimeControlPreset[] = [
    { id: 'bullet-1-0', label: 'Bullet 1+0', initialSec: 60, incrementSec: 0 },
    { id: 'bullet-2-1', label: 'Bullet 2+1', initialSec: 120, incrementSec: 1 },
    { id: 'blitz-3-2', label: 'Blitz 3+2', initialSec: 180, incrementSec: 2 },
    { id: 'blitz-5-0', label: 'Blitz 5+0', initialSec: 300, incrementSec: 0 },
    { id: 'rapid-10-0', label: 'Rapid 10+0', initialSec: 600, incrementSec: 0 },
    { id: 'rapid-15-10', label: 'Rapid 15+10', initialSec: 900, incrementSec: 10 },
    { id: 'classical-30-0', label: 'Classical 30+0', initialSec: 1800, incrementSec: 0 },
    { id: 'no-clock', label: 'No clock', initialSec: 0, incrementSec: 0, untimed: true },
    { id: 'custom', label: 'Custom', initialSec: 300, incrementSec: 0 },
  ];

  /** Format remaining ms: mm:ss above 20 s, ss.s at/below 20 s, 0:00 at/below zero. */
  export function fmtClock(ms: number): string {
    if (ms <= 0) return '0:00';
    if (ms <= 20_000) return (Math.ceil(ms / 100) / 10).toFixed(1);
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  ```

- [ ] 4. Run the test again and confirm it PASSES:
  ```
  npx vitest run src/clock/categories.test.ts
  ```

- [ ] 5. Commit:
  ```
  git add src/clock/categories.ts src/clock/categories.test.ts
  git commit -m "feat: time-control categoryFor band + presets + fmtClock (ADR-0036)"
  ```

---

## Task 3 — `insufficientMatingMaterial(fen, side)` FIDE helper (Q-C flag rule)

A pure helper for FIDE Art. 6.9: when a side flags, it is a draw if the *opponent* (the side that did NOT flag) cannot checkmate by any legal sequence. `chess.js` `isInsufficientMaterial()` judges the whole board, but Q-C needs **one named side's** material specifically, so this parses the FEN piece-placement field directly. Conservative: returns `true` only for the provably-no-mate cases (bare K; K+B; K+N; K + only same-colour bishops). Added to `categories.ts`. (Spec §4.2, §6.4, §9 AP-TC-6.)

**Files:**
- Modify: `src/clock/categories.ts`
- Modify (test): `src/clock/categories.test.ts`

**Steps:**

- [ ] 1. Add a failing `describe` block to the END of `src/clock/categories.test.ts` (append after the existing `fmtClock` describe), and add `insufficientMatingMaterial` to the import line at the top of the file:
  - Change the import line at the top from:
    ```ts
    import { categoryFor, TIME_CONTROL_PRESETS, fmtClock, type Category } from './categories';
    ```
    to:
    ```ts
    import { categoryFor, TIME_CONTROL_PRESETS, fmtClock, insufficientMatingMaterial, type Category } from './categories';
    ```
  - Append this block at the end of the file:
    ```ts
    describe('insufficientMatingMaterial (FIDE Art. 6.9 flag rule)', () => {
      // FENs are piece-placement + side-to-move; the helper only reads piece placement.
      it('true for king vs king', () => {
        expect(insufficientMatingMaterial('8/8/4k3/8/8/3K4/8/8 w - - 0 1', 'w')).toBe(true);
        expect(insufficientMatingMaterial('8/8/4k3/8/8/3K4/8/8 w - - 0 1', 'b')).toBe(true);
      });

      it('true for K + single bishop (the named side cannot mate)', () => {
        // White has K + bishop; Black has lone K.
        const fen = '8/8/4k3/8/8/3KB3/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(true); // K+B cannot force mate
        expect(insufficientMatingMaterial(fen, 'b')).toBe(true); // lone K cannot mate
      });

      it('true for K + single knight', () => {
        const fen = '8/8/4k3/8/8/3KN3/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(true);
        expect(insufficientMatingMaterial(fen, 'b')).toBe(true);
      });

      it('true for K + multiple bishops all on the SAME colour', () => {
        // Two white bishops both on light squares (f1, b1 are different colours, so use c1 + a3?).
        // Use bishops on light squares c8-style: place white bishops on f1 (light) and h3 (light).
        // f1 = file f(6) rank1 -> (6+1)=7 odd -> light; h3 = file h(8) rank3 -> 11 odd -> light.
        const fen = '8/8/4k3/8/8/3K3B/8/5B2 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(true);
      });

      it('false for K + two bishops on OPPOSITE colours (mate possible)', () => {
        // c1 (file3 rank1 -> 4 even -> dark) + f1 (light) => opposite colours.
        const fen = '8/8/4k3/8/8/3K4/8/2B2B2 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(false);
      });

      it('false for K + rook (mate possible)', () => {
        const fen = '8/8/4k3/8/8/3KR3/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(false);
      });

      it('false for K + pawn (mate possible after promotion)', () => {
        const fen = '8/8/4k3/8/8/3K1P2/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(false);
      });

      it('false for K + queen', () => {
        const fen = '8/8/4k3/8/8/3KQ3/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(false);
      });

      it('false for K + two knights (cannot be FORCED, but FIDE 6.9 = mate not impossible)', () => {
        const fen = '8/8/4k3/8/8/3KNN2/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(false);
      });

      it('evaluates the NAMED side independently of the other side', () => {
        // White: K + rook (sufficient). Black: lone king (insufficient).
        const fen = '8/8/4k3/8/8/3KR3/8/8 w - - 0 1';
        expect(insufficientMatingMaterial(fen, 'w')).toBe(false);
        expect(insufficientMatingMaterial(fen, 'b')).toBe(true);
      });
    });
    ```

- [ ] 2. Run the test and confirm the new block FAILS (expected: `insufficientMatingMaterial is not a function` / not exported):
  ```
  npx vitest run src/clock/categories.test.ts
  ```

- [ ] 3. Append `insufficientMatingMaterial` (and the `Side` import) to `src/clock/categories.ts`. Add the import at the top of the file (just under the leading comment), then append the function at the bottom:
  - Add at the top, after the file's header comment and before `export type Category`:
    ```ts
    import type { Side } from './Clock';
    ```
  - Append at the bottom of the file:
    ```ts
    /**
     * FIDE Art. 6.9 helper for the flag rule (Q-C): true if `side` has no possible
     * mating material — bare king, or K + a single bishop/knight, or K + only
     * same-colour bishops (no other pieces). Pure: derives solely from the FEN's
     * piece-placement field. A flag against a side with insufficient mating
     * material is a DRAW, not a loss. Conservative: for anything richer (a pawn,
     * rook, queen, two knights, opposite-colour bishops) it returns false — only
     * declare a draw when provably no mate (honesty doctrine, AP-TC-6).
     */
    export function insufficientMatingMaterial(fen: string, side: Side): boolean {
      const placement = fen.split(' ')[0];
      let bishops = 0;
      let knights = 0;
      let bishopSquaresLight = false;
      let bishopSquaresDark = false;
      let file = 0; // 0-based file as we scan a rank left→right
      let rank = 8; // FEN ranks run 8 down to 1, top row first

      for (const ch of placement) {
        if (ch === '/') {
          rank -= 1;
          file = 0;
          continue;
        }
        if (ch >= '1' && ch <= '8') {
          file += Number(ch);
          continue;
        }
        const isWhitePiece = ch === ch.toUpperCase();
        const mine = side === 'w' ? isWhitePiece : !isWhitePiece;
        const type = ch.toLowerCase();
        if (mine) {
          if (type === 'q' || type === 'r' || type === 'p') return false; // mate possible
          if (type === 'n') knights += 1;
          if (type === 'b') {
            bishops += 1;
            // Square colour: (file + rank) parity. file is 0-based here, rank is 1..8.
            const light = (file + rank) % 2 === 1;
            if (light) bishopSquaresLight = true;
            else bishopSquaresDark = true;
          }
        }
        file += 1;
      }

      // Two or more knights → mate is not impossible (FIDE: only force-impossible is a draw,
      // but Art. 6.9 draws on "cannot checkmate by ANY series of legal moves"; K+N+N CAN, so false).
      if (knights >= 2) return false;
      if (knights >= 1 && bishops >= 1) return false; // K+B+N can force mate
      // Bishops: insufficient only if all on a single colour.
      if (bishops >= 1 && bishopSquaresLight && bishopSquaresDark) return false;
      // Remaining cases: bare K, K+1N, K+1B, K + only same-colour bishops → insufficient.
      return true;
    }
    ```

- [ ] 4. Run the test again and confirm it PASSES:
  ```
  npx vitest run src/clock/categories.test.ts
  ```

- [ ] 5. Commit:
  ```
  git add src/clock/categories.ts src/clock/categories.test.ts
  git commit -m "feat: FIDE insufficientMatingMaterial helper for flag rule (ADR-0036)"
  ```

---

## Task 4 — `src/rating/pools.ts`: `RatingPool` union + `STANDARD_POOLS`

Define the `RatingPool` union (owned by this spec, including the `chess960` member populated later) and the `STANDARD_POOLS` tuple, in a dedicated module to avoid bloating `glicko2.ts`. No DB change yet. (Spec §4.4, scan "Authoritative shared data-model contract".)

**Files:**
- Create: `src/rating/pools.ts`
- Create (test): `src/rating/pools.test.ts`

**Steps:**

- [ ] 1. Write the failing test file `src/rating/pools.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { STANDARD_POOLS, type RatingPool } from './pools';

  describe('RatingPool union + STANDARD_POOLS', () => {
    it('STANDARD_POOLS lists exactly the 4 standard pools (chess960 seeded lazily)', () => {
      expect(STANDARD_POOLS).toEqual(['bullet', 'blitz', 'rapid', 'classical']);
    });

    it('the union accepts every standard member and chess960', () => {
      const all: RatingPool[] = ['bullet', 'blitz', 'rapid', 'classical', 'chess960'];
      expect(all).toHaveLength(5);
    });

    it('STANDARD_POOLS is a readonly tuple usable for iteration', () => {
      const seen: string[] = [];
      for (const p of STANDARD_POOLS) seen.push(p);
      expect(seen.sort()).toEqual(['blitz', 'bullet', 'classical', 'rapid']);
    });
  });
  ```

- [ ] 2. Run it and confirm it FAILS (expected: `Failed to resolve import "./pools"`):
  ```
  npx vitest run src/rating/pools.test.ts
  ```

- [ ] 3. Create `src/rating/pools.ts`:
  ```ts
  // Per-time-control rating pools (spec §4.4; owned by the time-controls spec).
  //
  // The RatingPool union is defined ONCE here and re-exported where convenient.
  // The `chess960` member is part of the contract now but is populated lazily by
  // the chess960 spec (the standard pools are seeded at onboarding/migration).

  export type RatingPool = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'chess960';

  /** The four standard (time-category) pools, seeded eagerly. chess960 is lazy. */
  export const STANDARD_POOLS = ['bullet', 'blitz', 'rapid', 'classical'] as const;
  ```

- [ ] 4. Run the test again and confirm it PASSES:
  ```
  npx vitest run src/rating/pools.test.ts
  ```

- [ ] 5. Commit:
  ```
  git add src/rating/pools.ts src/rating/pools.test.ts
  git commit -m "feat: RatingPool union + STANDARD_POOLS (pools.ts) (ADR-0036)"
  ```

---

## Task 5 — Reshape `PlayerModel` + add `GameRecord.timeControl` + `SettingsRecord.lastTimeControl` in `db.ts`

Reshape `PlayerModel` to `gameRatings` / `opponentByPool` (removing `gameRating` / `opponentTargetElo` / `recentOutcomes`), and add the additive `GameRecord.timeControl` and `SettingsRecord.lastTimeControl` fields. **No `DB_VERSION` bump** (AP-TC-2). This makes the project temporarily not type-check (consumers still read old fields) — Tasks 6–11 fix every consumer. (Spec §4.4, §4.5; scan contract.) **SHARED-MODIFY FILE** — additive to other batch-3 specs.

**Files:**
- Modify: `src/store/db.ts:18` (`GameRecord`), `src/store/db.ts:39` (`PlayerModel`), `src/store/db.ts:52` (`SettingsRecord`)

**Steps:**

- [ ] 1. In `src/store/db.ts`, update the imports at the top to pull in `RatingPool` and the engine's `GameOutcome`. Change:
  ```ts
  import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
  import type { Rating } from '../rating/glicko2';
  ```
  to:
  ```ts
  import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
  import type { Rating } from '../rating/glicko2';
  import type { RatingPool } from '../rating/pools';
  import type { GameOutcome } from '../engine/AdaptiveOpponent';
  import type { Category } from '../clock/categories';
  ```

- [ ] 2. In `src/store/db.ts`, add the `timeControl` field to `GameRecord`. Change:
  ```ts
  export interface GameRecord {
    id: string;
    pgn: string;
    result: 'win' | 'loss' | 'draw';
    botElo: number;
    playedAt: number;
    coached: boolean;
  }
  ```
  to:
  ```ts
  export interface GameRecord {
    id: string;
    pgn: string;
    result: 'win' | 'loss' | 'draw';
    botElo: number;
    playedAt: number;
    coached: boolean;
    /** Time control this game was played under (absent on legacy records = untimed classical). */
    timeControl?: { initialSec: number; incrementSec: number; category: Category; untimed?: boolean };
  }
  ```

- [ ] 3. In `src/store/db.ts`, reshape `PlayerModel`. Change:
  ```ts
  export interface PlayerModel {
    id: 'singleton';
    puzzleRating: Rating;
    gameRating: Rating;
    opponentTargetElo: number;
    recentOutcomes: ('win' | 'loss' | 'draw')[];
    /** Nascent weakness counters keyed by theme — Phase 2 fleshes this out. */
    weaknessCounters: Record<string, number>;
    onboarded: boolean;
    createdAt: number;
    updatedAt: number;
  }
  ```
  to:
  ```ts
  export interface PlayerModel {
    id: 'singleton';
    puzzleRating: Rating;
    /** Per-time-control game ratings (spec §4.4). chess960 seeded lazily. */
    gameRatings: Partial<Record<RatingPool, Rating>>;
    /** Per-pool adaptive-opponent state (target Elo + rolling outcomes). */
    opponentByPool: Partial<Record<RatingPool, { targetElo: number; recent: GameOutcome[] }>>;
    /** Nascent weakness counters keyed by theme — Phase 2 fleshes this out. */
    weaknessCounters: Record<string, number>;
    onboarded: boolean;
    createdAt: number;
    updatedAt: number;
  }
  ```

- [ ] 4. In `src/store/db.ts`, add `lastTimeControl` to `SettingsRecord`. Change:
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
  }
  ```
  to:
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
    /** Last time control chosen on the Play screen, restored as the default on mount (spec §4.5). */
    lastTimeControl?: { initialSec: number; incrementSec: number };
  }
  ```

- [ ] 5. Confirm the schema/upgrade ladder is UNCHANGED (`DB_VERSION` still `4`, no new store) by checking the file — do NOT edit `createDB` / `DB_VERSION`. Run the type-checker and expect it to FAIL with errors in the consumers that still read the old fields (`playerModel.ts`, `Play.svelte`, `Onboarding.svelte`, `Comeback.svelte`, `Sparring.svelte`, `Dashboard.svelte`, `Home.svelte`, `Insights.svelte`, `db.test.ts`) — this is expected and fixed in Tasks 6–11:
  ```
  npm run check
  ```

- [ ] 6. Commit (compiles-after-Task-11; commit the schema reshape as its own atomic step so the migration tasks build on it):
  ```
  git add src/store/db.ts
  git commit -m "feat: reshape PlayerModel to per-pool ratings + GameRecord.timeControl + lastTimeControl (no DB bump) (ADR-0036)"
  ```

---

## Task 6 — `migratePlayerModel` + `poolRating`/`poolOpponent` + `freshPlayerModel` reshape in `playerModel.ts`

Add the load-path migration that seeds the 4 standard pools from a legacy `gameRating` (RD widened to ≥ 150), the pool-accessor helpers with nearest-seeded fallback, and reshape `freshPlayerModel`. Wire `migratePlayerModel` into `loadPlayerModel`. No `DB_VERSION` bump. (Spec §4.4; scan contract; AP-TC-7.)

**Files:**
- Modify: `src/store/playerModel.ts:6` (`freshPlayerModel`), `src/store/playerModel.ts:24` (`loadPlayerModel`)
- Create (test): `src/rating/poolModel.test.ts`

**Steps:**

- [ ] 1. Write the failing test file `src/rating/poolModel.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { migratePlayerModel, poolRating, poolOpponent, freshPlayerModel } from '../store/playerModel';
  import { defaultRating } from './glicko2';
  import { STANDARD_POOLS } from './pools';
  import type { PlayerModel } from '../store/db';

  // A legacy v4 record carrying the OLD single-rating shape.
  function legacyRecord(): Record<string, unknown> {
    return {
      id: 'singleton',
      puzzleRating: defaultRating(1600, 80, 0.06),
      gameRating: defaultRating(1450, 90, 0.06),
      opponentTargetElo: 1480,
      recentOutcomes: ['win', 'loss', 'win'],
      weaknessCounters: { fork: 2 },
      onboarded: true,
      createdAt: 10,
      updatedAt: 20,
    };
  }

  describe('migratePlayerModel', () => {
    it('seeds all 4 standard pools from a legacy gameRating with RD widened to >= 150', () => {
      const m = migratePlayerModel(legacyRecord());
      for (const pool of STANDARD_POOLS) {
        expect(m.gameRatings[pool]).toBeDefined();
        expect(m.gameRatings[pool]!.rating).toBe(1450);
        expect(m.gameRatings[pool]!.rd).toBeGreaterThanOrEqual(150);
      }
    });

    it('seeds opponentByPool for the 4 standard pools from the legacy fields', () => {
      const m = migratePlayerModel(legacyRecord());
      for (const pool of STANDARD_POOLS) {
        expect(m.opponentByPool[pool]).toEqual({ targetElo: 1480, recent: ['win', 'loss', 'win'] });
      }
    });

    it('does NOT seed chess960 (lazy)', () => {
      const m = migratePlayerModel(legacyRecord());
      expect(m.gameRatings.chess960).toBeUndefined();
      expect(m.opponentByPool.chess960).toBeUndefined();
    });

    it('drops the legacy gameRating / opponentTargetElo / recentOutcomes fields', () => {
      const m = migratePlayerModel(legacyRecord()) as unknown as Record<string, unknown>;
      expect(m.gameRating).toBeUndefined();
      expect(m.opponentTargetElo).toBeUndefined();
      expect(m.recentOutcomes).toBeUndefined();
    });

    it('preserves puzzleRating, weaknessCounters, onboarded, timestamps', () => {
      const m = migratePlayerModel(legacyRecord());
      expect(m.puzzleRating.rating).toBe(1600);
      expect(m.weaknessCounters).toEqual({ fork: 2 });
      expect(m.onboarded).toBe(true);
      expect(m.createdAt).toBe(10);
    });

    it('falls back to round(gameRating) for opponent targetElo when opponentTargetElo is absent', () => {
      const raw = legacyRecord();
      delete raw.opponentTargetElo;
      delete raw.recentOutcomes;
      const m = migratePlayerModel(raw);
      expect(m.opponentByPool.classical).toEqual({ targetElo: 1450, recent: [] });
    });

    it('leaves an already-migrated record untouched', () => {
      const fresh = freshPlayerModel(100);
      fresh.gameRatings.bullet = defaultRating(1700, 120, 0.06);
      const m = migratePlayerModel(fresh as unknown as Record<string, unknown>);
      expect(m.gameRatings.bullet!.rating).toBe(1700);
      expect(m.gameRatings.classical).toBeDefined();
    });
  });

  describe('poolRating / poolOpponent fallback', () => {
    it('returns the pool rating directly when seeded', () => {
      const m = freshPlayerModel(0);
      m.gameRatings.rapid = defaultRating(1333, 100, 0.06);
      expect(poolRating(m, 'rapid').rating).toBe(1333);
    });

    it('falls back to the nearest seeded standard pool for an empty pool (chess960)', () => {
      const m = freshPlayerModel(0) as PlayerModel;
      // freshPlayerModel seeds the 4 standard pools at defaultRating(); chess960 is empty.
      expect(poolRating(m, 'chess960').rating).toBe(defaultRating().rating);
    });

    it('falls back to defaultRating() when no pool at all is seeded', () => {
      const m = freshPlayerModel(0);
      m.gameRatings = {};
      expect(poolRating(m, 'blitz')).toEqual(defaultRating());
    });

    it('poolOpponent falls back to { targetElo: 1500, recent: [] } when nothing is seeded', () => {
      const m = freshPlayerModel(0);
      m.opponentByPool = {};
      expect(poolOpponent(m, 'bullet')).toEqual({ targetElo: 1500, recent: [] });
    });

    it('poolOpponent returns the seeded pool when present', () => {
      const m = freshPlayerModel(0);
      m.opponentByPool.blitz = { targetElo: 1620, recent: ['win'] };
      expect(poolOpponent(m, 'blitz')).toEqual({ targetElo: 1620, recent: ['win'] });
    });
  });

  describe('freshPlayerModel', () => {
    it('seeds the 4 standard pools at defaultRating() and opponentByPool at targetElo 1500', () => {
      const m = freshPlayerModel(42);
      for (const pool of STANDARD_POOLS) {
        expect(m.gameRatings[pool]).toEqual(defaultRating());
        expect(m.opponentByPool[pool]).toEqual({ targetElo: 1500, recent: [] });
      }
      expect(m.gameRatings.chess960).toBeUndefined();
    });
  });
  ```

- [ ] 2. Run it and confirm it FAILS (expected: `migratePlayerModel`/`poolRating`/`poolOpponent` are not exported from `playerModel.ts`):
  ```
  npx vitest run src/rating/poolModel.test.ts
  ```

- [ ] 3. Rewrite `src/store/playerModel.ts` to add the migration + helpers and reshape `freshPlayerModel` + wire `loadPlayerModel`. Replace the whole file with:
  ```ts
  // Read/write helpers for the singleton player model + settings.

  import { openTrainerDB, type PlayerModel, type SettingsRecord } from './db';
  import { defaultRating, type Rating } from '../rating/glicko2';
  import { STANDARD_POOLS, type RatingPool } from '../rating/pools';
  import type { GameOutcome } from '../engine/AdaptiveOpponent';

  export function freshPlayerModel(now: number): PlayerModel {
    const gameRatings: PlayerModel['gameRatings'] = {};
    const opponentByPool: PlayerModel['opponentByPool'] = {};
    for (const pool of STANDARD_POOLS) {
      gameRatings[pool] = defaultRating();
      opponentByPool[pool] = { targetElo: 1500, recent: [] };
    }
    return {
      id: 'singleton',
      puzzleRating: defaultRating(),
      gameRatings,
      opponentByPool,
      weaknessCounters: {},
      onboarded: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Load-path migration (spec §4.4, AP-TC-7): if a record carries the legacy single
   * `gameRating` and lacks `gameRatings`, seed the 4 standard pools from it (RD widened
   * to >= 150, since per-pool evidence is thinner than the old single rating) and seed
   * `opponentByPool` from the legacy `opponentTargetElo`/`recentOutcomes`. chess960 stays
   * absent (seeded lazily by the chess960 spec). Legacy fields are dropped. An already
   * migrated record is returned essentially unchanged. NO DB_VERSION bump.
   */
  export function migratePlayerModel(raw: Record<string, unknown>): PlayerModel {
    const r = raw as Partial<PlayerModel> & {
      gameRating?: Rating;
      opponentTargetElo?: number;
      recentOutcomes?: GameOutcome[];
    };
    if (r.gameRatings && r.opponentByPool) {
      // Already in the new shape — return as a PlayerModel (defensive copy of nested maps).
      return { ...(raw as PlayerModel) };
    }

    const legacy = r.gameRating ?? defaultRating();
    const widenedRd = Math.max(legacy.rd, 150);
    const seeded: Rating = { rating: legacy.rating, rd: widenedRd, vol: legacy.vol };
    const targetElo = r.opponentTargetElo ?? Math.round(legacy.rating);
    const recent = r.recentOutcomes ?? [];

    const gameRatings: PlayerModel['gameRatings'] = {};
    const opponentByPool: PlayerModel['opponentByPool'] = {};
    for (const pool of STANDARD_POOLS) {
      gameRatings[pool] = { ...seeded };
      opponentByPool[pool] = { targetElo, recent: [...recent] };
    }

    return {
      id: 'singleton',
      puzzleRating: r.puzzleRating ?? defaultRating(),
      gameRatings,
      opponentByPool,
      weaknessCounters: r.weaknessCounters ?? {},
      onboarded: r.onboarded ?? false,
      createdAt: r.createdAt ?? Date.now(),
      updatedAt: r.updatedAt ?? Date.now(),
    };
  }

  /** The game rating for a pool, falling back to the nearest seeded standard pool, then defaultRating(). */
  export function poolRating(m: PlayerModel, pool: RatingPool): Rating {
    const direct = m.gameRatings[pool];
    if (direct) return direct;
    for (const p of STANDARD_POOLS) {
      const r = m.gameRatings[p];
      if (r) return r;
    }
    return defaultRating();
  }

  /** The adaptive-opponent state for a pool, falling back to nearest seeded pool, then a 1500 seed. */
  export function poolOpponent(m: PlayerModel, pool: RatingPool): { targetElo: number; recent: GameOutcome[] } {
    const direct = m.opponentByPool[pool];
    if (direct) return direct;
    for (const p of STANDARD_POOLS) {
      const o = m.opponentByPool[p];
      if (o) return o;
    }
    return { targetElo: 1500, recent: [] };
  }

  export function freshSettings(): SettingsRecord {
    return { id: 'singleton', coachedMode: false, allowNetwork: false, boardOrientation: 'white', opponentStyle: 'human' };
  }

  export async function loadPlayerModel(now: number): Promise<PlayerModel> {
    const db = await openTrainerDB();
    const existing = await db.get('playerModel', 'singleton');
    if (existing) return migratePlayerModel(existing as unknown as Record<string, unknown>);
    const fresh = freshPlayerModel(now);
    await db.put('playerModel', fresh);
    return fresh;
  }

  export async function savePlayerModel(model: PlayerModel, now: number): Promise<void> {
    const db = await openTrainerDB();
    await db.put('playerModel', { ...model, updatedAt: now });
  }

  export async function loadSettings(): Promise<SettingsRecord> {
    const db = await openTrainerDB();
    const existing = await db.get('settings', 'singleton');
    if (existing) return existing;
    const fresh = freshSettings();
    await db.put('settings', fresh);
    return fresh;
  }

  export async function saveSettings(s: SettingsRecord): Promise<void> {
    const db = await openTrainerDB();
    await db.put('settings', s);
  }

  /** Privacy / data-control: wipe everything local (spec §4.10 Settings).
   * Iterates every object store (so stores added in later phases are covered
   * automatically) and also clears the separate Syzygy tablebase cache DB. */
  export async function clearAllData(): Promise<void> {
    const db = await openTrainerDB();
    await Promise.all([...db.objectStoreNames].map((name) => db.clear(name)));
    // The tablebase cache lives in its own IndexedDB (endgame/tablebaseCache.ts).
    const { tbCacheClear } = await import('../endgame/tablebaseCache');
    await tbCacheClear();
  }
  ```

- [ ] 4. Run the migration test and confirm it PASSES:
  ```
  npx vitest run src/rating/poolModel.test.ts
  ```

- [ ] 5. Commit:
  ```
  git add src/store/playerModel.ts src/rating/poolModel.test.ts
  git commit -m "feat: PlayerModel load-path migration + poolRating/poolOpponent helpers (ADR-0036)"
  ```

---

## Task 7 — Update `db.test.ts` for the reshaped `PlayerModel` + a migration round-trip test

Fix the existing assertion that read `m.gameRating` and add a test proving a legacy record on disk is migrated on load. (Spec §4.4; §6.1, §6.3.) **SHARED-MODIFY-ADJACENT** — `db.test.ts` is also asserted-against by sibling specs; keep edits additive.

**Files:**
- Modify: `src/store/db.test.ts:49` (the "fresh player model" test)

**Steps:**

- [ ] 1. In `src/store/db.test.ts`, replace the `creates a fresh player model with both ratings separate` test (lines ~49–54). Change:
  ```ts
  it('creates a fresh player model with both ratings separate', async () => {
    const m = await loadPlayerModel(1000);
    expect(m.puzzleRating).toBeDefined();
    expect(m.gameRating).toBeDefined();
    expect(m.onboarded).toBe(false);
  });
  ```
  to:
  ```ts
  it('creates a fresh player model with the puzzle rating + the 4 standard game-rating pools', async () => {
    const m = await loadPlayerModel(1000);
    expect(m.puzzleRating).toBeDefined();
    expect(m.gameRatings.classical).toBeDefined();
    expect(m.gameRatings.bullet).toBeDefined();
    expect(m.gameRatings.blitz).toBeDefined();
    expect(m.gameRatings.rapid).toBeDefined();
    expect(m.gameRatings.chess960).toBeUndefined();
    expect(m.onboarded).toBe(false);
  });
  ```

- [ ] 2. In `src/store/db.test.ts`, also fix the `persists player model updates` test which reads `m.puzzleRating.rating` (that line is fine) — confirm it does NOT reference `gameRating`. No change needed there (it only touches `puzzleRating`). Then append a new migration round-trip test at the END of the `describe('IndexedDB store', …)` block (just before its closing `});`):
  ```ts
  it('migrates a legacy single-gameRating record to per-pool ratings on load (no version bump)', async () => {
    const db = await openTrainerDB();
    // Write a legacy-shaped record directly (bypassing the typed helper).
    await db.put('playerModel', {
      id: 'singleton',
      puzzleRating: { rating: 1600, rd: 80, vol: 0.06 },
      gameRating: { rating: 1450, rd: 90, vol: 0.06 },
      opponentTargetElo: 1480,
      recentOutcomes: ['win', 'loss'],
      weaknessCounters: {},
      onboarded: true,
      createdAt: 1,
      updatedAt: 2,
    } as unknown as Parameters<typeof db.put>[1]);

    const m = await loadPlayerModel(3000);
    expect(m.gameRatings.classical?.rating).toBe(1450);
    expect(m.gameRatings.bullet?.rating).toBe(1450);
    expect(m.gameRatings.classical?.rd).toBeGreaterThanOrEqual(150);
    expect(m.opponentByPool.rapid).toEqual({ targetElo: 1480, recent: ['win', 'loss'] });
    expect((m as unknown as { gameRating?: unknown }).gameRating).toBeUndefined();
    expect(db.version).toBe(4); // NO bump
  });
  ```

- [ ] 3. Run the store test file and confirm it PASSES:
  ```
  npx vitest run src/store/db.test.ts
  ```

- [ ] 4. Commit:
  ```
  git add src/store/db.test.ts
  git commit -m "test: db.test asserts per-pool ratings + legacy migration round-trip (ADR-0036)"
  ```

---

## Task 8 — Update untimed-drill consumers: `Comeback.svelte`, `Sparring.svelte`, `Insights.svelte`, `Dashboard.svelte`, `Home.svelte`

These read the old single `gameRating`/`opponentTargetElo`. Repoint them at the **classical** pool via `poolRating`/`poolOpponent` (Comeback/Sparring drills are untimed → classical; Dashboard/Home/Insights show the classical headline number, Q-F). No behavior change for the user. (Spec §4.4 consumers; Q-F.)

**Files:**
- Modify: `src/ui/Comeback.svelte:52`
- Modify: `src/ui/Sparring.svelte:43`
- Modify: `src/ui/Insights.svelte:30`
- Modify: `src/ui/Dashboard.svelte:27`
- Modify: `src/ui/Home.svelte:15` (and `:16`)

**Steps:**

- [ ] 1. In `src/ui/Comeback.svelte`, add the helper import after the `AdaptiveOpponent` import (line 10). Change:
  ```ts
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  ```
  to:
  ```ts
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { poolOpponent } from '../store/playerModel';
  ```
  Then change the opponent-seed line (52):
  ```ts
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(model.opponentTargetElo));
  ```
  to:
  ```ts
    // Comeback drills are untimed → classical pool (spec §4.4 / Q-F).
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(poolOpponent(model, 'classical').targetElo));
  ```

- [ ] 2. In `src/ui/Sparring.svelte`, add the helper import after the `AdaptiveOpponent` import (line 8). Change:
  ```ts
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  ```
  to:
  ```ts
  import { AdaptiveOpponent, initOpponentState } from '../engine/AdaptiveOpponent';
  import { poolOpponent } from '../store/playerModel';
  ```
  Then change the opponent-seed line (43):
  ```ts
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(model.opponentTargetElo));
  ```
  to:
  ```ts
    // Sparring scenarios are untimed → classical pool (spec §4.4 / Q-F).
    opponent = new AdaptiveOpponent(app.engine, initOpponentState(poolOpponent(model, 'classical').targetElo));
  ```

- [ ] 3. In `src/ui/Insights.svelte`, add the helper import. Find the script's import block and add (next to where `app` is imported — place it after the last existing import in the `<script>`):
  ```ts
  import { poolRating } from '../store/playerModel';
  ```
  Then change line 30:
  ```ts
        weakest = buildWeaknessProfile(analyses, model?.gameRating.rating ?? 1200).weakest;
  ```
  to:
  ```ts
        weakest = buildWeaknessProfile(analyses, model ? poolRating(model, 'classical').rating : 1200).weakest;
  ```

- [ ] 4. In `src/ui/Dashboard.svelte`, add the helper import (after the existing imports in the `<script>`):
  ```ts
  import { poolRating } from '../store/playerModel';
  ```
  Then change line 27:
  ```ts
    const rating = model ? model.gameRating.rating : 1200;
  ```
  to:
  ```ts
    const rating = model ? poolRating(model, 'classical').rating : 1200;
  ```

- [ ] 5. In `src/ui/Home.svelte`, add the helper import. Change the `<script>` block:
  ```ts
    import { app } from '../state/app.svelte';

    const model = $derived(app.model);
  ```
  to:
  ```ts
    import { app } from '../state/app.svelte';
    import { poolRating } from '../store/playerModel';

    const model = $derived(app.model);
    const classical = $derived(model ? poolRating(model, 'classical') : null);
  ```
  Then change the rating-card markup (lines 14–16):
  ```svelte
          <span class="val">{Math.round(model.gameRating.rating)}</span>
          <span class="rd">±{Math.round(model.gameRating.rd)}</span>
  ```
  to:
  ```svelte
          <span class="val">{classical ? Math.round(classical.rating) : '—'}</span>
          <span class="rd">±{classical ? Math.round(classical.rd) : '—'}</span>
  ```

- [ ] 6. Run the type-checker. Expected: remaining errors ONLY in `src/ui/Play.svelte` and `src/ui/Onboarding.svelte` (fixed in Tasks 9–10); the five files above should no longer error:
  ```
  npm run check
  ```

- [ ] 7. Commit:
  ```
  git add src/ui/Comeback.svelte src/ui/Sparring.svelte src/ui/Insights.svelte src/ui/Dashboard.svelte src/ui/Home.svelte
  git commit -m "refactor: repoint drill + dashboard consumers at classical pool via poolRating/poolOpponent (ADR-0036)"
  ```

---

## Task 9 — Seed all 4 standard pools in onboarding `commit()` (`Onboarding.svelte`)

The calibration seed must populate every standard pool from the single measured game rating (per the contract). Update `commit()` to write `gameRatings[pool]` + `opponentByPool[pool]` for all 4 standard pools. (Spec §4.4 consumers; §2.6.)

**Files:**
- Modify: `src/ui/Onboarding.svelte:199` (`commit`)

**Steps:**

- [ ] 1. In `src/ui/Onboarding.svelte`, add the pools import after the `AdaptiveOpponent` import (line 13). Change:
  ```ts
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  ```
  to:
  ```ts
  import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
  import { STANDARD_POOLS } from '../rating/pools';
  ```

- [ ] 2. In `src/ui/Onboarding.svelte`, rewrite `commit()` (lines 199–207) to seed all standard pools. Change:
  ```ts
  async function commit(puzzleR: { rating: number; rd: number; vol: number }, gameR: { rating: number; rd: number; vol: number }) {
    if (!app.model) return;
    app.model.puzzleRating = puzzleR;
    app.model.gameRating = gameR;
    app.model.opponentTargetElo = Math.round(gameR.rating);
    app.model.onboarded = true;
    await app.persistModel(Date.now());
    step = 'done';
  }
  ```
  to:
  ```ts
  async function commit(puzzleR: { rating: number; rd: number; vol: number }, gameR: { rating: number; rd: number; vol: number }) {
    if (!app.model) return;
    app.model.puzzleRating = puzzleR;
    // Calibration seeds ALL 4 standard pools from the single measured game rating
    // (spec §4.4 contract). chess960 stays lazy. Each pool starts the bot at gameR.
    const targetElo = Math.round(gameR.rating);
    for (const pool of STANDARD_POOLS) {
      app.model.gameRatings[pool] = { ...gameR };
      app.model.opponentByPool[pool] = { targetElo, recent: [] };
    }
    app.model.onboarded = true;
    await app.persistModel(Date.now());
    step = 'done';
  }
  ```

- [ ] 3. Run the type-checker. Expected: remaining errors ONLY in `src/ui/Play.svelte` (fixed in Task 10):
  ```
  npm run check
  ```

- [ ] 4. Commit:
  ```
  git add src/ui/Onboarding.svelte
  git commit -m "feat: onboarding commit seeds all 4 standard rating pools (ADR-0036)"
  ```

---

## Task 10 — Wire `Play.svelte`: TC selector, clock loop, per-pool rating, clock-aware bot budget, FIDE flag rule

The core wiring. Adds the time-control selector beside the opponent-style dropdown, both-side clock display, a tick loop that runs during BOTH `playing` and `thinking` (so the bot's clock decrements — AP-TC-4), `press()` on every move, a clock-aware bot movetime budget, flag → game-over with the FIDE-draw check, per-pool rating + per-pool adaptive nudge on finish, and `lastTimeControl` persistence. "No clock" preserves today's behavior verbatim. (Spec §4.3, §4.6, §6.4; AP-TC-3/4/5/6/8.)

**Files:**
- Modify: `src/ui/Play.svelte` (script block + markup)

**Steps:**

- [ ] 1. In `src/ui/Play.svelte`, replace the import + state block at the top of `<script>` (lines 1–39). Change:
  ```ts
    import { app } from '../state/app.svelte';
    import Board from './Board.svelte';
    import { ChessGame } from '../game/ChessGame';
    import { AdaptiveOpponent, initOpponentState, type GameOutcome } from '../engine/AdaptiveOpponent';
    import { updateRating } from '../rating/glicko2';
    import { openTrainerDB, type GameRecord } from '../store/db';
    import { loadAllAnalyses, runAnalysis } from '../analysis/runAnalysis';
    import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
    import { selectOpening, nextBookMove, steeringNote, type OpeningEntry } from '../opening/openingBook';
    import AnalysisResult from './AnalysisResult.svelte';
    import type { GameAnalysis } from '../analysis/types';

    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let game = $state(new ChessGame());
    let fen = $state(START_FEN);
    let lastMove = $state<[string, string] | null>(null);
    let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
    let result = $state('');
    let thinking = $state(false);
    let steerNote = $state('');
    let opponent: AdaptiveOpponent | null = null;
    const playerColor: 'white' | 'black' = 'white';

    // One-click post-game analysis (ADR-0022): no PGN paste needed.
    let lastGame = $state<{ id: string; pgn: string } | null>(null);
    let aStatus = $state<'idle' | 'analyzing' | 'done'>('idle');
    let aResult = $state<GameAnalysis | null>(null);
    let aPuzzles = $state(0);
    let aProgress = $state(0);
    let aTotal = $state(0);

    // Loop closure: the bot (Black here) opens toward the player's weakest area.
    let opening: OpeningEntry | null = null;
    let playedUci: string[] = [];

    const model = $derived(app.model);
    const coached = $derived(app.settings?.coachedMode ?? false);
    const opponentStyle = $derived(app.settings?.opponentStyle ?? 'human');
  ```
  to:
  ```ts
    import { app } from '../state/app.svelte';
    import Board from './Board.svelte';
    import { ChessGame } from '../game/ChessGame';
    import { AdaptiveOpponent, initOpponentState, recordGame, type GameOutcome } from '../engine/AdaptiveOpponent';
    import { updateRating } from '../rating/glicko2';
    import { openTrainerDB, type GameRecord } from '../store/db';
    import { poolRating, poolOpponent } from '../store/playerModel';
    import type { RatingPool } from '../rating/pools';
    import {
      initClock, startClock, stopClock, tick, press, flagged,
      type ClockState, type Side,
    } from '../clock/Clock';
    import {
      categoryFor, fmtClock, insufficientMatingMaterial, TIME_CONTROL_PRESETS,
      type Category, type TimeControlPreset,
    } from '../clock/categories';
    import { loadAllAnalyses, runAnalysis } from '../analysis/runAnalysis';
    import { buildWeaknessProfile, type Dimension } from '../analysis/weakness';
    import { selectOpening, nextBookMove, steeringNote, type OpeningEntry } from '../opening/openingBook';
    import AnalysisResult from './AnalysisResult.svelte';
    import type { GameAnalysis } from '../analysis/types';

    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let game = $state(new ChessGame());
    let fen = $state(START_FEN);
    let lastMove = $state<[string, string] | null>(null);
    let status = $state<'idle' | 'playing' | 'thinking' | 'over'>('idle');
    let result = $state('');
    let thinking = $state(false);
    let steerNote = $state('');
    let opponent: AdaptiveOpponent | null = null;
    const playerColor: 'white' | 'black' = 'white';

    // Clock-aware bot move budget bounds per category (ms) — [floor, ceil] (spec §4.3, Q-D).
    const BUDGET_BOUNDS: Record<Category, [number, number]> = {
      bullet: [40, 250], blitz: [80, 500], rapid: [150, 1200], classical: [200, 2000],
    };

    // Time-control state. `clock` is null for the untimed ("No clock") path = today's behavior.
    let selectedTC = $state<TimeControlPreset>(TIME_CONTROL_PRESETS.find((p) => p.id === 'rapid-10-0')!);
    let clock = $state<ClockState | null>(null);
    let customInitialSec = $state(300);
    let customIncrementSec = $state(0);
    let rafId: number | null = null;
    let lastTs = 0;

    // The bot plays Black here; the player is White.
    const botSide: Side = playerColor === 'white' ? 'b' : 'w';
    const playerSideClock: Side = playerColor === 'white' ? 'w' : 'b';

    function initialSecOf(p: TimeControlPreset): number {
      return p.id === 'custom' ? customInitialSec : p.initialSec;
    }
    function incrementSecOf(p: TimeControlPreset): number {
      return p.id === 'custom' ? customIncrementSec : p.incrementSec;
    }

    const selectedPool = $derived<RatingPool>(
      selectedTC.untimed ? 'classical' : categoryFor(initialSecOf(selectedTC), incrementSecOf(selectedTC)),
    );

    // One-click post-game analysis (ADR-0022): no PGN paste needed.
    let lastGame = $state<{ id: string; pgn: string } | null>(null);
    let aStatus = $state<'idle' | 'analyzing' | 'done'>('idle');
    let aResult = $state<GameAnalysis | null>(null);
    let aPuzzles = $state(0);
    let aProgress = $state(0);
    let aTotal = $state(0);

    // Loop closure: the bot (Black here) opens toward the player's weakest area.
    let opening: OpeningEntry | null = null;
    let playedUci: string[] = [];

    const model = $derived(app.model);
    const coached = $derived(app.settings?.coachedMode ?? false);
    const opponentStyle = $derived(app.settings?.opponentStyle ?? 'human');
    const live = $derived(status === 'playing' || status === 'thinking');

    // Restore the last-used time control on mount (spec §4.5).
    $effect(() => {
      const last = app.settings?.lastTimeControl;
      if (!last) return;
      const match = TIME_CONTROL_PRESETS.find(
        (p) => !p.untimed && p.id !== 'custom' && p.initialSec === last.initialSec && p.incrementSec === last.incrementSec,
      );
      if (match) {
        selectedTC = match;
      } else {
        selectedTC = TIME_CONTROL_PRESETS.find((p) => p.id === 'custom')!;
        customInitialSec = last.initialSec;
        customIncrementSec = last.incrementSec;
      }
    });
  ```

- [ ] 2. In `src/ui/Play.svelte`, change the weakness-profile read inside `newGame` (line 64) from the old `model.gameRating.rating` to the selected pool. Change:
  ```ts
        if (analyses.length) weakest = buildWeaknessProfile(analyses, model.gameRating.rating).weakest;
  ```
  to:
  ```ts
        if (analyses.length) weakest = buildWeaknessProfile(analyses, poolRating(model, selectedPool).rating).weakest;
  ```

- [ ] 3. In `src/ui/Play.svelte`, replace the opponent-seed + clock setup at the end of `newGame` (lines 71–80). Change:
  ```ts
      const state = initOpponentState(model.opponentTargetElo);
      opponent = new AdaptiveOpponent(app.engine, state);
      status = 'thinking';
      try {
        await opponent.applyStrength();
        status = 'playing';
      } catch (e) {
        result = 'Engine failed to start: ' + String(e);
        status = 'idle';
      }
  ```
  to:
  ```ts
      // Seed the bot from the SELECTED pool's adaptive state (spec §4.4, AP-TC-3).
      const state = initOpponentState(poolOpponent(model, selectedPool).targetElo);
      opponent = new AdaptiveOpponent(app.engine, state);

      // Build the clock for timed controls; "No clock" keeps clock = null (today's path verbatim).
      if (selectedTC.untimed) {
        clock = null;
      } else {
        clock = startClock(initClock(initialSecOf(selectedTC) * 1000, incrementSecOf(selectedTC) * 1000, 'w'));
      }

      // Persist the chosen time control for next time (skip for untimed).
      if (!selectedTC.untimed && app.settings) {
        app.settings.lastTimeControl = { initialSec: initialSecOf(selectedTC), incrementSec: incrementSecOf(selectedTC) };
        await app.persistSettings();
      }

      status = 'thinking';
      try {
        await opponent.applyStrength();
        status = 'playing';
        startClockLoop();
      } catch (e) {
        result = 'Engine failed to start: ' + String(e);
        status = 'idle';
      }
  ```

- [ ] 4. In `src/ui/Play.svelte`, add the clock-loop + budget + flag helpers immediately AFTER `newGame` closes (after its closing `}` near line 81, before `function turnColor()`):
  ```ts
    // ---- Clock loop (the ONLY place time is read; Clock.ts stays Date-free, AP-TC-1) ----

    /** Start the rAF tick loop. Runs while the game is live (playing OR thinking) so the
     *  bot's clock keeps decrementing during its turn and the bot can flag (AP-TC-4). */
    function startClockLoop() {
      if (!clock || rafId !== null) return;
      lastTs = performance.now();
      const step = () => {
        if (!clock || !live) {
          rafId = null;
          return;
        }
        const now = performance.now();
        const elapsed = now - lastTs;
        lastTs = now;
        clock = tick(clock, elapsed);
        const flag = flagged(clock);
        if (flag) {
          rafId = null;
          clock = stopClock(clock);
          void onFlag(flag);
          return;
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }

    function stopClockLoop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    /** Clock-aware bot movetime (spec §4.3, Q-D): scale with the bot's remaining time,
     *  using a phase-aware moves-left estimate, clamped per category. */
    function botMovetime(remainingMs: number, ply: number, cat: Category): number {
      const movesLeft = Math.max(8, 40 - Math.floor(ply / 2));
      const raw = remainingMs / movesLeft;
      const [floor, ceil] = BUDGET_BOUNDS[cat];
      return Math.round(Math.min(ceil, Math.max(floor, raw)));
    }

    /** A side flagged: game over. FIDE Art. 6.9 — if the OTHER side cannot mate, it's a draw
     *  (Q-C); otherwise the side that flagged loses. */
    async function onFlag(flaggedSide: Side) {
      stopClockLoop();
      status = 'over';
      const winnerSide: Side = flaggedSide === 'w' ? 'b' : 'w';
      let outcome: GameOutcome;
      if (insufficientMatingMaterial(game.fen, winnerSide)) {
        outcome = 'draw';
        result = 'Flag — but insufficient mating material: draw (FIDE Art. 6.9).';
      } else {
        const playerFlagged = flaggedSide === playerSideClock;
        outcome = playerFlagged ? 'loss' : 'win';
        result = playerFlagged ? 'You flagged — out of time.' : 'Opponent flagged — you win on time! ♚';
      }
      await finishGame(outcome);
    }
  ```

- [ ] 5. In `src/ui/Play.svelte`, add a `press()` after the player's move in `onMove`. Change (lines 92–94):
  ```ts
      playedUci.push(uci);
      fen = game.fen;
      lastMove = [from, to];
  ```
  to:
  ```ts
      playedUci.push(uci);
      fen = game.fen;
      lastMove = [from, to];
      if (clock) clock = press(clock, playerSideClock);
  ```

- [ ] 6. In `src/ui/Play.svelte`, make the bot move clock-aware and press after it in `engineMove`. Change (lines 108–117):
  ```ts
        let uci = opening ? nextBookMove(opening, playedUci) : null;
        if (!uci) uci = opponentStyle === 'engine' ? await opponent.pickMove(game.fen, 500) : await opponent.pickHumanMove(game.fen);
        if (uci) {
          game.moveUci(uci);
          playedUci.push(uci);
          fen = game.fen;
          lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
        }
  ```
  to:
  ```ts
        let uci = opening ? nextBookMove(opening, playedUci) : null;
        if (!uci) {
          // Clock-aware budget from the BOT's own remaining time (AP-TC-4); untimed keeps the defaults.
          const budget = clock
            ? botMovetime(botSide === 'w' ? clock.whiteMs : clock.blackMs, game.history().length, selectedPool as Category)
            : null;
          if (opponentStyle === 'engine') {
            uci = await opponent.pickMove(game.fen, budget ?? 500);
          } else {
            uci = budget != null ? await opponent.pickHumanMove(game.fen, budget) : await opponent.pickHumanMove(game.fen);
          }
        }
        if (uci) {
          game.moveUci(uci);
          playedUci.push(uci);
          fen = game.fen;
          lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
          if (clock) clock = press(clock, botSide);
        }
  ```
  Note: `selectedPool` is a `RatingPool`; for timed games it is always one of the four `Category` values (the untimed branch sets `clock = null`, so `clock ? …` guards it), hence the `as Category` is safe here.

- [ ] 7. In `src/ui/Play.svelte`, stop the clock when the game ends naturally (checkmate/stalemate/etc.) in `checkEnd`. Change (lines 149–152):
  ```ts
    function checkEnd(): boolean {
      const t = game.terminal();
      if (!t.over) return false;
      status = 'over';
  ```
  to:
  ```ts
    function checkEnd(): boolean {
      const t = game.terminal();
      if (!t.over) return false;
      status = 'over';
      stopClockLoop();
      if (clock) clock = stopClock(clock);
  ```

- [ ] 8. In `src/ui/Play.svelte`, rewrite `finishGame` to rate into the SELECTED pool and record the `timeControl` (lines 165–192). Change:
  ```ts
    async function finishGame(outcome: GameOutcome) {
      const m = model;
      const opp = opponent;
      if (!m || !opp) return;
      const botElo = opp.state.targetElo;
      // Adjust opponent strength toward the 55% band and persist.
      const newState = await opp.finishGame(outcome).catch(() => opp.state);
      m.opponentTargetElo = newState.targetElo;
      m.recentOutcomes = newState.recent;

      // Update the player's GAME rating via one Glicko match vs the bot Elo.
      const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
      m.gameRating = updateRating(m.gameRating, [{ opponentRating: botElo, opponentRd: 60, score }]);

      const now = Date.now();
      const db = await openTrainerDB();
      const rec: GameRecord = {
        id: `g:${now}`,
        pgn: game.pgn(),
        result: outcome,
        botElo,
        playedAt: now,
        coached,
      };
      await db.put('games', rec);
      lastGame = { id: rec.id, pgn: rec.pgn };
      await app.persistModel(now);
    }
  ```
  to:
  ```ts
    async function finishGame(outcome: GameOutcome) {
      const m = model;
      const opp = opponent;
      if (!m || !opp) return;
      const pool = selectedPool;
      const botElo = opp.state.targetElo;

      // Adjust the SELECTED pool's adaptive bot toward the 55% band (AP-TC-3) and re-apply
      // strength. recordGame is pure; we mirror it into the per-pool state and persist.
      const prevOpp = poolOpponent(m, pool);
      const nextOpp = recordGame({ targetElo: prevOpp.targetElo, recent: prevOpp.recent }, outcome);
      m.opponentByPool[pool] = nextOpp;
      opp.state = nextOpp;
      await opp.applyStrength().catch(() => {});

      // Update the SELECTED pool's game rating via one Glicko match vs the bot Elo (AP-TC-3).
      const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
      m.gameRatings[pool] = updateRating(poolRating(m, pool), [{ opponentRating: botElo, opponentRd: 60, score }]);

      const now = Date.now();
      const db = await openTrainerDB();
      const rec: GameRecord = {
        id: `g:${now}`,
        pgn: game.pgn(),
        result: outcome,
        botElo,
        playedAt: now,
        coached,
        timeControl: selectedTC.untimed
          ? { initialSec: 0, incrementSec: 0, category: 'classical', untimed: true }
          : {
              initialSec: initialSecOf(selectedTC),
              incrementSec: incrementSecOf(selectedTC),
              category: categoryFor(initialSecOf(selectedTC), incrementSecOf(selectedTC)),
            },
      };
      await db.put('games', rec);
      lastGame = { id: rec.id, pgn: rec.pgn };
      await app.persistModel(now);
    }
  ```

- [ ] 9. In `src/ui/Play.svelte`, stop the clock loop on `resign` (lines 236–242). Change:
  ```ts
    function resign() {
      if (status === 'playing' || status === 'thinking') {
        status = 'over';
        result = 'You resigned.';
        void finishGame('loss');
      }
    }
  ```
  to:
  ```ts
    function resign() {
      if (status === 'playing' || status === 'thinking') {
        status = 'over';
        stopClockLoop();
        if (clock) clock = stopClock(clock);
        result = 'You resigned.';
        void finishGame('loss');
      }
    }
  ```

- [ ] 10. In `src/ui/Play.svelte`, update the markup: the rating header (Q-F), the time-control selector beside the opponent dropdown, and the two clock read-outs. Change the header + opponent selector (lines 247–260):
  ```svelte
    {#if model}
      <p class="muted">
        Your game rating {Math.round(model.gameRating.rating)} · bot ≈ {model.opponentTargetElo} Elo
        {#if coached}· <span style="color:var(--accent)">coached on</span>{/if}
      </p>
    {/if}

    <label class="muted" style="font-size:0.85rem">
      Opponent:
      <select value={opponentStyle} onchange={(e) => setOpponentStyle(e.currentTarget.value === 'engine' ? 'engine' : 'human')}>
        <option value="human">Human-like (varied moves)</option>
        <option value="engine">Engine (best moves)</option>
      </select>
    </label>
  ```
  to:
  ```svelte
    {#if model}
      <p class="muted">
        Your {selectedPool} rating {Math.round(poolRating(model, selectedPool).rating)} · bot ≈ {poolOpponent(model, selectedPool).targetElo} Elo
        {#if coached}· <span style="color:var(--accent)">coached on</span>{/if}
      </p>
    {/if}

    <div class="row center" style="gap:1rem;flex-wrap:wrap">
      <label class="muted" style="font-size:0.85rem">
        Opponent:
        <select value={opponentStyle} onchange={(e) => setOpponentStyle(e.currentTarget.value === 'engine' ? 'engine' : 'human')}>
          <option value="human">Human-like (varied moves)</option>
          <option value="engine">Engine (best moves)</option>
        </select>
      </label>

      <label class="muted" style="font-size:0.85rem">
        Time:
        <select
          value={selectedTC.id}
          disabled={live}
          onchange={(e) => { selectedTC = TIME_CONTROL_PRESETS.find((p) => p.id === e.currentTarget.value) ?? selectedTC; }}
        >
          {#each TIME_CONTROL_PRESETS as p (p.id)}
            <option value={p.id}>{p.label}</option>
          {/each}
        </select>
      </label>

      {#if selectedTC.id === 'custom'}
        <label class="muted" style="font-size:0.85rem">
          min <input type="number" min="0" style="width:3.5rem" bind:value={customInitialSec} disabled={live}
            oninput={(e) => { customInitialSec = Math.max(0, Number(e.currentTarget.value) * 60); }}
            value={customInitialSec / 60} />
        </label>
        <label class="muted" style="font-size:0.85rem">
          +sec <input type="number" min="0" style="width:3.5rem" bind:value={customIncrementSec} disabled={live} />
        </label>
      {/if}
    </div>

    {#if clock}
      <div class="clocks">
        <div class="clock {clock.side === botSide ? 'active' : ''}">{fmtClock(botSide === 'w' ? clock.whiteMs : clock.blackMs)}</div>
        <div class="clock {clock.side === playerSideClock ? 'active' : ''}">{fmtClock(playerSideClock === 'w' ? clock.whiteMs : clock.blackMs)}</div>
      </div>
    {/if}
  ```
  Note: the `custom` minutes input above uses a small inline handler; if `svelte-check` flags the dual `bind:value`+`value`, simplify to the `oninput` handler only (drop `bind:value` and the `value=` attribute on the minutes input) — keep increment as `bind:value`.

- [ ] 11. In `src/ui/Play.svelte`, add clock styling to the `<style>` block at the bottom. Change:
  ```svelte
  <style>
    button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
    .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
  </style>
  ```
  to:
  ```svelte
  <style>
    button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .bar { height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
    .bar-fill { height: 100%; background: var(--accent); transition: width 0.1s linear; }
    .clocks { display: flex; flex-direction: column; gap: 0.3rem; align-items: center; margin: 0.4rem 0; }
    .clock { font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 700; padding: 0.1rem 0.8rem; border-radius: 6px; background: var(--panel-2); color: var(--text); min-width: 5rem; text-align: center; }
    .clock.active { background: var(--accent); color: #000; }
  </style>
  ```

- [ ] 12. Run the type-checker; it should now be CLEAN (all consumers fixed):
  ```
  npm run check
  ```

- [ ] 13. Run the full test suite; all tests (existing 135 + the new clock/categories/pool tests) should be GREEN:
  ```
  npm test
  ```

- [ ] 14. Commit:
  ```
  git add src/ui/Play.svelte
  git commit -m "feat: per-time-control clocks + ratings in Play (selector, tick loop, FIDE flag, per-pool rating) (ADR-0036)"
  ```

---

## Task 11 — Verification pass (build + full check) and manual smoke

Confirm the acceptance gates (spec §6, §8) before the docs task. No code changes unless a gate fails (then fix the smallest thing and re-run).

**Files:** (none — verification only)

**Steps:**

- [ ] 1. Run the full test suite and confirm green including the new files:
  ```
  npm test
  ```

- [ ] 2. Run the type-checker and confirm clean:
  ```
  npm run check
  ```

- [ ] 3. Run the production build and confirm it succeeds:
  ```
  npm run build
  ```

- [ ] 4. Manual smoke (record the result in the commit body of Task 12 if anything is notable). Launch the dev server (`npm run dev`) and verify:
  - Pick **Blitz 3+2** → both clocks count down; the increment is added on each move; the bot plays noticeably faster than in Classical.
  - Let the bot run low / self-flag in **Bullet 1+0** → the game ends with the right result.
  - Engineer a flag vs a lone king (or trust the unit tests for `insufficientMatingMaterial`) → **draw**.
  - Win/lose a **Rapid 10+0** game → only the **rapid** pool rating + rapid bot Elo change (check via Home/Dashboard headline = classical stays put; the Play header shows the rapid number move).
  - Select **No clock** → no clock UI, the game stores `untimed`, and behaves exactly like today; the classical pool moves on finish.
  - Re-select a time control, reload → `lastTimeControl` restores the default selection.
  - Load with a pre-existing legacy `playerModel` (or rely on the `db.test.ts` migration test) → no crash; Home/Dashboard show a number; after one game the correct pool moved and the legacy fields are gone.

- [ ] 5. If all gates pass, no commit is needed here (verification only). If a fix was required, commit it with a `fix:` message referencing ADR-0036.

---

## Task 12 — Docs (FINAL): append ADR-0036 to `decisions.md` + README note

Code-before-docs: this runs only after Tasks 1–11 are green. Append the ADR (matching the `## ADR-00NN — … / **Date:** / **Status:**` house style seen at the tail of `decisions.md`) and a short README note in the "Play & calibrate" / "Train & retain" sections. (Spec §7.)

**Files:**
- Modify: `decisions.md` (append at end)
- Modify: `README.md` (Play & calibrate section ~line 35; Train & retain section ~line 77)

**Steps:**

- [ ] 1. Append ADR-0036 to the END of `decisions.md` (after the ADR-0035 block). Add:
  ```markdown

  ## ADR-0036 — Time controls: clocks + per-time-control ratings (batch 3, spec 1)
  **Date:** 2026-06-02 · **Status:** accepted

  Play now has chess **clocks** and Lichess-style time-control **categories**, and the single game
  rating / single adaptive bot are split into **per-time-control pools** (`RatingPool`).

  - **Pure `Clock` core** (`src/clock/Clock.ts`): state `{ whiteMs, blackMs, incMs, side, running }`;
    `tick(elapsedMs)` decrements only the running side (clamped ≥ 0); `press(mover)` adds the Fischer
    **increment-on-press** to the mover then flips the side; `flagged()` reports the out-of-time side.
    **No `Date.now()` / `Math.random()` / `performance.now()` inside** (AP-TC-1) — the Play loop measures
    elapsed via `performance.now()` deltas and injects them. Immutable transitions, fully unit-tested.
  - **`categoryFor(initialSec, incrementSec)`** (`src/clock/categories.ts`) bands on the estimate
    `initialSec + 40·incrementSec` (bullet < 179 ≤ blitz < 479 ≤ rapid < 1499 ≤ classical). `TIME_CONTROL_PRESETS`
    seeds Bullet 1+0/2+1, Blitz 3+2/5+0, Rapid 10+0/15+10, Classical 30+0, **No clock**, Custom (Q-A).
  - **`RatingPool` union owned here** (`src/rating/pools.ts`): `'bullet'|'blitz'|'rapid'|'classical'|'chess960'`
    (the `chess960` member is populated lazily by the chess960 spec). `PlayerModel` reshaped to
    `gameRatings: Partial<Record<RatingPool, Rating>>` + `opponentByPool: Partial<Record<RatingPool, {
    targetElo; recent }>>` with a **load-path migration and NO `DB_VERSION` bump** (field reshape only,
    per the shared contract — AP-TC-2): a legacy single `gameRating` seeds the 4 standard pools (RD widened
    to ≥ 150); onboarding now seeds all 4 standard pools too.
  - **Per-pool Glicko + per-pool adaptive bot:** a finished game rates into *exactly* the selected pool and
    nudges *that* pool's bot (`recordGame` mirrored per pool) — never the old single rating, never every
    pool (AP-TC-3). The bot's clock **runs while it thinks** and is `press()`ed when it moves, so it can flag
    (AP-TC-4); its movetime budget scales with its own remaining time, phase-aware
    (`movesLeft = max(8, 40−⌊ply/2⌋)`), clamped per category (Q-D).
  - **"No clock"** = classical pool + `GameRecord.timeControl.untimed:true`, no clock UI, today's loop verbatim
    (Q-B=a, AP-TC-8). **Flag vs insufficient mating material = draw** (FIDE Art. 6.9, Q-C=a): a conservative
    pure `insufficientMatingMaterial(fen, side)` helper (bare K / K+B / K+N / same-colour bishops only).
    `SettingsRecord.lastTimeControl` is persisted and restored on mount; per-pool Elo is kept on TC switch (Q-E).
  - **UI (Q-F):** the Play header shows the **selected pool's** rating; Dashboard/Home/Insights keep one
    headline number = the **classical** pool (multi-rating Dashboard → §11). Comeback/Sparring drills remain
    untimed = classical pool.

  Cross-link: **supersedes the single-`gameRating` model** of ADR-0005 / ADR-0026 (onboarding now seeds all
  standard pools). The chess960 spec/ADR **consumes** this `RatingPool` union (adds `variant`/`startFen`,
  populates the `chess960` pool) — no migration conflict by construction. Deferred (§11): per-pool rating
  history + multi-rating Dashboard; delay/Bronstein increments; low-time warnings; timed onboarding/drills;
  PGN `TimeControl` header on export.
  ```

- [ ] 2. In `README.md`, append a clock/time-control bullet to the **Play & calibrate** section (after the "Adaptive opponent" bullet, around line 44). Add:
  ```markdown
  - **Time controls** — pick a clock on the Play screen (Bullet 1+0/2+1, Blitz 3+2/5+0, Rapid 10+0/15+10,
    Classical 30+0, or No clock). Both sides have a Fischer-increment clock; flag and you lose on time —
    unless your opponent has no mating material, which is a draw (FIDE Art. 6.9). The bot plays to its own
    clock (snappy in bullet, deliberate in classical). Your **game rating is per time control** — a bullet
    result no longer moves your classical number. The headline rating shown elsewhere is your classical pool;
    the practice drills (Comeback/Sparring) remain untimed = classical.
  ```

- [ ] 3. Confirm the docs build doesn't break anything (markdown only; no code) by re-running the type-checker and build once more (cheap sanity, since docs touch no `src/`):
  ```
  npm run check
  ```

- [ ] 4. Commit:
  ```
  git add decisions.md README.md
  git commit -m "docs: ADR-0036 time controls + README time-control note (ADR-0036)"
  ```

---

## Coverage map (spec §2 / §4 → task)

- §2.1 / §4.1 pure `Clock` core (`tick`/`press`/`flagged`, Date-free, immutable) → **Task 1**.
- §2.2 / §4.2 `categoryFor` band + `TIME_CONTROL_PRESETS` + `fmtClock` → **Task 2**; `insufficientMatingMaterial` (Q-C) → **Task 3**.
- §2.3 / §4.4 `RatingPool` union + `STANDARD_POOLS` → **Task 4**; `PlayerModel` reshape (`gameRatings`/`opponentByPool`) → **Task 5**; load-path migration + `poolRating`/`poolOpponent` + `freshPlayerModel` → **Task 6**; `db.test.ts` updates → **Task 7**.
- §2.4 / §4.5 `GameRecord.timeControl` + `SettingsRecord.lastTimeControl` → **Task 5** (fields) + **Task 10** (written/persisted).
- §2.5 / §4.6 `Play.svelte` selector, both-side clock display, tick loop during playing+thinking (AP-TC-4), `press()` every move (AP-TC-5), clock-aware bot budget §4.3 (Q-D), flag → over with FIDE draw (AP-TC-6), per-pool rating + per-pool adaptive nudge (AP-TC-3), `lastTimeControl` persist + restore, "No clock" verbatim (AP-TC-8) → **Task 10**.
- §2.6 migration consumers: `playerModel.ts` → **Task 6**; `Onboarding.svelte` (seed all 4 pools) → **Task 9**; `Comeback`/`Sparring`/`Dashboard`/`Home`/`Insights` → **Task 8**; `db.test.ts` → **Task 7**.
- §5 tests: `Clock.test.ts` → Task 1; `categories.test.ts` → Tasks 2–3; pool/migration tests (`pools.test.ts`, `poolModel.test.ts`) → Tasks 4, 6; `botMovetime` exercised by inspection (kept as a local Play helper, not extracted — DRY/YAGNI) → covered in Task 10's full-suite run.
- §6 verification gates → **Task 11**. §7 ADR-0036 + README (docs last) → **Task 12**.
