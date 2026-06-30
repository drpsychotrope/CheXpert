import { describe, it, expect } from 'vitest';
import {
  cardForMotif,
  cardForThemes,
  primaryMotifFamily,
  missWhy,
  type ConceptCard,
} from './concepts';
import { ChessGame } from '../game/ChessGame';
import { formatSanLine } from '../calc/calc';

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

// F4 (teach-explain-surfacing): the trainer-miss "why" helpers. Pure, locale-injected.
describe('primaryMotifFamily (F4 — reuses CARD_PRECEDENCE)', () => {
  it('picks the highest-precedence family present (after alias resolution)', () => {
    expect(primaryMotifFamily(['fork', 'crushing'])).toBe('fork');
    expect(primaryMotifFamily(['hangingPiece', 'pin'])).toBe('pin'); // hangingPiece is lowest
    expect(primaryMotifFamily(['fork', 'mate'])).toBe('mate');       // mate beats everything
    expect(primaryMotifFamily(['fork', 'doubleCheck'])).toBe('doubleCheck');
    // sub-tags resolve through the alias table.
    expect(primaryMotifFamily(['knightFork', 'absolutePin'])).toBe('fork');
    expect(primaryMotifFamily(['mateIn2'])).toBe('mate');
  });

  it('returns null when no theme names a known family (honesty)', () => {
    expect(primaryMotifFamily(['middlegameMistake', 'crushing'])).toBeNull();
    expect(primaryMotifFamily(['advantage'])).toBeNull();
    expect(primaryMotifFamily([])).toBeNull();
  });
});

describe('missWhy (F4 — fact-honest pattern hint, AP-TEACH-2)', () => {
  it('renders a non-empty FR AND EN hint for a known motif', () => {
    const en = missWhy(['fork'], 'en');
    const fr = missWhy(['fork'], 'fr');
    expect(en).toBeTruthy();
    expect(fr).toBeTruthy();
    // It embeds the existing motifExpl.* idiom (reuse, not new prose — Q-G).
    expect(en).toContain('forks two targets at once');
    expect(fr).toContain('fait une fourchette sur deux cibles');
  });

  it('produces a DIFFERENT string per locale (no English leak in FR — parity sanity)', () => {
    expect(missWhy(['fork'], 'en')).not.toBe(missWhy(['fork'], 'fr'));
    expect(missWhy(['mate'], 'en')).not.toBe(missWhy(['mate'], 'fr'));
  });

  it('returns null (no asserted reason) for low-signal themes — honest fallback', () => {
    // No high-precedence family resolves → no invented "why" (AP-TEACH-2).
    expect(missWhy(['middlegameMistake', 'crushing'], 'en')).toBeNull();
    expect(missWhy(['middlegameMistake', 'crushing'], 'fr')).toBeNull();
    expect(missWhy([], 'en')).toBeNull();
  });

  it('frames the why as a hint, not a verdict (FOLD-5)', () => {
    // The wording must read as a cue/idea, distinct from an engine-backed grade.
    expect(missWhy(['fork'], 'en')).toMatch(/^Hint:/);
    expect(missWhy(['fork'], 'fr')).toMatch(/^Indice/);
  });
});

// FOLD-3: the SAN-line build SolutionReveal performs (ChessGame.moveUci ?? raw → formatSanLine)
// must tolerate empty / short / illegal-mid-line UCI without throwing. This is the pure core of
// the component's reveal; SolutionReveal.svelte composes exactly this (verified by build + manual).
function revealSanLine(fen: string, moves: string[]): string {
  const g = new ChessGame(fen);
  return formatSanLine(moves.map((m) => g.moveUci(m) ?? m));
}

describe('SolutionReveal SAN-line tolerance (FOLD-3)', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('builds a numbered SAN line for a normal legal line', () => {
    expect(revealSanLine(START, ['e2e4', 'e7e5', 'g1f3'])).toBe('1.e4 e5 2.Nf3');
  });

  it('returns an empty string for an empty line (no throw)', () => {
    expect(() => revealSanLine(START, [])).not.toThrow();
    expect(revealSanLine(START, [])).toBe('');
  });

  it('handles a 1-ply line (no opponent reply)', () => {
    expect(revealSanLine(START, ['e2e4'])).toBe('1.e4');
  });

  it('falls back to raw UCI for an illegal mid-line ply, without crashing', () => {
    // e7e5 is illegal as White's 1st move → moveUci returns null → raw token kept; the rest
    // still resolves from the position after the legal first move. Never throws.
    expect(() => revealSanLine(START, ['e2e4', 'a1a8', 'b8c6'])).not.toThrow();
    const line = revealSanLine(START, ['e2e4', 'a1a8', 'b8c6']);
    expect(line).toContain('1.e4');
    expect(line).toContain('a1a8'); // illegal ply preserved as raw UCI (FOLD-3)
  });
});
