# Arbitrages — trainer-personalization (T2)

**Drafted** 2026-06-30 · head `9296aff` · method `/draft-general` 4 cycles → defaults applied → V1.
All four resolved to the recommended defaults; flip any to re-fold.

| # | Question | Options | **Default (V1)** | Rationale (one-line) |
|---|---|---|---|---|
| **Q-A** | Provenance display depth | (a) one-line tag · (b) full: pre = your move + severity, post = the missed win | **(b) full** | The standout "from your games" feature is currently mute; all `meta` fields + `moves[0]` already exist — cost is markup + 4 keys, not data. |
| **Q-B** | Mode toggle shape | (a) 2-way · (b) 3-way Mixed/From my games/Curated | **(b) 3-way**, persisted via optional `SettingsRecord.trainerSource?` | Maps 1:1 onto the existing `PuzzleQuery.source` union; optional field ⇒ no `DB_VERSION` bump; "Mixed" stays default. |
| **Q-C** | Theme/difficulty picker scope | (a) theme only · (b) theme + coarse difficulty band | **(b) theme + 3 coarse bands** (Easier/On level/Harder), reusing rating-offset + `window` | Theme reuses `tacticsFilterThemes` (no new routing); difficulty is a pure offset on the existing `next()` query — no new puzzle metadata. Coarse, not a slider (AP-TPERS-7). |
| **Q-D** | Exhaustion behaviour | (a) msg + auto-widen · (b) msg + auto-switch · (c) explicit msg, then offer widen or switch | **(c) explicit, user-chosen** | A silent auto-anything is the TR10 bug; an explicit message with Widen/Switch is honest and never dead-ends. |

## Cross-cutting defaults baked into V1
- **F3 ordering** — build F3 first; T2's weakness-steered "Mixed" *consumes* F3's `steerFromWeakness`
  (T2 never reimplements the bias). If F3 is unmerged, Mixed degrades to plain mixed behind a seam guard
  (build green either way). Matches architecture DAG `T2 ◄ F3`.
- **Theme display** — via shipped `motifLabelOrRaw` (gen.ts:18), NOT the unbuilt F1 `labelOrRaw`. T2 adds
  its own closed `severity.*` namespace (FR/EN, parity-gated).
- **Missed-win SAN** — `moves[0]` is UCI; SAN computed at the call site via `ChessGame`, passed to the
  pure formatter as a string (keeps `provenance.ts` dependency-free).
- **Single concern** — T2 = *solve-path provenance + selection control + honest exhaustion*. Miss-path
  reveal/self-tag/second-try → T1; usedHint/streak → T3; recording + bias core → F3/T1/T3. T2 touches
  neither `finish()`/recording nor `buildStudyPlan` (AP-COACH-1).
- **No `DB_VERSION` bump** — only optional `trainerSource?`; difficulty band session-only.

## Refiner diminishing-returns trace
- **C1**: Q-A/Q-B/Q-D (the load-bearing trio) + single-concern boundary vs T1/T3.
- **C2**: Q-C (coarse band not slider) + F3 ordering pin.
- **C3**: persist-toggle vs session (→ persist, additive); `motifLabelOrRaw` not F1; `severity.*` T2-owned;
  after-solve reads `moves[0]`→SAN.
- **C4**: no new arbitrage — only §2/§4 wording (formatter purity, exhaustion fall-through). **Stop (<10%).**

## What the user must ratify
1. Q-A=b (full provenance) — confirms the markup + 4 strings are wanted vs a cheaper one-liner.
2. Q-B=b + persist `trainerSource?` — confirms the additive setting is acceptable (no bump).
3. Q-C=b coarse difficulty band — confirms scope (not a slider).
4. Q-D=c explicit widen/switch — confirms no silent auto-behaviour.
5. **Build order**: F3 before T2 (or accept the graceful-degrade path if T2 lands first).
