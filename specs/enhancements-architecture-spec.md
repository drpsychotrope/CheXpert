# Architecture Spec — Enhancements portfolio (Coach + Trainer + Play)

**Type**: architecture / multi-PR cascade · **ADR**: ADR-0054 (to draft) · **Spec version**: V0
**Drafted**: 2026-06-30 · **Status**: decomposition for ratification (precedes per-PR `/draft-general`)

> This spec is **out of `/draft-general` scope by design** (it is a multi-PR cascade). It exists to
> dedupe/cluster the ~47 enhancement findings produced this session and sequence them into PR-sized,
> dependency-ordered units. **Each leaf PR below is then drafted via `/draft-general` (4 cycles) →
> `/enrich` (3 cycles) → build.** No code changes here; this is a portfolio map.

---

## §0 Context

Three features were assessed this session and produced ~47 raw findings:

- **Coach** — 20 product-depth improvements (`CO1..CO20`) + 10 `/enhance` findings (`CF1..CF10`).
- **Trainer** — 10 `/enhance` findings (`TR1..TR10`).
- **Play** — 7 above-cliff findings + a lower-leverage tail (`PL1..PL10`, `PLt*`).

Raw count is misleading: many findings share a **root cause and a fix surface** (write-only stores,
raw i18n keys leaking, unwired explain/SRS modules, mouse-only boards, triplicated game loops). The
architecture extracts that shared substrate into **foundation PRs** that unblock the per-feature
stacks, so the same wire-up isn't paid three times.

**Doctrine carried into every PR** (existing repo conventions): additive-optional persistence with
**no `DB_VERSION` bump** where possible (mirrors `coachProfile?`/`conceptSeen?`); **honesty posture**
(directional, sample-size-labelled, no single grade — AP-CHESS-13/24); **bilingual FR/EN parity**
(stable routing keys, labels via the catalogue — ADR-0053); pure cores (no `Date`/`Math.random` in
logic modules); Insights/study-plan output stays byte-identical unless a PR explicitly owns it.

---

## §1 Consolidated finding inventory (deduped)

Leverage tiers from the `/enhance` runs (H/M/L). `→PR` = where it folds.

### Coach — original 20 (`CO*`)
| ID | Finding | Tier | →PR |
|---|---|---|---|
| CO1 | Teach/explain (concept cards + annotate played game) | H | C6 |
| CO2 | Schedule + progress trend (show `coachProfilePrev`) | H | C1 |
| CO3 | Goals/intake step (+ metacog input) | M | C5 |
| CO4 | Adaptive probe depth on borderline motifs | M | C2 |
| CO5 | Time-budget toggle (15/30/60) | M | C7 |
| CO6 | Blend played-game history into profile | M | C4 |
| CO7 | Radar n/a axes / game less skippable | M | C2 |
| CO8 | Narrative coaching voice | M | C6 |
| CO9 | Expected-impact prioritization | M | C6 |
| CO10 | Closed loop — session results → profile (efficacy) | H | C7 |
| CO11 | Import real PGN games for assessment | H | C4 |
| CO12 | Designed-position probes (conversion/resilience) | M | C3 |
| CO13 | Surface game review (EvalGraph) in result | M | C6 |
| CO14 | Metacognition/calibration coaching | M | C5 |
| CO15 | Real timed probe (time management) | M | C2 |
| CO16 | Mastery-based program steps | M | C7 |
| CO17 | Opening-specific diagnosis → repertoire line | M | C7 |
| CO18 | Leverage strengths, not only weaknesses | M | C5 |
| CO19 | Staleness / re-assessment nudge | M | C1 |
| CO20 | Funnel: onboarding→coach + surface at right moment | H | C8 |

### Coach — `/enhance` (`CF*`)
| ID | Finding | Tier | →PR |
|---|---|---|---|
| CF1 | Record probe attempts → SRS + weaknessCounters | H | F3 |
| CF2 | Surface saved profile / resume program (write-only) | H | C1 |
| CF3 | Translate program routing keys (i18n leak) | M | F1 |
| CF4 | Mid-assessment pause/resume | M | C8 |
| CF5 | Cross-run comparability (absolute ratings vs deltas) | M | C1 |
| CF6 | Endgame sub-types (coarse `phase:endgame`) | M | C2 |
| CF7 | À-la-carte probe scope selection | M | C2 |
| CF8 | Engine-failure message (silent skip) | L-M | C8 |
| CF9 | Board keyboard/text entry + aria (a11y) | L-M | F2 |
| CF10 | Profile export/share | L | C8 |

### Trainer — `/enhance` (`TR*`)
| ID | Finding | Tier | →PR |
|---|---|---|---|
| TR1 | Show solution + "why" on a miss | H | T1 |
| TR2 | `weaknessCounters` steer selection (write-only→read) | H | F3 |
| TR3 | Self-tag closes loop (card / timed / FSRS clamp) | H | T1 |
| TR4 | Personal-puzzle `meta` provenance surfaced | H | T2 |
| TR5 | Track `usedHint`, clamp grade | M-H | T3 |
| TR6 | Second-try before fail (+ leave wrong move) | M | T1 |
| TR7 | Translate theme keys (i18n) | M | F1 |
| TR8 | Mastery/streak/daily goal + last-trained | M | T3 |
| TR9 | Mode toggle (curated / personal / mixed) + theme picker | M | T2 |
| TR10 | Theme-exhaustion message | L-M | T2 |

### Play — `/enhance` (`PL*`)
| ID | Finding | Tier | →PR |
|---|---|---|---|
| PL1 | Write-only `games` store → `getAllGames` + history | H | F5 |
| PL2 | In-memory analysis → persisted/batch (broken loop) | H | P1 |
| PL3 | In-game move list / notation | M | P2 |
| PL4 | Bot adaptation feedback (Elo delta shown) | M | P3 |
| PL5 | Opening steering symmetry (fill Black book) | M | P4 |
| PL6 | Shared game-session controller (Play/Sparring/Comeback) | M | F6 |
| PL7 | Takeback + on-demand blunder check | M | P2 |
| PL8 | Confirm-before-resign | M | P2 |
| PL9 | Bot resign / accept draw (+ draw-offer UI) | M | P3 |
| PL10 | Rematch button | M-H | P2 |
| PLt | Tail: difficulty control/override, increment-in-movetime, opening-variety seed, PGN export, difficulty-scaled blunder threshold | L/M | P3 / F5 |

---

## §2 Foundation PRs (shared substrate — build first, unblock the rest)

| PR | Goal | Folds | Key reuse hooks | Dep | Size |
|---|---|---|---|---|---|
| **F1 · i18n label routing** | Route every raw routing key shown to the user through the bilingual label catalogue | CF3, TR7, Play activity labels | `gt`, `motifLabelOrRaw` (`i18n/gen.ts:18`) | — | S |
| **F2 · Board input + a11y** | Keyboard/text move entry + aria across all `Board` consumers | CF9, TR10(a11y), Play | `display.resolveMove`/`onMoveText` (Tactics) | — | S-M |
| **F3 · Attempt recording + weakness read-back** | Every solve surface records an attempt; `weaknessCounters` becomes a **read** that steers selection | CF1, TR2, TR3(partial) | `attemptsRepo.recordTacticsAttempt`, FSRS, `PuzzleRepo.next({themes})` | — | M |
| **F4 · Teach/explain surfacing** | Reusable "show solution + why" (animated reveal + fact-derived line) | CO1, CO13, TR1(core) | `Calculate.revealSolution`, `analysis/explain.ts:explainPly`, `EvalGraph` | — | M |
| **F5 · Games store reads + PGN I/O** | `getAllGames`, game-history list, PGN import + export | PL1, CO11(in), PLt(PGN export), CF10(out) | `gamesRepo.putGame`+read, `games.playedAt` index, `pgn.ts`, `runAnalysis(source:'played')` | — | M |
| **F6 · Shared game-session controller** | Extract one controller for Play/Sparring/Comeback (+ Coach designed probes) | PL6 | `playSession.ts` (pure home exists; audit-v2-W12), `AdaptiveOpponent.pickHumanMove` | — | M-L |

Foundation PRs are mutually independent → **draftable/buildable in parallel**.

---

## §3 Feature-stack PRs

### Play (dep: F5, F6)
| PR | Goal | Folds | Dep |
|---|---|---|---|
| **P1 · Loop closure** ✅ shipped | Derived unanalysed-set (F5 reads) + sequential "Analyse all" + opt-in auto-run so steering+puzzles actually fire | PL2 | F5 |
| **P2 · In-game UX** ✅ shipped | Move list, rematch, confirm-resign, takeback + blunder-check (ADR-0058). DEFER to the next Play PR: click-to-preview a ply + ←/→ ply nav (the cursor F2 routed here), alternate-color rematch | PL3, PL10, PL8, PL7 | F2 |
| **P3 · Opponent agency & realism** | Difficulty override, adaptation feedback line, bot resign/draw + draw UI, movetime increment | PL4, PL9, PLt | F6 |
| **P4 · Steering symmetry** | Fill Black-side opening book / color-agnostic steering | PL5 | (CO17 shares book) |

### Trainer (dep: F3, F4)
| PR | Goal | Folds | Dep |
|---|---|---|---|
| **T1 · Feedback core** | Show solution+why on miss; self-tag loop; accept alt-winning moves (engine eval); second-try | TR1, TR3, TR6 | F4, F3 |
| **T2 · Personalization & selection** | weakness-steered mix; personal-puzzle provenance; mode toggle + theme picker; exhaustion msg | TR4, TR9, TR10 | F3 |
| **T3 · Integrity & retention** | `usedHint` + grade clamp; progressive hints; move-time/impulsivity signal; streak/daily goal | TR5, TR8 | F3, metacog |

### Coach (dep: F1, F3, F4, F5, F6)
| PR | Goal | Folds | Dep |
|---|---|---|---|
| **C1 · Profile persistence & surfacing** | Surface saved profile + resume program; trend (prev→current); cross-run comparability; staleness nudge | CF2, CO2, CF5, CO19 | — |
| **C2 · Probe engine v2** | Adaptive depth; endgame sub-types; à-la-carte scope; radar-axis honesty; timed probe | CO4, CF6, CF7, CO7, CO15 | F3 |
| **C3 · Designed-position probes** | Conversion/resilience via seeded scenarios | CO12 | F6, `scenarios.ts` |
| **C4 · Real-data assessment** | Import PGN / blend played history into the profile | CO11, CO6 | F5 |
| **C5 · Intake & metacognition** | Goals/intake step; calibration/metacog coaching; leverage strengths | CO3, CO14, CO18 | metacog, calibration |
| **C6 · Output & teaching** | Narrative voice; concept-card + game-review teaching; expected-impact prioritization | CO8, CO1, CO13, CO9 | F4 |
| **C7 · Program v2** | Time-budget toggle; mastery-based steps; closed-loop efficacy; opening→repertoire routing | CO5, CO16, CO10, CO17 | efficacy.ts, repertoire |
| **C8 · Funnel & robustness** ✅ shipped | onboarding→coach + right-moment surfacing; mid-assessment resume (in-memory, mirrors `activeSession`); engine-fail msg; profile export (JSON, via generalised `downloadText` — closes F5's deferred CF10) | CO20, CF4, CF8, CF10 | F5 |

---

## §4 Dependency DAG & build order

```
Phase 0 — Foundation (parallel):     F1   F2   F3   F4   F5   F6
                                      │    │    │\   │    │\   │
Phase 1 — Quick / low-dep:           C1   P2(◄F2)  \  T1(◄F3,F4)  \
                                                    \              \
Phase 2 — Feature cores:        T2(◄F3)  C2(◄F3)  C6(◄F4)  P1(◄F5)  P3(◄F6)
Phase 3 — Advanced:             C3(◄F6)  C4(◄F5)  C5      C7      T3      P4
Phase 4 — Closure:              C8(◄F5)  + efficacy/loop verification across C7/P1/T3
```

**Recommended PR-1 = F1 (i18n label routing).** Smallest, zero-dep, zero-risk, visible bilingual
fix — ideal to establish the `/draft-general`→`/enrich` cadence before the heavier foundation PRs
(F3/F5/F6). Then F3 → F4 → F5 → F6, then the stacks per phase.

---

## §5 Per-PR cadence (the requested pipeline, applied per leaf)

For each PR in build order:
1. `/draft-general <pr-name>` — **4 refiner cycles** → `specs/<pr-name>-spec.md` + baseline + arbitrages.
2. User ratifies arbitrages.
3. `/enrich <pr-name>` — **3 cycles** (sweep → prune → conditional) → FOLD bundle, ratify, fold into spec.
4. Build (Phase A code → B tests → C verify → Z docs) on a branch off `main`.
5. PR + merge; `session-wrapup` appends ADR/decisions as needed.

Per-PR gates (inherited): `npm test` green (no prior regression), `svelte-check` 0 errors, build green,
honesty/i18n-parity preserved, additive-no-`DB_VERSION`-bump unless the PR explicitly owns a migration.

---

## §6 Cross-cutting risks

- **`DB_VERSION`** — F3 (attempt fields), F5 (game reads), C1 (trend) add optional fields; keep additive
  (`?` + `?? default`) to avoid a migration. Only bump if a non-optional field is unavoidable; document why.
- **i18n parity** — every user-facing string added in any PR needs FR+EN; F1 lands the routing so later
  PRs inherit it (build F1 first to avoid re-leaking keys).
- **Insights byte-identity** — Trainer/Coach selection changes (F3, T2, C2) must not alter the Insights
  study-plan output (AP-COACH-1). Verify with the existing snapshot.
- **Shared-controller blast radius** — F6 touches Play/Sparring/Comeback; land behind its own gate with
  the existing convergence/behaviour tests before the feature PRs depend on it.
- **Scope discipline** — each leaf is SINGLE-concern; if a `/draft-general` cycle-1 flags a leaf as still
  multi-PR, split it (don't fold concerns to hit a count — mirrors the `/enhance` degressive lesson).

## §7 Deferred / out

- A dedicated coach rating pool + Chess960 strengths probe (needs 960 puzzles) — already deferred (coach §11).
- Multi-day calendar scheduling beyond CO2/CO19's in-app nudge.
- Anything requiring server/cloud (the app is local-first PWA) — PGN import stays client-side.

---

## §8 Foundation drafting status — 2026-06-30 (all 6 drafted+enriched, V1)

Each foundation PR has `specs/<pr>-spec.md` (V1) + `reports/<pr>_{target_exists,baseline,collision,arbitrages,improvements}` .

| PR | pr-name | Verdict | Key correction from pre-V0 | FOLD | ADR |
|---|---|---|---|---|---|
| F1 | i18n-label-routing | V1 | Play opponent-style already translated (dropped); Insights `planItem` added; `activity.*`/`focus.*` namespaces missing → created | 4 | none (extends 0053) |
| F2 | board-input-a11y | V1 | `Board.svelte` ALREADY has `onMoveText`+keyboard+aria-live; real gap = region `role`/`aria-label` + 11 unwired instances; dropped Calculate/Vision (square-tap) | 3 | none (extends 0052) |
| F3 | attempt-recording-weakness | V1 | `runAnalysis.ts:67` comment ("counters drive selection") is FALSE; `buildStudyPlan` never reads counters → Insights safe; supersedes audit-v2 W10 "delete counters" | 10 | **0055** |
| F4 | teach-explain-surfacing | V1 | `explainPly` needs engine `PlyAnalysis` a trainer-miss lacks → trainer "why" is theme-derived; `uciToSan` private; extract `SolutionReveal.svelte`; Coach review→C6 | 5 | none |
| F5 | games-store-pgn-io | V1 | PGN export doesn't exist (greenfield helper); `playedAt` index exists → no DB bump; coach PGN-assess→C4, profile export→C8 | 2 | **0056** |
| F6 | game-session-controller | V1 | loop never extracted (`playSession.ts` pure-only); NO auto-chain (coached takeback interposes); new `gameSession.ts`; Play-only migrate, siblings fast-follow | 8 | **0057** |

**Portfolio-wide facts (confirmed independently by ≥2 subagents):**
- **No Svelte component-test harness** (zero `*.svelte.test.ts`; 504 tests are pure/logic). All component-touching PRs verify via pure-core unit tests + static wiring-presence + manual/preview — NOT component tests.
- Baseline anchor: **504 tests / 69 files green, svelte-check 0/0 across 383 files, `DB_VERSION` 4**. No foundation PR bumps `DB_VERSION` (additive doctrine held).
- **ADR reconciliation**: portfolio = **0054**; F3=0055, F5=0056, F6=0057; F1/F2/F4 take no new ADR. (Subagents independently collided on 0054/0055 — resolved here.)
- F1's `labelOrRaw` helper is **drafted, not built** — F2 correctly took no hard dependency; build F1 early so later consumers inherit it.

**Recommended build order (foundation):** F1 (i18n, trivial) → F3 (attempt/weakness, highest leverage) → F4 (teach/explain) → F5 (games/PGN) → F6 (controller refactor, biggest blast radius, land last & parity-tested) → F2 (a11y, independent, any time). F2/F4/F5/F6 are otherwise parallel.

**Foundation drafted (§8 above). Feature layer drafted (§9 below).**

## §9 Feature-layer drafting status — 2026-06-30 (all 15 drafted+enriched, V1)

Each has `specs/<pr>-spec.md` (V1) + 5 reports. **0 STOPs across all 15.** Every subagent corrected its brief from real code.

| PR | pr-name | FOLD | Key pre-V0 correction | Build gate |
|---|---|---|---|---|
| P1 | play-loop-closure | 6 | **playerColor not recoverable from stored PGN** (bare `game.pgn()`) → add `GameRecord.playerColor?` at write | F5 |
| P2 | play-in-game-ux | 2 | move list reads `history()` (Play stores UCI); F2 owns input wiring; takeback un-rates that game (**ADR-0058**) | F2 |
| P3 | play-opponent-agency | 4 | `pickMove` returns uci, not eval → resign uses `evaluate(fullStrength)`; override game skips the rating pool | F6 |
| P4 | opening-steering-symmetry | 6 | book gap is **bidirectional** (3 new lines, chess.js-validated); latent wrong-colour `OPENING_BOOK[0]` bug | — |
| T1 | trainer-feedback-core | 6 | self-tag already stored → **react-only**; alt-move accept needs `fullStrength`+timeout→miss | F3, F4 |
| T2 | trainer-personalization | 4 | F3 seam = contract (guarded); uses `moveUci`; owns `severity.*` | F3 |
| T3 | trainer-integrity-retention | 6 | `streak`→`dailyStreak` (Vision clash); **F3↔T3 co-edit `Tactics.finish()`**; `schemaRev 1→2` | F3 |
| C1 | coach-profile-persistence | 2 | trend on **absolute** ratings (fixes CF5); resume rebuilds program | — |
| C2 | coach-probe-engine-v2 | 11 | seed set mate-only → endgame buckets fall back; radar **already honest** | F3 (recording) |
| C3 | coach-designed-probes | 4 | quantified gap (`MIN_PHASE_PLIES`/`MIN_BEHIND_EPISODES`); dedicated `COACH_PROBES` registry | F6 |
| C4 | coach-real-data-assessment | 6 | `buildWeaknessProfile` already N-game + history unified + **import already exists** → coach just consumes window | F5 |
| C5 | coach-intake-metacognition | 6 | `buildCoachProgram` 3-arg; metacog opt-in gates the line; goal-tuned difficulty rejected | — |
| C6 | coach-output-teaching | 5 | `winCurve`/`criticalMoments` are pure selectors over discarded plies; coach has `PlyAnalysis` → rich `explainPly` | F4 |
| C7 | coach-program-v2 | 7 | toggle must reach **2** call-sites (Coach+Session); opening name in `reason`, not `focus` | efficacy; P4 handoff |
| C8 | coach-funnel-robustness | 8 | 4 premises confirmed; rough-patch reuses persisted `opponentByPool.recent`; in-memory resume mirrors `activeSession`; generic `downloadText` | F5 (soft) |

## §10 Consolidation — build order, ADR ledger, merge hazards, invariants

**Master build order** (foundation first; deps respected):
`F1 → F3 → F4 → F5 → F6` (foundation core) · `F2` any time (independent) ·
then features per gate: `T1`(F3+F4) · `T2,T3`(F3) · `C2`(F3) · `C6`(F4) · `P1,C4`(F5) · `P3,C3`(F6) · `P2`(F2) · `P4,C1,C5,C7,C8` (no hard foundation gate; C8 export soft-reuses F5). C7 consumes P4's completed book (one-way handoff).

**ADR ledger (reconciled):** 0054 portfolio · 0055 F3 · 0056 F5 · 0057 F6 · 0058 P2 (takeback un-rates a game — the one hard feature ADR). All other PRs: **no new ADR by default**; conditional ADRs (C7 mastery model, C8 DB-persist resume, T3 clamp policy) take **0059+ sequentially only if ratified at build**.

**Cross-PR merge hazards (flagged by subagents):**
- **F3 ↔ T3** both edit `Tactics.svelte`; T3 stays out of `loadNext` so the only co-edited fn is `finish()` — merge that hunk carefully (independent additive fields `coachProbe?` vs `usedHint?`).
- **F2 → P2**: F2 ships the board input wiring; P2 adds the move-list/ply-nav on top — P2 must not touch F2's input code.
- **P4 → C7**: P4 owns `OPENING_BOOK`; C7 routes opening names via `reason` and never edits the book.
- **F4 → T1, C6**: `SolutionReveal.svelte` is created by F4; T1/C6 are hard-gated on it.

**Portfolio invariants held by all 21 PRs (6 foundation + 15 feature):** no `DB_VERSION` bump (all additive-optional; T3 uses `schemaRev 1→2` backfill) · Insights study-plan byte-identical (no PR forks `buildStudyPlan`/`buildWeaknessProfile`) · pure cores (no `Date`/`Math.random`) · bilingual FR/EN parity · honesty (directional, sample-size-labelled, no grade, no invented Elo) · verify-via-pure-unit-tests+manual (no component-test harness) · every enrich FOLD set held or shrank across cycles (~115 enrichments folded, zero fabrication). Baseline 504 tests → projected ~514+ post-build.

**Next action:** ratify (build order + ADR ledger), then **build** PR-by-PR from F1, or **commit** the spec portfolio as a checkpoint first.
