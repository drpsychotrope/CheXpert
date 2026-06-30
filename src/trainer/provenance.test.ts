// T2/TR4+TR9 pure-core tests (no Svelte harness). provenanceOf tolerates partial/legacy meta and
// never throws; bandToQuery/sourceToQuery are the deterministic selection mappings. The after-solve
// SAN is computed at the CALL SITE via ChessGame.moveUci — asserted here against the real wrapper to
// prove the contract the component relies on (enrich E1), incl. the null (illegal) -> omit case.
import { describe, it, expect } from 'vitest';
import { provenanceOf, bandToQuery, sourceToQuery, type DifficultyBand } from './provenance';
import { ChessGame } from '../game/ChessGame';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A personal puzzle with full provenance meta (mirrors generatePuzzles.ts:100-107). */
function personalFull(meta: Record<string, string> = {}) {
  return {
    source: 'personal',
    meta: {
      sourceGameId: 'g:1',
      moveNumber: '23',
      playedMove: 'Qxf7',
      severity: 'blunder',
      motifConfidence: 'high',
      kind: 'missed-win',
      ...meta,
    },
  };
}

describe('provenanceOf (T2/TR4 pure core)', () => {
  it('full personal meta → the structured pre object (fields mapped, extras ignored)', () => {
    expect(provenanceOf(personalFull())).toEqual({
      moveNumber: '23',
      playedMove: 'Qxf7',
      severity: 'blunder',
      kind: 'missed-win',
    });
  });

  it('a curated puzzle → null (no-op escape, byte-identical to today)', () => {
    expect(provenanceOf({ source: 'curated', meta: { moveNumber: '5', playedMove: 'e4', severity: 'mistake' } })).toBeNull();
  });

  it('a personal puzzle with NO meta → null (generic tag, never throws)', () => {
    expect(provenanceOf({ source: 'personal' })).toBeNull();
    expect(provenanceOf({ source: 'personal', meta: undefined })).toBeNull();
  });

  // enrich E2 / AP-TPERS-10: partial/legacy meta — null when an essential field is absent, never throws.
  it('partial/legacy meta (missing an essential field) → null, never throws', () => {
    expect(provenanceOf(personalFull({ moveNumber: '' }))).toBeNull(); // empty essential
    expect(() => provenanceOf({ source: 'personal', meta: { playedMove: 'e4', severity: 'mistake' } })).not.toThrow();
    expect(provenanceOf({ source: 'personal', meta: { playedMove: 'e4', severity: 'mistake' } })).toBeNull(); // no moveNumber
    expect(provenanceOf({ source: 'personal', meta: { moveNumber: '3', severity: 'mistake' } })).toBeNull(); // no playedMove
    expect(provenanceOf({ source: 'personal', meta: { moveNumber: '3', playedMove: 'e4' } })).toBeNull(); // no severity
  });

  it('ignores extra/unknown meta keys', () => {
    const prov = provenanceOf(personalFull({ somethingNew: 'x', anotherTail: 'y' }));
    expect(prov).toEqual({ moveNumber: '23', playedMove: 'Qxf7', severity: 'blunder', kind: 'missed-win' });
  });

  it('normalises kind: a missing/legacy/other kind → "mistake" (always a valid after-solve branch)', () => {
    expect(provenanceOf({ source: 'personal', meta: { moveNumber: '3', playedMove: 'e4', severity: 'mistake' } })?.kind).toBe('mistake');
    expect(provenanceOf(personalFull({ kind: 'somethingElse' }))?.kind).toBe('mistake');
    expect(provenanceOf(personalFull({ kind: 'missed-win' }))?.kind).toBe('missed-win');
  });

  it('is deterministic — same input → same output (purity guard, no Date/Math.random)', () => {
    const input = personalFull();
    expect(provenanceOf(input)).toEqual(provenanceOf(input));
  });
});

describe('after-solve SAN via ChessGame.moveUci (enrich E1 — call-site contract)', () => {
  it('renders moves[0] (a UCI) as SAN on a fresh board from the puzzle FEN', () => {
    // From the start position, e2e4 is "e4" in SAN.
    expect(new ChessGame(START_FEN).moveUci('e2e4')).toBe('e4');
  });

  it('a null from moveUci (illegal/unparseable) → the after-solve line is omitted (no crash)', () => {
    // An illegal move in this position returns null; the component then omits the line.
    expect(new ChessGame(START_FEN).moveUci('e2e5')).toBeNull();
    expect(() => new ChessGame(START_FEN).moveUci('zzzz')).not.toThrow();
  });
});

describe('bandToQuery (T2/TR9 coarse difficulty — AP-TPERS-7)', () => {
  it('on-level equals today\'s curated window (no-regression default path)', () => {
    expect(bandToQuery('on-level', 1500)).toEqual({ rating: 1500, window: 250 });
  });
  it('easier shifts the rating down and narrows the window', () => {
    expect(bandToQuery('easier', 1500)).toEqual({ rating: 1350, window: 200 });
  });
  it('harder shifts the rating up and narrows the window', () => {
    expect(bandToQuery('harder', 1500)).toEqual({ rating: 1650, window: 200 });
  });
  it('is deterministic (purity guard)', () => {
    for (const b of ['easier', 'on-level', 'harder'] as DifficultyBand[]) {
      expect(bandToQuery(b, 1200)).toEqual(bandToQuery(b, 1200));
    }
  });
});

describe('sourceToQuery (T2/TR9 toggle → PuzzleQuery.source)', () => {
  it('mixed → undefined (today\'s blended behaviour)', () => {
    expect(sourceToQuery('mixed')).toBeUndefined();
  });
  it('personal/curated pass through unchanged', () => {
    expect(sourceToQuery('personal')).toBe('personal');
    expect(sourceToQuery('curated')).toBe('curated');
  });
});
