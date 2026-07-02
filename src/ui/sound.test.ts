import { describe, it, expect } from 'vitest';
import { RECIPES, playSound, setSoundEnabled, isSoundEnabled, pieceCount, moveSoundEvent } from './sound';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const AFTER_CAPTURE = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'; // a pawn is gone

describe('RECIPES (PR-05 — data-shape sanity, no AudioContext needed)', () => {
  it('defines every event with short, quiet notes (cues, not fanfare — AP-ROADMAP-7)', () => {
    const events = ['move', 'capture', 'check', 'win', 'loss', 'draw', 'milestone'] as const;
    for (const ev of events) {
      const notes = RECIPES[ev];
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.d).toBeLessThanOrEqual(250); // each note short
        expect(n.at + n.d).toBeLessThanOrEqual(500); // whole cue under half a second
        expect(n.g).toBeLessThanOrEqual(0.2); // quiet
      }
    }
  });
});

describe('pieceCount / moveSoundEvent (pure classification)', () => {
  it('counts board-field pieces only', () => {
    expect(pieceCount(START)).toBe(32);
    expect(pieceCount(AFTER_E4)).toBe(32);
    expect(pieceCount(AFTER_CAPTURE)).toBe(31);
  });
  it('classifies check > capture > move', () => {
    expect(moveSoundEvent(START, AFTER_E4, false)).toBe('move');
    expect(moveSoundEvent(AFTER_E4, AFTER_CAPTURE, false)).toBe('capture');
    expect(moveSoundEvent(AFTER_E4, AFTER_CAPTURE, true)).toBe('check'); // check wins even on capture
  });
});

describe('playSound is inert-safe (jsdom has no AudioContext)', () => {
  it('never throws with audio unavailable, enabled or not', () => {
    setSoundEnabled(true);
    expect(() => playSound('move')).not.toThrow();
    setSoundEnabled(false);
    expect(() => playSound('milestone')).not.toThrow();
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true); // restore module default for other tests
  });
});
