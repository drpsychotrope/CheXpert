import { describe, it, expect } from 'vitest';
import type { ConceptCard } from './concepts';

// Read BOTH committed assets straight from disk — same style as concepts.seed.test.ts
// (no fetch, no loadConcepts). jsdom resolves import.meta.url against http://localhost,
// so we use require('fs'/'path') + process.cwd() (node-compat.d.ts declares require/process
// for tsc without @types/node).
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

function load(file: string): { version: number; cards: ConceptCard[] } {
  const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
  return JSON.parse(raw) as { version: number; cards: ConceptCard[] };
}

const en = load('public/concepts/concepts.json');
const fr = load('public/concepts/concepts.fr.json');
const enCards = en.cards;
const frCards = fr.cards;

describe('concepts.fr.json parity with concepts.json (EN canonical)', () => {
  it('has the same number of cards', () => {
    expect(frCards.length).toBe(enCards.length);
  });

  it('has the same set of motif keys', () => {
    expect(new Set(frCards.map((c) => c.motif))).toEqual(new Set(enCards.map((c) => c.motif)));
  });

  it('keeps identical example geometry (fen + keyMove) per motif — FR prose must not drift', () => {
    const enByMotif = new Map(enCards.map((c) => [c.motif, c]));
    for (const frCard of frCards) {
      const enCard = enByMotif.get(frCard.motif);
      expect(enCard, `EN card missing for motif ${frCard.motif}`).toBeTruthy();
      // Same number of examples.
      expect(frCard.examples.length, `example count drift for ${frCard.motif}`).toBe(enCard!.examples.length);
      // Same fen + keyMove at each index (board geometry is locale-independent).
      frCard.examples.forEach((ex, i) => {
        expect(ex.fen, `${frCard.motif}[${i}]: fen drift`).toBe(enCard!.examples[i].fen);
        expect(ex.keyMove, `${frCard.motif}[${i}]: keyMove drift`).toBe(enCard!.examples[i].keyMove);
      });
    }
  });

  it('has non-empty French title / idea / why for every card and example', () => {
    for (const card of frCards) {
      expect(card.title.trim().length, `empty title for ${card.motif}`).toBeGreaterThan(0);
      expect(card.idea.trim().length, `empty idea for ${card.motif}`).toBeGreaterThan(0);
      for (const ex of card.examples) {
        expect(ex.why.trim().length, `empty why in ${card.motif}`).toBeGreaterThan(0);
      }
    }
  });
});
