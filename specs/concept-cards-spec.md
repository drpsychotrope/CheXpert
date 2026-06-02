# Spec — `concept-cards`: teach-before-test (curated worked-example cards per motif)

**Scope:** feature (single concern: short curated instruction per high-confidence motif) · **Status:** V1 (refined) · **Date:** 2026-06-02
Batch 3, spec E of 6. Branch `claude/awesome-keller-12b99e`.

## §0 Context

The app is **all assessment, no teaching.** Tactics tests; Review tests; analysis diagnoses; the
opponent steers — but nothing ever *shows the pattern* before (or after) the player is graded on it.
A beginner who keeps failing forks is told "you failed a fork" and re-served the same theme; the
instruction gap is never filled.

This spec ships **concept cards**: a tiny curated, worked-example card per motif the app already
detects with confidence. A card is shown at two honest teaching moments:
- **(a) first exposure** — the first time a motif appears for the player in Tactics, offer its card;
- **(b) leech** — when a specific puzzle has been failed repeatedly (a "leech"), offer the card for
  that puzzle's motif before the next attempt.

Cards are **curated static content** (CURATED, never generated — no LLM, ADR-0015/AP-CHESS-19), and
exist **only for motifs we detect with confidence** (mirrors ADR-0007/0020 honesty: no card for a
pattern we can't reliably name). Teaching is **optional and non-blocking** — a "Learn the pattern"
link, never a forced modal that interrupts the recall loop (active recall stays primary; AP-CHESS-15).

This is the natural complement to the diagnosis stack already shipped: detectors name the motif
(`motif.ts`), the lapse logic finds the puzzles you fail most (`schedule.ts buildLapseSet`), and the
SRS resurfaces them. Concept cards add the one missing arrow: *here is how this pattern works.*

## §1 Empirical baseline

- **Detectable motif set** (`src/analysis/motif.ts` `detectMotif`, ADR-0007 + ADR-0020, `confidence:'high'` only):
  `mate` / `mateInN` / `backRankMate`, `hangingPiece`, `fork` / `knightFork`, `pin` / `absolutePin` /
  `relativePin`, `skewer`, `discoveredAttack` / `discoveredCheck`, `doubleCheck`. Tag strings are the
  exact Lichess theme keys, and they flow into personal-puzzle `themes` and `Puzzle.themes` already.
- **Puzzle themes ARE motif keys.** `Puzzle.themes: string[]` (`src/trainer/puzzle.ts`) and
  `PuzzleAttemptRecord.themes: string[]` (`src/store/db.ts`) use the same Lichess theme keys, so a
  puzzle's motif is recoverable from its themes with **no new linkage** (e.g. a puzzle tagged `fork`
  → the `fork` card).
- **Seed-asset + ETL precedent (the house pattern).** `public/puzzles/seed-puzzles.json` (machine-
  verified, `scripts/gen-seed-puzzles.mjs`) and `public/openings/eco.json` (`scripts/build-eco.mjs`)
  ship a committed, offline JSON loaded at runtime. `src/opening/eco.ts` is the exact template for a
  pure loader: `loadEco()` fetches `${BASE_URL}openings/eco.json`, caches, returns `[]` on failure;
  `nameOpening(uci, table)` is a pure lookup tested against an in-memory table (`eco.test.ts`).
- **Legal-content-asserted-in-tests precedent.** `src/guess/games.ts` (ADR-0017) ships hand-curated
  PGNs and the suite asserts every line is legal + finished so a typo can't ship; the openings ETL
  (AP-CHESS-53) drops any line chess.js can't parse. Same bar applies to card FENs/key-moves.
- **Leech / most-failed logic.** `src/srs/schedule.ts buildLapseSet(attempts, k)` already ranks
  puzzles by fail count (pure; `lapseIntegration.test.ts` proves it reads `puzzleAttempts` as Tactics
  writes them). A per-puzzle **fail count** is therefore available from the same `puzzleAttempts` rows.
- **Persistence contract (scan, AUTHORITATIVE).** IndexedDB stores arbitrary shapes; **adding a field
  to an existing record needs NO `DB_VERSION` bump** (migrate in the load path); only a **new object
  store** bumps v4→v5. So first-exposure tracking is an additive field, **no schema bump**.
- **Surfaces.** `src/ui/Tactics.svelte` drives the solve loop and holds the current `puzzle` (with
  `.themes`). `src/state/app.svelte.ts` owns the `View` union + cross-view signal flags
  (`tacticsFilterThemes`, `tacticsTimed`) and the loaded `model`. `src/store/playerModel.ts`
  load path returns the stored record as-is (old records simply lack new fields → read with `?? []`).
- 135 tests passing, type-clean, build green (scan §2.2). No `concepts`/`conceptCard`/`conceptSeen`
  identifier exists in `src/` (scan §2.1 — net-new). No new external dependency (scan §2.5).

## §2 Scope

**In:**
1. **Seed asset** `public/concepts/concepts.json` — one card per **detectable** motif. Shape:
   ```jsonc
   {
     "version": 1,
     "license": "CC0 (curated positions/text). Lichess puzzle DB is CC0.",
     "cards": [
       {
         "motif": "fork",                       // a Lichess theme key the detector emits
         "title": "Fork (double attack)",
         "idea": "One piece attacks two targets at once; the opponent can save only one.", // 1-2 sentences
         "examples": [                            // 2-3 per card
           { "fen": "<legal FEN, solver to move>", "keyMove": "<UCI legal in that FEN>", "why": "Knight hits king and rook; after the king moves, take the rook." }
         ]
       }
     ]
   }
   ```
   Committed output (offline-ready, like `seed-puzzles.json`). Curated by hand for the **seed**;
   regenerable/augmentable by a tiny ETL `scripts/build-concepts.mjs` (see §4.1). Motif coverage,
   example count, and whether FENs are curated vs derived → **Q-A / Q-E**.
2. **`src/concepts/concepts.ts`** (pure + loader, mirrors `eco.ts`):
   - `ConceptCard` / `ConceptExample` interfaces (above).
   - `cardForMotif(motif: string, cards: ConceptCard[]): ConceptCard | null` — pure lookup. Maps a
     motif **or any of its sub-tags** to its card via a canonical alias table (`mateInN`/`backRankMate`
     → `mate`; `knightFork` → `fork`; `absolutePin`/`relativePin` → `pin`; `discoveredCheck` →
     `discoveredAttack`), so a puzzle tagged `knightFork` still finds the `fork` card. Alias map is a
     constant in this module.
   - `cardForThemes(themes: string[], cards): ConceptCard | null` — first theme (by detector
     precedence `mate > doubleCheck > fork > skewer > pin > discoveredAttack > hangingPiece`, reused
     from ADR-0020) that resolves to a card. This is the puzzle→card entry point.
   - `loadConcepts(): Promise<ConceptCard[]>` — fetch `${BASE_URL}concepts/concepts.json`, cache,
     return `[]` on any failure (graceful degradation — a missing/broken asset must never break
     Tactics; the link simply doesn't appear). Optional `fetchFn` injection for tests like `PuzzleRepo`.
   - Pure functions take the table as an argument (no I/O) so they're unit-tested against an in-memory
     fixture (the `eco.test.ts` pattern).
3. **First-exposure tracking** — additive field `conceptSeen?: string[]` (the **resolved motif keys**
   already offered at first-exposure), **no DB bump**. Location PlayerModel vs SettingsRecord → **Q-C**
   (recommend PlayerModel: it's learning state, lives next to `weaknessCounters`, and is wiped with the
   rest on data-reset). Seeded `[]` in `freshPlayerModel`; read with `model.conceptSeen ?? []` for old
   records. The key stored is the **resolved card motif** (the family key returned by `cardForThemes`,
   e.g. `fork`), not raw puzzle themes — so a puzzle whose themes resolve to no card never burns an
   entry, and a `knightFork` puzzle and a `fork` puzzle share one first-exposure. `conceptSeen` gates
   **only the first-exposure branch**; the leech branch (item 4) is independent of it (a card you've
   met can still be re-offered when *that specific puzzle* keeps beating you — a different moment).
4. **Leech trigger** — a pure `isLeech(failCount, threshold)` predicate (threshold N → **Q-B**,
   recommend **3**) plus a `failCountByPuzzle(attempts): Map<string,number>` helper (reuse the count
   loop already inside `buildLapseSet`; extract it so both share one definition — DRY, no behaviour
   change to `buildLapseSet`). Tactics computes the current puzzle's fail count from `puzzleAttempts`
   and, when it crosses N, surfaces a **"Learn this pattern"** link to the puzzle's motif card
   **before the next attempt** (non-blocking).
5. **UI**:
   - **`src/ui/ConceptCard.svelte`** — a compact, dismissible card view: title, idea, and the 2-3
     examples each as a small board (reuse `Board.svelte` read-only) with the key move highlighted +
     the `why` line. **Optional/non-blocking** (recommend a panel/link, NOT a forced modal — **Q-D**).
   - **`src/ui/Concepts.svelte`** — a browsable index of all cards (the teaching library). Add
     `'concepts'` to the `View` union + a nav/Dashboard entry. Index-in-nav vs contextual-only →
     **Q-F** (recommend both: a nav entry for the library + the contextual links).
   - Tactics integration: a "Learn the pattern" link in the post-attempt feedback area, shown when
     (first-exposure for this motif) OR (this puzzle is a leech). Clicking opens the card
     (inline panel or routes to `concepts` focused on that motif — **Q-D**). The link **never blocks**
     loading the next puzzle.

**Out (deferred → §11):** cards for `confidence:'low'` / phase-fallback "motifs" (we don't teach what we
can't name — honesty); spaced-repetition *of cards themselves* (a card is reference, not a graded item);
deriving example positions live from the user's own failed puzzles (curated seed first — **Q-E**);
interactive "now you try" mini-puzzle attached to a card; cards for non-tactical/positional motifs
(ADR-0031 features); localisation of card text.

## §3 Pre-flight gates

1. `detectMotif`'s emitted tag set + the ADR-0020 precedence list are unchanged (cards key off them).
2. `Puzzle.themes` / `PuzzleAttemptRecord.themes` carry Lichess theme keys (so puzzle→motif needs no
   new link); `buildLapseSet` reads `puzzleAttempts` as Tactics writes them (`lapseIntegration.test.ts`).
3. `BASE_URL` fetch of a committed `public/**` JSON works at runtime (proven by `eco.ts` / `PuzzleRepo`).
4. Adding `conceptSeen?` to `PlayerModel` needs **no `DB_VERSION` bump** (scan contract); old records
   load unchanged and read the field as `?? []`.
5. 135 tests green, type-clean, build green before starting (scan §2.2).

## §4 Phase A — code

### §4.1 Seed asset + ETL
- Hand-author `public/concepts/concepts.json` (the seed): one card per motif in the §2-Q-A coverage
  set, 2-3 examples each, every `fen` legal with the **solver to move** and every `keyMove` a legal
  UCI move in that FEN that *demonstrates the motif*. Pick example FENs from the existing CC0 corpus
  where convenient (mate-in-1 seed positions already demonstrate `mate`/`backRankMate`); otherwise
  compose minimal didactic positions.
- `scripts/build-concepts.mjs` (optional but recommended, mirrors `build-eco.mjs` / `gen-seed-puzzles.mjs`):
  validate every card through chess.js (FEN parses, side-to-move correct, `keyMove` legal) and
  **fail loudly / drop** any invalid example, logging the count; write the committed JSON. Wire
  `npm run etl:concepts`. This keeps the asset machine-checkable even though it's curated. (If kept
  purely hand-authored, the §5 test below is the only guard — acceptable, but the script is cheap.)

### §4.2 `concepts.ts` (pure + loader)
- Interfaces, the `MOTIF_ALIASES` constant, `cardForMotif`, `cardForThemes` — all **pure** (table
  passed in; no I/O; no `Date.now`/`Math.random`), unit-tested against an in-memory fixture.
- `loadConcepts()` — the runtime fetch+cache loader (browser path), `fetch(${BASE_URL}concepts/
  concepts.json)`, module-level cache, **graceful `[]` on any failure**, injectable `fetchFn`
  (mirrors `eco.ts` + `PuzzleRepo`). The seed asset is validated by the disk-read test in §5, not
  through this loader.

### §4.3 Leech predicate + shared count
- Extract `failCountByPuzzle(attempts)` from `buildLapseSet` (re-implement `buildLapseSet` on top of it
  so output is byte-identical) and add `isLeech(failCount, threshold)`. Pure, in `src/srs/schedule.ts`
  (or a sibling) — same module family as the lapse logic. **No change to `buildLapseSet`'s result.**

### §4.4 First-exposure field
- Add `conceptSeen?: string[]` to `PlayerModel` (`db.ts`); seed `[]` in `freshPlayerModel`
  (`playerModel.ts`); **no `DB_VERSION` change.** Consumers read `model.conceptSeen ?? []`.

### §4.5 UI
- `ConceptCard.svelte` (read-only `Board` per example, key move highlighted, dismissible, non-blocking).
- `Concepts.svelte` index + `'concepts'` in the `View` union + nav/Dashboard link.
- `Tactics.svelte`: resolve `card = cardForThemes(puzzle.themes, cards)` for the loaded puzzle (skip
  if `null`). Two **independent** triggers, both surfacing the same non-blocking **"Learn the pattern"**
  link to `card`:
  - **first-exposure** — `card.motif ∉ conceptSeen`: offered once; on offer, append `card.motif` to
    `conceptSeen` and `persistModel`.
  - **leech** — `isLeech(failCount, N)` where `failCount` for this `puzzle.id` is read at puzzle
    **load** (an async `db.getAllFromIndex('puzzleAttempts','puzzleId', id)` count, counting prior
    failures *before* this session's attempt). The leech branch does **not** consult or mutate
    `conceptSeen`, so a re-failed leech keeps offering its card even after first-exposure.
  Loading the next puzzle is **never** gated on the card; a `null` card simply shows no link.

## §5 Phase B — tests

- **`concepts.test.ts`** (pure, in-memory fixture table — the `eco.test.ts` pattern):
  - `cardForMotif` resolves a direct key (`fork` → fork card) and every **alias** (`knightFork`→fork,
    `mateIn3`/`backRankMate`→mate, `absolutePin`/`relativePin`→pin, `discoveredCheck`→discoveredAttack).
  - `cardForThemes` picks by precedence (a `['fork','crushing']` → fork; `['hangingPiece','pin']` → pin,
    higher precedence) and returns `null` for themes with no card (e.g. only a low-confidence fallback
    tag like `middlegameMistake`).
  - Unknown/empty motif → `null`. (No network: pure functions take the table.)
- **`concepts.seed.test.ts`** (the legal-content guard, mirrors `games.ts`/ADR-0017 + AP-CHESS-53):
  read the **real committed** `concepts.json` **from disk** — `JSON.parse(readFileSync(new
  URL('../../public/concepts/concepts.json', import.meta.url), 'utf8'))` — **not** via `loadConcepts`
  (that's `fetch`-based / browser-runtime; no test in the repo fetches a real `public/**` asset —
  `PuzzleRepo.test.ts` injects a fake `fetchFn` instead, so the loader is exercised only through the
  injected path). For **every** example assert (a) `new Chess(fen)` parses, (b) the FEN's side-to-move
  matches the side that plays `keyMove`, (c) `keyMove` is in `chess.moves({verbose})` for that FEN.
  Assert there is **exactly one card per motif key** and **every card covers a detector-emitted motif**
  (no card for a motif `detectMotif` never produces — honesty). Whether to additionally assert
  `detectMotif` *fires* the card's motif on the example → **Q-G** (recommend: legality + key-move now;
  defer detector-fires coupling).
- **`schedule.test.ts`** (extend): `failCountByPuzzle` counts only failures and matches the tallies
  `buildLapseSet` ranks by; `buildLapseSet` output is unchanged after the extraction (regression);
  `isLeech` true at/above N, false below.
- Existing 135 tests stay green; no test touches the network.

## §6 Phase C — verification

`npm test` green incl. the new suites; `svelte-check` clean; build green. Manual: fail the same
Tactics puzzle N times → a non-blocking "Learn the pattern" link appears → opens the right motif card
(legal example boards, key move highlighted) → dismiss → next puzzle loads normally; first time a new
motif appears, its card is offered once and not again; Concepts index lists every card from nav;
deleting all data clears `conceptSeen` (it rides PlayerModel through `clearAllData`).

## §7 Phase Z — docs

- **ADR-0040** (provisional id; appended at IMPLEMENTATION time, not now): "Concept cards —
  teach-before-test via curated worked examples." Record: curated static content, **no LLM**
  (ADR-0015); cards **only for confidently-detected motifs** (extends the ADR-0007/0020 honesty
  doctrine to *teaching*); two trigger moments (first-exposure + leech); **non-blocking** link
  (active recall stays primary, AP-CHESS-15); seed asset + optional ETL with legality asserted in
  tests (ADR-0017 / AP-CHESS-53 precedent); additive `conceptSeen` field, **no schema bump** (scan
  contract); the leech threshold N and coverage set as decided in §8; the two **independent** trigger
  branches (first-exposure consults/updates `conceptSeen`; leech does not). Cross-link ADR-0007,
  ADR-0020, ADR-0015, ADR-0017, ADR-0029 (`buildLapseSet`). Record the **AP-CC-1..7** anti-patterns.
- **README** "Learn & retain" (or the teaching/feature section): add concept cards — "see the pattern
  the first time it bites you, and when a puzzle keeps beating you," plus the Concepts library. Note
  the content is curated + offline, CC0 attribution consistent with the puzzle/ECO assets.

## §8 Acceptance

- A curated `public/concepts/concepts.json` ships with one card per detectable motif (Q-A set),
  2-3 examples each, **every FEN + key move asserted legal** in tests (and motif-coverage = detector
  set, no fabricated patterns).
- `concepts.ts` is pure-tested (lookup + aliases + precedence + graceful empty load); the loader
  degrades to `[]` without breaking Tactics.
- First exposure to a motif in Tactics offers its card **once** (tracked via additive `conceptSeen`,
  **no DB bump**); a puzzle failed ≥ N times offers its motif's card before the next attempt.
- The card is **optional and non-blocking** — never gates the recall loop or the next puzzle.
- A Concepts index lists all cards from nav. `npm test` green incl. new suites; `svelte-check` clean;
  build green. ADR-0040 + README updated (at implementation).

## §9 Anti-patterns

- **AP-CC-1** — Generating card text/examples (LLM or templated prose) instead of shipping **curated**
  content. Cards are hand-authored static data (no LLM; ADR-0015). Reject any runtime/codegen of idea text.
- **AP-CC-2** — A card for a motif we **don't** confidently detect (a fabricated/aspirational pattern).
  Cards exist **only** for `detectMotif`'s high-confidence keys; the §5 seed test asserts coverage ==
  detector set (extends ADR-0007/0020 honesty to teaching).
- **AP-CC-3** — A **blocking** modal that interrupts the recall loop / forces reading before solving.
  Teaching is an **optional link**; loading the next puzzle is never gated on a card (AP-CHESS-15).
- **AP-CC-4** — Shipping an **illegal** example FEN or a key move that isn't legal in it (a wrong
  worked example teaches the wrong thing). Every example is chess.js-verified in tests (ADR-0017 /
  AP-CHESS-53 precedent); the ETL drops/fails invalid examples.
- **AP-CC-5** — Re-offering the same motif's card on every exposure (nagging) — or, conversely, losing
  the "seen" state. Record the motif in `conceptSeen` the moment the card is **offered**; one-shot per
  motif; survives reload (persisted) and is wiped on data-reset.
- **AP-CC-6** — Bumping `DB_VERSION` or adding an object store for `conceptSeen` (it's an additive
  field; scan contract forbids a bump). Migrate in the load path with `?? []`; no `upgrade()` case.
- **AP-CC-7** — Re-implementing the fail-count tally separately from `buildLapseSet` (drift between the
  leech trigger and the "Your misses" set). Share one `failCountByPuzzle`; assert `buildLapseSet`
  output is unchanged after the extraction.

## §10 Rollback

All net-new + additive: a new data file (`public/concepts/concepts.json`), optional ETL script, pure
`src/concepts/concepts.ts`, two pure helpers in `schedule.ts`, one additive `PlayerModel` field, two
new Svelte views, and Tactics link wiring + one `View`-union arm. **No schema bump, no object store,
no change to existing logic** (`buildLapseSet` output preserved; `detectMotif` untouched). Revert by
deleting the new files and the additive lines; `conceptSeen` on stored records is ignored by the
reverted code (harmless). Tactics/Review/SRS behave exactly as before.

## §11 Follow-up

- Derive example positions from the **user's own** failed puzzles of that motif (personalised cards;
  needs a from-attempts FEN source — **Q-E** deferred path).
- An interactive "now you try" mini-puzzle appended to each card (turns teaching → active recall).
- Cards for **positional** features (IQP, weak squares, doubled pawns — ADR-0031 `positional.ts`) once
  those are surfaced as confident motifs.
- Optional spaced *review of cards* (only if cards gain an attemptable component; today a card is
  reference, not a graded item).
- Localisation of card text; richer media (arrows/annotations) per example.

---

## Arbitrages (bundled in `reports/concept-cards_arbitrages.md`)

- **Q-A — Seed coverage (which motifs).** Recommend one card per detector **family**: `mate` (covers
  `mateInN`/`backRankMate`), `fork` (covers `knightFork`), `pin` (absolute+relative), `skewer`,
  `discoveredAttack` (covers `discoveredCheck`), `doubleCheck`, `hangingPiece` → **7 cards**. (Sub-tags
  alias to the family card; no separate `knightFork` card.)
- **Q-B — Leech fail-count threshold N.** Recommend **N = 3** (third failure of the *same* puzzle
  triggers the offer) — rare enough not to nag, common enough to catch a real leech.
- **Q-C — First-exposure tracking location.** Recommend **PlayerModel.conceptSeen** (learning state,
  next to `weaknessCounters`, wiped on data-reset) over SettingsRecord. Additive field, no DB bump.
- **Q-D — Card as blocking modal vs optional link.** Recommend **optional link / inline panel**
  (protect the recall flow; AP-CC-3). Never a forced modal.
- **Q-E — Curated example FENs now vs derive from the user's failed puzzles.** Recommend **curated
  seed now** (ships offline, machine-verifiable, like seed-puzzles/eco); personalised derivation is §11.
- **Q-F — Concepts index in nav vs contextual-only.** Recommend **both** — a nav/Dashboard entry for
  the library plus the contextual "Learn the pattern" links.
- **Q-G — Seed test: assert legality only vs also assert `detectMotif` fires the motif on the example.**
  Recommend **legality + key-move legality + coverage now**; defer asserting the detector fires
  (couples the asset test to detector internals; revisit if examples drift).
