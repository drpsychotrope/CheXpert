# Spec — Phase 4: refinements + loop closure

**Status:** V2 (re-baselined against real code 2026-05-31) · **Scope:** feature bundle → **shipped as one commit per feature** (skill §3.4).
> ✅ **RE-BASELINED.** Verified hooks: `AdaptiveOpponent.pickMove`/`recordGame` (pure, extendable), `WeaknessProfile.weakest: Dimension` (steering signal), `PlyAnalysis` (motif/severity/phase/winProbLoss/bestWhiteCp/mate → NL + guess-the-move). Maia **OUT** (Q-A=b local-only ⇒ no backend ⇒ ADR-0003/0012). Commits, in value order: (1) loop-closure opening steering, (2) NL analysis, (3) Woodpecker, (4) guess-the-move, (5) calc/vision drills.

---

## §0 Context

Phases 1–3 build and retain. Phase 4 (a) **closes the loop** — the opponent finally *reads the weakness profile* and steers games toward the player's gaps — and (b) adds the depth features: natural-language "why", guess-the-move, calculation/visualisation drills, the Woodpecker fixed-set mode, and (if a backend is chosen) Maia as a human-like sparring partner.

## §0.5 Arbitrages — RESOLVED (2026-05-31)

- **Q-B Maia → (a) Stockfish-calibrated only for v1; Maia deferred.** Combined with **Q-A=b (local-only, no distribution)**, there is **no backend in scope**. → **Maia is OUT of Phase 4** unless the user later opts into a backend (which would also re-open the licensing posture — hosting triggers GPL/AGPL). Phase 4 ships the rest client-side. See ADR-0003/ADR-0012.
- **Q-J NL annotation engine → rule-based templates** (per brief: "a light DecodeChess", *not* an LLM) keyed on (motif tag, eval-swing magnitude, phase). An LLM would hallucinate reasons (AP-CHESS-19) and break the local-privacy stance. See ADR-0011.

## §1 Empirical baseline *(capture at exec time)*

- Phase 2 motif/eval data shape (NL templates + guess-the-move read it).
- Phase 2 weakness profile shape (loop-closing opponent reads it).
- Phase 1 `AdaptiveOpponent` hook points (weakness-steering extends it).
- If Maia: lc0 deployment reality — backend process or WASM weights size.

## §2 Scope (split into per-feature specs at execution)

1. **Loop closure — weakness-probing opponent.** Extend Phase 1 `AdaptiveOpponent`: bias openings/structures toward the player's weak dimensions (from the Phase 2 profile) while keeping the ~55% win band. *This is the payoff of the whole architecture.*
2. **NL "analysis explained".** Rule-based templates keyed on (motif, eval-swing, phase) → plain-language "why this move is good/bad". No LLM (Q-J).
3. **Guess-the-move.** Predict the master's move on annotated games; score vs the played move; active recall.
4. **Calculation / visualisation drills.** Blindfold mini-lines, square-colour trainer, knight-vision — with a difficulty ramp.
5. **Woodpecker fixed-set mode.** A fixed puzzle set, timed cycles, faster each pass, to automaticity — complements (does not replace) the FSRS adaptive-variety mode from Phase 3.
6. **Maia (conditional on Q-B backend).** Levels ~1100/1500/1900 via lc0, nodes=1 (no search) → realistic human errors. Caveats to surface in-product: Maia over-knows opening theory for its level and plays endgames too precisely.

## §3 Pre-flight gates

| Gate | Check | Stop-if-fail |
|---|---|---|
| G1 | Phases 1–3 shipped, green | yes |
| G2 | Per-feature spec written before building that feature (split the bundle) | yes |
| G3 | (If Maia) Q-B backend exists; lc0 + Maia weights load and answer at nodes=1 | yes for the Maia sub-feature only |

## §4 Phase A — code (ordered; ship independently)

Build in value order, each behind its own commit/spec:
1. **Loop-closing opponent** (highest value — completes the product thesis).
2. NL annotation templates.
3. Woodpecker mode (reuses the trainer).
4. Guess-the-move.
5. Calc/visualisation drills.
6. Maia (only if backend chosen).

## §5 Phase B — tests

- Opponent weakness-steering: given a profile, opening selection skews toward weak dimensions; win band preserved.
- NL templates: deterministic output for fixture (motif, eval, phase) tuples; never asserts a reason not present in the engine facts.
- Guess-the-move scoring; calc-drill difficulty ramp; Woodpecker timing/cycle logic.
- (If Maia) returns legal, level-plausible moves at nodes=1.

## §6 Phase C — verification

| Gate | Target |
|---|---|
| Loop closure | a player with weakness X sees more positions exercising X, still ~55% win band |
| NL "why" | explanations are rule-derived, never fabricated |
| Each drill | works, ramps, scores correctly |
| (If Maia) | human-like errors at the chosen level; opening/endgame caveats disclosed |

## §7 Phase Z — docs

- `decisions.md` (append): ADR-0010 loop-closure opponent, ADR-0011 NL engine = rule-based (Q-J), ADR-0012 Maia decision + deployment (Q-B). One ADR per feature as each ships.
- README: full feature set; restate the closed-loop thesis and the honesty caveat (personalised-beats-generic is mechanism-plausible, not study-proven — instrument, don't over-claim).

## §8 Acceptance criteria

- [ ] Opponent demonstrably steers toward the player's weaknesses while holding the win band — **the loop is closed**.
- [ ] NL explanations are rule-based and faithful to engine facts.
- [ ] Guess-the-move, calc drills, Woodpecker mode all functional.
- [ ] Maia shipped *iff* a backend was chosen; caveats disclosed in-product.
- [ ] Each feature shipped under its own single-concern spec + commit.

## §9 Anti-patterns

- **AP-CHESS-18** — building Phase 4 as one monolithic PR. Split per feature.
- **AP-CHESS-19** — NL "why" that fabricates reasons (LLM or loose templates). Reasons must derive from engine facts (motif + eval swing).
- **AP-CHESS-20** — Maia's opening-theory over-knowledge / too-precise endgames presented as "human at your level" without disclosure.
- **AP-CHESS-21** — calc/blindfold drills with no difficulty ramp (either trivial or demoralising).
- **AP-CHESS-22** — closing the loop so hard the opponent only ever plays the weakness (breaks the 55% flow band and feels punishing). Bias, don't obsess.

## §10 Rollback

Each feature independently revertable (separate specs/commits). Maia is isolated behind the backend flag — removing it leaves the client-side product intact.

## §11 Follow-up

Post-Phase-4: the telemetry the brief asks for (local, privacy-respecting) to *measure* whether the personalised loop actually beats generic training — the brief's stated honest contribution. Spec that as its own measurement-study feature.
