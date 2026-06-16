import { describe, it, expect } from 'vitest';
import { explainPly } from './explain';
import type { PlyAnalysis } from './types';

function ply(p: Partial<PlyAnalysis>): PlyAnalysis {
  return {
    ply: 22, moveNumber: 12, color: 'w', san: 'Nxe5', uci: 'f3e5',
    fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4N3/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 1',
    bestUci: 'f3e5', bestWhiteCp: 50, playedWhiteCp: -300, cpLoss: 350, winProbLoss: 28,
    severity: 'blunder', phase: 'middlegame',
    ...p,
  };
}

describe('explainPly — rule-based, fact-derived only (Q-J / AP-CHESS-19)', () => {
  it('headline carries move, severity, win% loss, and phase', () => {
    const e = explainPly(ply({}), 'en');
    expect(e.headline).toContain('Move 12');
    expect(e.headline).toContain('Nxe5');
    expect(e.headline).toContain('blunder');
    expect(e.headline).toContain('28%');
    expect(e.headline).toContain('middlegame');
  });

  it('names the missed motif ONLY when confidence is high', () => {
    const high = explainPly(ply({ bestUci: 'd1h5', motif: { tag: 'fork', tags: ['fork'], confidence: 'high' } }), 'en');
    expect(high.reasons.join(' ')).toMatch(/fork/i);

    const low = explainPly(ply({ motif: { tag: 'middlegameMistake', tags: ['middlegameMistake'], confidence: 'low' } }), 'en');
    // Low-confidence: must NOT assert a specific pattern — honest fallback.
    expect(low.reasons.join(' ')).toMatch(/can't name a specific/i);
    expect(low.reasons.join(' ')).not.toMatch(/\bfork\b/i);
  });

  it('mentions a forced mate when one was available (no motif needed)', () => {
    const e = explainPly(ply({ mate: 2, motif: undefined }), 'en');
    expect(e.reasons.join(' ')).toMatch(/forced mate/i);
  });

  it('suggests a concrete better move in SAN', () => {
    // f3g5 = Ng5, a legal move in the fixture FEN (an Italian after 3.Bc4).
    const e = explainPly(ply({ bestUci: 'f3g5' }), 'en');
    expect(e.better).toBe('Better was Ng5.');
  });

  it('affirms good/best moves without inventing criticism', () => {
    const e = explainPly(ply({ severity: 'best', winProbLoss: 0 }), 'en');
    expect(e.reasons).toHaveLength(0);
    expect(e.better).toBeNull();
    expect(e.headline).toMatch(/best move/);
  });

  it('scales the magnitude sentence with win% loss', () => {
    expect(explainPly(ply({ winProbLoss: 28 }), 'en').reasons[0]).toMatch(/large/i);
    expect(explainPly(ply({ severity: 'mistake', winProbLoss: 13 }), 'en').reasons[0]).toMatch(/about 13%/);
    expect(explainPly(ply({ severity: 'inaccuracy', winProbLoss: 6 }), 'en').reasons[0]).toMatch(/smaller slip/i);
  });

  it('never references a best move it does not have', () => {
    const e = explainPly(ply({ bestUci: null, motif: undefined, mate: undefined }), 'en');
    expect(e.better).toBeNull();
    expect(e.reasons.join(' ')).not.toMatch(/Better was/);
  });

  it('explains the new geometric motifs (pin) in plain language', () => {
    const e = explainPly(ply({ motif: { tag: 'pin', tags: ['pin', 'absolutePin'], confidence: 'high' } }), 'en');
    expect(e.reasons.join(' ')).toMatch(/pin/i);
  });

  it('renders a non-promoting best move as SAN, not raw UCI', () => {
    // Regression: d2d4 from the start position must become "d4", not "d2d4"
    // (chess.js 1.4.0 rejects a promotion field on a non-promoting move).
    const e = explainPly(
      ply({
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        bestUci: 'd2d4',
        severity: 'mistake',
        winProbLoss: 12,
        motif: { tag: 'openingMistake', tags: ['openingMistake'], confidence: 'low' },
      }),
      'en',
    );
    expect(e.better).toBe('Better was d4.');
    expect(e.better).not.toContain('d2d4');
  });

  it('renders the same facts in French when locale is fr (V2-W18)', () => {
    const e = explainPly(ply({ bestUci: 'f3g5' }), 'fr');
    expect(e.headline).toContain('Coup 12'); // "Move" -> "Coup"
    expect(e.headline).toContain('Nxe5'); // SAN stays English (ADR-0052 Q4)
    expect(e.headline).toContain('une gaffe'); // "a blunder" -> "une gaffe"
    expect(e.headline).toContain('milieu de partie'); // "middlegame" -> "au milieu de partie"
    expect(e.better).toBe('Mieux valait Ng5.');
  });
});
