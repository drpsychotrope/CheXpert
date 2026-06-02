import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { CARD_PRECEDENCE, type ConceptCard } from './concepts';

// Read the committed asset straight from disk — no fetch, no loadConcepts (no repo
// test fetches a real public/** asset; PuzzleRepo.test.ts injects a fake fetchFn).
// Use process.cwd() + path.resolve because jsdom resolves import.meta.url relative
// paths against http://localhost (not file://) so new URL(..., import.meta.url)
// produces a non-file URL that readFileSync rejects.
const raw = readFileSync(resolve(process.cwd(), 'public/concepts/concepts.json'), 'utf8');
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
