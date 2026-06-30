# Enrichments — games-store-pgn-io (F5)

**PR**: `games-store-pgn-io` · **Drafted**: 2026-06-30 · **Method**: `/enrich` 3 cycles, 8-axis sweep
**Discipline**: FOLD (integrate now) / DEFER (good idea, wrong PR or premature) / REJECT (violates scope/causality).
**ANTI-FABRICATION**: an axis with nothing genuine is marked **CLEAN** — the FOLD set must not grow to hit a number.

**Outcome: 2 FOLD · 6 DEFER · 3 REJECT · 4 CLEAN axes.** FOLDs are folded into `specs/games-store-pgn-io-spec.md`.

---

## 8-axis sweep

### Axis 1 — Capability gap
- **FOLD-G1 — batch the analysed/not marker** via `getAnalyzedGameIds()` (`getAllKeys('gameAnalyses')` → Set) instead of N `getAnalysis` calls. Without it the history list is N+1 reads. Real capability + perf. (Folded §2.2/§4.1; AP-GAMES-3.)
- **FOLD-G2 — Export PGN on the Play tail**, not only in history. The game just finished is the highest-intent moment to export; the history row alone forces a detour. One ghost button next to "Analyse this game" (`Play.svelte:619-623`). (Folded §2.3/§4.4.)
- **DEFER — auto-queue unanalysed games (loop closure)**: making games readable invites "analyse all / auto-queue". That's **P1 (PL2)** by the portfolio DAG. Don't fold (couples F5 to the play loop).
- **DEFER — imported-games history**: a second read over `importedGames`. Trivial but a distinct concern; §11.

### Axis 2 — Observability
- **CLEAN.** F5 is a read + a download + a reachable existing pipeline. No new long-running/async surface that warrants progress/telemetry beyond what `runAnalysis` already emits (`onProgress`, reused). The Import re-analyse reuses the existing progress bar. Adding metrics here would be fabricated scope.

### Axis 3 — Fidelity of rendering
- **DEFER — richer history rows** (opening name via `describeOpening`, ACPL when analysed, result-coloured chips). `describeOpening` is async per game (`AnalysisResult.svelte:38`) → N async calls on the list = the N+1 trap again, and opening naming is a *display* nicety, not the PL1 concern. Defer to a history-polish follow-up; V1 shows date/result/Elo/TC/960 + analysed marker (honest, cheap).
- Note: 960 badge + disabled-Analyse IS in V1 (correct fidelity for the honest 960 boundary).

### Axis 4 — Robustness
- **REJECT (already covered) — PGN parse hardening on import.** The single-game paste already handles malformed (`parsePgn` throws → caught), multi-game (split + notice), headers-only (guard), color-not-detected (guard). F5 reuses it verbatim; re-specifying is fabrication.
- **Folded into §3/§4 (not a new FOLD, just correctness):** `downloadPgn` feature-detects `URL.createObjectURL` (jsdom/SSR safety) and no-ops on an empty `pgn`. This is baseline correctness of the new util, already in the spec — not an inflated enrichment.

### Axis 5 — Reuse
- **CLEAN (maximised, nothing new to fold).** History "open analysis" reuses `AnalysisResult.svelte`; re-analyse reuses `runAnalysis(source:'played')` + the `getAnalysis`-idempotency pattern from `Play.svelte`; the read mirrors `attemptsRepo` style; new keys go in the existing `play` domain. The spec already extracts the played-analysis helper only *if* it reduces duplication (call-through otherwise) — correct restraint. No additional reuse exists to harvest.

### Axis 6 — Extensibility
- **DEFER — `getRecentGames(n)` / paginated read.** YAGNI at current volume; `getAllGames` + client slice suffices. A bounded/indexed read is the right shape *when* history grows (cursor on `playedAt`). §11.
- **REJECT — generic `exportGame(format)` abstraction** (PGN/FEN/JSON). Only PGN is needed and `GameRecord.pgn` already exists; a format-registry is speculative generality. Single concern: PGN.

### Axis 7 — Symmetry
- **DEFER — import symmetry (file ⇄ paste) and export symmetry (single ⇄ bulk).** F5 is paste-in / download-out per game. Bulk file import (Q-B) and bulk export (a "download all games" zip/concat) are the symmetric extensions — both deferred together so the symmetry lands as one coherent later PR, not half here.
- **CLEAN on the played/imported axis:** F5 deliberately scopes to *played* games (PL1); imported-games read is the symmetric counterpart, already DEFERred (Axis 1) — not re-counted.

### Axis 8 — Honest framing
- **REJECT (guard, not fold) — calling F5 "PGN import"** in user-facing copy. The *import primitive* already exists (`parsePgn` + the Import paste). What F5 genuinely adds is: (1) played games become **readable** (PL1), (2) **PGN export** (new), (3) a **re-analyse-from-history** entry. Copy/ADR must say that, not over-claim a new importer. Locked in §0 + ADR-0054 wording + AP-GAMES-5 (boundary).
- **CLEAN otherwise:** no honesty debt introduced; 960 limitation surfaced, sample-size/grading claims untouched, no network.

---

## FOLD set (folded into the V1 spec)
| ID | One-line | Axis |
|---|---|---|
| **FOLD-G1** | Batch analysed/not via `getAnalyzedGameIds()` (`getAllKeys`) — kill the N+1 | Capability gap |
| **FOLD-G2** | Export PGN on the Play tail (highest-intent moment), not history-only | Capability gap |

## DEFER set (good, wrong PR / premature)
- Auto-queue unanalysed games → **P1** (loop closure).
- Imported-games history (`importedGames` read) → §11.
- Richer history rows (opening/ACPL/chips) → history-polish follow-up (avoids N async `describeOpening`).
- `getRecentGames(n)` / paginated cursor read → when volume warrants.
- Bulk file import (Q-B) → §11.
- Bulk export ("download all") → with the import-symmetry PR.

## REJECT set (scope / causality)
- PGN parse re-hardening — already covered by the existing Import flow (reused).
- Generic `exportGame(format)` registry — speculative; only PGN needed.
- Re-branding F5 as "PGN import" — over-claim; the import primitive pre-exists.

## CLEAN axes (anti-fabrication — nothing genuine to add)
- **Observability** · **Reuse** (already maximised) · partial **Symmetry** (played/imported counterpart already deferred) · **Honest framing** (no debt beyond the guard).
