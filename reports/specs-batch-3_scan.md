# Pre-V0 empirical scan — specs batch 3 (clock, modes, pedagogy)

Shared scan for 6 single-concern specs drafted together (draft-general §2). Date: 2026-06-02.
Branch: `claude/awesome-keller-12b99e`.

## Batch contents (6 specs, single-concern each)

| pr-name | spec file | scope | cost |
|---|---|---|---|
| `time-controls` | specs/time-controls-spec.md | feature | LOW |
| `chess960` | specs/chess960-spec.md | feature | MED–HIGH |
| `metacognition` | specs/metacognition-spec.md | feature | LOW |
| `critical-moment-drill` | specs/critical-moment-drill-spec.md | feature | LOW |
| `concept-cards` | specs/concept-cards-spec.md | feature | LOW–MED |
| `efficacy-session` | specs/efficacy-session-spec.md | feature | MED |

Suggested ship order: 1 → 3 → 4 → 6 → 5 → 2 (clock first; chess960 last).

## §2.1 Target existence (all net-new; anchors exist)

Verified absent in `src/` (grep, case-insensitive): `gameRatings`, `class Clock`, `whiteMs`,
`UCI_Chess960`, `incrementSec`, `chess960`, `selfTag`, `conceptCard`, `whenToThink`.
`timeControl` matches ONLY the PGN `TimeControl` header parser (`src/analysis/pgn.ts`,
`types.ts`, `Import.svelte`) — imported games already carry a TimeControl tag; reuse the string.

Anchor files confirmed present:
- `src/ui/Play.svelte` — live game loop (drives clock; bot move at fixed movetime today).
- `src/engine/AdaptiveOpponent.ts` — `pickMove(fen, movetime)` / `pickHumanMove(fen, movetime)`.
- `src/engine/EngineClient.ts` — generic `setOption(name,value)` (so `UCI_Chess960` works),
  `evaluate(fen,{movetime})`, `analyzeLines(fen,{multipv,movetime})`. Interrupt = terminate+respawn.
- `src/store/db.ts` — schema v4; `GameRecord`, `PlayerModel`, `SettingsRecord`, `PuzzleAttemptRecord`.
- `src/state/app.svelte.ts` — `View` union (nav), cross-view signal flags (`tacticsTimed`, `tacticsFilterThemes`).
- `src/analysis/criticalMoments.ts`, `fingerprint.ts`, `weakness.ts`, `studyPlan.ts`, `motif.ts` — reuse targets.
- `src/game/ChessGame.ts` — chess.js wrapper (castling shim point for chess960).

## §2.2 Baseline (current state)

- DB schema **v4**. `DB_VERSION = 4`. Additive fallthrough `upgrade()` ladder.
- `PlayerModel`: ONE `gameRating: Rating`, ONE `opponentTargetElo: number`, ONE `recentOutcomes[]`.
- `AdaptiveOpponent`: fixed movetime (500 engine / 300 human). No clock concept.
- `Play.svelte`: no timer. Bot move budget hardcoded. `opponentStyle` selectable (ADR-0035).
- Rating: Glicko-2 (`rating/glicko2.ts`), `updateRating(rating, matches)`.
- 135 tests passing, type-clean, build green (README).

## §2.3 Source divergence

None. Invocation references the in-session brainstorming design (per-TC ratings via AskUserQuestion,
wild=Chess960). Consistent.

## §2.4 Collision

No git remote (local-only repo) → `gh pr list` N/A. Branches: `main`, current worktree branch,
and `claude/agitated-babbage-e01086` (empty — 0 commits and 0 diff vs main). No parallel work overlaps.

## §2.5 Dependency check

**No new external dependency in any of the 6 specs.** chess.js 1.4.0, chessground 9.2.1, Stockfish 18
(+ `UCI_Chess960` UCI option), ts-fsrs, idb — all already installed. Chess960 castling is handled by a
local shim, not a library swap. Risk-free.

## §2.6 Conventions (baked into every spec)

- Decision log: `decisions.md`, **append-only** ADR; new entry, cross-link supersedence. Next id = **ADR-0036**.
- Spec file: `specs/<pr-name>-spec.md`. Reports: `reports/<pr-name>_*`.
- Doctrine (README + ADRs): client-only, **no backend**, **no LLM** (rule-based / fact-derived only),
  **intellectual honesty** (no fake accuracy grade; conservative motif tags; directional benchmarks),
  active recall, "stronger per hour". Network egress ONLY opt-in Syzygy.
- Pure cores unit-tested, no `Date.now`/`Math.random` in cores (UI/caller injects). Vitest.
- Phase order: **code → tests → verify → docs**. Docs last.
- chess960 overrides the README "no variant catalogue" line — note it explicitly in that spec + ADR.

## Authoritative shared data-model contract (consume verbatim)

**Rule:** IndexedDB stores arbitrary value shapes. **Adding fields to existing records needs NO
`DB_VERSION` bump** — migrate in the load path (`store/playerModel.ts`). **A new object store is the
ONLY thing that bumps v4→v5.**

- **`RatingPool` union (define once, in `rating` or `db`):** `'bullet' | 'blitz' | 'rapid' | 'classical' | 'chess960'`.
- **`PlayerModel` reshape (OWNED by `time-controls` spec):**
  - `gameRating: Rating` → `gameRatings: Partial<Record<RatingPool, Rating>>`.
  - `opponentTargetElo` + `recentOutcomes` → `opponentByPool: Partial<Record<RatingPool, { targetElo: number; recent: GameOutcome[] }>>`.
  - Load-path migration: if old `gameRating` present and `gameRatings` absent, seed the 4 standard
    pools from it (RD widened); `chess960` seeded lazily on first 960 game. NO version bump.
  - Consumers to update: onboarding/calibration seeds, `Play.svelte`, Dashboard/Insights "which rating".
- **`GameRecord` (OWNED by `time-controls`; `chess960` adds fields):**
  - + `timeControl: { initialSec: number; incrementSec: number; category: 'bullet'|'blitz'|'rapid'|'classical'; untimed?: boolean }`.
  - + `variant?: 'standard' | 'chess960'` (default standard) + `startFen?: string`. (chess960 spec.)
- **`SettingsRecord` (time-controls):** + `lastTimeControl?: { initialSec; incrementSec }`.
- **`PuzzleAttemptRecord` (metacognition):** + `confidence?: 'sure'|'unsure'|'guess'` + `selfTag?: string` (optional; no bump).
- **New object store (efficacy-session, the ONLY v4→v5 bump):** `sessions` if guided-session history is
  persisted — else derive and avoid the bump. Spec must justify the store or drop it.
- **chess960 rating** is its own pool (`chess960`), ORTHOGONAL to time category (Lichess model).

Ownership prevents divergence: `time-controls` defines `RatingPool` (incl. the `chess960` member) and the
PlayerModel migration; `chess960` only populates the `chess960` pool + `variant`/`startFen`. If both ship,
no migration conflict.
