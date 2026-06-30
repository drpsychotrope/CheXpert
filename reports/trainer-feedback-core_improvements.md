# trainer-feedback-core (T1) — `/enrich` improvements

**Method**: `/enrich` 3 cycles, 8-axis sweep → FOLD / DEFER / REJECT per finding.
**Anti-fabrication**: the FOLD set must not grow for its own sake. 6 enrichments were folded **during drafting** (already in the spec's FOLD set §11). This sweep re-derives them honestly and tests for *genuinely new* ones. Result: **+0 net new FOLDs** beyond the drafted six — the additional axis findings are DEFER/REJECT (correctly downstream or out of scope). An empty *new* set is CLEAN, not a failure.

---

## Axis sweep (3 cycles consolidated)

| Axis | Finding | Verdict | Where |
|---|---|---|---|
| **Robustness** | Alt-check engine timeout/error must default to **miss**, never hang | **FOLD-1** (drafted) | §4 A4, AP-TFEED-3 |
| **Render fidelity** | Leave the **wrong move visible** during the second try (see what you played) | **FOLD-2** (drafted) | §4 A4, Q-B |
| **Symmetry** | TR1 + TR6 to **Review** as well as Tactics | **FOLD-3** (drafted) | §4 A5, FOLD set |
| **Honest framing** | "Different move, equally winning" + hint-not-verdict wording | **FOLD-4** (drafted) | §4 A6, AP-TFEED-3 |
| **Reuse** | `rushed`→reuse `app.tacticsTimed`; `unfamiliar`→reuse `cardForThemes`/`openLearn` | **FOLD-5** (drafted) | §4 A4, AP-TFEED-1/6 |
| **Correctness** | Alt-eval must pass `fullStrength:true` (worker throttle C-1/P0-01) | **FOLD-6** (drafted) | §4 A4, AP-TFEED-3 |
| **Capability gap** | A "near-miss" tier — accept *winning-but-worse-than-mainline by > X cp* with a softer message | **DEFER → T3** | a 2nd acceptance tier risks diluting the puzzle's lesson; needs UX + telemetry first. §11. |
| **Observability** | Telemetry: how often is an alt actually played / accepted? | **DEFER → T3** | no telemetry layer in T1 (matches F4 T3 defer); revisit `altAccepted?` flag (Q-H). §11. |
| **Observability** | Show the *delta* ("your move: +2.4 vs best +2.6") on an accepted alt | **DEFER → C6/T3** | crosses into engine-eval *display* (Coach/EvalGraph territory); honesty-OK but scope creep here. |
| **Extensibility** | Make the second-try budget configurable (settings) | **DEFER → T3** | constructor already parameterized (`retriesLeft`); exposing a setting is a T3 UX add, not core. Q-B(c). §11. |
| **Capability gap** | React to `miscalculated`/`wrong-plan` self-tags too | **REJECT (this PR)** | no clean *single* action exists (would invent a reaction → AP-TFEED-7). Genuinely out; not deferred-with-a-plan. |
| **Symmetry** | Add metacog (selfTag/confidence) UI to **Review** so TR3 works there | **REJECT (this PR)** | that's a *new capture surface* = T2 scope (mode/personalization); T1 reacts only where the signal already exists (PC-3). |
| **Reuse** | Extract a shared "miss panel" component for Tactics+Review | **REJECT** | premature abstraction; the two wirings are a few lines each consuming F4's component. Mirrors the repo's "don't fold concerns to hit a count" lesson (architecture §6). |
| **Honest framing** | Confidence clamp should also *tell* the user why their interval is short | **DEFER → T3** | a nice transparency touch but adds UI + a string set; the clamp itself (silent, correct) is the T1 core. |

---

## Cycle notes
- **Cycle 1** (capability/observability/robustness): confirmed FOLD-1; surfaced the near-miss tier + telemetry + eval-delta → all **DEFER** (downstream, need UX/telemetry). No new core FOLD.
- **Cycle 2** (fidelity/reuse/symmetry): confirmed FOLD-2/3/5; rejected the shared-miss-panel abstraction and the Review-metacog-capture (T2). No new core FOLD.
- **Cycle 3** (extensibility/honest framing): confirmed FOLD-4/6; configurable budget + clamp-transparency → **DEFER → T3**. No new core FOLD.

## Anti-fabrication verdict
- **New FOLDs this sweep: 0.** The six in the spec were folded at draft time and are genuinely load-bearing (robustness, fidelity, symmetry, honesty, reuse, correctness). The sweep's other findings are honestly **DEFER** (good idea, wrong PR / premature) or **REJECT** (no clean action / new surface / premature abstraction). The set did not grow to look thorough. CLEAN.

## Folded into the spec
All six FOLD-1..6 are already reflected in `specs/trainer-feedback-core-spec.md` (§4, §9 AP-TFEED-, and the `/enrich FOLD set` block at the end). DEFER items are listed in §11 Follow-up. No further spec edit required from this sweep.
