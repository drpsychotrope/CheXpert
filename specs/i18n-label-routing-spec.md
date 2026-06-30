# Spec — i18n label routing (foundation PR F1)

**PR**: `i18n-label-routing` · **Scope**: fix (i18n) · **Portfolio**: F1 of `enhancements-architecture-spec.md`
**Drafted**: 2026-06-30 · **Spec version**: V1 (4 refiner cycles + 3 enrich cycles; 4 FOLD applied — `reports/i18n-label-routing_improvements.md`) · **Pre-V0 scan**: PASS
**Extends**: ADR-0053 (bilingual switch). No new ADR (display-only follow-up).

---

## §0 Context

The bilingual catalogue (PR #31, ADR-0053) localizes UI strings, but several surfaces still render
**raw routing/enum keys** straight to the user — a FR user sees `play-steered — openingAccuracy` and
`hangingPiece, discoveredAttack`. This PR routes those displays through the existing label catalogue.
**Display-only**: the underlying keys (which feed routing, e.g. `focus → tacticsFilterThemes`) never change.

Pre-V0 scan corrected the scope: the claimed "Play opponent-style" leak is **already translated**
(`play.opponentHuman/Engine`) and is dropped; a cross-axis pass found **Insights `planItem`** likely
leaks `{activity}` and folds it in. Two namespaces (`activity.*`, `focus.*`) **do not exist** and must
be created — so this is "add the missing labels + route", not merely "route".

## §0.5 Arbitrages — RESOLVED 2026-06-30 (recommended defaults applied; flip any to re-fold)

**Q-A=a** (drop `focus` from display, rely on localized `reason`) · **Q-B=a** (common theme set + raw
fallback) · **Q-C=a** (fold Insights `planItem`) · **Q-D=accept** (drop Play — non-leak). Spec body
reflects these; this is the V1. See `reports/i18n-label-routing_arbitrages.md` for rationale.

- **Q-A `focus` display** — `focus` is a mixed key/prose field. Recommend **(a) drop `focus` from the
  display** and rely on the already-localized `reason` (Coach.svelte:260 shows `activity` label + `reason`).
- **Q-B trainer theme coverage** — `motif.*` covers 7; themes are open-vocabulary. Recommend **(a) add a
  common Lichess-theme label set + `motifLabelOrRaw` raw fallback** for the long tail.
- **Q-C Insights `planItem`** — recommend **(a) fold it into F1** (translate the displayed `activity`
  there too) so the foundation PR closes all activity leaks at once.
- **Q-D Play drop** — confirm dropping Play from scope (informational; already i18n'd).

## §1 Empirical baseline

From `reports/i18n-label-routing_baseline.json` (2026-06-30):

| Fact | Value |
|---|---|
| Confirmed leak sites | `Coach.svelte:260` (activity+focus), `Tactics.svelte:399` (themes), `Insights` `planItem` (activity, verify) |
| Not a leak (dropped) | `Play.svelte:518` opponent-style (already `play.opponent*`) |
| Resolvers (gen.ts) | `gt`, `gtHas`, `motifLabelOrRaw` (motif namespace only) |
| `motif.*` | 7 keys: fork·pin·skewer·hangingPiece·discoveredAttack·mate·endgame |
| `activity.*` / `focus.*` | **0 — missing** |
| `activity` union | tactics·endgames·repertoire·comeback·vision·sparring·play-steered (7) |

## §2 Scope

**In:**
1. **Add `activity.*` catalogue** (7 keys × FR/EN) in `src/i18n/messages/generators.ts` (or the UI catalogue used by `t`), matching the `PlanItem.activity` union exactly.
2. **Coach** (`Coach.svelte:260`) — render `gt('activity.'+item.activity)`; drop `item.focus` from display (Q-A=a) — `reason` already carries localized detail.
3. **Trainer** (`Tactics.svelte:399`) — map `puzzle.themes` through `motifLabelOrRaw` (per Q-B: add a common-theme set + raw fallback).
4. **Insights** (`insights.planItem`) — translate the displayed `activity` (Q-C=a).
5. **Bilingual parity** — every new key FR+EN; extend the parity test.
6. **(FOLD I4) Generic `labelOrRaw(namespace, key, locale)` helper** in `gen.ts` (sibling of `motifLabelOrRaw`), consumed by Coach + Insights (two consumers now) — no per-component inline resolver.
7. **(FOLD I1) Systematic leak sweep** — a pre-flight grep across all components for raw enum rendering; fold trivially-fixable sites (same namespace), DEFER non-trivial ones (§11). Close the leak *class*, not 3 instances.

**Out / deferred:** Play opponent-style (not a leak); changing any routing key or `focus` semantics upstream in `program.ts` (scope creep); full Lichess theme vocabulary (Q-B defers the long tail to raw fallback); non-trivial swept sites needing a new namespace (§11).

## §3 Pre-flight gates (re-verify at exec)

- [ ] `git status` clean on a fresh `i18n-label-routing` branch off `main`.
- [ ] `npm test` + `npm run check` green BEFORE edits (lock baseline).
- [ ] Confirm `Coach.svelte:260` and `Tactics.svelte:399` still render raw keys (lines may drift).
- [ ] Confirm `insights.planItem` passes raw `activity` (validates Q-C); if already labelled, drop #4.
- [ ] Confirm the `PlanItem.activity` union is still the 7 captured values (else add the new one).
- [ ] Locate the parity test (e.g. `concepts.fr-parity.test.ts` sibling for generators) to extend.
- [ ] **(I1) Sweep**: grep components for raw enum rendering — `\.themes\b`, `\.activity\b`, `\.focus\b`, `\.dimension\b` interpolated without a label resolver (check `Review.svelte`, `Dashboard.svelte`, scenario names). List hits; trivial → fold here, non-trivial → §11.

## §4 Phase A — code change (CODE FIRST)

- **A0 (FOLD I4)** `gen.ts`: add `labelOrRaw(namespace, key, locale)` (sibling of `motifLabelOrRaw`: `gtHas(ns+'.'+key) ? gt(ns+'.'+key, locale) : key`). Coach (A2) and Insights (A4) consume it — no inline `gt('activity.'+k)` per component. ~3 lines; no plugin abstraction (AP-ENRICH-7 cap).
- **A1** `generators.ts`: add `activity.tactics|endgames|repertoire|comeback|vision|sparring|play-steered` with FR+EN (table in §8). If `t`-path UI uses a different catalogue than the `gt` generators map, add there and expose via the same resolver Coach/Insights use.
- **A2** `Coach.svelte:260`: replace `<b>{item.activity}</b> — {item.focus}` with `<b>{labelActivity(item.activity)}</b>` (+ keep `reason` meta). `labelActivity` = `gt('activity.'+k, locale)` with raw fallback.
- **A3** `Tactics.svelte:399`: replace `puzzle.themes.join(', ')` with `puzzle.themes.map(th => motifLabelOrRaw(th, locale)).join(', ')` (after Q-B coverage additions).
- **A4** `Insights.svelte`: pass the localized activity label into `insights.planItem` (Q-C).
- **No routing/semantic change.** Keys passed to `tacticsFilterThemes`, session routing, etc. stay raw.

## §5 Phase B — tests

- Unit: `labelActivity`/`motifLabelOrRaw` return localized FR + EN for each key, raw for unknown.
- Parity (FOLD I3): extend the FR/EN parity test to **iterate the real `PlanItem.activity` union** (not a hardcoded list) and assert each value has FR+EN `activity.*` — a future union value added without a label fails the test (future-proof, mirrors coach-mode exhaustiveness gate).
- Regression: a Coach program with `activity:'play-steered'` renders a non-raw FR string; a puzzle with `themes:['hangingPiece']` renders "Pièce en prise" (FR), not "hangingPiece".
- Guard: Insights study-plan DATA (item ordering/minutes) unchanged — snapshot stays identical (AP-COACH-1).

## §6 Phase C — verification (acceptance gates)

- [ ] `npm test` — new + parity tests green; **no prior test regressed**.
- [ ] `npm run check` — svelte-check 0 errors.
- [ ] `npm run build` — green.
- [ ] Manual (FR locale): Coach result program shows translated activities, no `play-steered`/`openingAccuracy`; Trainer theme line shows translated motifs; Insights study plan shows translated activity.
- [ ] Toggle EN — same surfaces show English labels (parity holds).

## §7 Phase Z — docs (LAST)

- `decisions.md`: one line under ADR-0053 follow-ups (no new ADR): "F1 i18n-label-routing — display keys (activity/themes) routed through catalogue; routing keys unchanged." Append-only.
- `enhancements-architecture-spec.md`: tick F1; record Play-dropped + Insights-added scope correction.
- README: no change (internal).

## §8 Acceptance criteria

1. No raw routing/enum key is shown on Coach result, Trainer theme line, or Insights study plan, in either locale. ✅ = manual + regression test.
2. All 7 `activity.*` keys exist with FR+EN; parity test enforces it. ✅
3. Routing unchanged: `focus`/`activity`/theme keys passed downstream are byte-identical. ✅ = grep + Insights snapshot.
4. No `DB_VERSION` bump; no prior test/behaviour regressed. ✅

**`activity.*` values (recommended):**

| key | FR | EN |
|---|---|---|
| tactics | Tactique | Tactics |
| endgames | Finales | Endgames |
| repertoire | Répertoire | Repertoire |
| comeback | Retour au score | Comeback |
| vision | Vision | Vision |
| sparring | Sparring | Sparring |
| play-steered | Partie ciblée | Steered game |

**(FOLD I2) Terminology fidelity:** FR labels must use **standard French chess vocabulary** (fourchette, clouage, enfilade…), consistent with the register already in `motif.*`. Reuse existing FR strings where they overlap; do not invent literal translations that mislead a French player.

## §9 Anti-patterns

- **AP-I18N-1 — Translating the routing key.** Only the DISPLAY is localized; the key passed to routing/filters stays raw. Translating it breaks `tacticsFilterThemes`/session routing.
- **AP-I18N-2 — Half-parity.** Adding EN without FR (or vice-versa). Every key is bilingual; the parity test gates it.
- **AP-I18N-3 — Scope creep into `program.ts`.** Don't "clean up" `focus` to be a key namespace here — that's a behavior change in another module. Display-only.
- **AP-I18N-4 — Silent raw fallback hiding a missing key.** `motifLabelOrRaw` falling back to raw is fine for the open theme tail, but every `activity.*` key MUST exist (closed union) — a raw activity is a bug, not a tail.
- **AP-I18N-5 — Insights data drift.** Touching the label must not reorder/recompute the study plan (AP-COACH-1).
- **AP-I18N-6 — Literal mistranslation.** A FR label that's a literal calque instead of the standard chess term misleads learners. Use the established vocabulary; reuse `motif.*` FR register.

## §10 Rollback

Single branch. All edits are additive (new keys) + display swaps. Revert the 3-4 component edits + the new keys; `npm test && npm run check` returns to baseline. No data/migration involved.

## §11 Follow-up

- Full Lichess theme vocabulary (Q-B long tail) if raw fallback proves visible.
- Non-trivial leak sites found by the §3 sweep that need a NEW namespace (e.g. scenario names) — fixed in their own small PR, consuming the `labelOrRaw` helper landed here.
- (`labelOrRaw` generic helper is now IN scope — promoted from here by enrich FOLD I4.)
