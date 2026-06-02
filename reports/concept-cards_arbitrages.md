# Arbitrages — `concept-cards`

**Spec:** `specs/concept-cards-spec.md` · **Date:** 2026-06-02 · Decisions to confirm before implementation. Each has a recommendation; defaults are safe to take.

| Q | Decision | Options | Recommendation | Why |
|---|---|---|---|---|
| **Q-A** | Seed coverage — which motifs get a card | (a) one per detector **family** (7); (b) one per sub-tag too (~12) | **(a) 7 family cards** | Sub-tags (`knightFork`, `mateIn3`, `backRankMate`, `absolutePin`/`relativePin`, `discoveredCheck`) alias to the family card. One `fork` card teaches the idea; no `knightFork` duplicate. Matches the curated-minimal house style. |
| **Q-B** | Leech fail-count threshold **N** | 2 / **3** / 4 | **N = 3** | Third failure of the *same* puzzle = a real leech; rare enough not to nag, early enough to help. Tune later (pure `isLeech` param). |
| **Q-C** | First-exposure tracking location | **PlayerModel.conceptSeen** vs SettingsRecord | **PlayerModel** | It's learning state (lives next to `weaknessCounters`), and is wiped by `clearAllData` with the rest. Additive field, **no DB bump** (scan contract). |
| **Q-D** | Card presentation | **optional link / inline panel** vs blocking modal | **optional link** | Protect the active-recall flow (AP-CC-3 / AP-CHESS-15). Never gate solving or the next puzzle on reading a card. |
| **Q-E** | Example FENs source | **curated seed now** vs derive from the user's own failed puzzles | **curated seed now** | Ships offline + machine-verifiable (seed-puzzles/eco precedent). Personalised derivation is a clean §11 follow-up once a from-attempts FEN source exists. |
| **Q-F** | Concepts index placement | nav library / contextual-only / **both** | **both** | A nav/Dashboard "Concepts" library (the `explorer` precedent) **plus** the contextual "Learn the pattern" links at the two trigger moments. |
| **Q-G** | Seed test depth | legality + key-move only / **+ assert `detectMotif` fires the motif** | **legality + key-move now**; defer detector-fires | Asserting the detector fires couples the asset test to detector internals (and some didactic FENs may be pre-move setups). Legality + key-move legality + coverage==detector-set is the honest, stable guard now. |

## Notes
- All choices are reversible and local; none blocks another batch-3 spec.
- The only one with downstream reach is **Q-C** (PlayerModel field) — but it's additive and owned here;
  no conflict with the `time-controls`-owned PlayerModel reshape (that touches `gameRatings`/
  `opponentByPool`, disjoint from `conceptSeen`; both are migrate-in-load, no version bump).
- **Q-B (N)** and **Q-A (coverage)** are the two recorded in ADR-0040 at implementation.

## Cross-spec dependency (note only)
`metacognition` (batch-3 spec) adds `PuzzleAttemptRecord.selfTag?: string` — a player-applied tag on a
miss. A future enhancement could let a **self-tagged** miss (e.g. the player flags "I keep missing
forks") feed the **leech / first-exposure** trigger directly, complementing the fail-count signal.
**No coupling now** — `concept-cards` keys off detector motifs + fail counts only; this is a §11-class
idea, recorded so the two specs don't diverge.
