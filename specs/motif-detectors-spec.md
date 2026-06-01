# Spec — `motif-detectors`: geometric tactical motif detectors

**Scope:** feature · **Status:** V1 (drafted V0 → refined cycles 1–4) · **Date:** 2026-06-01
**Spec 1 of 3** (foundation). Sibling specs: `eval-graph`, `loop-closers`.

> **Decisions applied (user accepted all defaults, 2026-06-01):** Q-A precedence `mate > doubleCheck >
> fork > skewer > pin > discoveredAttack > hangingPiece`; Q-B geometric presence + valuable-target/king
> filter (NO engine re-check — keeps motif.ts pure); Q-C relative pins included when `back>front` and
> `back≥5`, plus all absolute pins. §11's stricter-gate variant is therefore **not** taken. ADR-0020 records these.

> Changelog: V0 drafted from locked brainstorm decisions. Cycle 1 validated premise (ADR-0007
> sanctions this as the "later pass"). Cycles 2–4 hardened geometry, tag-string alignment,
> precedence, edge cases. 4 cycles run by user request (`--max-cycles 4 --force-cycle-3`).

---

## §0 Context

[motif.ts](../src/analysis/motif.ts) (154 LOC) currently tags only `mate`/`mateInN`/`backRankMate`,
`hangingPiece`, and `fork`/`knightFork` at `confidence:'high'`; everything else falls back to a
`confidence:'low'` `<phase>Mistake` tag. [ADR-0007](../decisions.md) deliberately deferred
pin/skewer/discovered-attack because *"a wrong specific tag is worse than an honest generic one"* and
stated *"taxonomy extends in later passes."* This PR is that later pass: it adds **four geometric
detectors** — `pin`, `skewer`, `discoveredAttack`, `doubleCheck` — that fire **only when the
relation is geometrically certain**, otherwise leaving the existing low-confidence fallback exactly
as-is. The new tags propagate for free to natural-language explanations ([explain.ts](../src/analysis/explain.ts),
gated on `confidence:'high'` per AP-CHESS-19) and to personal-puzzle themes
([generatePuzzles.ts:73](../src/analysis/generatePuzzles.ts), which copies `p.motif.tags`).

## §1 Empirical baseline

Captured 2026-06-01 (`reports/motif-detectors_baseline.json`):

- `detectMotif` at [motif.ts:60](../src/analysis/motif.ts); `MotifResult.confidence ∈ {'high','low'}` — **no `'medium'`** (so geometric-only at `'high'` needs **no type change**).
- Existing high-confidence detectors: mate / mateInN / backRankMate / hangingPiece / fork / knightFork.
- Helpers already present: `tweakTurn`, `captureTargetsFrom`, `isDefendedBy`, `VALUE`, `isBackRankMate`.
- Tests baseline: **135 passing**, 5 of them in `motif.test.ts`. `svelte-check` clean.
- AP-CHESS catalog max = 24 → new anti-patterns start at **AP-CHESS-25**. ADR max = 19 → Phase Z appends **ADR-0020**.
- No engine calls added: `detectMotif` runs only on already-flagged mistakes/blunders.

## §2 Scope

**In:**
- Four new geometric detectors in `detectMotif`, all emitting `confidence:'high'`, describing the
  idea behind the **missed best move** (`bestUci`) on a player mistake/blunder.
- NL phrases in `MOTIF_EXPLANATION` for each new tag (+ `discoveredCheck` subtag).
- Fixtures in `motif.test.ts` (positive + negative per detector).
- Phase Z: ADR-0020 extending ADR-0007.

**Deferred (NOT this PR):**
- Surfacing a per-motif breakdown in the weakness radar → `loop-closers` / future (§11).
- Any new tactical class beyond the four (deflection, overload, decoy, trapped-piece) — explicitly
  rejected: not geometrically certain (AP-CHESS-9 doctrine).
- Re-evaluating positions with the engine to confirm a motif "wins" (see Q-B arbitrage).

## §3 Pre-flight gates (re-verify at exec time)

1. `MotifResult` type still `{tag, tags[], confidence:'high'|'low'}` — if `'medium'` was added elsewhere, re-open Q.
2. `detectMotif(ctx: MotifContext)` signature unchanged; mate branch still early-returns.
3. `npm test` green at 135 before edits; `npm run check` clean.
4. The 5 existing `motif.test.ts` cases unchanged and still pass after the change (esp. the 2 fallback cases).

## §4 Phase A — code change (`motif.ts`)

All detectors operate on `fenAfter` (after `bestUci`, opponent to move), reusing the existing
fork/hanging pattern. The moved piece's **type is read from `fenAfter` at `to`** (so a promotion is
seen as the promoted piece, not the pawn — AP-CHESS-28). Add detectors **after** the existing
fork/hanging block, accumulating into the same `tags[]`; the mate branch keeps its early return.

### §4.1 Shared geometry helper
Add `rayBetween(fromSq, toSq)` / `sliderHits(fen, sliderSq, dir)` style helpers (pure, no chess.js
move-gen) returning the ordered occupied squares along a rank/file/diagonal from a square. A ray is
**clear** between A and B iff no occupied square lies strictly between them. `attacksSquare(fen, sq, target)`
returns whether the piece on `sq` geometrically attacks `target` given its type (knight L-jump;
slider clear ray by piece type — B diagonals, R orthogonals, Q both; pawn diagonal; king adjacent).

### §4.2 `pin` (absolute + relative)
The moved piece on `to` is a slider (B/R/Q). Along one of its attack rays: first enemy piece = `front`,
next enemy piece on the **same clear ray** = `back`.
- **Absolute pin:** `back` is the enemy king → tag `pin` (+ subtag `absolutePin`).
- **Relative pin:** `VALUE[back] > VALUE[front]` **and** `VALUE[back] >= 5` → tag `pin` (+ `relativePin`).
The slider's ray type must match its piece (a rook ray for R/Q, a diagonal for B/Q). Ray
clear between slider→front and front→back (AP-CHESS-25).

### §4.3 `skewer` (enfilade)
Same ray geometry as pin but **front is the more valuable / forcible** piece:
- `front` is the enemy king (check) **or** `VALUE[front] > VALUE[back]`, with `back` an enemy piece
  of `VALUE[back] >= 3`. Tag `skewer`.
Pin vs skewer are disambiguated purely by the value ordering of `front`/`back` (king-as-`back` ⇒ pin;
king-as-`front` ⇒ skewer) (AP-CHESS-26).

### §4.4 `discoveredAttack` (+ `discoveredCheck`)
The moved piece is **not** the attacking slider; it vacated `from`. A **moverColor** slider sits
behind `from` such that, before the move, `from` was the **sole** occupied square between that slider
and an enemy target `T` on the ray; after the move the ray is clear and the slider attacks `T`, where
`T` is the enemy king (⇒ also tag `discoveredCheck`) or an enemy piece with `VALUE[T] >= 3`
(AP-CHESS-27). The revealed slider must be ours and the ray type must match it.

### §4.5 `doubleCheck`
Composed, not via a chess.js `attackers()` API (unavailable/uncertain in 1.4.0):
`doubleCheck = directCheck AND discoveredCheck`, where `directCheck = attacksSquare(fenAfter, to, enemyKingSq)`
(the moved piece itself checks) and `discoveredCheck` is the §4.4 king case. A double check is
geometrically only ever a direct + discovered check, so this composition is exact. Tag `doubleCheck`
(also keep `discoveredCheck`). Castling as `bestUci` (king move that teleports a rook) is a
documented non-detection: the discovered-source logic keys on the king's `from`; castling is almost
never the missed tactic → leave untagged (AP-CHESS-30).

### §4.6 Tags, precedence, magnitude
- Tag strings are the **exact Lichess theme keys**: `pin`, `skewer`, `discoveredAttack`, `doubleCheck`
  (+ subtags `absolutePin`/`relativePin`/`discoveredCheck`), so theme filters in Tactics keep working
  (AP-CHESS-29).
- Primary tag (`tags[0]`) precedence when several fire — see **Q-A** (default applied:
  `mate > doubleCheck > fork > skewer > pin > discoveredAttack > hangingPiece`).
- Magnitude tag (`crushing`/`advantage`) still appended; the `tags.length > 0 ⇒ confidence:'high'`
  return is unchanged.

## §5 Phase B — tests (`motif.test.ts`)
Add, each with a hand-built FEN + `bestUci` + expected tag, plus a negative twin that must NOT fire:
- `pin` absolute (slider pins piece to king) + negative (ray blocked by a third piece → no tag).
- `pin` relative (rook behind a minor) + negative (`back` cheaper than `front` → must be `skewer`, not `pin`).
- `skewer` (check a king with a queen behind) + negative.
- `discoveredAttack` (move a knight to unveil a bishop hitting the queen) + negative (`from` was not the sole blocker).
- `discoveredCheck` + `doubleCheck` (knight moves giving check while unveiling a rook check) + negative (single checker → not double).
- Regression: the 5 existing cases unchanged; the 2 fallback cases still `confidence:'low'`.

## §6 Phase C — verification
- `npm test` → ≥ 135 + new cases, all green.
- `npm run check` → 0 errors.
- Spot-check `explainPly` on a fixture for each new tag renders the phrase (not the raw fallback sentence).
- Confirm `generatePuzzlesFromAnalysis` carries a new tag into `puzzle.themes` (no code change, assert in a small test or manual trace).

## §7 Phase Z — docs (LAST)
- Append **ADR-0020 — "Motif taxonomy extension: four geometric detectors (extends ADR-0007)"** to
  [decisions.md](../decisions.md): list the four, the geometric-certainty bar, the unchanged fallback,
  and the Q-A/Q-B/Q-C decisions taken. Cross-link ADR-0007; do **not** amend ADR-0007 in place.
- README "Honesty notes" / "Features → Analysis explained": add pin/skewer/discovered/double to the
  named-motif list (keep the "conservative, says so when it can't" wording).

## §8 Acceptance criteria
1. 135 baseline tests still pass; new per-detector positive + negative tests pass.
2. `npm run check` clean; no change to `MotifResult` type.
3. Every new tag string is an exact Lichess theme key.
4. The 2 fallback tests still yield `confidence:'low'` — fallback path provably untouched.
5. `explain.ts` has a phrase for each new tag; raw-UCI/fallback sentence not shown for them.
6. ADR-0020 appended (not an amendment); README motif list updated.
7. No new engine calls (grep diff: no `analyzeLines`/`evaluate` added to `motif.ts`).

## §9 Anti-patterns
- **AP-CHESS-25** — Pin/skewer ray not verified clear (a piece between slider/front or front/back) → phantom tag.
- **AP-CHESS-26** — Pin vs skewer swapped: must key strictly on `front`/`back` value ordering (king-back ⇒ pin, king-front ⇒ skewer).
- **AP-CHESS-27** — Discovered-attack false positive: revealed slider is the opponent's, or `from` was not the sole blocker, or the line was already open.
- **AP-CHESS-28** — Reading the moved piece type from `fenBefore@from` instead of `fenAfter@to`, mis-detecting promotions.
- **AP-CHESS-29** — Tag strings drift from Lichess theme keys → Tactics theme filters silently miss the new puzzles.
- **AP-CHESS-30** — Castling/en-passant `bestUci` mis-handled; documented as non-detection, must not crash or mis-tag.
- **AP-CHESS-31** — A new detector downgrades or bypasses the `confidence:'low'` fallback for positions it can't classify (fallback must remain the default).

## §10 Rollback
Pure additive function logic in three files; no schema/IndexedDB/migration touched, no data. Revert
the `motif.ts`, `explain.ts`, `motif.test.ts` diffs and the ADR-0020 append. Nothing downstream
persists motif tags irreversibly (puzzle themes regenerate on next analysis).

## §11 Follow-up
- Weakness radar: a per-motif tactics breakdown (e.g. "you miss pins most") — deferred; belongs with
  `loop-closers` drill routing.
- Optional `relativePin`/`skewer` "wins material" confirmation via the existing MultiPV evaluator
  (only if Q-B chooses the stricter gate) — would couple motif tagging to the engine; out of scope here.
