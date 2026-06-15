import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { ChessGame, type Chess960CastleFiles } from './ChessGame';
import { chess960PositionById } from '../variant/chess960';

function castleFor(kingFile: number, rookFiles: [number, number]): Chess960CastleFiles {
  const rf = [...rookFiles].sort((a, b) => a - b) as [number, number];
  return { whiteKingFile: kingFile, whiteRookFiles: rf, blackKingFile: kingFile, blackRookFiles: rf };
}
function game(fen: string, kingFile: number, rookFiles: [number, number]): ChessGame {
  return new ChessGame(fen, { variant: 'chess960', castle: castleFor(kingFile, rookFiles) });
}

// Each row: a position where exactly ONE castle is just-legal. [label, fen, kingSq, rookSq,
// kingFile, rookFiles, expectedSan, kingTarget, rookTarget]. All FENs pre-verified legal.
const LEGAL: Array<[string, string, string, string, number, [number, number], string, string, string]> = [
  // SP-518 standard: king e1, rooks a1/h1 — both sides legal on an open back rank.
  ['518-short', '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 'e1', 'h1', 4, [0, 7], 'O-O', 'g1', 'f1'],
  ['518-long',  '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 'e1', 'a1', 4, [0, 7], 'O-O-O', 'c1', 'd1'],
  // SP-0 files (king g1, rooks f1+h1): king already sits on its SHORT target, the f1-rook
  // blocks the short rook-target → only LONG is reachable (king g1→c1, rook f1→d1).
  ['sp0-long',  '6k1/8/8/8/8/8/8/5RKR w - - 0 1', 'g1', 'f1', 6, [5, 7], 'O-O-O', 'c1', 'd1'],
  // King b1, rooks a1+c1 (off-centre king): SHORT legal (king b1→g1, rook c1→f1; a-rook stays).
  ['kingb-short', '6k1/8/8/8/8/8/8/RKR5 w - - 0 1', 'b1', 'c1', 1, [0, 2], 'O-O', 'g1', 'f1'],
  // Black to move, standard files mirrored.
  ['518b-short', 'r3k2r/8/8/8/8/8/8/4K3 b - - 0 1', 'e8', 'h8', 4, [0, 7], 'O-O', 'g8', 'f8'],
];

// Negatives: a king-to-rook attempt that MUST be refused. [label, fen, kingSq, rookSq, kingFile, rookFiles].
const ILLEGAL: Array<[string, string, string, string, number, [number, number]]> = [
  // King passes through g1 which a black rook on g8 attacks → no short castle.
  ['thru-check', '4k1r1/8/8/8/8/8/8/R3K2R w - - 0 1', 'e1', 'h1', 4, [0, 7]],
  // King currently in check (black rook e8 hits e1) → no castle.
  ['in-check', '4r2k/8/8/8/8/8/8/R3K2R w - - 0 1', 'e1', 'h1', 4, [0, 7]],
  // Knight on g1 blocks the king's short target → no short castle.
  ['blocked', '4k3/8/8/8/8/8/8/R3K1NR w - - 0 1', 'e1', 'h1', 4, [0, 7]],
];

describe('Chess960 castling shim — legal castles', () => {
  it.each(LEGAL)('%s generates the king-onto-rook dest', (_l, fen, kingSq, rookSq, kf, rfs) => {
    const g = game(fen, kf, rfs);
    expect(g.dests().get(kingSq) ?? []).toContain(rookSq);
  });

  it.each(LEGAL)('%s applies: SAN, king/rook on targets, turn flips', (_l, fen, kingSq, rookSq, kf, rfs, san, kT, rT) => {
    const g = game(fen, kf, rfs);
    const color = fen.split(' ')[1] as 'w' | 'b';
    expect(g.move(kingSq, rookSq)).toBe(san);
    const after = new Chess(g.fen);
    expect(after.get(kT as never)).toEqual({ type: 'k', color });
    expect(after.get(rT as never)).toEqual({ type: 'r', color });
    expect(g.turn).toBe(color === 'w' ? 'b' : 'w');
    expect(g.fen).toBeTruthy(); // resulting FEN re-loads (constructed via chess.js)
  });

  it.each(LEGAL)('%s accepts the equivalent king-to-rook UCI', (_l, fen, kingSq, rookSq, kf, rfs, san) => {
    const g = game(fen, kf, rfs);
    expect(g.moveUci(kingSq + rookSq)).toBe(san);
  });
});

describe('Chess960 castling shim — illegal castles refused', () => {
  it.each(ILLEGAL)('%s: no castle dest, move() null, UCI null, king unmoved', (_l, fen, kingSq, rookSq, kf, rfs) => {
    const g = game(fen, kf, rfs);
    expect(g.dests().get(kingSq) ?? []).not.toContain(rookSq);
    expect(g.move(kingSq, rookSq)).toBeNull();
    const g2 = game(fen, kf, rfs);
    expect(g2.moveUci(kingSq + rookSq)).toBeNull();
    expect(new Chess(g2.fen).get(kingSq as never)?.type).toBe('k'); // unmoved
  });
});

describe('Chess960 castling shim — rights bookkeeping & FEN', () => {
  it('king-side and queen-side rights are independent (spending short leaves nothing after a king move)', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 4, [0, 7]);
    expect(g.move('e1', 'h1')).toBe('O-O'); // spend short; king now on g1, both rights gone
    g.move('e8', 'd8'); // black waits
    expect(g.move('g1', 'a1')).toBeNull(); // long no longer available (king moved by castling)
  });

  it('a normal king move clears both that side rights', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 4, [0, 7]);
    g.move('e1', 'e2');
    g.move('e8', 'e7');
    g.move('e2', 'e1');
    g.move('e7', 'e8');
    expect(g.move('e1', 'h1')).toBeNull();
    expect(g.move('e1', 'a1')).toBeNull();
  });

  it('a rook leaving its home file clears that side right only', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 4, [0, 7]);
    g.move('h1', 'g1'); // kingside rook moves off home
    g.move('e8', 'd8');
    expect(g.move('e1', 'h1')).toBeNull(); // rook no longer on h1 → no short
    expect(g.move('e1', 'a1')).toBe('O-O-O'); // long still fine
  });

  it('SP-518 fenForEngine collapses to KQkq (outermost rooks)', () => {
    const p = chess960PositionById(518);
    const g = new ChessGame(p.startFen, { variant: 'chess960', castle: p.castle });
    expect(g.fenForEngine().split(' ')[2]).toBe('KQkq');
  });

  it('an off-centre 960 start (king b1, rooks a1/c1) still yields a valid engine FEN castle field', () => {
    const p = chess960PositionById(959); // rkrnnqbb: king b, rooks a/c — outermost rooks
    const g = new ChessGame(p.startFen, { variant: 'chess960', castle: p.castle });
    const field = g.fenForEngine().split(' ')[2];
    // both rooks are the outermost on their side → X-FEN collapses to KQkq
    expect(field).toBe('KQkq');
  });
});

describe('Chess960 — no phantom standard castles (ADR-0041 regression)', () => {
  // King g1 (file 6), rooks a1/h1 (files 0/7), open back rank.
  // chess.js would generate e1 as a castle target (O-O-O ±2 path) when the castling
  // field is KQkq — the bug. After the fix the field is '-', so e1 must NOT appear.
  const KING_FILE = 6;
  const ROOK_FILES: [number, number] = [0, 7];
  const FEN = '4k3/8/8/8/8/8/8/R5KR w KQkq - 0 1';

  it('dests for g1 does NOT include e1 (no phantom O-O-O)', () => {
    const g = game(FEN, KING_FILE, ROOK_FILES);
    expect(g.dests().get('g1') ?? []).not.toContain('e1');
  });

  it('move g1→e1 returns null (phantom castle rejected)', () => {
    const g = game(FEN, KING_FILE, ROOK_FILES);
    expect(g.move('g1', 'e1')).toBeNull();
  });

  it('legit short castle g1→h1 still works (dest present, king/rook relocated)', () => {
    const g = game(FEN, KING_FILE, ROOK_FILES);
    // h1 is the kingside rook → short castle
    expect(g.dests().get('g1') ?? []).toContain('h1');
    expect(g.move('g1', 'h1')).toBe('O-O');
    // King must land on g1 (SHORT_KING_FILE=6) and rook on f1 (SHORT_ROOK_FILE=5)
    const after = new Chess(g.fen);
    expect(after.get('g1' as never)).toMatchObject({ type: 'k', color: 'w' });
    expect(after.get('f1' as never)).toMatchObject({ type: 'r', color: 'w' });
  });

  it('legit long castle g1→a1 still works (dest present, king/rook relocated)', () => {
    const g = game(FEN, KING_FILE, ROOK_FILES);
    // a1 is the queenside rook → long castle
    expect(g.dests().get('g1') ?? []).toContain('a1');
    expect(g.move('g1', 'a1')).toBe('O-O-O');
    const after = new Chess(g.fen);
    expect(after.get('c1' as never)).toMatchObject({ type: 'k', color: 'w' });
    expect(after.get('d1' as never)).toMatchObject({ type: 'r', color: 'w' });
  });
});

describe('standard mode unaffected by the 960 shim', () => {
  it('default ChessGame still does standard castling via chess.js', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(g.move('e1', 'g1')).toBe('O-O'); // standard king-two-squares encoding
    const back = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    expect(back.move('e8', 'c8')).toBe('O-O-O');
  });

  it('default ChessGame opening position has 20 first moves and no extra castle dests', () => {
    const g = new ChessGame();
    let total = 0;
    for (const arr of g.dests().values()) total += arr.length;
    expect(total).toBe(20);
  });

  it('fenForEngine equals fen in standard mode', () => {
    const g = new ChessGame();
    expect(g.fenForEngine()).toBe(g.fen);
  });
});

describe('Chess960 undo — castle-aware (audit v2 C-2 / P0-03)', () => {
  it('undo after a 960 castle restores board, turn, history and the castle right', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 4, [0, 7]);
    const fen0 = g.fen;
    expect(g.move('e1', 'h1')).toBe('O-O'); // king→g1, rook→f1, turn→b
    expect(g.turn).toBe('b');
    g.undo();
    expect(g.fen).toBe(fen0); // board fully restored (silently corrupted before the fix)
    expect(g.turn).toBe('w'); // side-to-move restored
    expect(g.history()).toEqual([]); // san960 popped
    const after = new Chess(g.fen);
    expect(after.get('e1' as never)).toMatchObject({ type: 'k', color: 'w' });
    expect(after.get('h1' as never)).toMatchObject({ type: 'r', color: 'w' });
    expect(g.dests().get('e1') ?? []).toContain('h1'); // right restored → castle legal again
  });

  it('undo after a normal 960 move restores position and side rights', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 4, [0, 7]);
    const fen0 = g.fen;
    expect(g.move('e1', 'e2')).toBe('Ke2'); // normal king move clears rights
    g.undo();
    expect(g.fen).toBe(fen0);
    expect(g.history()).toEqual([]);
    expect(g.dests().get('e1') ?? []).toContain('h1'); // right back after undo
  });
});

describe('Chess960 — king step onto a vacated rook-home file (audit v2 P1-16)', () => {
  it('lets the king step onto its short rook file once that rook has left (normal move, not a dead castle)', () => {
    const g = game('k7/8/8/8/8/8/8/5RKR w - - 0 1', 6, [5, 7]); // king g1, rooks f1/h1; black Ka8
    expect(g.move('h1', 'h4')).toBe('Rh4'); // kingside rook leaves home → short right cleared
    expect(g.move('a8', 'a7')).toBe('Ka7'); // black waits (far from the action)
    // g1->h1 is now a legal ONE-STEP king move onto the vacated h-file; before the fix it was
    // wrongly intercepted as a (now-dead) castle and rejected.
    expect(g.move('g1', 'h1')).toBe('Kh1');
  });
});

describe('resolveMove — keyboard move entry (audit v2 C-4 / P0-04)', () => {
  it('resolves SAN, UCI and coordinate forms without mutating', () => {
    const g = new ChessGame();
    const fen0 = g.fen;
    expect(g.resolveMove('Nf3')).toMatchObject({ from: 'g1', to: 'f3' });
    expect(g.resolveMove('g1f3')).toMatchObject({ from: 'g1', to: 'f3' });
    expect(g.resolveMove('e2-e4')).toMatchObject({ from: 'e2', to: 'e4' });
    expect(g.resolveMove('e2 e4')).toMatchObject({ from: 'e2', to: 'e4' });
    expect(g.resolveMove('nonsense')).toBeNull();
    expect(g.fen).toBe(fen0); // pure resolution, no side effects
  });

  it('resolves promotion via SAN and UCI', () => {
    const g = new ChessGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(g.resolveMove('a8=Q')).toMatchObject({ from: 'a7', to: 'a8', promo: 'q' });
    expect(g.resolveMove('a7a8n')).toMatchObject({ from: 'a7', to: 'a8', promo: 'n' });
  });

  it('resolves a 960 castle word to king-onto-rook coordinates', () => {
    const g = game('4k3/8/8/8/8/8/8/R3K2R w - - 0 1', 4, [0, 7]);
    expect(g.resolveMove('O-O')).toEqual({ from: 'e1', to: 'h1' });
    expect(g.resolveMove('O-O-O')).toEqual({ from: 'e1', to: 'a1' });
  });
});
