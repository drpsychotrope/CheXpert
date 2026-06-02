# Concept Cards (Teach-Before-Test) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship curated, worked-example "concept cards" — one per confidently-detected motif family — surfaced at two honest teaching moments (first exposure to a motif, and when a puzzle becomes a leech), as an optional non-blocking link that never interrupts the active-recall loop.

**Architecture:** A committed seed asset (`public/concepts/concepts.json`) holds 7 hand-authored cards (mate, hangingPiece, fork, pin, skewer, discoveredAttack, doubleCheck), each with 2-3 chess.js-legal examples. A pure module `src/concepts/concepts.ts` (modeled on `eco.ts`) provides `cardForMotif`/`cardForThemes` lookup with a sub-tag alias table plus a graceful `loadConcepts()` fetch loader. Two pure helpers extracted from `srs/schedule.ts` (`failCountByPuzzle`, `isLeech`) feed the leech trigger; first-exposure is tracked via an additive `PlayerModel.conceptSeen?: string[]` (no DB bump). `Tactics.svelte` resolves the current puzzle's card and shows a "Learn the pattern" link on either trigger; `ConceptCard.svelte` renders a card (read-only boards), and `Concepts.svelte` is the browsable library wired into nav.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite, IndexedDB via `idb`, chess.js 1.4.0 (legality assertions in tests), Vitest. No new dependency. No LLM. Client-only.

---

## Conventions, doctrine & guardrails (read once before Task 1)

- **NO LLM, CURATED content.** Cards are hand-authored static data. Never generate idea text or examples at runtime/build (AP-CC-1; extends ADR-0007/0015/0020).
- **Honesty.** Cards exist ONLY for motifs `detectMotif` emits with `confidence:'high'`. The seed test asserts `coverage == detector family set` (AP-CC-2).
- **Pure cores.** No `Date.now`/`Math.random` in `concepts.ts` lookup, alias table, or the two `schedule.ts` helpers. UI/caller injects time. Vitest only.
- **Additive field → NO `DB_VERSION` bump.** `DB_VERSION` stays `4`. `conceptSeen?: string[]` is migrated in the load path with `?? []`. No `upgrade()` case, no new object store (AP-CC-6).
- **Non-blocking.** Loading the next puzzle is NEVER gated on a card; a `null` card simply shows no link (AP-CC-3 / AP-CHESS-15).
- **One fail-count definition.** `failCountByPuzzle` is the single source; `buildLapseSet` is re-implemented on top of it with **byte-identical output** (AP-CC-7).
- **No real `public/**` fetch in tests.** The seed test reads the committed JSON from disk via `readFileSync(new URL(...))`. The fetch loader is only ever exercised through an injected `fetchFn` (the `PuzzleRepo.test.ts` precedent).
- **Phase order:** code → tests → verify → docs. The ADR (provisional **ADR-0040**) is the FINAL task.
- **Commands:** `npx vitest run <file>` (single suite), `npm test` (all), `npm run check` (svelte-check), `npm run build`.
- **Commit message style (per task):** `feat: concept cards — <task summary>` ending with the repo co-author trailer. Commit only the files listed in each task's **Files** block.

### Shared modify targets — FLAG FOR THE EXECUTOR

These files are touched by multiple tasks and/or are owned by other in-flight specs. Edit additively; do not reorder or rewrite existing logic.

| File | Tasks | Nature of change |
|---|---|---|
| `src/store/db.ts` | 4 | Add ONE optional field to `PlayerModel`. **Do NOT touch `DB_VERSION` or `upgrade()`.** (time-controls also reshapes `PlayerModel` — keep your line additive and independent.) |
| `src/store/playerModel.ts` | 4 | Seed `conceptSeen: []` in `freshPlayerModel`; the load path returns the record as-is (consumers read `?? []`). |
| `src/srs/schedule.ts` | 3 | Extract `failCountByPuzzle`, add `isLeech`; re-implement `buildLapseSet` on top **without changing its output**. |
| `src/state/app.svelte.ts` | 6 | Add `'concepts'` to the `View` union (additive arm). |
| `src/ui/App.svelte` | 6 | Add a `{:else if app.view === 'concepts'}` branch + a nav button + the import. |
| `src/ui/Tactics.svelte` | 5, 6 | Add card resolution + leech fail-count read + first-exposure tracking (Task 5) and the "Learn the pattern" link UI (Task 6). |
| `decisions.md` | 7 | Append ADR-0040 at EOF (append-only). |

### Detector contract (verified — cards key off this, unchanged)

`src/analysis/motif.ts` `detectMotif` emits these high-confidence theme keys:
`mate`, `mateIn1..3`, `backRankMate`, `hangingPiece`, `fork`, `knightFork`, `pin`, `absolutePin`, `relativePin`, `skewer`, `discoveredAttack`, `discoveredCheck`, `doubleCheck` (plus low-confidence `${phase}Mistake` fallbacks and magnitude tags `crushing`/`advantage` which resolve to NO card).

The 7 **family** keys that get a card (Q-A): `mate`, `hangingPiece`, `fork`, `pin`, `skewer`, `discoveredAttack`, `doubleCheck`.

Sub-tags alias to a family (Q-A): `mateIn1`/`mateIn2`/`mateIn3`/`backRankMate` → `mate`; `knightFork` → `fork`; `absolutePin`/`relativePin` → `pin`; `discoveredCheck` → `discoveredAttack`.

**Precedence** for `cardForThemes` (mate first, then the in-code `motif.ts` list `['doubleCheck','fork','skewer','pin','discoveredAttack','hangingPiece']`): `mate > doubleCheck > fork > skewer > pin > discoveredAttack > hangingPiece`.

---

## Task 1 — Seed asset `public/concepts/concepts.json`

Ship the curated, offline, machine-verifiable card content (one card per detectable motif family; 2-3 examples each). Every FEN parses, has the **solver to move**, and every `keyMove` is a legal UCI move in that FEN that demonstrates the motif. **All 17 examples below were pre-verified legal with chess.js (parse + legal move + opponent-not-already-in-check + not game-over).** This task only writes the file; the legality guard test lands in Task 2.

**Files:**
- `public/concepts/concepts.json` (new)

**Steps:**

- [ ] 1.1 Create `public/concepts/concepts.json` with EXACTLY this content (do not alter FENs or key moves — they are verified):

```json
{
  "version": 1,
  "license": "CC0. Curated didactic positions + text. Compatible with the Lichess puzzle DB (CC0).",
  "cards": [
    {
      "motif": "mate",
      "title": "Checkmate (incl. back-rank)",
      "idea": "Attack the enemy king so it has no legal move. A king trapped on its back rank by its own pawns is the classic pattern.",
      "examples": [
        { "fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", "keyMove": "e1e8", "why": "Back-rank mate: the king is boxed in by its own pawns; Re8# along the open file ends it." },
        { "fen": "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", "keyMove": "d1d8", "why": "Same idea with the queen: Qd8# delivers mate on the undefended back rank." },
        { "fen": "6k1/R7/1R6/8/8/8/8/6K1 w - - 0 1", "keyMove": "b6b8", "why": "Ladder mate: Rb8# while the rook on a7 covers the 7th rank — the king has no escape square." }
      ]
    },
    {
      "motif": "hangingPiece",
      "title": "Hanging piece (free material)",
      "idea": "An undefended enemy piece can simply be taken. Always scan for pieces your opponent left unprotected.",
      "examples": [
        { "fen": "6k1/5ppp/8/8/8/n7/5PPP/R3R1K1 w - - 0 1", "keyMove": "a1a3", "why": "The knight on a3 is undefended; Rxa3 wins a whole piece for nothing." },
        { "fen": "6k1/5ppp/8/r7/8/8/5PPP/R5K1 w - - 0 1", "keyMove": "a1a5", "why": "The rook on a5 hangs; Rxa5 wins a full rook." }
      ]
    },
    {
      "motif": "fork",
      "title": "Fork (double attack)",
      "idea": "One piece attacks two targets at once; the opponent can save only one. Knights and pawns fork especially well.",
      "examples": [
        { "fen": "6kr/8/8/4N3/8/8/8/6K1 w - - 0 1", "keyMove": "e5f7", "why": "Knight fork: Nf7+ checks the king and attacks the rook on h8 — after the king moves, take the rook." },
        { "fen": "3r2k1/8/8/4N3/8/8/5PPP/6K1 w - - 0 1", "keyMove": "e5f7", "why": "Same knight fork against king and rook: Nf7 hits g8 (check) and d8 at once." },
        { "fen": "4k3/3r1n2/8/4P3/8/8/8/4K3 w - - 0 1", "keyMove": "e5e6", "why": "Pawn fork: e6 attacks the rook on d7 and the knight on f7 simultaneously — one of them falls." }
      ]
    },
    {
      "motif": "pin",
      "title": "Pin (absolute & relative)",
      "idea": "A piece can't (or shouldn't) move because a more valuable piece — or the king — sits behind it on the same line.",
      "examples": [
        { "fen": "4k3/8/2n5/8/8/8/8/5BK1 w - - 0 1", "keyMove": "f1b5", "why": "Absolute pin: Bb5 pins the knight on c6 to the king on e8 — the knight is frozen." },
        { "fen": "4k3/8/8/4n3/8/8/8/R5K1 w - - 0 1", "keyMove": "a1e1", "why": "Absolute pin on the file: Re1 pins the knight on e5 to the king on e8." },
        { "fen": "4r1k1/8/8/3n4/8/8/8/5BK1 w - - 0 1", "keyMove": "f1c4", "why": "Relative pin: Bc4 pins the knight on d5 — moving it would lose material along the diagonal." }
      ]
    },
    {
      "motif": "skewer",
      "title": "Skewer (the reverse pin)",
      "idea": "Attack a valuable piece on a line; when it steps aside, capture the less valuable piece behind it. The king is often the front piece.",
      "examples": [
        { "fen": "4q3/8/8/8/4k3/8/8/R5K1 w - - 0 1", "keyMove": "a1e1", "why": "Re1+ skewers the king on e4 to the queen on e8 — the king must move, then Rxe8 wins the queen." },
        { "fen": "8/8/8/q3k3/8/8/8/6KR w - - 0 1", "keyMove": "h1h5", "why": "Rh5+ skewers the king on e5 to the queen on a5 along the rank; the king steps off and Rxa5 wins the queen." }
      ]
    },
    {
      "motif": "discoveredAttack",
      "title": "Discovered attack (incl. discovered check)",
      "idea": "Move one piece to unveil an attack from the piece behind it. When the unveiled attack is a check, the moving piece can grab material with tempo.",
      "examples": [
        { "fen": "6k1/8/8/8/6N1/8/8/6RK w - - 0 1", "keyMove": "g4e5", "why": "Ne5 steps off the g-file and discovers check from the rook on g1 — a discovered check, and the knight lands actively." },
        { "fen": "7k/8/8/4N3/8/8/8/B5K1 w - - 0 1", "keyMove": "e5c4", "why": "Nc4 unveils the bishop on a1, giving check along the long diagonal to the king on h8 while the knight escapes with tempo." }
      ]
    },
    {
      "motif": "doubleCheck",
      "title": "Double check",
      "idea": "Two pieces give check at once — one moving, one discovered. The king MUST move; nothing can block or capture both checkers.",
      "examples": [
        { "fen": "6k1/8/8/8/6N1/8/8/6RK w - - 0 1", "keyMove": "g4f6", "why": "Nf6+ checks the king on g8 and simultaneously discovers the rook on g1 — double check, so the king is forced to move." },
        { "fen": "7k/8/8/4N3/8/8/8/B5K1 w - - 0 1", "keyMove": "e5g6", "why": "Ng6+ checks the king on h8 and discovers the bishop on a1 along the diagonal — double check; only a king move is legal." }
      ]
    }
  ]
}
```

- [ ] 1.2 Sanity-check the file is valid JSON and has exactly 7 cards / 17 examples: `node -e "const c=require('./public/concepts/concepts.json'); console.log('cards', c.cards.length, 'examples', c.cards.reduce((n,x)=>n+x.examples.length,0));"` → expect `cards 7 examples 17`. (No code, no test yet — the legality assertion is Task 2.5.)
- [ ] 1.3 Commit: `feat: concept cards — curated seed asset (7 family cards)`.

> **Note for the executor (optional, NOT in scope for a passing build):** Spec §4.1 mentions an optional `scripts/build-concepts.mjs` ETL (mirroring `scripts/build-eco.mjs`) that re-validates every card through chess.js and rewrites the JSON. The seed test in Task 2 is the authoritative guard, so the script is **not required**. If you add it later, wire `"etl:concepts": "node scripts/build-concepts.mjs"` in `package.json` and have it drop/fail-loudly on any invalid example. Do not block this plan on it.

---

## Task 2 — Pure loader + lookup `src/concepts/concepts.ts` (+ unit tests + seed legality test)

Build the pure lookup (`cardForMotif`/`cardForThemes` + alias table) and the graceful fetch loader, modeled on `eco.ts`. Tests come first (TDD): a pure in-memory-fixture suite, then the disk-read seed legality/coverage guard.

**Files:**
- `src/concepts/concepts.ts` (new)
- `src/concepts/concepts.test.ts` (new — pure, in-memory fixture)
- `src/concepts/concepts.seed.test.ts` (new — reads the committed JSON from disk)

**Steps:**

- [ ] 2.1 Write the FAILING pure unit test `src/concepts/concepts.test.ts` (full code):

```ts
import { describe, it, expect } from 'vitest';
import {
  cardForMotif,
  cardForThemes,
  type ConceptCard,
} from './concepts';

// In-memory fixture (the eco.test.ts pattern — pure functions take the table).
const CARDS: ConceptCard[] = [
  { motif: 'mate', title: 'Mate', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
  { motif: 'hangingPiece', title: 'Hanging', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
  { motif: 'fork', title: 'Fork', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
  { motif: 'pin', title: 'Pin', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
  { motif: 'skewer', title: 'Skewer', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
  { motif: 'discoveredAttack', title: 'Discovered', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
  { motif: 'doubleCheck', title: 'Double check', idea: 'x', examples: [{ fen: 'f', keyMove: 'a1a2', why: 'w' }] },
];

describe('cardForMotif', () => {
  it('resolves a direct family key', () => {
    expect(cardForMotif('fork', CARDS)?.motif).toBe('fork');
    expect(cardForMotif('mate', CARDS)?.motif).toBe('mate');
    expect(cardForMotif('hangingPiece', CARDS)?.motif).toBe('hangingPiece');
  });

  it('resolves every sub-tag alias to its family card', () => {
    expect(cardForMotif('knightFork', CARDS)?.motif).toBe('fork');
    expect(cardForMotif('mateIn1', CARDS)?.motif).toBe('mate');
    expect(cardForMotif('mateIn3', CARDS)?.motif).toBe('mate');
    expect(cardForMotif('backRankMate', CARDS)?.motif).toBe('mate');
    expect(cardForMotif('absolutePin', CARDS)?.motif).toBe('pin');
    expect(cardForMotif('relativePin', CARDS)?.motif).toBe('pin');
    expect(cardForMotif('discoveredCheck', CARDS)?.motif).toBe('discoveredAttack');
  });

  it('returns null for an unknown or empty motif', () => {
    expect(cardForMotif('middlegameMistake', CARDS)).toBeNull();
    expect(cardForMotif('crushing', CARDS)).toBeNull();
    expect(cardForMotif('', CARDS)).toBeNull();
  });
});

describe('cardForThemes (precedence: mate > doubleCheck > fork > skewer > pin > discoveredAttack > hangingPiece)', () => {
  it('picks the highest-precedence theme that resolves to a card', () => {
    expect(cardForThemes(['fork', 'crushing'], CARDS)?.motif).toBe('fork');
    // hangingPiece is lowest precedence → pin wins.
    expect(cardForThemes(['hangingPiece', 'pin'], CARDS)?.motif).toBe('pin');
    // mate beats everything.
    expect(cardForThemes(['fork', 'mate'], CARDS)?.motif).toBe('mate');
    // doubleCheck beats fork.
    expect(cardForThemes(['fork', 'doubleCheck'], CARDS)?.motif).toBe('doubleCheck');
    // sub-tags resolve through the alias table, honoring family precedence.
    expect(cardForThemes(['knightFork', 'absolutePin'], CARDS)?.motif).toBe('fork');
  });

  it('returns null when no theme resolves to a card', () => {
    expect(cardForThemes(['middlegameMistake', 'crushing'], CARDS)).toBeNull();
    expect(cardForThemes([], CARDS)).toBeNull();
  });
});
```

- [ ] 2.2 Run it — expect FAIL (module/exports do not exist yet): `npx vitest run src/concepts/concepts.test.ts`.

- [ ] 2.3 Write the minimal implementation `src/concepts/concepts.ts` (full code):

```ts
// Curated concept cards (teach-before-test, ADR-0040). One card per high-confidence
// motif FAMILY the detector emits (mate, hangingPiece, fork, pin, skewer,
// discoveredAttack, doubleCheck). Pure lookup + a graceful fetch loader, mirroring
// src/opening/eco.ts. CURATED static content only — never generated (no LLM).

export interface ConceptExample {
  /** Legal FEN with the SOLVER to move. */
  fen: string;
  /** A legal UCI move in `fen` that demonstrates the motif. */
  keyMove: string;
  /** One-line explanation of why the move shows the pattern. */
  why: string;
}

export interface ConceptCard {
  /** A detector-emitted FAMILY theme key (mate/hangingPiece/fork/pin/skewer/discoveredAttack/doubleCheck). */
  motif: string;
  title: string;
  /** 1-2 sentence plain-English idea. */
  idea: string;
  /** 2-3 worked examples. */
  examples: ConceptExample[];
}

/** Sub-tag → family-card key. Sub-tags share the family card (Q-A). */
export const MOTIF_ALIASES: Record<string, string> = {
  mateIn1: 'mate',
  mateIn2: 'mate',
  mateIn3: 'mate',
  backRankMate: 'mate',
  knightFork: 'fork',
  absolutePin: 'pin',
  relativePin: 'pin',
  discoveredCheck: 'discoveredAttack',
};

/**
 * Detector precedence (ADR-0020): mate is most forcing, then the in-code motif.ts
 * order. Used by cardForThemes to pick the single most relevant card for a puzzle.
 */
export const CARD_PRECEDENCE: string[] = [
  'mate',
  'doubleCheck',
  'fork',
  'skewer',
  'pin',
  'discoveredAttack',
  'hangingPiece',
];

/** Canonicalize a raw theme/motif key to its family key (via the alias table). */
function familyKey(motif: string): string {
  return MOTIF_ALIASES[motif] ?? motif;
}

/** Pure: the card for a motif or any of its sub-tags, or null. */
export function cardForMotif(motif: string, cards: ConceptCard[]): ConceptCard | null {
  if (!motif) return null;
  const key = familyKey(motif);
  return cards.find((c) => c.motif === key) ?? null;
}

/**
 * Pure: the card for a puzzle's themes — the highest-precedence theme (after alias
 * resolution) that has a card. This is the puzzle→card entry point. Returns null when
 * no theme resolves to a card (e.g. only a low-confidence fallback tag).
 */
export function cardForThemes(themes: string[], cards: ConceptCard[]): ConceptCard | null {
  const families = new Set(themes.map(familyKey));
  for (const fam of CARD_PRECEDENCE) {
    if (families.has(fam)) {
      const card = cards.find((c) => c.motif === fam);
      if (card) return card;
    }
  }
  return null;
}

// --- runtime loader (bundled JSON; mirrors eco.ts + PuzzleRepo) ---------------
type Fetcher = (url: string) => Promise<Response>;
let cache: ConceptCard[] | null = null;

/**
 * Fetch + cache the committed seed. Returns [] on ANY failure — a missing/broken
 * asset must never break Tactics (the "Learn the pattern" link simply won't appear).
 * `fetchFn` is injectable for tests; the seed asset itself is validated by the
 * disk-read test (concepts.seed.test.ts), NOT through this loader.
 */
export async function loadConcepts(fetchFn: Fetcher = (u) => fetch(u)): Promise<ConceptCard[]> {
  if (cache) return cache;
  try {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    const res = await fetchFn(`${base}concepts/concepts.json`);
    if (!res.ok) {
      cache = [];
    } else {
      const data = (await res.json()) as { cards?: ConceptCard[] } | ConceptCard[];
      cache = Array.isArray(data) ? data : (data.cards ?? []);
    }
  } catch {
    cache = [];
  }
  return cache;
}

/** Test-only: reset the module cache between cases. */
export function __resetConceptsCacheForTests(): void {
  cache = null;
}
```

- [ ] 2.4 Run — expect PASS: `npx vitest run src/concepts/concepts.test.ts`.

- [ ] 2.5 Write the FAILING seed legality + coverage test `src/concepts/concepts.seed.test.ts` (full code). It reads the **real committed JSON from disk** (NOT via `loadConcepts`) and asserts every example is chess.js-legal, side-to-move matches the key move, and coverage == the detector family set:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { CARD_PRECEDENCE, type ConceptCard } from './concepts';

// Read the committed asset straight from disk — no fetch, no loadConcepts (no repo
// test fetches a real public/** asset; PuzzleRepo.test.ts injects a fake fetchFn).
const raw = readFileSync(new URL('../../public/concepts/concepts.json', import.meta.url), 'utf8');
const data = JSON.parse(raw) as { version: number; cards: ConceptCard[] };
const cards = data.cards;

// The high-confidence motif FAMILIES detectMotif emits and we ship a card for (Q-A).
// (mate, doubleCheck, fork, skewer, pin, discoveredAttack, hangingPiece — = CARD_PRECEDENCE.)
const DETECTOR_FAMILIES = new Set(CARD_PRECEDENCE);

describe('concepts.json seed asset', () => {
  it('parses and is non-empty', () => {
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('has exactly one card per detector-emitted motif family (coverage == detector set; no fabricated patterns)', () => {
    const motifs = cards.map((c) => c.motif);
    // No duplicates.
    expect(new Set(motifs).size).toBe(motifs.length);
    // Every card covers a real detector family (honesty — AP-CC-2).
    for (const m of motifs) expect(DETECTOR_FAMILIES.has(m)).toBe(true);
    // Coverage is exactly the detector family set.
    expect(new Set(motifs)).toEqual(DETECTOR_FAMILIES);
  });

  it('has 2-3 examples per card', () => {
    for (const card of cards) {
      expect(card.examples.length).toBeGreaterThanOrEqual(2);
      expect(card.examples.length).toBeLessThanOrEqual(3);
    }
  });

  it('every example FEN is legal, with the side-to-move playing a legal key move (AP-CC-4)', () => {
    for (const card of cards) {
      for (const ex of card.examples) {
        // (a) FEN parses.
        const chess = new Chess(ex.fen);
        // (b) The key move's mover is the side to move (UCI from-square holds that side's piece).
        const fromSq = ex.keyMove.slice(0, 2) as Parameters<typeof chess.get>[0];
        const piece = chess.get(fromSq);
        expect(piece, `${card.motif}: no piece on ${fromSq} in ${ex.fen}`).toBeTruthy();
        expect(piece!.color, `${card.motif}: ${ex.keyMove} not by side-to-move in ${ex.fen}`).toBe(chess.turn());
        // (c) The key move is legal in that FEN.
        const legal = chess
          .moves({ verbose: true })
          .some((m) => m.from + m.to + (m.promotion ?? '') === ex.keyMove || m.from + m.to === ex.keyMove);
        expect(legal, `${card.motif}: illegal key move ${ex.keyMove} in ${ex.fen}`).toBe(true);
      }
    }
  });
});
```

- [ ] 2.6 Run — expect PASS (the Task 1 seed was pre-verified against exactly these assertions): `npx vitest run src/concepts/concepts.seed.test.ts`.
  - If it FAILS: the asset was altered. Re-verify each failing example with `new Chess(fen)` + `.moves({verbose:true})` and fix the FEN/keyMove (NOT the test) until coverage == `DETECTOR_FAMILIES` and every move is legal.

- [ ] 2.7 Commit: `feat: concept cards — pure loader + lookup with alias table + seed legality test`.

---

## Task 3 — Extract `failCountByPuzzle` + add `isLeech` in `src/srs/schedule.ts`

DRY the fail-count tally: extract the count loop already inside `buildLapseSet` into a reusable `failCountByPuzzle`, re-implement `buildLapseSet` on top of it (byte-identical output), and add the pure `isLeech` predicate. The leech trigger and the "Your misses" set must share ONE definition (AP-CC-7).

**Files:**
- `src/srs/schedule.ts` (modify — shared target)
- `src/srs/schedule.test.ts` (new — there is currently no dedicated `schedule.test.ts`; `interleave`/`buildLapseSet` are exercised elsewhere. This adds focused coverage for the extraction + new helpers.)

**Steps:**

- [ ] 3.1 Write the FAILING test `src/srs/schedule.test.ts` (full code). It pins the regression (`buildLapseSet` output unchanged) and the new helpers:

```ts
import { describe, it, expect } from 'vitest';
import { buildLapseSet, failCountByPuzzle, isLeech, type AttemptLike } from './schedule';

const attempts: AttemptLike[] = [
  { puzzleId: 'a', solved: false },
  { puzzleId: 'a', solved: false },
  { puzzleId: 'a', solved: false }, // a: 3 fails
  { puzzleId: 'b', solved: false },
  { puzzleId: 'b', solved: true }, // a solved attempt does NOT count
  { puzzleId: 'c', solved: true }, // c never fails → absent
];

describe('failCountByPuzzle', () => {
  it('counts only failures, keyed by puzzleId', () => {
    const m = failCountByPuzzle(attempts);
    expect(m.get('a')).toBe(3);
    expect(m.get('b')).toBe(1);
    expect(m.has('c')).toBe(false); // no failures → not present
    expect(m.size).toBe(2);
  });

  it('matches the tallies buildLapseSet ranks by', () => {
    const m = failCountByPuzzle(attempts);
    // a (3) ranks above b (1).
    expect([...m.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id)).toEqual(['a', 'b']);
  });
});

describe('buildLapseSet (output unchanged after extraction — regression)', () => {
  it('ranks puzzles by failure count, ties broken by id, sliced to k', () => {
    expect(buildLapseSet(attempts, 2)).toEqual(['a', 'b']);
    expect(buildLapseSet(attempts, 1)).toEqual(['a']);
  });

  it('breaks ties deterministically by ascending id', () => {
    const tied: AttemptLike[] = [
      { puzzleId: 'z', solved: false },
      { puzzleId: 'y', solved: false },
    ];
    expect(buildLapseSet(tied, 2)).toEqual(['y', 'z']);
  });

  it('returns an empty set when there are no failures', () => {
    expect(buildLapseSet([{ puzzleId: 'c', solved: true }], 5)).toEqual([]);
  });
});

describe('isLeech', () => {
  it('is true at or above the threshold, false below', () => {
    expect(isLeech(3, 3)).toBe(true);
    expect(isLeech(4, 3)).toBe(true);
    expect(isLeech(2, 3)).toBe(false);
    expect(isLeech(0, 3)).toBe(false);
  });
});
```

- [ ] 3.2 Run — expect FAIL (`failCountByPuzzle`/`isLeech` not exported): `npx vitest run src/srs/schedule.test.ts`.

- [ ] 3.3 Edit `src/srs/schedule.ts`. Keep `interleave` and `AttemptLike` exactly as-is. Replace the `buildLapseSet` block with the extraction + new helpers (full replacement for lines 25-36 of the current file):

```ts
/** Failure tally per puzzle id (the single source of truth for "most-failed"). Pure. */
export function failCountByPuzzle(attempts: AttemptLike[]): Map<string, number> {
  const fails = new Map<string, number>();
  for (const a of attempts) {
    if (a.solved) continue;
    fails.set(a.puzzleId, (fails.get(a.puzzleId) ?? 0) + 1);
  }
  return fails;
}

/** The `k` puzzles you fail most (any source), ranked by failure count (a "your misses" set). */
export function buildLapseSet(attempts: AttemptLike[], k: number): string[] {
  const fails = failCountByPuzzle(attempts);
  return [...fails.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    .slice(0, k)
    .map(([id]) => id);
}

/** A puzzle is a "leech" once it's been failed at least `threshold` times (Q-B: N=3). Pure. */
export function isLeech(failCount: number, threshold: number): boolean {
  return failCount >= threshold;
}
```

  (The sort/slice/map in `buildLapseSet` is byte-identical to the original; only the inline count loop moved into `failCountByPuzzle`.)

- [ ] 3.4 Run — expect PASS: `npx vitest run src/srs/schedule.test.ts`.
- [ ] 3.5 Run the broader SRS suite to confirm no regression in `buildLapseSet` consumers: `npx vitest run src/srs`.
- [ ] 3.6 Commit: `feat: concept cards — extract failCountByPuzzle + isLeech (DRY with buildLapseSet)`.

---

## Task 4 — Additive `PlayerModel.conceptSeen` field (NO DB bump)

Add the first-exposure tracking field. **`DB_VERSION` stays `4`; no `upgrade()` case; no object store** (AP-CC-6). Old records read `?? []`.

**Files:**
- `src/store/db.ts` (modify — shared target; touch ONLY the `PlayerModel` interface)
- `src/store/playerModel.ts` (modify — shared target; seed in `freshPlayerModel`)
- `src/store/playerModel.test.ts` (new — there is no dedicated test today; this asserts the additive field + the no-bump invariant)

**Steps:**

- [ ] 4.1 Write the FAILING test `src/store/playerModel.test.ts` (full code):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { freshPlayerModel, loadPlayerModel, savePlayerModel } from './playerModel';
import { DB_VERSION, openTrainerDB } from './db';
import { resetDb } from '../test/resetDb';

describe('PlayerModel.conceptSeen (additive, no DB bump)', () => {
  beforeEach(resetDb);

  it('does NOT bump the schema version (still v4)', () => {
    expect(DB_VERSION).toBe(4);
  });

  it('freshPlayerModel seeds conceptSeen to an empty array', () => {
    const m = freshPlayerModel(1000);
    expect(m.conceptSeen).toEqual([]);
  });

  it('persists and reloads conceptSeen entries', async () => {
    const m = freshPlayerModel(1000);
    m.conceptSeen = ['fork', 'mate'];
    await savePlayerModel(m, 2000);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.conceptSeen).toEqual(['fork', 'mate']);
  });

  it('an OLD record lacking conceptSeen loads, and consumers read it as [] via ?? []', async () => {
    // Simulate a pre-feature record written without conceptSeen.
    const db = await openTrainerDB();
    const legacy = freshPlayerModel(1000) as Record<string, unknown>;
    delete legacy.conceptSeen;
    await db.put('playerModel', legacy as never);
    const loaded = await loadPlayerModel(3000);
    expect(loaded.conceptSeen ?? []).toEqual([]);
  });
});
```

- [ ] 4.2 Run — expect FAIL (`conceptSeen` not on the type / not seeded): `npx vitest run src/store/playerModel.test.ts`.

- [ ] 4.3 Edit `src/store/db.ts` — add ONE optional field to the `PlayerModel` interface (additive; do not touch `DB_VERSION`, `upgrade()`, or any store). Insert after the `weaknessCounters` line:

```ts
  /** Nascent weakness counters keyed by theme — Phase 2 fleshes this out. */
  weaknessCounters: Record<string, number>;
  /** Resolved motif keys whose concept card has already been offered at first-exposure
   *  (ADR-0040). Additive; old records lack it and read `?? []`. NO DB_VERSION bump. */
  conceptSeen?: string[];
```

- [ ] 4.4 Edit `src/store/playerModel.ts` — seed the field in `freshPlayerModel`. Insert after the `weaknessCounters: {},` line:

```ts
    weaknessCounters: {},
    conceptSeen: [],
```

  (No change to `loadPlayerModel` — it already returns the stored record as-is; consumers read `model.conceptSeen ?? []`.)

- [ ] 4.5 Run — expect PASS: `npx vitest run src/store/playerModel.test.ts`.
- [ ] 4.6 Commit: `feat: concept cards — additive PlayerModel.conceptSeen (no schema bump)`.

---

## Task 5 — First-exposure + leech triggers in `Tactics.svelte` (the cycle-1 fix; INDEPENDENT logic)

Wire the two **independent** triggers into the Tactics solve loop. This task adds the data/logic plumbing in `Tactics.svelte`; the link MARKUP lands in Task 6 (kept separate so the wiring is reviewable on its own). Key first-exposure off the **resolved card motif** (`card.motif`), not raw themes (so a `knightFork` puzzle and a `fork` puzzle share one first-exposure, and a no-card puzzle never burns an entry). The leech branch does **not** consult or mutate `conceptSeen`.

**Files:**
- `src/ui/Tactics.svelte` (modify — shared target)

**Steps:**

- [ ] 5.1 Add imports at the top of the `<script>` block in `src/ui/Tactics.svelte` (after the existing imports):

```ts
  import { cardForThemes, loadConcepts, type ConceptCard } from '../concepts/concepts';
  import { failCountByPuzzle, isLeech } from '../srs/schedule';
```

- [ ] 5.2 Add reactive state for the cards table, the current card, and the leech flag. Insert near the other `$state` declarations (after `const seen = new Set<string>();`):

```ts
  // Concept cards (teach-before-test, ADR-0040). Loaded once; [] if the asset is missing
  // (graceful — the link just won't appear). Non-blocking: never gates the next puzzle.
  let cards = $state<ConceptCard[]>([]);
  let card = $state<ConceptCard | null>(null);
  let leech = $state(false);
  const LEECH_THRESHOLD = 3; // Q-B

  loadConcepts().then((c) => {
    cards = c;
  });
```

- [ ] 5.3 In `loadNext()`, after the puzzle is chosen and assigned (`puzzle = p;` ... `startTimer();`), resolve the card and compute the leech flag from PRIOR failures (before this session's attempt). Replace the tail of `loadNext()` (from `seen.add(p.id);` through `startTimer();`) with:

```ts
    seen.add(p.id);
    puzzle = p;
    trainer = new TacticalTrainer(p, Date.now());
    display = new ChessGame(p.fen);
    fen = display.fen;
    lastMove = null;
    // Orient the board to the solver's side, fixed for the whole puzzle.
    orientation = display.turn === 'w' ? 'white' : 'black';
    startTimer();
    // Resolve the teaching card for this puzzle's motif (null → no link shown).
    card = cardForThemes(p.themes, cards);
    // Leech = this puzzle has already been failed >= N times (PRIOR attempts only).
    void refreshLeech(p.id);
```

- [ ] 5.4 Add the leech-count helper (reads prior failures from IndexedDB; counts failures *before* this session's attempt). Insert as a new function in the `<script>` block (e.g. after `clearDrill`):

```ts
  /** Recompute the leech flag for `puzzleId` from stored attempts (prior failures only). */
  async function refreshLeech(puzzleId: string): Promise<void> {
    leech = false;
    try {
      const db = await openTrainerDB();
      const prior = await db.getAllFromIndex('puzzleAttempts', 'puzzleId', puzzleId);
      const fails = failCountByPuzzle(prior).get(puzzleId) ?? 0;
      leech = isLeech(fails, LEECH_THRESHOLD);
    } catch {
      leech = false; // never block the loop on a count failure
    }
  }
```

  (`failCountByPuzzle` over the puzzle's own attempt rows == its fail count; reusing it keeps the leech trigger and the "Your misses" set on one definition — AP-CC-7.)

- [ ] 5.5 Add the first-exposure derivation + the "offer once" action. Insert after the `const timed = $derived(...)` block:

```ts
  // First-exposure: this motif's card has NOT been offered before. Keyed off the
  // RESOLVED card motif (card.motif), not raw themes (Q-A / spec §2.3). Independent of leech.
  const firstExposure = $derived(!!card && !(model?.conceptSeen ?? []).includes(card.motif));
  // Show the "Learn the pattern" link on EITHER trigger (both non-blocking).
  const showLearn = $derived(!!card && (firstExposure || leech));
```

  And add the action that records the offer (call this when the user opens the card, see Task 6):

```ts
  /** Mark this motif's card as offered at first-exposure (one-shot per motif; persisted). */
  async function markConceptOffered(): Promise<void> {
    if (!model || !card) return;
    const seenList = model.conceptSeen ?? [];
    if (seenList.includes(card.motif)) return;
    model.conceptSeen = [...seenList, card.motif];
    await app.persistModel(Date.now());
  }
```

  > **Honesty note:** `markConceptOffered` records the motif the moment the card is **offered/opened** (AP-CC-5: one-shot, survives reload, wiped on data-reset since it rides `PlayerModel` through `clearAllData`). The leech branch never touches `conceptSeen`, so a re-failed leech keeps offering its card even after first-exposure.

- [ ] 5.6 `npm run check` — expect clean (no unused/type errors). The link markup + `markConceptOffered` call wire up in Task 6; `showLearn`/`firstExposure`/`card`/`leech`/`markConceptOffered` are referenced there. To avoid a transient "unused" error between tasks, complete Task 6 in the same working session before running the full `npm run check` gate.
- [ ] 5.7 Commit: `feat: concept cards — first-exposure + leech triggers in Tactics`.

---

## Task 6 — UI: `ConceptCard.svelte`, `Concepts.svelte` index, View route, nav, Tactics link

Add the card view (read-only boards), the browsable library, the `'concepts'` route + nav entry, and the "Learn the pattern" link in Tactics (Q-D optional/non-blocking; Q-F both nav library + contextual link).

**Files:**
- `src/ui/ConceptCard.svelte` (new)
- `src/ui/Concepts.svelte` (new)
- `src/state/app.svelte.ts` (modify — shared target; add `'concepts'` to the `View` union)
- `src/ui/App.svelte` (modify — shared target; import + route branch + nav button)
- `src/ui/Tactics.svelte` (modify — shared target; the link markup + open action)

**Steps:**

- [ ] 6.1 Create `src/ui/ConceptCard.svelte` — a compact card view rendering each example as a read-only `Board` with the key move shown via `lastMove`, plus the `why` line. Dismissible, non-blocking (full code):

```svelte
<script lang="ts">
  import Board from './Board.svelte';
  import type { ConceptCard } from '../concepts/concepts';

  interface Props {
    card: ConceptCard;
    /** Optional dismiss handler (inline-panel mode). */
    onClose?: () => void;
  }
  let { card, onClose }: Props = $props();

  // The board's side-to-move = the solver (FEN side to move). lastMove highlights the key move.
  function sideToMove(fen: string): 'white' | 'black' {
    return fen.split(' ')[1] === 'b' ? 'black' : 'white';
  }
  function keySquares(uci: string): [string, string] {
    return [uci.slice(0, 2), uci.slice(2, 4)];
  }
</script>

<article class="concept-card">
  <header class="row">
    <h3>{card.title}</h3>
    {#if onClose}
      <button class="link" onclick={onClose}>dismiss</button>
    {/if}
  </header>
  <p class="idea">{card.idea}</p>

  <div class="examples">
    {#each card.examples as ex}
      <figure class="example">
        <div class="mini-board">
          <Board
            fen={ex.fen}
            orientation={sideToMove(ex.fen)}
            turnColor={sideToMove(ex.fen)}
            viewOnly={true}
            lastMove={keySquares(ex.keyMove)}
          />
        </div>
        <figcaption class="why">{ex.why}</figcaption>
      </figure>
    {/each}
  </div>
</article>

<style>
  .concept-card { max-width: 760px; border: 1px solid var(--border, #333); border-radius: 8px; padding: 1rem; }
  .concept-card header { justify-content: space-between; align-items: baseline; }
  .idea { color: var(--muted); margin: 0.25rem 0 0.75rem; }
  .examples { display: flex; flex-wrap: wrap; gap: 1rem; }
  .example { margin: 0; width: var(--mini); }
  /* A fixed-size, clipped wrapper so the scaled board reserves correct layout space
     (no height:0 hacks, no dead rules). --scale shrinks the board; --mini is the
     wrapper's footprint at that scale. */
  .mini-board {
    --scale: 0.62;
    --mini: calc(min(82vw, 68vh, 540px) * var(--scale) + 18px * var(--scale));
    width: var(--mini);
    height: var(--mini);
    overflow: hidden;
  }
  .mini-board :global(.board-frame) { transform: scale(var(--scale)); transform-origin: top left; }
  .why { font-size: 0.85rem; color: var(--muted); margin-top: 0.4rem; }
  button.link { background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
```

  > **Layout note for the executor:** `Board.svelte` renders a `.board-frame` sized to `min(82vw,68vh,540px)` (+ an 18px label gutter). The `:global(.board-frame) { transform: scale() }` + fixed-size clipped wrapper above keeps mini-boards compact in the index without overlap. Sizing is cosmetic; the hard requirement is a **legal read-only board with the key move highlighted** (via `lastMove`). If the scale math drifts on your viewport, adjust `--scale`/`--mini` — do not change board behavior.

- [ ] 6.2 Create `src/ui/Concepts.svelte` — the browsable library of all cards, optionally focused on one motif (full code):

```svelte
<script lang="ts">
  import { app } from '../state/app.svelte';
  import ConceptCard from './ConceptCard.svelte';
  import { loadConcepts, type ConceptCard as Card } from '../concepts/concepts';

  let cards = $state<Card[]>([]);
  // Optional focus motif handed over by a contextual "Learn the pattern" link.
  const focus = $derived(app.conceptFocusMotif);

  loadConcepts().then((c) => {
    cards = c;
  });

  const visible = $derived(focus ? cards.filter((c) => c.motif === focus) : cards);
</script>

<section class="col">
  <h2>Concepts — the pattern library</h2>
  <p class="muted">Curated, offline worked examples for the tactics we detect. Reference, not a test.</p>

  {#if focus}
    <p class="feedback">
      Showing: {focus}
      <button class="link" onclick={() => (app.conceptFocusMotif = null)}>show all</button>
    </p>
  {/if}

  {#if cards.length === 0}
    <p class="muted">No concept cards available.</p>
  {:else}
    <div class="list">
      {#each visible as card (card.motif)}
        <ConceptCard {card} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .list { display: flex; flex-direction: column; gap: 1.25rem; }
  button.link { background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
```

- [ ] 6.3 Edit `src/state/app.svelte.ts` — add the `'concepts'` arm to the `View` union and a focus-motif signal flag. Add `| 'concepts'` to the union (e.g. after `| 'analysis-board'`):

```ts
  | 'analysis-board'
  | 'concepts'
  | 'settings';
```

  And add the cross-view signal flag inside `AppState` (after `analysisFen`):

```ts
  /** Optional motif to focus the Concepts library on (set by a "Learn the pattern" link). */
  conceptFocusMotif = $state<string | null>(null);
```

- [ ] 6.4 Edit `src/ui/App.svelte` — import the view, add the route branch, and add a nav button (Q-F: nav library entry). Add the import after the `Sparring` import:

```ts
  import Sparring from './Sparring.svelte';
  import Concepts from './Concepts.svelte';
```

  Add a nav button (place it near the other learning buttons, e.g. after the `Vision` button):

```svelte
    <button onclick={() => app.go('vision')}>Vision</button>
    <button onclick={() => app.go('concepts')}>Concepts</button>
```

  Add the route branch (before the `settings` branch):

```svelte
  {:else if app.view === 'sparring'}
    <Sparring />
  {:else if app.view === 'concepts'}
    <Concepts />
  {:else if app.view === 'analysis-board'}
    <AnalysisBoard />
```

  (Insert the `concepts` branch anywhere among the `{:else if}` arms before the final `{:else}`; the snippet above shows a valid spot.)

- [ ] 6.5 Edit `src/ui/Tactics.svelte` — add the "Learn the pattern" link in the post-attempt feedback area and an inline card panel. Add `app` is already imported. Add a small state + open handler in the `<script>` block (after `markConceptOffered`):

```ts
  let showCard = $state(false);

  async function openLearn(): Promise<void> {
    showCard = true;
    await markConceptOffered(); // records first-exposure the moment the card is opened
  }
```

  Add the link + inline panel in the markup. Insert directly AFTER the existing `<p class="feedback {feedbackKind}">{feedback}</p>` line:

```svelte
  <p class="feedback {feedbackKind}">{feedback}</p>

  {#if showLearn && card}
    <p class="feedback">
      {#if leech}This one keeps beating you.{/if}
      <button class="link" onclick={openLearn}>Learn the pattern →</button>
      <button class="link" onclick={() => { app.conceptFocusMotif = card!.motif; app.go('concepts'); }}>open in library</button>
    </p>
  {/if}

  {#if showCard && card}
    <ConceptCard {card} onClose={() => (showCard = false)} />
  {/if}
```

  Add the `ConceptCard` import at the top of the `<script>` block (after the `Board` import):

```ts
  import ConceptCard from './ConceptCard.svelte';
```

  > **Non-blocking invariant (AP-CC-3):** `loadNext()` / "Next puzzle →" never read `showCard`, `showLearn`, or `card`; the link and panel are purely additive. A `null` card → `showLearn` is false → nothing renders. The leech `card` may be re-offered on a re-failed leech (the leech branch doesn't consult `conceptSeen`).

- [ ] 6.6 `npm run check` — expect clean. Resolve any unused-symbol errors by confirming Task 5's `showLearn`/`firstExposure`/`leech`/`card`/`markConceptOffered` are all now referenced by the Task 6 markup.
- [ ] 6.7 Run the full suite to confirm no regressions: `npm test` — expect green (135 prior + the new `concepts`, `concepts.seed`, `schedule`, `playerModel` suites).
- [ ] 6.8 `npm run build` — expect green (svelte-check + vite build).
- [ ] 6.9 Manual verification (Phase C, spec §6):
  - Fail the same Tactics puzzle 3× → a non-blocking "Learn the pattern" link appears before the next attempt → opens the correct motif card (legal example boards, key move highlighted) → dismiss → "Next puzzle →" loads normally.
  - First time a NEW motif appears, its card is offered once; after opening it (or solving on), it is not auto-offered again for that motif (verify `conceptSeen` grew; survives reload).
  - The Concepts nav entry lists every card; a contextual "open in library" link focuses the right motif and "show all" clears the focus.
  - Settings → delete all data → `conceptSeen` is cleared (it rides `PlayerModel` through `clearAllData`).
- [ ] 6.10 Commit: `feat: concept cards — ConceptCard + Concepts index + route/nav + Tactics link`.

---

## Task 7 — FINAL: append ADR-0040 to `decisions.md` + README note (code-before-docs)

Docs land LAST (phase order). Append the ADR (append-only; do not edit existing entries) and add a short README line under the existing `### Train & retain` section.

**Files:**
- `decisions.md` (modify — append at EOF only)
- `README.md` (modify — one additive line under `### Train & retain`)

**Steps:**

- [ ] 7.1 Append this entry to the END of `decisions.md` (after the ADR-0035 block):

```markdown

## ADR-0040 — Concept cards: teach-before-test via curated worked examples
**Date:** 2026-06-02 · **Status:** accepted

The app was all assessment, no teaching: detectors name a motif (`motif.ts`), `buildLapseSet`
(`schedule.ts`) finds the puzzles you fail most, the SRS resurfaces them — but nothing ever *showed
the pattern*. Concept cards add that one missing arrow.

**What ships.** A committed seed asset `public/concepts/concepts.json` holds **7 cards**, one per
high-confidence motif **family** the detector emits — `mate`, `hangingPiece`, `fork`, `pin`, `skewer`,
`discoveredAttack`, `doubleCheck` — each with 2-3 worked examples (`{fen, keyMove, why}`). Sub-tags
alias to the family card (`mateInN`/`backRankMate`→`mate`; `knightFork`→`fork`; `absolutePin`/
`relativePin`→`pin`; `discoveredCheck`→`discoveredAttack`). Pure `src/concepts/concepts.ts`
(`cardForMotif`/`cardForThemes` + `MOTIF_ALIASES` + `CARD_PRECEDENCE`) mirrors `eco.ts`: pure lookup
unit-tested against an in-memory table; `loadConcepts()` fetches the bundled JSON and degrades to `[]`
on any failure (a missing asset never breaks Tactics). `ConceptCard.svelte` renders each example on a
read-only board with the key move highlighted; `Concepts.svelte` is the nav library.

**Two honest, independent triggers.** (a) **First exposure** — the first time a motif's resolved card
is unseen on a Tactics puzzle, offer it; recorded in the additive `PlayerModel.conceptSeen?: string[]`
the moment the card is opened (one-shot per motif; keyed off the **resolved card motif**, not raw
themes, so a no-card puzzle never burns an entry and `knightFork`/`fork` share one entry). (b)
**Leech** — a puzzle failed **≥ 3** times (`isLeech`, threshold N=3) offers its motif card before the
next attempt; this branch does **not** consult or mutate `conceptSeen`, so a re-failed leech keeps
offering its card. The fail count reuses `failCountByPuzzle`, extracted from `buildLapseSet` (output
byte-identical) so the leech trigger and the "Your misses" set share one definition.

**Doctrine.** Cards are **CURATED static content — no LLM** (ADR-0015). They exist **only for motifs we
confidently detect** — the seed test asserts coverage == the detector family set (extends the
ADR-0007/0020 honesty doctrine to *teaching*; no fabricated patterns). Teaching is **optional and
non-blocking** — a "Learn the pattern" link, never a forced modal; loading the next puzzle is never
gated on a card (AP-CHESS-15). Every example FEN + key move is **chess.js-verified legal** in tests
(ADR-0017 / AP-CHESS-53 precedent). `conceptSeen` is an **additive field — NO `DB_VERSION` bump**
(stays v4; migrated in the load path with `?? []`; wiped on data-reset via `clearAllData`).

**Anti-patterns.** AP-CC-1 generated card text/examples (reject; curated only). AP-CC-2 a card for a
motif we don't confidently detect. AP-CC-3 a blocking modal that interrupts the recall loop. AP-CC-4
an illegal example FEN / key move (tests verify). AP-CC-5 re-offering the same motif's card every
exposure, or losing "seen" state. AP-CC-6 bumping `DB_VERSION` / adding a store for `conceptSeen`.
AP-CC-7 re-implementing the fail-count tally separately from `buildLapseSet`.

Cross-links: ADR-0007 (high-confidence motifs only), ADR-0020 (geometric motifs + precedence),
ADR-0015 (no LLM), ADR-0017 (legal-content-in-tests), ADR-0029 (`buildLapseSet`/lapse logic).
Deferred (§11): personalised cards from the user's own failed puzzles; an interactive "now you try"
mini-puzzle; positional-motif cards (ADR-0031); spaced review of cards; localisation.
```

- [ ] 7.2 Add a README line under the existing `### Train & retain` section in `README.md` (additive; place it as a new bullet/sentence in that section):

```markdown
- **Concept cards** — curated, offline worked examples for the tactics we detect (fork, pin, skewer,
  back-rank mate, …). See the pattern the first time it bites you in Tactics, and again when a puzzle
  keeps beating you — an optional, non-blocking "Learn the pattern" link, plus a browsable Concepts
  library. Content is hand-authored and CC0, consistent with the puzzle/ECO assets (no LLM).
```

- [ ] 7.3 `npm run check` + `npm test` once more — expect clean/green (docs-only changes shouldn't affect them, but confirm).
- [ ] 7.4 Commit: `feat: concept cards — teach-before-test per motif (ADR-0040)`.

---

## Final acceptance checklist (spec §8)

- [ ] `public/concepts/concepts.json` ships 7 cards (one per detectable family), 2-3 examples each; every FEN + key move asserted legal; coverage == detector family set (no fabricated patterns).
- [ ] `concepts.ts` is pure-tested (lookup + aliases + precedence) and the loader degrades to `[]` without breaking Tactics.
- [ ] First exposure to a motif in Tactics offers its card **once** (tracked via additive `conceptSeen`, no DB bump); a puzzle failed ≥ 3× offers its motif card before the next attempt.
- [ ] The card is optional/non-blocking — never gates the recall loop or the next puzzle.
- [ ] A Concepts index lists all cards from nav. `npm test` green incl. new suites; `npm run check` clean; `npm run build` green.
- [ ] ADR-0040 appended to `decisions.md`; README "Train & retain" note added.
- [ ] `DB_VERSION` is still `4` (grep to confirm no bump and no new `upgrade()` case / object store).
- [ ] `buildLapseSet` output is unchanged after the `failCountByPuzzle` extraction (Task 3 regression test passes).
```
