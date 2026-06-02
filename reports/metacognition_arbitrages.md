# Arbitrages — metacognition

Spec: `specs/metacognition-spec.md` · Cycles: 2/3 (cycle 3 skipped — cycle 2 clean, ≤ 8 polish).
**Critical structural defects: none.** All decisions below have a refiner recommendation; defaults are
safe to ship as-is. Reply e.g. `meta Q-A: a, Q-B: a, Q-C: a, …`.

## Decisions requested

### Q-A — Opt-in master switch & default
- (a) `metacogEnabled` setting, **default OFF** — chips never appear unless the player opts in.
- (b) Default ON — more data, but adds chips to everyone's solver.
**Rec: (a).** Protects the active-recall flow (AP-META-4); doctrine favours not slowing the loop.

### Q-B — Calibration metric
- (a) Confidence×accuracy table + threshold verdict ("when sure, right 78%").
- (b) Brier-style single score.
**Rec: (a).** Legible, needs no stats literacy, and a single opaque number reads like a grade — in
tension with AP-META-1 (descriptive, not a grade). Brier → §11/§11-Q-D. Thresholds in (a): overconfident
< 0.60, well-calibrated ≥ 0.80, underconfident = guess-acc ≥ 0.70 (ordered) — tunable.

### Q-C — Where chips live + Calculate persistence
- (a) Tactics + **Calculate**, where Calculate gains a minimal `puzzleAttempts` write (calc attempts are
  currently logged NOWHERE — grep-verified). Review chips deferred (Review doesn't persist an attempt).
- (b) Tactics only — strictly additive, no behaviour change to Calculate.
**Rec: (a).** Calculate is the purest "did you really see it?" surface → confidence there is
high-signal, and the write fixes a latent gap (calc attempts invisible today). **Side effect to accept:**
calc attempts begin counting in history/calibration. If you want zero behaviour change, pick (b).

### Q-D — Self-tag timing: miss-only vs always
- (a) Self-tag **after a miss only**.
- (b) Always (capture "why were you sure?" on solves too).
**Rec: (a).** "Why did I fail?" is where the tag is meaningful; zero friction on solves.

### Q-E — The taxonomy list
Default closed set: `miscalculated · missed-opponent-resource · rushed · unfamiliar-pattern ·
wrong-plan · other`. Trim/extend? (e.g. add `time-pressure`, `tired`.)
**Rec: ship as-is** — ≤ 6 chips keeps the row one tap; `other` is the escape hatch. Keep it a CLOSED set
(AP-META-2).

### Q-F — Chip implementation
- (a) Inline chip markup per view.
- (b) A shared `MetacogChips.svelte` component.
**Rec: (a).** 3 small self-styled views; lowest surface. Extract to (b) if a 4th surface ever needs it.

### Q-G — Where the readout surfaces
- (a) Insights "Calibration" panel.
- (b) A Dashboard tile.
**Rec: (a).** Descriptive self-knowledge already lives in Insights (next to the "not a grade" trend
footnote). Dashboard tile → §11.

### Q-H — Sample-size floor before any verdict
- `minReported`: (a) 10 · (b) 5 (earlier, noisier) · (c) 20 (stabler, slower).
**Rec: (a) 10**, exposed via `calibration(attempts, { minReported })` so it's tunable without code
changes to the core (AP-META-3).

## Auto-applied (no user input needed)
- Optional additive fields only; **no `DB_VERSION` bump** (stays 4), no object store (AP-META-7;
  data-model contract).
- `undefined`/legacy attempts ignored by tallies; all-legacy → empty-but-valid result, no readout
  (AP-META-6).
- Confidence captured DURING `solving` (pre-reveal), never post-result (AP-META-8).
- Readout is a fact-sentence + descriptive verdict word; NO numeric/letter grade; test guards the
  sentence (AP-META-1).
- Self-tag is a fixed closed taxonomy; unknown values bucket under `other` (AP-META-2).
- No new `puzzleAttempts` write except the deliberate Calculate one (Q-C=a); never duplicate Tactics'
  write (AP-META-5).
- Pure core, no Date.now/Math.random; Vitest; phase order code→tests→verify→docs.
- New ADR appended at IMPLEMENTATION time as provisional **ADR-0037** (id confirmed against the batch at
  merge); spec only specifies it.

## Stop status
- Cycles run: 2/3 · stop reason: cycle 2 had 0 critical defects and ≤ 8 polish → cycle 3 skipped per
  draft-general skip-evaluator.
- Cross-spec deps: **none** (ownership disjoint from the other 5 batch-3 specs; no migration conflict).
- V1 ready pending Q-A..Q-H (all defaulted; shippable without changes).
