# Board-vision drills refonte — design

- **Status:** design approved via brainstorming; pending implementation plan
- **Date:** 2026-06-02
- **Related:** ADR-0018 (original vision drills), ADR-0010 / ADR-0011 (FSRS), ADR-0033
  (first-exposure grade cap), ADR-0040 / `conceptSeen` (additive PlayerModel field precedent),
  proposed **ADR-0042** (this refonte)

## 1. Motivation

The square-colour drill (`Square colours`: name a random square's colour) rewards an
**arithmetic shortcut**: colour `= (fileIndex + rankIndex) parity`. A learner computes the
parity instead of recalling the board, so the drill never builds board retention. This is the
user's critique, and it generalises into a test:

> **Closed-form test** — does a *position-independent* formula yield the answer? If yes, the
> drill trains arithmetic, not vision.

Applied to the current roster ([`src/ui/Vision.svelte`](../../../src/ui/Vision.svelte)):

| Current drill | Closed-form answer? | Verdict |
|---------------|---------------------|---------|
| Square colours | Yes — `(file+rank)` parity | **Cut** as an isolated drill |
| Knight distance | No — must trace BFS geometry | Keep (legitimate calculation) |
| Find them all | No, but **shows a board** | Keep as tactical *scanning* (not blindfold) |

Two secondary defects:

- **Drills are ephemeral.** Scoring lives in local component `$state` (`asked/correct/streak`),
  never persisted to `app.model`. There is no per-square tracking, no spaced repetition, and no
  signal back into the study plan. "Retaining the board" requires repetition over time, which the
  current design cannot deliver.
- **Menu copy is wrong.** The menu claims *"no board to lean on"*, but *Find them all* renders a
  board. Fix the copy.

## 2. Goal & scope

Deliver a vision module whose drills (a) force locating/relating **real squares** with no
shortcut, (b) **persist per-square mastery** with spaced repetition so weak squares resurface,
and (c) **feed weak squares into the deliberate-practice session plan** (efficacy loop).

Scope (user-confirmed): **content + per-square persistence + studyPlan/efficacy integration.**

## 3. Approach (decision: A)

Per-square retention reuses the existing **FSRS** subsystem rather than inventing scheduling.

- **A — reuse FSRS (chosen).** Extend `SrsItemKind` with `'vision-square'`, `refId` = the
  square (`"e4"`). Coordinate↔square and blindfold both grade the same per-square card. Per-drill
  stats (diagonal/knight/find-all) live on an additive `PlayerModel.visionStats` field.
  **No `DB_VERSION` bump.** Due-queue and session machinery integrate for free.
  - Trade-off: FSRS intervals are day-scaled. Sub-second recall is handled purely by overriding
    the grade thresholds (`VISION_GRADE_THRESHOLDS`); intervals run in min/hours/days, which is
    correct for "retention over time".
- **B — bespoke per-square store (rejected).** New `visionSquares` object store with hand-rolled
  decay + weighted sampling. Tailored to fast recall, but requires a `DB_VERSION` bump, a new
  scheduler, new tests, and reinvents FSRS.
- **C — PlayerModel + weighted sampling (rejected).** Per-square/per-drill aggregates with a
  weighted random draw favouring weak squares. Smallest, but "spaced repetition" degrades to
  "weighted sampling" — no cross-session due dates, weaker retention. Partially contradicts the goal.

## 4. Roster (final)

| Drill | Type | Persisted signal |
|-------|------|------------------|
| **Coordinate↔square** (name→click + click→name) | single-square | FSRS `vision-square` card |
| **Blindfold** (flash a position → "what piece is on e5?") | single-square | FSRS `vision-square` card |
| **Diagonal / line / reach** | relational | `visionStats.diagonal` |
| **Knight distance** *(kept)* | calculation | `visionStats.knight` |
| **Find them all** *(kept)* | scanning | `visionStats.findall` |

Removed: **square-colour as an isolated drill**. Colour returns as a *by-product* of the diagonal
drill ("are b2 and g7 the same colour?"), never as an end in itself. **The `squareColor` function
is retained** (used by the diagonal by-product); only the menu card and its dedicated flow are removed.

## 5. Data model (additive; zero DB bump)

1. **`SrsItemKind += 'vision-square'`** ([`src/srs/types.ts`](../../../src/srs/types.ts)).
   `refId` = square (`"e4"`), `id` = `vision-square:e4`. Reuses `ensureCard` / `reviewItem` /
   `isDue` / `dueCards` ([`src/srs/SrsStore.ts`](../../../src/srs/SrsStore.ts)) and
   `newCard` / `gradeCard` / `resultToGrade` ([`src/srs/fsrs.ts`](../../../src/srs/fsrs.ts))
   unchanged. **Coordinate and blindfold grade the same per-square card.**

2. **`VISION_GRADE_THRESHOLDS = { fastMs: 1500, slowMs: 5000 }`** (vs the puzzle default
   `8000 / 25000`), passed to `resultToGrade`. `solved` = correct square / correct piece. The
   existing first-exposure Easy→Good cap (ADR-0033 in `gradeCard`) applies unchanged.

3. **`PlayerModel.visionStats?`** ([`src/store/db.ts`](../../../src/store/db.ts)):
   ```ts
   visionStats?: Record<'diagonal' | 'knight' | 'findall',
     { attempts: number; correct: number; emaMs: number; lastSeen: number }>;
   ```
   Additive optional field read as `?? {}`; precedent = `conceptSeen`. **No migration, no
   `DB_VERSION` bump.**

4. **Review-gate fix.** [`src/ui/Session.svelte`](../../../src/ui/Session.svelte) calls
   `dueCount(Date.now())` with **no `kind`**, so `vision-square` cards would inflate the puzzle
   Review queue. Change the Review gate to `dueCount(now, 'puzzle')` (plus repertoire if the
   Review step covers it). A separate `dueCount(now, 'vision-square')` drives the targeted vision step.

## 6. Core pure modules (`src/vision/`)

Repo discipline preserved: pure, deterministic (no `Math.random` in core), one `*.test.ts` per
module. The UI supplies FENs and a `pick` in `[0,1)`.

```ts
// geometry.ts — square relations (colour falls out as a by-product)
sameRank(a, b) / sameFile(a, b) / sameDiagonal(a, b): boolean   // sameDiagonal = |Δfile| === |Δrank|
aligned(a, b): 'rank' | 'file' | 'diagonal' | null
squaresBetween(a, b): string[]                  // strictly-between squares if aligned, else []
genRelation(pick): { a, b, kind: 'same-diagonal' | 'between' | 'same-color', prompt, answer }

// blindfold.ts — single-square memory
pieceAt(fen, square): string | null             // 'P','n',… or null (pure FEN board parse)
genBlindfold(fen, pick): { square, answer: string | null }   // UI supplies the FEN

// visionStats.ts — per-drill reducer (pure)
recordDrill(stats, key: 'diagonal' | 'knight' | 'findall', correct, ms, now): VisionStats
//   emaMs = prev ? 0.3*ms + 0.7*prev : ms

// weakSquares.ts — selection + mastery (pure, over a card list)
weakSquares(cards, now, limit): string[]        // due first, then ascending stability
visionMastery(cards): number                    // fraction of 64 squares in a stable Review state

// grading.ts
export const VISION_GRADE_THRESHOLDS = { fastMs: 1500, slowMs: 5000 };
```

**Coordinate↔square** needs no new pure module — it reuses `squareFrom` / `isSquare` /
`allSquares` ([`src/vision/vision.ts`](../../../src/vision/vision.ts)); the check is
`click === target` (UI). **Reused unchanged:** `vision.ts` (knight, `squareFrom`, `squareColor`),
`tacticsVision.ts` (find-all).

## 7. UI

**`src/ui/Board.svelte`** — additive, backward-compatible props:

- `coords?: boolean = true` — `false` hides the gutter labels (unlabeled mode). Board renders its
  own gutter labels (chessground's are already off), so this gates that rendering.
- `onSelect?: (square: string) => void` — wires chessground `events.select` (single-square click).
- Coordinate drill uses the empty FEN `'8/8/8/8/8/8/8/8'`.

**`src/ui/Vision.svelte`** — menu reworked to 5 cards (square-colour card removed; *"no board to
lean on"* copy corrected). Flows:

- **coordinate** — *name→click*: show the square name, unlabeled clickable empty board,
  `onSelect` → `click === target`; *click→name*: highlight a square, user picks file+rank. Time
  the prompt→answer interval → `reviewItem('vision-square', square, resultToGrade(ok, ms,
  VISION_GRADE_THRESHOLDS))`.
- **blindfold** — pick a FEN (`app.puzzles.next` with the existing fallback FENs) → show the board
  for ~3 s (countdown) → hide → "what piece is on {square}?" (piece picker incl. *empty*) → grade
  the card for that square.
- **diagonal** — `genRelation(pick)` → prompt + yes/no or count → `recordDrill` then
  `app.persistModel(now)`.
- **knight / find-all** — existing flow, now **wired to `recordDrill`** (previously ephemeral).
- Menu header shows `visionMastery(cards)` → e.g. "Board mastery: 72%".

`now` is UI-owned (`Date.now()`), as elsewhere; never inside a core function.

## 8. Session / studyPlan / efficacy integration

- **Weak-square plumbing**, mirroring `tacticsFilterThemes`: add
  `app.visionWeakSquares: string[] | null` ([`src/state/app.svelte.ts`](../../../src/state/app.svelte.ts)),
  set when the session is built, consumed by `Vision.svelte` to seed coordinate/blindfold prompts
  onto those squares.
- **studyPlan** ([`src/analysis/studyPlan.ts`](../../../src/analysis/studyPlan.ts), the vision
  warm-up at line ~30): if `weakSquares(cards, now)` is non-empty, the vision step focus becomes
  `'targeted recall'` with `reason = 'N squares due'`; otherwise the current generic find-all
  warm-up stands.
- **Review gate fix** as in §5.4.
- **Efficacy surface**: `visionMastery(cards)` shown in the Vision menu header. A dedicated
  dashboard/insights tile is **out of scope** (follow-up).

## 9. Tests

- `geometry.test.ts` — corners; non-aligned → `[]`; full a1–h8 diagonal; adjacent → empty between;
  `genRelation` deterministic per `pick`.
- `blindfold.test.ts` — `pieceAt` (start position, empty square → null, edge files/ranks);
  `genBlindfold` deterministic.
- `visionStats.test.ts` — EMA (first attempt = ms), counters, accuracy.
- `weakSquares.test.ts` — ordering (due first, then ascending stability), `limit`; `visionMastery`
  over 0 / partial / all-64 synthetic card sets.
- `SrsStore.test.ts` (extended) — `vision-square` card round-trip; `dueCards(now, 'vision-square')`
  scoping; Review gate `dueCount(now, 'puzzle')` excludes vision cards.
- `studyPlan` test — weak squares → vision step `focus = 'targeted recall'`.
- **Regression**: `vision.test.ts` / `tacticsVision.test.ts` unchanged — `squareColor` the function
  stays; only the isolated drill/card is removed.

## 10. Files touched

- **New:** `src/vision/geometry.ts`, `blindfold.ts`, `visionStats.ts`, `weakSquares.ts`,
  `grading.ts` (+ matching `*.test.ts`).
- **Edit:** `src/srs/types.ts` (kind), `src/store/db.ts` (`visionStats?` type — no migration),
  `src/state/app.svelte.ts` (`visionWeakSquares`), `src/ui/Board.svelte` (`coords`/`onSelect`),
  `src/ui/Vision.svelte` (refonte + persistence wiring), `src/analysis/studyPlan.ts`,
  `src/ui/Session.svelte` (Review-gate fix + seed weak squares).
- **Docs:** ADR-0042 (vision refonte: the closed-form test + hybrid per-square FSRS), README
  feature catalogue, `decisions.md`.

## 11. Migration & risk

- **Migration:** none. `visionStats` absent → `?? {}`; `vision-square` cards created lazily on first
  drill. No `DB_VERSION` bump.
- **Risk — Review pollution:** the `dueCount` scoping fix (§5.4) is load-bearing; without it the
  puzzle Review badge and gate count vision cards. Covered by the extended `SrsStore.test.ts`.
- **Risk — FSRS day-scale vs sub-second recall:** mitigated by `VISION_GRADE_THRESHOLDS`; accepted
  that vision intervals graduate to min/hours/days like puzzles.
- **Risk — board `onSelect` semantics:** chessground `events.select` fires on tap/click of any
  square including empty ones; verified against the chessground API during implementation.

## 12. Out of scope (follow-up)

- Dedicated dashboard/insights vision tile (mastery is shown in the Vision menu header only).
- Full blindfold *reconstruction* (place every piece). This design queries a **single** square per
  blindfold prompt so it maps cleanly onto the per-square card; multi-square reconstruction is a
  later iteration.
