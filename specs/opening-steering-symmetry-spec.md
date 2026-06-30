# Spec — `opening-steering-symmetry`: make opening steering work for both player colours

**PR**: `opening-steering-symmetry` · **Scope**: feature (P4 of the enhancements portfolio) · **ADR**: none (extends AP-CHESS-22; not architectural)
**Spec version**: V1 (post 4 refiner cycles + 3 enrich cycles) · **Drafted**: 2026-06-30
**Pre-V0 scan**: PASS — `reports/opening-steering-symmetry_{target_exists,baseline,collision}.json`

---

## §0 Context

The closed loop's payoff (ADR-0014, AP-CHESS-22) is that the bot **biases its opening toward the
player's weakest dimension**: `selectOpening(botColor, weakest, pick)` weights book lines whose
`targets` equals `weakest` at ~3:1 over the rest, while keeping variety. The bot's colour is the
**opposite** of the player's — the single runtime caller is:

```ts
// src/ui/Play.svelte:167
opening = selectOpening(playerColor === 'white' ? 'b' : 'w', weakestDim, Math.random());
```

The mechanism is sound; the **data is asymmetric**. Measured (`reports/…_baseline.json`):
the `OPENING_BOOK` has **10 White-bot lines and 4 Black-bot lines**, and the `targets` are unevenly
distributed across the two colours. As a result, for some `(bot colour, dimension)` pairs there is
**no line at all**, so the weight-3 set is empty, the weighting silently collapses to uniform, and
the bot plays an opening unrelated to the gap — while `steeringNote` quietly emits the non-steering
"Playing the X." That is a **silent no-op**: the loop's headline feature fails for those players
with no error and no signal.

This PR completes the book so **every `Dimension` is reachable for both bot colours**, and adds a
**same-colour fallback** so any future gap fails safe (audible, never a wrong-colour entry) instead
of silently no-opping.

## §0.5 Arbitrages flagged

Surfaced by the pre-V0 scan; full user-facing bundle in `reports/opening-steering-symmetry_arbitrages.md`.
**Defaults below are the recommended resolutions; spec body already reflects them.**

- **Q-A — fill the book vs a fallback vs both.** **[default: BOTH]** Add the missing lines so every
  Dimension is reachable per colour, *and* harden `selectOpening` so that when the requested colour's
  pool lacks any line targeting `weakest`, it returns a deterministic **same-colour** entry (never a
  wrong-colour one) — so a gap can never again silently no-op. (a) data-only leaves the fallback bug
  latent; (b) fallback-only keeps steering blind for the missing dims; (both) is belt-and-braces.
- **Q-B — how many new lines.** **[default: minimal coverage set = 3]** Add exactly the lines needed so
  each of the 5 Dimensions has ≥1 line for *each* bot colour: `sicilian-b` (tactics), `exchangeCaro-b`
  (endgameConversion), `kingsGambitAccepted-w` (resilience). Full numeric parity (10/10) is rejected as
  scope creep — variety is already preserved by the weighting.
- **Q-C — source the new lines.** **[default: eco.json-grounded]** Every new line's prefix exists in
  `public/openings/eco.json` (Sicilian B50, Caro-Kann …d5 B12, King's Gambit C30); names follow the
  existing book's "(as Black)" / family convention. Hand-curation is rejected.
- **Q-D — FR/EN parity for the new names.** **[default: extend `ECO_NAME_FR`]** Add the three new
  display names to the French overlay in `eco.ts` so `steeringNote` can be localized with parity,
  matching ADR-0053. (Alternative: localize `steeringNote` independently — rejected as a second
  naming source.)

## §1 Empirical baseline

Captured 2026-06-30 (`reports/opening-steering-symmetry_{target_exists,baseline,collision}.json`).
Anchors, not estimates:

| Fact | Value | Source |
|---|---|---|
| `OPENING_BOOK` size | **14 lines: 10 White-bot, 4 Black-bot** | mirrored from `openingBook.ts:30`, counted |
| `Dimension` set | exactly 5: `tactics`, `endgameConversion`, `openingAccuracy`, `timeManagement`, `resilience` | `weakness.ts:13` |
| Black-bot coverage | missing **`tactics`, `endgameConversion`** (0 lines each) | simulated |
| White-bot coverage | missing **`resilience`** (0 lines) | simulated |
| Silent no-op | player White + weakest `tactics` → every `pick` returns a non-tactics line; `steeringNote` says "Playing the X." | simulated, `…_collision.json` |
| Only runtime caller | `src/ui/Play.svelte:167` (`Math.random()` at the call-site, not inside the core) | grep |
| `eco.json` | 40 entries; new lines' prefixes present (B50, B12, C30) | `eco.json`, counted |
| Tests | **504 / 69 files green**; `openingBook.test.ts` asserts colour+dim coverage on the **union** (masks per-colour gap) | portfolio §8 + live file count |
| `svelte-check` | 0 errors / 0 warnings (383 files) | portfolio §8 |
| `DB_VERSION` | **4** (this PR adds none) | `db.ts` |

**Key correction vs portfolio PL5:** the gap is **bidirectional**, not Black-only. Minimal parity
therefore needs **2 new Black lines + 1 new White line**, not "fill the Black book".

## §2 Scope (single concern)

**One concern: make weakness-based opening steering reach every `Dimension` for both bot colours,
and never silently no-op.**

**In:**
- `src/opening/openingBook.ts` — add **3** `OPENING_BOOK` entries (Q-B); harden `selectOpening`'s
  empty-weighted-set path to return a deterministic **same-colour** fallback (Q-A); keep the core pure.
- `src/opening/eco.ts` — add the 3 new display names to `ECO_NAME_FR` (Q-D).
- `src/opening/openingBook.test.ts` — add per-colour coverage + non-degenerate-steering assertions.

**Out (explicitly):**
- Numeric 10/10 parity / a full repertoire (variety is the weighting's job, not the book's size).
- Any Coach concern (C7 opening→repertoire routing): this PR stays coach-agnostic — it only completes
  the shared book + steering. C7 consumes `app.steerDimension`, which already flows into
  `selectOpening`; completing the book makes that path work for either colour **for free**.
- The `nextBookMove` feeding mechanism and its future relocation into `gameSession.ts` (F6).
- Chess960 (no book; `selectOpening` is not called).
- Any persistence / `DB_VERSION` change.

## §3 Pre-flight gates

1. `OPENING_BOOK`, `selectOpening`, `nextBookMove`, `steeringNote`, `Dimension`, `ECO_NAME_FR` all
   present as in §1 (verified).
2. The 3 new lines are **legal from the start position** and feed the bot at least one book move on
   its own turn (validated with chess.js — `…_baseline.json`).
3. 504 tests green before changes; `svelte-check` 0/0.
4. No consumer reads `OPENING_BOOK`/`selectOpening` except `Play.svelte` (grep-confirmed) → Insights
   byte-identity is structurally guaranteed.

## §4 Phase A — code (FIRST)

### §4.1 Add the minimal coverage set to `OPENING_BOOK` (`openingBook.ts`)
Append three eco.json-grounded entries (all validated legal):

```ts
// --- tactics (bot as Black): sharp Sicilian → tactical middlegames, mirrors the White tactics cluster ---
{ id: 'sicilian-b', name: 'Sicilian Defence (as Black)', botColor: 'b', targets: 'tactics',
  moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4'] },

// --- endgameConversion (bot as Black): Exchange Caro-Kann → symmetric structure, reach endgames sooner ---
{ id: 'exchangeCaro-b', name: 'Caro-Kann, Exchange (as Black)', botColor: 'b', targets: 'endgameConversion',
  moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5'] },

// --- resilience (bot as White): gambit a pawn so the PLAYER (Black) must defend/convert under pressure ---
{ id: 'kingsGambitAccepted-w', name: "King's Gambit Accepted", botColor: 'w', targets: 'resilience',
  moves: ['e2e4', 'e7e5', 'f2f4', 'e5f4'] },
```

After this, per-colour coverage is complete: every `Dimension` has ≥1 line for **both** `botColor`
values. (Comment each line with the dimension rationale, matching the existing book's style.)

### §4.2 Harden `selectOpening` against an empty weighted set (`openingBook.ts`)
The existing logic already filters the pool by colour and the length-0 guard returns `OPENING_BOOK[0]`.
Two refinements, both purity-preserving (no `Date`/`Math.random` added):

1. **Same-colour empty-pool fallback.** Replace `return OPENING_BOOK[0]` (which can return a
   *wrong-colour* entry) with a deterministic same-colour pick, falling back to `OPENING_BOOK[0]`
   only if the colour is truly absent (cannot happen post-§4.1, but fail safe):
   ```ts
   const pool = OPENING_BOOK.filter((o) => o.botColor === botColor);
   if (pool.length === 0) {
     return OPENING_BOOK.find((o) => o.botColor === botColor) ?? OPENING_BOOK[0];
   }
   ```
   *(Net behaviour for any real colour is unchanged today; this removes the latent wrong-colour bug
   so a future gap can never feed `nextBookMove` the wrong side.)*

2. **No-coverage is explicit, not accidental.** When `weakest` is set but **no** pool line targets it,
   the weighting already degrades to uniform variety. Keep that behaviour (it is the correct
   "graceful variety" outcome) — but it must now be **unreachable for the 5 real dimensions** because
   §4.1 guarantees coverage. Add a short comment documenting that the uniform-fallback path is the
   intended degradation only for an *unknown* dimension, not a silent loss of steering for a known one.

*(No signature change. `selectOpening` stays pure and deterministic given `pick`.)*

### §4.3 FR/EN parity for the new names (`eco.ts`)
Add to `ECO_NAME_FR`:
```ts
'Sicilian Defence (as Black)': 'Défense sicilienne (avec les Noirs)',
'Caro-Kann, Exchange (as Black)': "Caro-Kann, variante d'échange (avec les Noirs)",
"King's Gambit Accepted": 'Gambit du roi accepté',
```
This keeps a single naming source (the overlay) and lets any localized surface render the new
openings with parity (ADR-0053). `steeringNote` localization itself is out of scope here (it is
English today for *all* lines); this PR does not regress parity and pre-stages the names for the
i18n routing PR (F1) that owns `steeringNote` wording.

## §5 Phase B — tests

Add to `src/opening/openingBook.test.ts` (pure unit tests — the portfolio has **no Svelte component
harness**; `selectOpening` is the unit-testable core):

1. **Per-colour, per-dimension coverage (the regression lock).** For **each** `botColor ∈ {'w','b'}`
   and **each** of the 5 `Dimension`s, assert `OPENING_BOOK.some(o => o.botColor === c && o.targets === d)`.
   *(This replaces the union-only assertion's blind spot; it is the test that would have caught the bug.)*
2. **New lines are legal** — covered by the existing "every line is legal" loop (now includes the 3).
3. **Steering is non-degenerate for the previously-broken pairs.** For `(bot='b', weakest='tactics')`,
   `(bot='b', weakest='endgameConversion')`, `(bot='w', weakest='resilience')`: over many `pick`
   values, assert the weak-targeting line is selected **strictly more often** than any single other
   line (i.e. the ~3:1 bias now actually engages) — mirroring the existing `bot='w' tactics` bias test.
4. **`steeringNote` now steers** for those pairs: the selected weak-targeting opening yields a note
   containing "weakest area" (was "Playing the X." pre-fix).
5. **Same-colour fallback** — assert `selectOpening(c, weak, pick).botColor === c` holds for both
   colours across the full `pick` range (extends the existing colour-filter test to `'b'`).
6. **FR parity** — `localizedOpeningName({name}, 'fr')` returns the French overlay (not the English
   fallback) for each of the 3 new names.

Expected delta: **+~6 assertions / +0 or +1 test file** (same file). New baseline ≈ **510 tests**.

## §6 Phase C — verification

- `npm test` green incl. the new `openingBook.test.ts` cases; **no prior regression** (504 → ~510).
- `svelte-check` 0 errors / 0 warnings (no `.svelte` touched, but run it — anchor parity).
- Insights study-plan snapshot **byte-identical** (structurally guaranteed; verify the existing
  snapshot test still passes — AP-COACH-1).
- Manual/preview: start a game as **White** (bot Black) with a tactics/endgame weakness profiled
  (or via `app.steerDimension`) → the bot now opens with the Sicilian / Exchange Caro-Kann and the
  steering note names the weakness; start as **Black** with a resilience gap → bot plays the King's
  Gambit. Off-book by the player still hands control to the engine (`nextBookMove` unchanged).

## §7 Phase Z — docs (LAST)

- **No new ADR.** Extend the inline AP-CHESS-22 rationale comment in `openingBook.ts` to record that
  the book must keep **per-colour** Dimension coverage (not just union), and that the uniform path is
  graceful variety for *unknown* dimensions only.
- README: the steering feature description (if it enumerates coverage) gains "works for both colours";
  otherwise no change. ATTRIBUTION unchanged (eco data already credited).
- `decisions.md`: append the Q-A…Q-D resolutions (append-only) at session wrap.

## §8 Acceptance criteria

1. Every `Dimension` has ≥1 `OPENING_BOOK` line for **both** `botColor` values (test §5.1).
2. For the three previously-broken `(colour, dimension)` pairs, `selectOpening` biases toward the
   weak-targeting line ~3:1 and `steeringNote` reports "weakest area" (tests §5.3–§5.4).
3. `selectOpening` returns a **same-colour** entry for every input, including the empty-pool fallback
   (test §5.5).
4. The 3 new names render with FR/EN parity via `ECO_NAME_FR` (test §5.6).
5. `selectOpening`/`nextBookMove` remain pure (no `Date`/`Math.random` inside); signatures unchanged.
6. 504→~510 tests green; `svelte-check` 0/0; Insights snapshot byte-identical; **`DB_VERSION` still 4**.
7. No Coach concern encoded in the book; `app.steerDimension` path now works for either colour.

## §9 Anti-patterns

- **AP-STEER-1** — *Silent no-op steering.* Steering toward a dimension the bot's colour can't express
  must never just play a random opening with no signal. The book must cover every `(colour, dimension)`
  pair; the uniform-variety path is reserved for an *unknown* dimension only.
- **AP-STEER-2** — *Union-coverage illusion.* Asserting the book covers "both colours and all dims" on
  the **union** hides per-colour holes. Coverage tests must be **per colour × per dimension**.
- **AP-STEER-3** — *Wrong-colour fallback.* A fallback that returns `OPENING_BOOK[0]` regardless of the
  requested colour feeds `nextBookMove` the wrong side and produces no bot move (a deeper silent no-op).
  Fallbacks must be **same-colour**.
- **AP-STEER-4** — *Impurity creep at the fix site.* Do not "fix" variety by adding `Math.random()`/`Date`
  inside `selectOpening`; the pick stays a caller-supplied parameter (AP-CHESS-22 determinism).
- **AP-STEER-5** — *Coach coupling.* Do not add coach/repertoire-specific entries or branch on coach
  state in the shared book; keep it a pure steering book that C7 can consume via `app.steerDimension`.
- **AP-STEER-6** — *Parity drift.* A new user-visible opening name without an `ECO_NAME_FR` entry
  silently falls back to English, breaking FR/EN parity (ADR-0053). Add the FR name with the line.
- **AP-STEER-7** — *Over-filling.* Padding the book to numeric 10/10 parity is scope creep and dilutes
  the weighting; add only the minimal set that closes the coverage holes.

## §10 Rollback

Pure-additive: 3 data rows + a same-colour fallback refinement + 3 FR-overlay strings + test
assertions. No schema, no signature change, no `.svelte` change. Revert the three files; steering
returns to its prior (asymmetric) behaviour. Zero migration.

## §11 Follow-up (deferred, not this PR)

- Localize `steeringNote` itself (it is English for all lines today) — belongs to **F1 i18n routing**,
  which owns user-facing steering wording; the FR names are pre-staged here.
- Per-dimension **depth/quality** of lines (e.g. multiple tactical Black lines for richer variety) —
  only if play-testing shows the single line feels repetitive; the weighting already preserves variety.
- A coverage **lint/CI assertion** generated from the `Dimension` union × `{'w','b'}` so any future
  dimension addition forces book coverage (turns AP-STEER-2 into a build-time guarantee).
- Coach C7 may later prefer a *specific* repertoire line per opening weakness; that routing lives in
  C7, consuming this completed book — not here.
