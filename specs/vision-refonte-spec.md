# Spec: vision-refonte — board-vision drills refonte

> Source of truth: `docs/superpowers/specs/2026-06-02-vision-refonte-design.md` (approved via brainstorming).
> Pre-V0 scan: `reports/vision-refonte_*.json`. Scope = **feature**. Proposed **ADR-0042**.
> Version: V1 (V0 → 4 refiner cycles → V1).

## §0 Context

The `Square colours` drill rewards an arithmetic shortcut: colour `= (fileIndex + rankIndex)`
parity. Learners compute parity instead of recalling the board, so the drill never builds board
retention (the originating critique). Generalised as the **closed-form test**: *if a
position-independent formula yields the answer, the drill trains arithmetic, not vision.*
square-colour fails it (parity); knight-distance passes (BFS geometry); find-them-all passes but
shows a board (scanning, not blindfold).

Secondary: the three current drills are **ephemeral** — scoring lives in local `$state`
(`asked/correct/streak`), never persisted; no per-square tracking, no spaced repetition, no study-plan
feedback. `src/ui/Vision.svelte` is 207 lines.

This PR cuts square-colour as an isolated drill, adds drills that force locating/relating **real
squares**, persists per-square mastery via the existing FSRS subsystem, and feeds weak squares into
the deliberate-practice session plan.

## §0.5 Arbitrages flagged

- **Q-A (Review-gate scope).** The pre-V0 scan found `Session.svelte:67` calls `dueCount(Date.now())`
  **unscoped**, while the session Review step routes to `Review.svelte`, which reviews **puzzles only**
  (`kind==='puzzle'`, lines 38/44). Repertoire is reviewed on its own screen, not via the session
  Review step. So the gate already over-counts repertoire today (pre-existing latent bug). This spec
  defaults to **exclude-vision-only** (preserve puzzle+repertoire semantics exactly). Alternative:
  narrow to `'puzzle'` (also fixes the latent repertoire over-count, but changes repertoire gate
  behavior). See `reports/vision-refonte_arbitrages.md`.

## §1 Empirical baseline

Captured 2026-06-02 (`reports/vision-refonte_baseline.json`):

- `SrsItemKind = 'puzzle' | 'repertoire'` (`src/srs/types.ts:7`) — no exhaustive switch on `kind`
  anywhere, so extension is additive and safe.
- `srsCards` store (DB v3), indexes `due` + `kind`; `dueCards`/`dueCount` already take an optional
  `kind` filter (`src/srs/SrsStore.ts:33,42`).
- FSRS default thresholds `{ fastMs: 8000, slowMs: 25000 }` (`src/srs/fsrs.ts:25`); first-exposure
  Easy→Good cap lives in `gradeCard` (ADR-0033).
- `PlayerModel` (`src/store/db.ts:51`) has the additive optional-field precedent `conceptSeen`
  (line 62), read `?? []`, no `DB_VERSION` bump. `DB_VERSION = 4`.
- `Review.svelte` filters `kind==='puzzle'` (lines 38, 44). `Repertoire.svelte:96` reviews
  `'repertoire'` cards on its own screen.
- Test runner `vitest run`. Deps `chess.js`, `chessground`, `ts-fsrs` present — **no new external dep**.
- Decision log `decisions.md`: append-only ADR-NNNN, supersede + cross-link; highest accepted
  ADR-0041 → next **ADR-0042**.

## §2 Scope

**In:**
- Remove the square-colour drill card + flow from `Vision.svelte` (keep the `squareColor` *function*).
- New drills: coordinate↔square, blindfold (single-square), diagonal/line/reach.
- Keep knight-distance + find-them-all; wire both to persisted per-drill stats.
- Per-square mastery via FSRS kind `'vision-square'`; per-drill stats via additive
  `PlayerModel.visionStats`.
- Weak squares feed the studyPlan vision step; exclude vision cards from the session Review gate.
- Pure modules + tests; ADR-0042 + README + decisions.md.

**Deferred (§11):** dedicated dashboard/insights vision tile; full blindfold *reconstruction*
(multi-square); the pre-existing repertoire Review-gate over-count (only excluded, not fixed, unless
Q-A picks narrow-to-puzzle).

## §3 Pre-flight gates (re-verify at execution time)

1. `git grep -n "SrsItemKind = " src/srs/types.ts` still shows `'puzzle' | 'repertoire'` (no other
   author already added a kind).
2. `git grep -nE "switch\s*\(.*kind" src` returns no exhaustive switch that a new union member breaks.
3. `Vision.svelte` still has the three drills `'color' | 'knight' | 'findall'` (drill union unchanged).
4. `Session.svelte` still calls `dueCount(Date.now())` unscoped at the Review-gate line.
5. `npm test` (vitest) is green on a clean tree before any edit.
6. `DB_VERSION === 4` and `PlayerModel` has no `visionStats` field yet.

If any gate fails, STOP and reconcile with the diverging change before proceeding.

## §4 Phase A — code change (code first, ordered by dependency)

**A1 — `src/srs/types.ts`.** `export type SrsItemKind = 'puzzle' | 'repertoire' | 'vision-square';`
Comment: refId for `vision-square` is the algebraic square (`"e4"`); id = `vision-square:e4`.

**A2 — `src/vision/grading.ts` (new).**
```ts
import { Grade, type GradeThresholds, type Grade as GradeT } from '../srs/fsrs';
/** Coordinate↔square is a sub-second recall task → speed-graded, vs the puzzle default (8000/25000). ADR-0042. */
export const VISION_GRADE_THRESHOLDS: GradeThresholds = { fastMs: 1500, slowMs: 5000 };
/** Blindfold is a MEMORY task, not a speed task (F1). Grade on correctness only — a correct-but-slow
 *  recall after a 3 s flash must not be penalised as "slow". Speed is ignored. */
export function blindfoldGrade(solved: boolean): GradeT { return solved ? Grade.Good : Grade.Again; }
```

**A3 — `src/vision/geometry.ts` (new), pure.**
```ts
sameRank(a, b): boolean            // equal rank, a !== b
sameFile(a, b): boolean            // equal file, a !== b
sameDiagonal(a, b): boolean        // |Δfile| === |Δrank| && a !== b
aligned(a, b): 'rank' | 'file' | 'diagonal' | null
squaresBetween(a, b): string[]     // strictly-between squares if aligned, else []
genRelation(pick: number): { a: string; b: string;
  kind: 'same-diagonal' | 'between' | 'same-color';
  prompt: string; answer: boolean | number }   // deterministic from pick
```
`genRelation` selects `a`, `b`, and a `kind` deterministically from `pick ∈ [0,1)` (reuse
`allSquares()` + index arithmetic; no `Math.random`). `same-color` reuses `squareColor` from
`vision.ts`. `answer` is boolean for `same-diagonal`/`same-color`; for `between` it is the **count**
`squaresBetween(a,b).length` (numeric input scores cleanly; still forces seeing the line — F5). For
`between`, `genRelation` only emits aligned `(a,b)` pairs so the count is ≥ 0 and meaningful.

**A4 — `src/vision/blindfold.ts` (new), pure.**
```ts
pieceAt(fen: string, square: string): string | null   // 'P','n',… or null; parse FEN board field only
genBlindfold(fen: string, pick: number): { square: string; answer: string | null }
```
`pieceAt` parses only the board field of the FEN (rank-by-rank, expand digits); no `chess.js`
needed. Returns the **case-sensitive FEN char** (`'N'` = white knight, `'n'` = black knight) so colour
is part of the answer (F2). `genBlindfold` picks the queried square deterministically from `pick`
(any of the 64 — mixes occupied and empty squares so the *empty* answer is exercised, F9).

**A5 — `src/vision/visionStats.ts` (new), pure.**
```ts
export type VisionDrillKey = 'diagonal' | 'knight' | 'findall';
export interface VisionDrillStat { attempts: number; correct: number; emaMs: number; lastSeen: number }
export type VisionStats = Partial<Record<VisionDrillKey, VisionDrillStat>>;
export function recordDrill(stats: VisionStats, key: VisionDrillKey,
  correct: boolean, ms: number, now: number): VisionStats   // pure; emaMs = prev ? 0.3*ms+0.7*prev : ms
```
Returns a new object (no mutation). Seeds a missing key.

**A6 — `src/vision/weakSquares.ts` (new), pure.**
```ts
import type { SrsCardRecord } from '../srs/types';
weakSquares(cards: SrsCardRecord[], now: number, limit: number): string[]
//   filter kind==='vision-square'; due (due<=now) first, then ascending stability; refId -> square; slice(limit)
visionMastery(cards: SrsCardRecord[]): number
//   fraction of 64 squares whose vision-square card is in a stable Review state (state===2 && stability>=MASTERY_STABILITY_DAYS); 0..1
```
Pure over a passed card list — no DB access in core. `MASTERY_STABILITY_DAYS` (FSRS stability is in
days) is a named const in this module (default 21, tunable; F6). `weakSquares` ranks only squares
that **have** a card; squares never drilled have no card and are surfaced by the un-seeded uniform
random selection in the coordinate/blindfold drills (F3) — they correctly count as not-mastered in
`visionMastery` (64 is the fixed denominator).

**A7 — `src/store/db.ts`.** Add to `PlayerModel`:
```ts
/** Per-drill vision stats (ADR-0042). Additive; old records read `?? {}`. NO DB_VERSION bump. */
visionStats?: import('../vision/visionStats').VisionStats;
```
No migration; `createDB` untouched; `DB_VERSION` stays 4.

**A8 — `src/state/app.svelte.ts`.** Add field, mirroring `tacticsFilterThemes`:
```ts
/** Set by the session builder; consumed by Vision.svelte to seed coordinate/blindfold onto weak squares. */
visionWeakSquares = $state<string[] | null>(null);
```

**A9 — `src/ui/Board.svelte`.** Two additive props (defaults preserve current behavior):
- `coords?: boolean = true` — when `false`, do not render the gutter rank/file labels.
- `onSelect?: (square: string) => void` — wire chessground `events.select` in `config()`:
  `events: { select: (key) => onSelect?.(key as string), after: … }`. **When `onSelect` is set, also
  set `selectable: { enabled: true }` and `viewOnly: false`** — otherwise chessground does not emit
  `select` on an empty square (F8). `movable.free` stays `false` (no piece dragging).
Coordinate drill passes the empty FEN `'8/8/8/8/8/8/8/8'`, `coords={false}`, and an `onSelect` handler.

**A10 — `src/ui/Vision.svelte`.** Rework:
- Drill union → `'menu' | 'coordinate' | 'blindfold' | 'relation' | 'knight' | 'findall'`. Remove
  `color`. Menu: 5 cards; fix the false *"no board to lean on"* copy.
- **coordinate**: two sub-modes. *name→click* shows the target square name over an unlabeled empty
  clickable board; `onSelect` → `clicked === target`. *click→name* highlights a square (lastMove
  trick or a drawn shape) and the user picks file+rank. Measure prompt→answer `ms`, then
  `await reviewItem('vision-square', target, resultToGrade(ok, ms, VISION_GRADE_THRESHOLDS), Date.now())`.
- **blindfold**: FEN from `app.puzzles.next(...)` (existing fallback FENs), show the board for ~3s
  (countdown), hide, ask "what piece is on {square}?" with a picker of 12 pieces (both colours) +
  *empty*. Truth = `pieceAt(fen, square)` (case-sensitive FEN char). Grade
  `await reviewItem('vision-square', square, blindfoldGrade(ok), Date.now())` — **correctness only,
  no speed** (F1).
- **relation**: `genRelation(pick)` → prompt; boolean kinds (`same-diagonal`/`same-color`) → yes/no,
  `between` → numeric count input. On answer
  `app.model.visionStats = recordDrill(app.model.visionStats ?? {}, 'diagonal', ok, ms, now)` then
  `await app.persistModel(now)`.
- **knight / findall**: keep existing logic; additionally `recordDrill(... 'knight'/'findall' ...)`
  + persist.
- Menu header: `visionMastery(await allCards())` → "Board mastery: NN%".
- On entering coordinate/blindfold, if `app.visionWeakSquares?.length`, seed prompts from that list
  (cycle through it) instead of a uniform random square.
- `now = Date.now()` is UI-owned; never passed into a core function as `Date.now()` inline.

**A11 — `src/analysis/studyPlan.ts`.** Extend `buildStudyPlan` to accept weak squares as data
(keeps the core pure — no DB read here):
```ts
buildStudyPlan(leaks, weakest, minutes, opts?: { visionWeakSquares?: string[] })
```
At the vision warm-up (line ~30): if `opts?.visionWeakSquares?.length`, set
`focus: 'targeted recall'`, `reason: '${n} squares due — targeted recall.'`; else keep the current
generic find-all warm-up.

**A12 — `src/ui/Session.svelte`.** In the FRESH-start block:
- Fetch vision cards once: `const visionCards = await dueCards(now, 'vision-square', 200);`
  compute `const weak = weakSquares(visionCards, now, 12);` set `app.visionWeakSquares = weak.length ? weak : null;`
  and pass `{ visionWeakSquares: weak }` to `buildStudyPlan`.
- **Review-gate fix (Q-A default = exclude-vision-only):**
  `const includeReview = ((await dueCount(now, 'puzzle')) + (await dueCount(now, 'repertoire'))) > 0;`
  (preserves existing puzzle+repertoire semantics, excludes `vision-square`). If Q-A = narrow-to-puzzle,
  use `dueCount(now, 'puzzle') > 0` instead.

## §5 Phase B — tests

- `src/vision/geometry.test.ts` — `sameRank/File/Diagonal` truth on corners/edges; `aligned`
  returns `null` for knight-shaped offsets; `squaresBetween` empty for non-aligned and for adjacent;
  full a1–h8 → 6 inner squares; `genRelation` deterministic for fixed `pick` (same input → same output).
- `src/vision/blindfold.test.ts` — `pieceAt` on the start FEN (e.g. e1→'K', e8→'k', e4→null), edge
  files/ranks (a1/h8); malformed/empty square → null; `genBlindfold` deterministic.
- `src/vision/visionStats.test.ts` — first attempt sets `emaMs = ms`, `attempts=1`; second blends
  `0.3*ms+0.7*prev`; `correct` increments only on success; purity (input not mutated).
- `src/vision/weakSquares.test.ts` — ordering (due before not-due, then ascending stability);
  `limit` honored; non-`vision-square` cards ignored; `visionMastery` = 0 / partial / 1.0 on
  synthetic card sets.
- `src/srs/SrsStore.test.ts` (extend) — `ensureCard('vision-square','e4',…)` round-trips;
  `dueCards(now,'vision-square')` returns only vision cards; a due `vision-square` card does **not**
  change `dueCount(now,'puzzle')`.
- `src/analysis/studyPlan.test.ts` (extend) — with `visionWeakSquares` non-empty the vision step
  `focus==='targeted recall'`; empty → unchanged generic warm-up.
- **Regression**: `src/vision/vision.test.ts` + `tacticsVision.test.ts` unchanged and green
  (`squareColor` retained).

## §6 Phase C — verification

1. `npm test` green (new + extended + regression).
2. `npx tsc --noEmit` clean (union extension, new `PlayerModel` field, Board props typecheck).
3. Manual (dev server): square-colour card gone; coordinate drill board shows no labels and a click
   on an **empty** square fires `onSelect` (confirms `selectable.enabled`, F8); blindfold flashes
   then hides and a wrong colour (e.g. 'N' vs 'n') is marked wrong (F2); relation `between` takes a
   numeric answer; menu shows a mastery %.
4. `Session` Review step still appears iff puzzles/repertoire are due (vision-due alone must NOT
   trigger it).

## §7 Phase Z — docs (LAST)

- **`decisions.md`**: append `## ADR-0042 — Board-vision drills refonte` (date 2026-06-02, accepted).
  Record the closed-form test, the cut of square-colour, hybrid per-square FSRS (`vision-square`) +
  per-drill `visionStats`, and the Review-gate scoping. Cross-link ADR-0018 (superseded vision
  drills), ADR-0010/0011 (FSRS reuse). Never amend prior entries.
- **`README.md`**: update the feature/training catalogue (vision drills list).
- Inline `// ADR-0042` comments in the new vision modules.

## §8 Acceptance criteria

- [ ] `vitest run` green; `tsc --noEmit` clean.
- [ ] `SrsItemKind` includes `'vision-square'`; no switch broke.
- [ ] `DB_VERSION` still 4; no migration added; old `PlayerModel` records load (`visionStats ?? {}`).
- [ ] coordinate + blindfold write `vision-square` FSRS cards (verify a card exists post-drill).
- [ ] diagonal/knight/findall update `PlayerModel.visionStats` and persist.
- [ ] A due `vision-square` card does not inflate the session Review gate.
- [ ] square-colour drill card removed; `squareColor` function retained and still tested.
- [ ] ADR-0042 appended; README updated; docs committed AFTER code.

## §9 Anti-patterns

- **AP-VISION-1** — re-introducing a closed-form drill (anything answerable by a position-independent
  formula). Every drill must require locating/relating real squares.
- **AP-VISION-2** — deleting `squareColor`. It is reused by the relation drill's `same-color`
  by-product; only the isolated drill is removed.
- **AP-VISION-3** — bumping `DB_VERSION` for `visionStats`. It is an additive optional field; a bump
  would force an unnecessary migration (see `conceptSeen` precedent).
- **AP-VISION-4** — letting `vision-square` cards leak into the Review screen/gate. Review is
  puzzle-scoped; the session gate must exclude vision (§4 A12).
- **AP-VISION-5** — calling `Date.now()` / `Math.random()` inside a `src/vision/*` core function. UI
  owns time and randomness; cores take `now`/`pick`.
- **AP-VISION-6** — DB reads inside `weakSquares`/`visionMastery`. They are pure over a passed card
  list; the caller fetches.
- **AP-VISION-7** — docs before code (ADR-0042 / README claiming a shipped feature before Phase A is green).

## §10 Rollback

All edits are additive and isolated. To revert: `git revert` the feature commit(s); the new
`vision-square` cards become orphan rows in `srsCards` (harmless — never read once the kind is gone,
and `dueCount`/`dueCards` without a kind tolerate them). `visionStats` on `PlayerModel` is ignored by
reverted code. No schema rollback needed (no migration was added).

## §11 Follow-up

- Dedicated dashboard/insights vision tile (mastery shown only in the Vision menu header here).
- Full blindfold *reconstruction* (place every piece) — this spec queries one square per prompt.
- Pre-existing repertoire Review-gate over-count: this spec only excludes vision; fixing repertoire's
  gate/review wiring is a separate concern (unless Q-A picks narrow-to-puzzle, which fixes it as a
  side-effect).
