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
