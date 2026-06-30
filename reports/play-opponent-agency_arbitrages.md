# play-opponent-agency — Arbitrages + Refiner cycles (V0 → V1)

**PR**: P3 opponent agency & realism · **Method**: `/draft-general` 4 refiner cycles · **Date**: 2026-06-30
Baseline: 504 tests / 69 files green, svelte-check 0/0, DB_VERSION 4, latest ADR 0053.

---

## Arbitrages (resolved → applied to V1)

| Q | Decision | Default applied | Why (one line) |
|---|---|---|---|
| **Q-A** Difficulty model | Modes {Adaptive·Easier(−200)·Harder(+200)·Fixed Elo} | Adaptive default | Discrete modes beat a raw slider for a learner; Adaptive default = **zero regression**; recommended by the brief. |
| **Q-B** Bot-resign rule | `botPovCp ≤ −Elo-scaled gate` for N plies, full-strength eval | threshold scaled by bot Elo | Weak bots resign less (human-realistic); sustained deficit avoids noise; recommended. |
| **Q-C** Draw | Player-offer the bot accepts near 0 / declines if winning; **bot-offer DEFERRED** | player-offer first | Ship the high-value half; defer bot-initiated nag-tuning; recommended. |
| **Q-D** Adaptation feedback | One post-game line from `nextOpp` vs `prevOpp` | yes, suppressed for override | Makes the invisible adaptation honest+visible; values already returned by `applyGameResult`; recommended. |
| **Q-E** Override → rating pool | **No** — flagged game, skip the fold | override skips `applyGameResult` | Honesty doctrine (AP-CHESS-13/24): an easy/hard/fixed game must not pollute the adaptive pool/rating; recommended. |
| **Q-F** Increment-in-movetime (PLt) | Add increment to `botMovetime` budget | folded, default 0 preserves callers | A real opponent uses its increment; pure, regression-safe default. |
| **Q-G** Coached threshold (PLt) | Scale `coachEvalBad` gate by bot Elo | `coachedBlunderThreshold(botElo)` | Coached signal proportional to the chosen opponent; ~250 at mid pool = regression-safe. |
| **Q-H** Persist difficulty | `SettingsRecord.difficultyMode?`/`fixedElo?` additive optional | restored on mount | Mirrors `opponentStyle?`/`lastTimeControl`; **no DB_VERSION bump**. |
| **Q-I** Decision home | Pure `src/engine/opponentAgency.ts` | DOM-free, unit-testable | No component-test harness → the realism logic must be pure-core testable (like `playSession.ts`). |

---

## Refiner cycle log

### Cycle 1 — structural defects (premise integrity)
- **D1 (critical, FIXED in V0):** Brief claimed `pickMove returns eval cp`. Code: `pickMove` returns a **uci string** (`res.bestmove`). The resign/draw eval source is `EngineClient.evaluate(fen,{fullStrength:true}).whiteCp`. → Premise correction baked into §0; AP-OPPAGENCY-3 added (must use full-strength eval, not the throttled search).
- **D2 (critical, FIXED):** F6 controller (`src/game/gameSession.ts`) is **drafted not built** (0 matches in src). P3 dep=F6 (architecture §3). → Spec written against the F6 *contract*; F6 declared a hard prerequisite (§0, §3.1); `Play.svelte`-direct fallback documented. No STOP (premise sound; dependency is a sequencing fact, not a wrong premise).
- **D3 (FIXED):** Draw-by-agreement is **not** a `ChessGame.terminal()` reason — surfacing it by faking a terminal reason would corrupt the rules layer + collide with F6's pure `checkTerminal`. → Modelled as a distinct structured end (`reason:'agreement'|'resign'`), kept out of `terminal()`; AP-OPPAGENCY-6 + §4.A3.
- Verdict: no scope-splitting defect; single concern holds. Delta vs V0: large.

### Cycle 2 — honesty + reuse correctness
- **D4 (FIXED):** Q-E honesty path was implicit. Made explicit: `finishGame` branches on `difficultyMode`; override → skip `applyGameResult` fold, still `putGame` flagged. AP-OPPAGENCY-5 + §6 honest-pool check + §5.10 predicate test.
- **D5 (FIXED):** Risk of double engine eval per bot decision (resign + draw). → One full-strength eval per bot decision feeds both deciders (AP-OPPAGENCY-10; mirrors W15 MultiPV-3-not-4 cost lesson).
- **D6 (FIXED):** `botMovetime` increment change could break the 6 existing `playSession.test.ts` cases. → New param defaults to 0 (behaviour-preserving); existing cases stay green; one new case. §4.A1/§5.9.
- Delta vs cycle 1: moderate (honesty + cost discipline tightened).

### Cycle 3 — scope discipline + regression safety
- **D7 (FIXED):** Overlap with P2 (confirm-resign/rematch/takeback/move-list) and F5 (PGN export) and P4 (opening-variety seed). → §2 OUT + AP-OPPAGENCY-7 fence; P3 reuses `ConfirmDialog` for the draw prompt but does not add/alter the player-resign confirm.
- **D8 (FIXED):** Coached-threshold change risks shifting coached behaviour for everyone. → `coachedBlunderThreshold` defaults to ~250 at mid pool (regression anchor in §5.8); AP-OPPAGENCY-1 (Adaptive = no regression) generalized.
- **D9 (FIXED):** F6 no-auto-chain contract (AP-CTRL-8) must be honoured by the resign/draw evaluation. → AP-OPPAGENCY-9 + §4.A3 (evaluation in caller-orchestrated `engineReply`).
- Delta vs cycle 2: smaller (fences + anchors).

### Cycle 4 — polish (diminishing returns)
- **P1:** ADR posture clarified — default **no new ADR** (feature; honesty extends AP-CHESS-13/24); flag **0058** only if PR-time review elevates the realism model. §7 + baseline report.
- **P2:** Purity guard wording aligned with F6 C3-2 (no fake timers/seeded random → determinism from numeric eval cp). §5 + AP-OPPAGENCY-11.
- **P3:** `schemaRev` bump only "if the load path must backfill, else leave" — avoid a gratuitous rev. §4.A6.
- **Diminishing returns reached**: cycle 4 produced only wording/posture polish (no new structural or honesty defects). **Stop at 4 per method.** Delta cycle 3→4 < 10%.

**Net**: 9 defects fixed (3 critical premise/honesty, 6 correctness/scope) + 3 polish. Single concern preserved; additive-no-DB-bump preserved; pure-core testability preserved.

---

## Tunables surfaced (centralized in `opponentAgency.ts` for later tuning)
`DIFFICULTY_OFFSET=200` · `RESIGN_BASE_CP=900` · `RESIGN_PLIES=4` · `DRAW_CP≈30` · `DRAW_PLIES` · Elo-scaling curves for `resignThreshold` and `coachedBlunderThreshold`. All pure; tune against F5 telemetry later (§11).

## User must ratify
1. Difficulty set {Adaptive·Easier·Harder·Fixed} with ±200 offsets (Q-A) — or a different set/offset.
2. Bot-resign Elo-scaling + that very weak bots may **never** resign (Q-B floor).
3. Player-draw-offer now, **bot-initiated draw deferred** (Q-C).
4. Override games **do not** move the rating pool (Q-E) — confirm this honesty stance.
5. ADR posture: **no new ADR** by default (flag 0058 only if realism model is deemed architectural).
