# Arbitrages: i18n-label-routing (F1)

## Critical structural defects (cycle 1 stops)
None. Premise valid; scope corrected (Play dropped — already translated; Insights folded in).

## Decisions requested from user

### Q-A — `focus` display in the Coach program list
`focus` is a mixed field: sometimes a motif key (`fork`), sometimes English prose (`'defend & recover'`, `'opening lines'`). It can't be cleanly translated by the existing resolver.
- (a) **Drop `focus` from the display** — show the localized `activity` label + the already-localized `reason`. — *cheapest, no prose leaks, reason already conveys the detail.*
- (b) Add a `focus.*` label map covering every focus string. — *more work; duplicates info already in `reason`.*
- (c) Normalize `focus` to a key namespace upstream in `program.ts`. — *behavior change in another module → scope creep (AP-I18N-3).*
**Recommendation: (a).**

### Q-B — Trainer theme coverage
`motif.*` has 7 keys; `puzzle.themes` are open-vocabulary Lichess (dozens).
- (a) **Add a common-theme label set (~15-20) + `motifLabelOrRaw` raw fallback** for the long tail. — *covers what users actually see; tail degrades gracefully.*
- (b) Add the full Lichess theme vocabulary. — *large, mostly unseen themes; maintenance burden.*
- (c) Raw fallback only (translate nothing new). — *minimal; common themes still leak.*
**Recommendation: (a).**

### Q-C — Insights `planItem` activity
`insights.planItem` ('{minutes}m · {activity}') also renders raw `activity`.
- (a) **Fold into F1** — translate it here so the foundation PR closes all `activity` leaks at once. — *single concern = "activity/theme display labels", consistent.*
- (b) Keep F1 to Coach+Trainer; defer Insights to its own PR. — *splits one trivial label fix across two PRs.*
**Recommendation: (a).**

### Q-D — Drop Play from scope (informational)
Play opponent-style is already translated (`play.opponentHuman/Engine`). Confirm dropping it from F1.
**Recommendation: accept (it's a non-leak).**

## Auto-applied patches (no user input)
- Scope reframed "route" → "add `activity.*` catalogue + route" (namespaces were missing).
- `activity.*` FR/EN value table added to spec §8.
- AP-I18N-1..5 codified (don't translate routing keys; parity; no program.ts creep; closed-union completeness; Insights data byte-identity).
- Pre-flight added to confirm `insights.planItem` passes raw activity before editing it.

## Stop status
- Cycles run: 4/4 (requested; natural stop = cycle 2 per skip evaluator — recorded in refiner log).
- Stop reason: cycles-exhausted (decreasing returns hit by cycle 3; cycle 4 confirmed convergence).
- Final spec: `specs/i18n-label-routing-spec.md` (V0.4 → V1 on ratification).

## Next steps
1. Reply with decisions (e.g. `Q-A: a, Q-B: a, Q-C: a, Q-D: accept`).
2. I apply them as the final V1 patch to the spec.
3. Then `/enrich i18n-label-routing` (3 cycles) for additive enrichments, then build.
