# Spec — teach-explain-surfacing (Foundation **F4**)

**Type**: foundation PR (shared substrate) · **Spec version**: **V1** (4 refiner cycles applied; FOLD set from `/enrich` ×3 folded) · **Drafted**: 2026-06-30
**Architecture parent**: `specs/enhancements-architecture-spec.md` §2 (F4) · **ADR**: none new (reuse under ADR-0040/0044/0021/0052/0053; see §0.5 Q-E)
**Branch base**: `main` · **Sibling reports**: `reports/teach-explain-surfacing_{target_exists,baseline,collision,arbitrages,improvements}.{json,md}`

---

## §0 Context

Three learning surfaces already *compute* "the solution + why" but never *show* it where the learning happens:

- **Trainer miss** (`src/ui/Tactics.svelte`, `src/ui/Review.svelte`): on a wrong move the board is **reset to the start FEN** and the user is told only *"Not the move"* / *"missed"*. The solution line is never shown. (Folds **TR1 core**.)
- **Coach game review** (`src/ui/Coach.svelte`): `finishGame()` runs the **full** `runAnalysis()` then **discards** the `GameAnalysis`, keeping only `.dimensions` for the radar. The win-prob curve and turning points are computable but unsurfaced. (Folds **CO1 / CO13**.)

Meanwhile **`src/ui/Calculate.svelte`** *does* show an animated solution: `revealSolution()` steps a fresh `ChessGame` through `puzzle.moves` at 350 ms/ply on a view-only board and prints a numbered SAN line via `formatSanLine`. That capability is **trapped inside one component**.

**F4 extracts a reusable "show the solution + why" surface** — animated playback + a fact-derived natural-language line — that the Trainer (on a miss) and the Coach (game review) can both consume. F4 **lands the shared component and wires the Trainer-miss proof consumers**; the Coach game-review consumption is **deferred to C6** (per the architecture DAG).

### Pre-V0 empirical scan (verdict: **PROCEED**)
Baseline: **504 tests / 69 files green; svelte-check 383 files, 0 errors, 0 warnings** (`reports/..._baseline.json`). All reuse hooks read and verified (`reports/..._target_exists.json`). **Three premise corrections** (carried into §0.5):
1. `explain.ts` **`uciToSan` is module-private**, not exported. F4 reuses the exported **`explainPly()`** for the Coach path and derives SAN for the reveal via `new ChessGame(fen).moveUci(uci)` + `formatSanLine`, exactly as `Calculate.revealSolution` already does. F4 does **not** widen the export surface with `uciToSan`.
2. **`explainPly()` requires a full `PlyAnalysis`** (engine eval). A **trainer-miss has no `PlyAnalysis`** at solve time (puzzle lines are pre-verified; no live engine). So the trainer-miss "why" is **theme/motif-derived** (from `puzzle.themes`), *not* `explainPly`. `explainPly` is the **Coach** game-review path → deferred to C6. This is exactly the per-consumer split arbitrage Q-B recommends, now grounded in a real type constraint.
3. There are **two** trainer-miss consumers (Tactics **and** Review), structurally identical, not one. Both are wired in F4 (Q-C).

---

## §0.5 Arbitrages (recommended defaults — ratify before build)

> Full reasoning in `reports/teach-explain-surfacing_arbitrages.md`. Defaults below are what the spec is written against.

| # | Question | Options | **Recommended default** |
|---|---|---|---|
| **Q-A** | New shared component vs extend Calculate? | (a) new `SolutionReveal.svelte` both consume; (b) extend Calculate in place; (c) extract a pure helper only | **(a) extract a new `src/ui/SolutionReveal.svelte`**; refactor `Calculate.svelte` to consume it (proves reuse, removes duplication). The 350 ms stepper + SAN-line build move into the component. |
| **Q-B** | Depth of "why" | (a) theme line only; (b) + concept card; (c) + EvalGraph | **Per consumer**: trainer-miss → **theme/motif-derived line** (no engine; honest); Coach game-review → **EvalGraph + turning points** (has `GameAnalysis`) **[C6]**; concept card stays behind the **existing `showLearn`** (untouched). |
| **Q-C** | Wire consumers now, or land component only? | (a) component only; (b) component + Trainer-miss; (c) component + Trainer + Coach | **(b+) component + BOTH trainer-miss consumers (Tactics & Review)** as proof. **Coach game-review DEFERRED to C6.** |
| **Q-D** | Reveal trigger in Trainer | (a) auto-reveal on miss; (b) a "Show solution" button (opt-in) | **(b) a "Show solution" toggle** shown after a miss. Non-blocking, doesn't auto-spoil for a Retry; one tap reveals + animates. (Calculate keeps its existing auto-reveal-on-Submit — it has no Retry.) |
| **Q-E** | New ADR? | yes / no | **No.** Reuse under ADR-0040/0044/0021/0052/0053. Allocate **ADR-0054** at build time only if the extraction is judged decision-worthy; do not pre-spend. |
| **Q-F** | i18n key names for new strings | — | `reveal.showSolution`, `reveal.hideSolution`, `reveal.why`, `reveal.themeWhy` (all FR+EN, in `tactics.ts`). `calc.solution` is **reused** (already bilingual), not redefined. |
| **Q-G** | Theme→idiom mapping source | (a) reuse existing motif labels (`motif.*` / `motifExpl.*`); (b) new table | **(a) reuse existing `motifExpl.*`/`motif.*` catalogue** keyed off the puzzle's highest-precedence theme (via `cardForThemes`/`CARD_PRECEDENCE` family resolution). No new content table; pure mapping. |

---

## §1 Baseline (empirical, `reports/..._baseline.json`)

- **Tests**: 504 pass / 69 files. **Targeted** (`explain`, `calc`, `concepts`): 24 pass.
- **svelte-check**: 383 files, **0 errors / 0 warnings**.
- **Behavior today**:
  - Tactics miss → board reset to `puzzle.fen`; `t('tactics.wrong')`; **no solution**; `showLearn` link only on first-exposure/leech.
  - Review miss → board reset; `t('review.missed')`; **no solution**.
  - Calculate submit → `revealSolution()` animates + prints `t('calc.solution',{line})`. **Only surface that reveals today.**
  - Coach result → `<Radar>` only; `GameAnalysis` discarded (CO13).
- **Byte-identity anchors** (must not drift): `explain.test.ts` (EN+FR), `calc.test.ts` (`formatSanLine`), Insights study-plan snapshot (AP-COACH-1), EvalGraph output.

---

## §2 Scope (single concern)

**One concern: make the existing "solution + why" capability reusable and surface it on a Trainer miss.**

**IN**
1. New `src/ui/SolutionReveal.svelte` — animated solution playback (extracted from `Calculate.revealSolution`) + an optional fact-derived "why" line.
2. Refactor `Calculate.svelte` to consume `SolutionReveal` (no behavior change — byte-equivalent reveal).
3. Wire `SolutionReveal` into the **Tactics** and **Review** miss paths (Q-D toggle).
4. A pure helper for the trainer-miss "why": `puzzle.themes → motif idiom` via the existing bilingual catalogue (Q-G).
5. New bilingual strings (Q-F).
6. Enrichments folded (`reports/..._improvements.md`): key-move highlight (FOLD-1), reduced-motion/instant reveal (FOLD-2), short/illegal-line tolerance (FOLD-3), source-agnostic `why?` reuse contract (FOLD-4), pattern-hint framing (FOLD-5).

**OUT (explicit non-goals)**
- Coach game-review consumption (EvalGraph + turning points) → **C6**.
- Any change to `explainPly`, `EvalGraph`, `winCurve`, `criticalMoments`, concept cards, `showLearn`, selection/SRS/`weaknessCounters` (F3), grades, `DB_VERSION`.
- Accepting alternative winning moves / second-try / self-tag loop → **T1** (F4 is the reusable surface T1 builds on).
- No engine call on the trainer path (line is pre-verified).

---

## §3 Pre-flight (gates before Phase A)

- [ ] Confirm baseline reproduces: `npx vitest run` = 504 pass; `npx svelte-check` = 0/0.
- [ ] Confirm `SolutionReveal.svelte` does not exist; `AP-TEACH-*` namespace empty; `reveal.*` keys absent (`reports/..._collision.json`).
- [ ] Ratify §0.5 arbitrages (esp. Q-A extract, Q-C two consumers + Coach deferral, Q-D toggle).
- [ ] Confirm `Board.svelte` prop contract used by Calculate's reveal (`fen`, `orientation`, `viewOnly`, `lastMove`) is stable (it is — read).

---

## §4 Phase A — CODE FIRST

> Order: helper (pure) → component → Calculate refactor → consumers. Code lands before tests (§5) and docs (§7).

### A1 — Pure "why" helper (theme → idiom)
New pure function (no `Date`/`Math.random`/engine), locale injected. Home: `src/concepts/concepts.ts` (already owns theme→family resolution) **or** a small `src/analysis/teachLine.ts` (decide in build; default: `concepts.ts`, reusing `familyKey`/`CARD_PRECEDENCE`).

```ts
/** The single most-relevant motif family for a puzzle's themes (highest precedence), or null. */
export function primaryMotifFamily(themes: string[]): string | null
/** A one-line, fact-honest "why" for a trainer miss, in `locale`:
 *  resolves the primary motif family and renders the existing `motifExpl.*`/`motif.*`
 *  idiom. Returns null when no family resolves (then the component shows the SAN line only). */
export function missWhy(themes: string[], locale: Locale): string | null
```
- Reuses existing bilingual catalogue keys (Q-G); **no new prose content**, only a mapping.
- Honesty: when no high-precedence family resolves, returns `null` → **no asserted reason** (mirrors `explainPly`'s honest fallback discipline; AP-TEACH-2).

### A2 — `src/ui/SolutionReveal.svelte` (the shared surface)
Props (additive, all optional except the line):
```ts
interface Props {
  fen: string;                 // start FEN of the line
  moves: string[];             // UCI solution line (user/opp alternating); may be short/empty
  orientation: 'white'|'black';
  why?: string | null;         // optional fact-derived line; SOURCE-AGNOSTIC (see FOLD-4)
  autoplay?: boolean;          // default true; Calculate=true, Trainer toggled on reveal
  stepMs?: number;             // default 350 (matches Calculate today); 0 = instant
  onDone?: () => void;         // optional callback when playback finishes
}
```
- **Extracts** `Calculate.revealSolution`'s body: build SAN via `new ChessGame(fen)` + `moveUci` per ply → `formatSanLine`; step a second `ChessGame` at `stepMs` reassigning `fen`+`lastMove`; render a **view-only `<Board>`** + the numbered SAN line (`t('calc.solution',{line})`, reused) + the optional `why`.
- **FOLD-1 (render fidelity):** each step sets **`lastMove`** to highlight the key move played, matching the baseline reveal (and ConceptCard's keyMove highlight). The extraction must not drop this.
- **FOLD-2 (a11y / render fidelity):** honor `prefers-reduced-motion` → collapse to an **instant** render of the final position (equivalent to `stepMs=0`, no animation), still printing the full SAN line. `stepMs` is the seam.
- **FOLD-3 (robustness):** tolerate **empty / short (1-ply) / illegal-mid-line** `moves` — render whatever SAN resolves (`moveUci(m) ?? m` fallback, as Calculate does) and stop the stepper cleanly; never throw.
- **FOLD-4 (reuse contract):** `why?` is **source-agnostic** — the **Trainer** passes `missWhy(themes, locale)` (theme-derived); the **Coach (C6)** passes an **`explainPly`-derived** line through the *same* prop. C6 must **not** fork the component for its richer "why".
- Owns its own `setTimeout` chain; **clears on `onDestroy`** (mirrors Calculate's `clearRevealTimer`). UI timing stays in the component (not a pure core) — consistent with the existing pattern.
- Pure-ish: no store reads, no persistence, no engine; fully driven by props.

### A3 — Refactor `Calculate.svelte` to consume `SolutionReveal`
- Replace the inline `revealSolution()` board-stepper + `solutionSan` markup with `<SolutionReveal fen={puzzle.fen} moves={puzzle.moves} orientation={orientation} autoplay />`.
- Keep Calculate's `phase`/grading/metacog exactly as-is. The reveal must remain **byte-equivalent** (same SAN line, same 350 ms cadence, same view-only board). Net: deletes duplicated logic; no behavior change.

### A4 — Wire Tactics miss path (proof consumer #1)
- After a `'wrong'` result (Tactics `onMove`), instead of *only* resetting + `t('tactics.wrong')`, render a **"Show solution"** toggle (`reveal.showSolution`). On tap → mount `<SolutionReveal fen={puzzle.fen} moves={puzzle.moves} orientation={orientation} why={missWhy(puzzle.themes, getLocale())} autoplay />`.
- **Non-blocking & Retry-safe**: the existing board reset + Retry button stay; reveal is opt-in (Q-D) so it never auto-spoils a Retry. `showLearn`/concept card untouched.
- Timed/leech/metacog flows unchanged.

### A5 — Wire Review miss path (proof consumer #2)
- Same one-liner as A4 in Review's `onMove` `'wrong'` branch (`reveal.showSolution` → `<SolutionReveal …>` with `missWhy`). Structurally identical; no Review-specific logic.

### A6 — i18n strings (Q-F)
Add to `src/i18n/messages/tactics.ts`, **FR+EN each** (collision-guarded by `translate.test.ts`):
- `reveal.showSolution` — FR "Voir la solution" / EN "Show solution"
- `reveal.hideSolution` — FR "Masquer la solution" / EN "Hide solution"
- `reveal.why` — FR "Pourquoi :" / EN "Why:"  *(only if the component prefixes the why line; else fold into the line itself)*
- `reveal.themeWhy` — **FOLD-5**: the trainer "why" template, framed as a **pattern hint** (a cue, not a verdict/full analysis), e.g. FR "Motif : {motif} — voilà ce que vous avez manqué." / EN "Pattern: {motif} — that's what you missed." (final wording at build; must read as a hint, distinct from the Coach's engine-backed review).
Reuse `calc.solution` for the SAN line (do **not** redefine).

---

## §5 Tests (after code)

- **Unit (pure, new)** `src/analysis/teachLine.test.ts` or extend `concepts.test.ts`:
  - `primaryMotifFamily` picks highest-precedence family; returns `null` on no-card themes.
  - `missWhy` renders a non-empty FR **and** EN string for a known motif (e.g. `fork`); returns `null` for low-signal themes (honesty — AP-TEACH-2). FR ≠ EN for the same input (parity sanity).
- **Component** `src/ui/SolutionReveal.test.ts` (Svelte testing, mirrors `board-reactivity.test.ts` style):
  - Given `fen`+`moves`, renders the SAN line equal to `formatSanLine` of the line (reuse contract).
  - `autoplay=false` → no board mutation until triggered; `onDestroy` clears the timer (no leak).
  - Renders `why` when provided; omits the why block when `why=null`.
  - **FOLD-3**: empty `moves` and a 1-ply line render without throwing (clean stop); an illegal mid-line UCI falls back to raw and does not crash.
  - **FOLD-1/2**: each step exposes `lastMove`; `stepMs=0` (reduced-motion path) renders the final position immediately with the full SAN line.
- **Regression / byte-identity**:
  - `explain.test.ts`, `calc.test.ts`, `concepts.test.ts` unchanged & green (reuse-only).
  - Calculate reveal SAN line identical to baseline (the extraction is behavior-preserving).

---

## §6 Verification

- [ ] `npx vitest run` → **≥ 504 pass** (new tests add; **0 prior regressions**).
- [ ] `npx svelte-check --tsconfig ./tsconfig.json` → **0 errors / 0 warnings** (matches baseline).
- [ ] `npm run build` green.
- [ ] **i18n parity**: every new key has FR+EN; `translate.test.ts` collision guard green.
- [ ] **Byte-identity**: Insights study-plan snapshot unchanged (AP-COACH-1); `explainPly` EN+FR pins unchanged; EvalGraph untouched.
- [ ] **Manual** (`npm run dev`): Tactics miss → "Show solution" → board animates the real line + SAN + a "why" (FR and EN); Retry still works without spoiler; Review miss identical; Calculate reveal visually unchanged.
- [ ] **No `DB_VERSION` change**; no new persisted fields.

---

## §7 Docs (LAST)

- `decisions.md`: append-only. If Q-E ratifies a decision record, allocate **ADR-0054** (reveal-extraction / teach-surfacing reuse); else a short decisions note referencing ADR-0040/0044. Note F4 lands the shared component + Trainer-miss proof; Coach game-review → C6.
- Update `specs/enhancements-architecture-spec.md` F4 row status → shipped (component + Trainer-miss; Coach deferred to C6) — *doc-only, after code/merge*.
- No README/user-doc churn (additive UI; covered by in-app strings).

---

## §8 Acceptance

1. `SolutionReveal.svelte` exists, prop-driven, no store/engine/persistence; owns + clears its timer.
2. `Calculate.svelte` consumes it; reveal is **byte-equivalent** to baseline (SAN line + 350 ms cadence).
3. **Tactics** and **Review** miss paths offer an opt-in "Show solution" that animates the real line + shows a fact-honest "why" (theme-derived), bilingual, **Retry-safe**, non-blocking.
4. `missWhy` is pure, bilingual, and returns `null` (no asserted reason) when it has no high-precedence fact.
5. 504+ tests green; svelte-check 0/0; build green; i18n parity green; Insights/`explainPly`/EvalGraph byte-identical; no `DB_VERSION` bump.

---

## §9 Anti-patterns (AP-TEACH-)

- **AP-TEACH-1** — *Re-implementing the reveal instead of extracting it.* The 350 ms stepper + SAN-line build exist in `Calculate.revealSolution`; F4 **extracts** them. Do not write a second stepper.
- **AP-TEACH-2** — *Asserting a "why" we didn't derive.* The trainer-miss line is **theme/motif-derived only** and framed as a **pattern hint** (FOLD-5), not a verdict; when no high-precedence family resolves, show **no reason** (`null`), never a generic invented one. (Mirrors `explain.ts` honesty / AP-CHESS-19.)
- **AP-TEACH-3** — *Calling the engine / faking a `PlyAnalysis` on the trainer path.* Puzzle lines are pre-verified; the trainer "why" must not run analysis or fabricate eval facts. `explainPly` is the Coach path (C6) where a real `PlyAnalysis` exists.
- **AP-TEACH-4** — *Auto-spoiling the solution before a Retry.* Reveal is opt-in on a miss (Q-D); resetting + Retry must remain possible without seeing the answer.
- **AP-TEACH-5** — *Concatenating bilingual fragments.* New strings are complete per-locale templates in `tactics.ts` (ADR-0052/0053); reuse `calc.solution`; never build a sentence by gluing translated pieces.
- **AP-TEACH-6** — *Scope creep into T1/C6.* No alt-move acceptance, second-try, self-tag, EvalGraph, or Coach wiring in F4.

---

## §10 Rollback

- Pure-additive + one behavior-preserving refactor. Rollback = revert the PR commit. If only the consumer wiring is suspect, revert A4/A5 (the toggle) and keep A2/A3 (component + Calculate refactor) — Calculate stays byte-equivalent, so partial rollback is safe.
- No data/migration to unwind (no `DB_VERSION` change).

---

## §11 Follow-up (explicitly downstream, not F4)

- **T1** (Trainer feedback core): builds on `SolutionReveal` to add second-try, alt-winning-move acceptance (engine eval), and the self-tag loop (dep F4, F3).
- **C6** (Coach output & teaching): consumes `SolutionReveal` for replay + **EvalGraph + `criticalMoments` turning points** on the Coach result, plus `explainPly` narrative on a real `PlyAnalysis` (dep F4). Per **FOLD-4**, C6 passes its `explainPly`-derived line through `SolutionReveal`'s existing `why?` prop — it must **not** fork the component.
- `SolutionReveal.moves`/`fen` are already arbitrary, so C6's non-puzzle game-review line needs no further prop work.
- **T3**: reveal-usage telemetry (does showing the solution help?) — DEFERRED (no telemetry layer in F4 scope).
