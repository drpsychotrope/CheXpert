# Spec — games store reads + PGN I/O (foundation PR F5)

**PR**: `games-store-pgn-io` · **Scope**: feature (infrastructure) · **Portfolio**: F5 of `enhancements-architecture-spec.md`
**Drafted**: 2026-06-30 · **Spec version**: V1 (4 refiner cycles + 3 enrich cycles; FOLD set applied — `reports/games-store-pgn-io_improvements.md`) · **Pre-V0 scan**: PASS
**New ADR**: ADR-0054 (games store becomes readable + client-side PGN I/O primitive). Append-only to `decisions.md`.

---

## §0 Context

The `games` store is **write-only**: `putGame` (`src/store/gamesRepo.ts:9`) is called once, from `src/ui/Play.svelte:450`, and **read nowhere in `src/`** — only `db.test.ts`/`repos.test.ts` read it back (pre-V0 grep confirmed; `reports/games-store-pgn-io_target_exists.json`). Every game the user plays is persisted and then invisible: no history, no way to revisit, no PGN out, and the only post-game analysis is the *transient* "Analyse this game" on the Play tail (`Play.svelte:456`), lost on navigation.

This is the **infrastructure PR** that turns `games` into a readable asset and lands the **client-side PGN I/O primitive**. It deliberately stops at the primitive + a minimal history surface: the **coach** PGN-assessment consumer (CO11) is a later PR (**C4**), and **play/loop** consumers (P1) come later too. F5 builds the substrate once so those stacks don't each re-pay the read + parse wiring.

**Local-first**: all PGN import/export is **client-side only** — `Blob`/object-URL download out, textarea/file paste in. Nothing leaves the device (consistent with `settings.allowNetwork` posture).

Pre-V0 scan corrected/confirmed three things:
- **PL1 premise CONFIRMED** — `games` is genuinely write-only in `src/`. Proceed.
- **PGN export does NOT exist anywhere** — no `createObjectURL`/`Blob`/`download=` in the whole tree. It is greenfield, and trivial: `GameRecord.pgn` already holds a chess.js-serialised PGN (`game.pgn()` at `Play.svelte:433`), so export is a download wrapper over an existing string — **no re-serialisation**.
- **No DB change needed** — the `games.playedAt` index already exists (created in the v1 upgrade, `db.ts:169-170`). `getAllGames` is a new READ over an existing store + index ⇒ **NO `DB_VERSION` bump** (doctrine satisfied, explicitly justified §1/§3).

## §0.5 Arbitrages — RESOLVED 2026-06-30 (recommended defaults applied; flip any to re-fold)

**Q-A=a** · **Q-B=a** · **Q-C=a** · **Q-D=defer**. Spec body reflects these; this is the V1. Rationale + alternatives in `reports/games-store-pgn-io_arbitrages.md`.

- **Q-A — history-list placement.** Options: (a) a **section inside the existing Import view** (`view 'import'`, `nav.analyse`); (b) inside Play; (c) inside Dashboard; (d) a new top-level view. **Recommend (a).** Import already owns PGN paste + `AnalysisResult` and is reachable from Home (`home.analyseGame`) and nav; a new view costs three coupled edits (`View` union + `App.svelte` `loaders[]` + `NAV[]`) + a new lazy chunk for no benefit. Single concern, zero routing churn. (A one-line entry button from the Play tail → Import history is folded as a convenience, FOLD-G2.)
- **Q-B — PGN import scope.** Options: (a) **single-game paste now, bulk DEFER**; (b) bulk file now. **Recommend (a).** The single-game paste flow already exists and is hardened (multi-game split *detection*, headers-only guard, color-not-detected guard — `Import.svelte:44-77`). F5 reuses it as-is. Bulk file import (multi-game loop, progress, dedupe at scale) is a separate concern → §11.
- **Q-C — does F5 wire coach PGN-assessment (CO11)?** Options: (a) **land the PARSE/IMPORT primitive + a generic "import & analyse a game" entry; coach-assessment integration DEFER to C4**; (b) wire C4 here. **Recommend (a).** F5 owns the *primitive* (`parsePgn` is already the primitive; what's new is making played games readable + PGN out + a re-analyse-from-history entry). Folding coach assessment now violates single-concern and couples F5 to the coach profile schema (C4's job). Hard boundary.
- **Q-D — coach profile export (CF10).** Options: same PR vs C8. **Recommend DEFER to C8.** F5 is games/PGN, not the coach *profile*. CF10 exports a `CoachProfile`, a different artifact with a different consumer; out of scope.

## §1 Empirical baseline

From `reports/games-store-pgn-io_baseline.json` + `_target_exists.json` + `_collision.json` (2026-06-30):

| Fact | Value |
|---|---|
| `games` store readers in `src/` | **0** (write-only; only tests read it) |
| `putGame` callers | 1 — `Play.svelte:450` |
| `games.playedAt` index | **exists** (`db.ts:108` decl, created `db.ts:169-170` v1 upgrade) |
| `GameRecord` fields | `id,pgn,result,botElo,playedAt,coached,timeControl?,variant?,startFen?` |
| Played-game id format | `g:<epoch>` (`Play.svelte:432`) |
| PGN export (any) | **does not exist** (no `Blob`/`createObjectURL`/`download=` in tree) |
| `parsePgn` / `inferPlayerColor` | exist (`analysis/pgn.ts`), already used by `Import.svelte` |
| `runAnalysis(source:'played')` | exists (`runAnalysis.ts:16-83`); idempotency is **caller-side** via `getAnalysis` (see `Play.svelte:461`) |
| `getAnalysis(gameId)` | exists (`gamesRepo.ts:19`) → `GameAnalysis \| undefined` (the analysed/not marker) |
| `AnalysisResult.svelte` | exists; consumed by Import + Play tail (reusable) |
| Tests baseline | **504 passed / 69 files** |
| `svelte-check` baseline | **0 errors / 0 warnings / 383 files** |
| `DB_VERSION` | 4 — **no bump in F5** |
| i18n parity test | structural (`Message = Record<Locale,string>`) + cross-domain collision guard (`translate.test.ts`) |

Symbol/key/view collisions: **none** (`getAllGames`, `history.*`, `exportPgn`, a `history` view — all absent).

## §2 Scope (single concern: make `games` readable + client-side PGN I/O)

**In:**
1. **`getAllGames()`** in `src/store/gamesRepo.ts` — `db.getAllFromIndex('games','playedAt')` (chronological; reverse client-side for newest-first). Returns `GameRecord[]`. Mirrors `attemptsRepo` read style. **No new store/index → no `DB_VERSION` bump.**
2. **Game-history section in `Import.svelte`** (Q-A=a) — list played games newest-first: date (from `playedAt`), result, bot Elo, time control / `chess960` badge, and an **analysed / not-analysed** marker derived from `getAnalysis(game.id)`. Empty-state message when none. (FOLD-G1: batch the analysed-marker lookups — see §4.)
3. **PGN export (download)** — a small client-side helper `downloadPgn(pgn: string, filename: string)` (new file `src/ui/pgnDownload.ts` or inline util) using `Blob` + object URL + `revokeObjectURL`. Affordances: a **"Export PGN"** action **per history row** AND on the **Play tail** when a game just finished (FOLD-G2 places it next to "Analyse this game"). Filename derived from `GameRecord.playedAt` + `result` (e.g. `game-2026-06-30-win.pgn`) — **not** `Date.now()` (purity/testability).
4. **Re-analyse-from-history entry** (Q-C=a, the "import & analyse a game" primitive made reachable) — each *non-960*, *not-yet-analysed* history row gets an **"Analyse"** action that runs `runAnalysis(source:'played')` for that `game.id`, idempotent via `getAnalysis` (reuse the Play-tail pattern `Play.svelte:456-492`; extract a shared helper if it reduces duplication, else call-through). Result rendered via the existing **`AnalysisResult.svelte`**. 960 games keep the analyse action disabled (existing AP-960-4 rationale; `Play.svelte:625-629`).
5. **Bilingual strings** — every new label FR+EN in `src/i18n/messages/play.ts` (history.* sub-namespace; the Import view's keys live in `import.*`/`play.*` already). Parity test passes by construction.

**Out / deferred (→ §11):**
- **Coach PGN-assessment integration (CO11/C4)** — F5 lands the primitive only (Q-C). Hard boundary.
- **Coach profile export (CF10/C8)** (Q-D).
- **Bulk / multi-game file import** (Q-B) — single-game paste only (reuse existing).
- **Imported-games history** (the `importedGames` store) — F5's history is **played** games (PL1). A second read is trivial but a distinct concern; defer unless it folds for free.
- **Delete-a-game / manage history**, pagination — not needed at current volume; defer.
- **In-memory→persisted analysis loop closure (PL2/P1)** — F5 makes games readable; *auto-queueing* unanalysed games is P1.

## §3 Pre-flight

- Confirm baseline green: `npm test` (expect 504/504) + `npm run check` (expect 0/0).
- Re-grep to confirm no `getAllGames`/`downloadPgn`/`history.*` introduced meanwhile (collision guard).
- Confirm `games.playedAt` index is present at runtime (it is — v1 upgrade). **Assert no `DB_VERSION` change in the diff** (doctrine gate).
- Confirm `GameRecord.pgn` is non-empty for played games (it is — `game.pgn()` at write). Export needs no fallback, but the helper should no-op/disable on an empty string (defensive).

## §4 Phase A — CODE FIRST

1. **`gamesRepo.ts`** — add:
   ```ts
   export async function getAllGames(): Promise<GameRecord[]> {
     const db = await openTrainerDB();
     return db.getAllFromIndex('games', 'playedAt'); // ascending by playedAt
   }
   ```
   (Caller reverses for newest-first; keep the repo a thin index read.) Import `GameRecord` type (already imported in the file).
   **FOLD-G1 (batch analysed markers):** add `export async function getAnalyzedGameIds(): Promise<Set<string>>` → `new Set((await db.getAllKeys('gameAnalyses')))` so the history list resolves analysed/not in **one** read instead of N `getAnalysis` calls. (`gameAnalyses` is keyed by `gameId`.)
2. **PGN download util** — `src/ui/pgnDownload.ts`:
   ```ts
   export function pgnFilename(playedAt: number, result: string): string { /* game-YYYY-MM-DD-<result>.pgn from playedAt */ }
   export function downloadPgn(pgn: string, filename: string): void { /* Blob → URL.createObjectURL → a.click() → revokeObjectURL */ }
   ```
   `pgnFilename` is **pure** (date derived from the `playedAt` arg via `new Date(playedAt)` formatting — no `Date.now()`), unit-testable. `downloadPgn` is the DOM side-effect (guarded for SSR/jsdom: feature-detect `URL.createObjectURL`).
3. **`Import.svelte`** — add a `<section>` history block:
   - on mount (and after a re-analyse), `getAllGames()` + `getAnalyzedGameIds()`; render newest-first.
   - per row: localized date (`fmtNum`/`Intl` via locale), result, `botElo`, TC/960 badge, analysed marker, **Export PGN** button (`downloadPgn(game.pgn, pgnFilename(game.playedAt, game.result))`), and **Analyse** button when not-analysed and not 960.
   - **Analyse** → reuse the played-analysis helper; on done, set the existing `result`/`AnalysisResult` panel and refresh the analysed set.
   - empty state: `t('history.empty')`.
4. **`Play.svelte`** (FOLD-G2, minimal) — add an **Export PGN** ghost button next to "Analyse this game" in the `status==='over' && lastGame` block (`Play.svelte:619-623`), calling `downloadPgn(lastGame.pgn, …)`. (Played-game export at the natural moment; no new view.)
5. **i18n** — add `history.*` keys (title, empty, analysed, notAnalysed, export, analyse, playedOn, resultWin/Loss/Draw, vs) to `src/i18n/messages/play.ts`, FR+EN; add an `play.exportPgn` (or `import.exportPgn`) label.

**Order:** repo read → util (+ its test) → Import section → Play button → i18n. Code compiles green before any doc edit.

## §5 Tests

- **`gamesRepo` (extend `repos.test.ts`)**: `getAllGames` returns inserted games ordered by `playedAt`; empty when none; `getAnalyzedGameIds` returns the set of ids present in `gameAnalyses` and excludes games with no analysis. (Uses `resetDb` + fake-indexeddb, same as existing.)
- **`pgnDownload` (new `pgnDownload.test.ts`)**: `pgnFilename(playedAt,result)` is deterministic for a fixed epoch (no `Date.now`), includes the result, ends `.pgn`, and sanitises unsafe chars. `downloadPgn` feature-detects (no throw when `URL.createObjectURL` absent).
- **i18n parity**: covered by the existing structural test (every new `history.*` key has fr+en by construction) — assert it still passes; no test rewrite needed.
- **No regression**: full `npm test` stays at ≥504 passing (new tests add to it).
- **Insights byte-identity**: F5 touches no selection/studyPlan logic → existing Insights snapshot unaffected (assert untouched files).

## §6 Verification

1. `npm test` — green, count = 504 + new tests, **0 failures**.
2. `npm run check` — **0 errors / 0 warnings** (383 + new files).
3. `npm run build` — green.
4. **Manual smoke**: play+finish a game → it appears in Import history newest-first with "not analysed"; click **Analyse** → `AnalysisResult` renders, marker flips to "analysed", puzzles fold (existing pipeline); click **Export PGN** (history row + Play tail) → a `.pgn` file downloads and re-loads in chess.js; switch FR/EN → all new labels flip; a 960 game shows in history with the Analyse action disabled.
5. **Doctrine gates**: diff contains **no `DB_VERSION` change**, no new store/index; no server/network call; every new user string has fr+en.

## §7 Docs (LAST)

- **`decisions.md`** — append **ADR-0054** (games store readable + client-side PGN I/O primitive; Q-A=a section-in-Import, Q-B=a single-game, Q-C=a primitive-only/coach-deferred-to-C4, Q-D=defer-to-C8; no `DB_VERSION` bump; cross-link ADR-0022 (Play one-click analysis), the Phase-2 import flow, and `enhancements-architecture-spec.md` F5). Append-only; do not edit D001–D051 or prior ADRs.
- **`specs/enhancements-architecture-spec.md`** — mark F5 status (drafted→shipped) in §2 when merged (light touch; the portfolio map owns cross-PR status).
- No README change required (no new top-level concept for the user beyond the history section, which is self-describing).

## §8 Acceptance

- [ ] `getAllGames()` + `getAnalyzedGameIds()` exist in `gamesRepo.ts`, index-backed, tested.
- [ ] `games` store is now READ in `src/` (history section) — PL1 closed.
- [ ] Import view shows a played-game history (newest-first; date/result/Elo/TC/960; analysed marker; empty state) — bilingual.
- [ ] PGN export downloads a valid `.pgn` from a history row AND the Play tail (client-side; filename from `playedAt`).
- [ ] Re-analyse-from-history runs `runAnalysis(source:'played')`, idempotent via `getAnalysis`, renders `AnalysisResult`; disabled for 960.
- [ ] No `DB_VERSION` bump; no new store/index; no network.
- [ ] `npm test` ≥504 green · `npm run check` 0/0 · `npm run build` green.
- [ ] Insights output byte-identical (no selection/studyPlan change).
- [ ] Coach PGN-assessment NOT wired (C4 boundary held); profile export NOT here (C8).
- [ ] ADR-0054 appended; F5 status updated.

## §9 Anti-patterns (AP-GAMES-)

- **AP-GAMES-1** — bumping `DB_VERSION` for a read. The `playedAt` index already exists; a new read MUST NOT trigger a migration.
- **AP-GAMES-2** — re-serialising PGN on export. `GameRecord.pgn` is already a valid PGN; export downloads the stored string verbatim.
- **AP-GAMES-3** — N+1 analysed-marker lookups. Resolve analysed/not via one `getAllKeys('gameAnalyses')` set (FOLD-G1), not per-row `getAnalysis`.
- **AP-GAMES-4** — adding a new top-level `history` view. Attach to Import (Q-A); no `View`-union/NAV churn.
- **AP-GAMES-5** — wiring coach PGN-assessment (CO11) or profile export (CF10) into F5. Boundary belongs to C4 / C8.
- **AP-GAMES-6** — `Date.now()` in the filename/util core. Derive the date from `GameRecord.playedAt` so the helper is pure/testable.
- **AP-GAMES-7** — offering Analyse on a `chess960` game. Keep disabled (AP-960-4).
- **AP-GAMES-8** — leaking imported games into the played-history read. `getAllGames` reads ONLY the `games` store; `importedGames` is separate and out of scope.
- **AP-GAMES-9** — a server/network round-trip for import/export. Strictly client-side.
- **AP-GAMES-10** — untranslated history/export labels (FR-only or EN-only). Every new string is a fr+en `Message`.

## §10 Rollback

Additive and isolated. To revert: drop `getAllGames`/`getAnalyzedGameIds`, the `pgnDownload` util + its test, the Import history `<section>`, the Play-tail export button, and the `history.*` keys. No schema/migration was introduced (nothing to undo in IndexedDB). `putGame` and all existing flows are untouched. ADR-0054 stays in `decisions.md` (append-only) annotated as reverted if needed.

## §11 Follow-up

- **C4** — coach PGN-assessment consumer: blend imported/played history into the `CoachProfile` (CO11/CO6). Consumes F5's primitive.
- **P1** — loop closure: persist + auto-queue the last unanalysed game so steering/puzzles fire without a manual click (PL2). Builds on `getAllGames`.
- **Bulk file import** (Q-B deferred) — multi-game `.pgn` upload with a progress loop + dedupe at scale.
- **Imported-games history** — surface the `importedGames` store alongside played games (one extra read).
- **CF10 / C8** — coach profile export/share (distinct artifact).
- **History management** — delete a game, pagination, search/filter by result/opening, when volume warrants.
