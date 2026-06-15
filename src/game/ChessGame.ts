// Thin wrapper over chess.js that exposes exactly what the UI (chessground) and
// the trainer need: a legal-destinations map, promotion handling, terminal-state
// detection, and FEN/PGN I/O. Rules logic stays in chess.js (headless).
//
// CHESS960 (ADR-0041): chess.js 1.4.0 loads a scrambled 960 start but generates ZERO
// castling moves and only accepts decorative `KQkq` rights (Shredder/X-FEN rejected).
// So in 960 a local castling SHIM is the SOLE source of castling rights and the SOLE
// path that generates/validates/applies a castle. chess.js stays the rules authority
// for every NON-castling move. All 960 branches are gated on `variant==='chess960'`;
// with variant standard/absent, behaviour is byte-for-byte the original.

import { Chess, type Square, type Move, type Color, type PieceSymbol } from 'chess.js';
import type { Chess960Castle } from '../variant/chess960';

export type Dests = Map<string, string[]>;

export type Variant = 'standard' | 'chess960';

// Single canonical shape: the king/rook start files are produced by the generator
// (`Chess960Castle`) and consumed identically by the shim's dests/legality/apply/FEN.
// Re-exported here under the name callers use so there is exactly one definition.
export type Chess960CastleFiles = Chess960Castle;

export interface ChessGameOpts {
  variant?: Variant;
  /** Required when variant==='chess960': the true king/rook start files. */
  castle?: Chess960CastleFiles;
}

export interface TerminalState {
  over: boolean;
  reason?: 'checkmate' | 'stalemate' | 'insufficient' | 'threefold' | 'fiftyMove' | 'draw';
  winner?: 'w' | 'b';
}

const FILES = 'abcdefgh';
const fileOf = (sq: string): number => FILES.indexOf(sq[0]);
const rankOf = (sq: string): number => Number(sq[1]);
const sqOf = (file: number, rank: number): string => `${FILES[file]}${rank}`;
/** Fixed 960 castle targets (independent of start files): short→king g(6)/rook f(5); long→king c(2)/rook d(3). */
const SHORT_KING_FILE = 6;
const SHORT_ROOK_FILE = 5;
const LONG_KING_FILE = 2;
const LONG_ROOK_FILE = 3;

interface Side960Rights {
  /** kingside (toward the h-file) right live. */
  short: boolean;
  /** queenside (toward the a-file) right live. */
  long: boolean;
}

export class ChessGame {
  private chess: Chess;
  private readonly variant: Variant;
  private readonly castleFiles: Chess960CastleFiles | null;
  private rights: { w: Side960Rights; b: Side960Rights } | null = null;
  /** Shim-tracked SAN history (chess.js history misses our manual castles). */
  private san960: string[] = [];
  /** The FEN the game started from — kept for the Chess960 PGN [FEN] header (ADR-0041, audit W5). */
  private readonly startFen: string;
  /** Shim-tracked repetition counter. chess.js's `_positionCount` is wiped by the load()
   *  we do on every manual 960 castle, so its isThreefoldRepetition() goes blind across a
   *  castle. We count positions ourselves (960 only) and consult it in terminal() (audit W5). */
  private repetition = new Map<string, number>();
  /** Pre-move snapshots enabling a correct 960 undo even across a manual castle, whose
   *  chess.load() wipes chess.js's own undo stack (audit v2 C-2 / P0-03). */
  private history960: Array<{
    fen: string;
    rights: { w: Side960Rights; b: Side960Rights };
    san: string[];
    rep: Map<string, number>;
  }> = [];

  constructor(fen?: string, opts?: ChessGameOpts) {
    this.variant = opts?.variant ?? 'standard';
    this.castleFiles = this.variant === 'chess960' ? (opts?.castle ?? null) : null;
    // In 960 mode neutralize chess.js's castling field to '-' so it generates zero phantom
    // standard castles (chess.js uses KQkq to produce ±2 king moves; the shim owns castling).
    const loadFen = this.variant === 'chess960' && fen ? neutralizeCastling(fen) : fen;
    this.chess = new Chess(loadFen);
    this.startFen = fen ?? this.chess.fen();
    if (this.variant === 'chess960') {
      this.rights = { w: { short: true, long: true }, b: { short: true, long: true } };
      // If the start FEN lacks a rook on a castle file (already moved), drop that right.
      this.syncRightsToBoard();
      // Seed shim history from any moves already in the loaded FEN's PGN (usually none).
      this.san960 = this.chess.history();
      this.repetition.set(this.repKey(), 1);
    }
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  load(fen: string): void {
    // In 960 mode neutralize chess.js's castling field to '-' (same reason as constructor).
    const loadFen = this.variant === 'chess960' ? neutralizeCastling(fen) : fen;
    this.chess.load(loadFen);
    if (this.variant === 'chess960') {
      this.syncRightsToBoard();
      // Reset the repetition counter to the freshly loaded position (audit W5).
      this.repetition.clear();
      this.repetition.set(this.repKey(), 1);
      // A load() is a hard reset — earlier moves are no longer undoable (audit v2 P0-03).
      this.history960 = [];
    }
  }

  loadPgn(pgn: string): void {
    this.chess.loadPgn(pgn);
  }

  pgn(): string {
    if (this.variant !== 'chess960') return this.chess.pgn();
    // chess.js only knows the moves played since the last manual-castle load(), so its pgn()
    // is truncated after any 960 castle. Rebuild from the shim's own SAN history (audit W5).
    const sp = this.startFen.split(' ');
    let moveNo = Number(sp[5] || '1');
    let whiteToMove = (sp[1] || 'w') === 'w';
    let body = '';
    for (let k = 0; k < this.san960.length; k++) {
      if (whiteToMove) {
        body += `${moveNo}. ${this.san960[k]} `;
      } else {
        if (k === 0) body += `${moveNo}... `;
        body += `${this.san960[k]} `;
        moveNo++;
      }
      whiteToMove = !whiteToMove;
    }
    const headers = [
      '[Event "Chess Trainer — Chess960"]',
      '[Variant "Chess960"]',
      '[SetUp "1"]',
      `[FEN "${this.startFen}"]`,
    ].join('\n');
    return `${headers}\n\n${body.trim()}`.trim();
  }

  /** Repetition key (960): piece placement + side to move + shim castling rights + en-passant.
   *  Excludes the move clocks so a genuine position repeat is detected (FIDE threefold). */
  private repKey(): string {
    const f = this.fen.split(' ');
    const castle = this.variant === 'chess960' && this.rights ? this.castleFieldForEngine() : f[2];
    return `${f[0]} ${f[1]} ${castle} ${f[3] ?? '-'}`;
  }

  /** Record one more occurrence of the current position (960 repetition tracking). */
  private bumpRepetition(): void {
    const key = this.repKey();
    this.repetition.set(key, (this.repetition.get(key) ?? 0) + 1);
  }

  history(): string[] {
    return this.variant === 'chess960' ? [...this.san960] : this.chess.history();
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  /** Legal destinations per origin square — the shape chessground wants. */
  dests(): Dests {
    const dests: Dests = new Map();
    for (const move of this.chess.moves({ verbose: true }) as Move[]) {
      const arr = dests.get(move.from);
      if (arr) arr.push(move.to);
      else dests.set(move.from, [move.to]);
    }
    if (this.variant === 'chess960') this.addCastleDests(dests);
    return dests;
  }

  /**
   * Attempt a move. `promotion` defaults to queen. In 960, a king-onto-own-rook move is
   * a castle and goes through the shim; everything else goes through chess.js.
   * Returns SAN on success, null if illegal.
   */
  move(from: string, to: string, promotion: 'q' | 'r' | 'b' | 'n' = 'q'): string | null {
    if (this.variant === 'chess960') {
      const snap = this.snapshot960(); // restore point captured BEFORE any mutation (P0-03)
      const side = this.castleSideFor(from, to);
      // Only treat king-onto-rook-file as a castle while the right is LIVE. Once the rook has
      // left that file (right cleared), the same king step is a NORMAL move and must fall through
      // to chess.js rather than being rejected as a dead castle (audit v2 P1-16).
      if (side && this.rights?.[this.turn][side]) {
        const san = this.applyCastle(side); // returns SAN or null (currently illegal)
        if (san) {
          this.history960.push(snap);
          this.bumpRepetition();
        }
        return san;
      }
      try {
        const m = this.chess.move({ from: from as Square, to: to as Square, promotion });
        if (m) {
          this.san960.push(m.san);
          this.updateRightsAfterNormalMove(m);
          this.history960.push(snap);
          this.bumpRepetition();
        }
        return m ? m.san : null;
      } catch {
        return null;
      }
    }
    try {
      const m = this.chess.move({ from: from as Square, to: to as Square, promotion });
      return m ? m.san : null;
    } catch {
      return null;
    }
  }

  /** Play a move given in UCI long-algebraic form (e2e4, e7e8q; in 960 also e1h1 castles). */
  moveUci(uci: string): string | null {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = (uci[4] as 'q' | 'r' | 'b' | 'n') || 'q';
    return this.move(from, to, promo);
  }

  /**
   * Resolve a typed move (SAN "Nf3"/"exd5"/"O-O", UCI "g1f3"/"e7e8q", or coordinate "e2-e4")
   * to `{from,to,promo}` WITHOUT mutating the game, so a caller can feed it through the same
   * `onMove(from,to,promo)` path a drag uses (audit v2 C-4 / P0-04, keyboard move entry).
   * Returns null if unparseable/illegal in the current position. Variant-aware: 960 castling is
   * resolved to the king-onto-own-rook coordinates the shim expects.
   */
  resolveMove(input: string): { from: string; to: string; promo?: 'q' | 'r' | 'b' | 'n' } | null {
    const t = input.trim();
    if (!t) return null;
    // UCI / coordinate form (separators optional): e2e4, e2-e4, e7e8q.
    const compact = t.replace(/[\s-]/g, '');
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(compact)) {
      const c = compact.toLowerCase();
      const promo = c[4] as 'q' | 'r' | 'b' | 'n' | undefined;
      return { from: c.slice(0, 2), to: c.slice(2, 4), promo: promo || undefined };
    }
    // Castling words (O-O / O-O-O, also tolerating zeros).
    if (/^[o0](-?[o0]){1,2}$/i.test(t)) {
      const long = (t.match(/[o0]/gi) ?? []).length === 3;
      return this.resolveCastle(long ? 'long' : 'short');
    }
    // SAN for any non-castle move via a scratch board (no mutation). In 960, neutralise the
    // castling field so chess.js parses the position; castling is handled above.
    try {
      const scratchFen = this.variant === 'chess960' ? neutralizeCastling(this.chess.fen()) : this.chess.fen();
      const m = new Chess(scratchFen).move(t);
      if (!m) return null;
      return { from: m.from, to: m.to, promo: (m.promotion as 'q' | 'r' | 'b' | 'n') || undefined };
    } catch {
      return null;
    }
  }

  /** Resolve a castle (SAN word) to its from/to coordinates without mutating. */
  private resolveCastle(side: 'short' | 'long'): { from: string; to: string } | null {
    if (this.variant === 'chess960' && this.castleFiles) {
      const color = this.turn;
      const rank = color === 'w' ? 1 : 8;
      const kingFile = color === 'w' ? this.castleFiles.whiteKingFile : this.castleFiles.blackKingFile;
      const rookFiles = color === 'w' ? this.castleFiles.whiteRookFiles : this.castleFiles.blackRookFiles;
      const rookFile = side === 'short' ? Math.max(...rookFiles) : Math.min(...rookFiles);
      return { from: sqOf(kingFile, rank), to: sqOf(rookFile, rank) }; // king onto own rook (960)
    }
    try {
      const m = new Chess(this.chess.fen()).move(side === 'short' ? 'O-O' : 'O-O-O');
      return m ? { from: m.from, to: m.to } : null;
    } catch {
      return null;
    }
  }

  /** True if moving from->to would be a pawn reaching the last rank. */
  isPromotion(from: string, to: string): boolean {
    const piece = this.chess.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    const rank = to[1];
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  }

  undo(): void {
    if (this.variant === 'chess960') {
      // A 960 castle reloads chess.js (wiping its undo stack), so chess.undo() cannot revert
      // it. Restore the full pre-move snapshot instead — uniform for castles and normal moves
      // (audit v2 C-2 / P0-03).
      const snap = this.history960.pop();
      if (!snap) return;
      this.chess.load(snap.fen); // snap.fen already has castling neutralised to '-'
      this.rights = snap.rights;
      this.san960 = snap.san;
      this.repetition = snap.rep;
      return;
    }
    this.chess.undo();
  }

  /** Capture the full restorable 960 state before a move (audit v2 P0-03). */
  private snapshot960(): {
    fen: string;
    rights: { w: Side960Rights; b: Side960Rights };
    san: string[];
    rep: Map<string, number>;
  } {
    return {
      fen: this.chess.fen(),
      rights: { w: { ...this.rights!.w }, b: { ...this.rights!.b } },
      san: [...this.san960],
      rep: new Map(this.repetition),
    };
  }

  terminal(): TerminalState {
    if (this.chess.isCheckmate()) {
      return { over: true, reason: 'checkmate', winner: this.chess.turn() === 'w' ? 'b' : 'w' };
    }
    if (this.chess.isStalemate()) return { over: true, reason: 'stalemate' };
    if (this.chess.isInsufficientMaterial()) return { over: true, reason: 'insufficient' };
    // 960: chess.js loses its repetition history across our manual-castle reloads, so consult
    // the shim's own counter; standard keeps using chess.js's detector (audit W5).
    if (this.variant === 'chess960') {
      if ((this.repetition.get(this.repKey()) ?? 0) >= 3) return { over: true, reason: 'threefold' };
    } else if (this.chess.isThreefoldRepetition()) {
      return { over: true, reason: 'threefold' };
    }
    if (this.chess.isDraw()) return { over: true, reason: 'draw' };
    return { over: false };
  }

  // ─────────────────────────── Chess960 castling shim ───────────────────────────

  /**
   * FEN for Stockfish with `UCI_Chess960`. Same board/turn/ep/clocks as `fen`, but the
   * castling field is X-FEN (collapses to KQkq when the castling rook is the OUTERMOST on
   * its side — the common case) or Shredder file-letters when X-FEN is ambiguous (an inner
   * rook backs a right). chess.js NEVER parses this string; the round-trip is internal.
   */
  fenForEngine(): string {
    if (this.variant !== 'chess960' || !this.castleFiles || !this.rights) return this.fen;
    const parts = this.fen.split(' ');
    parts[2] = this.castleFieldForEngine();
    return parts.join(' ');
  }

  private castleFieldForEngine(): string {
    const cf = this.castleFiles!;
    const r = this.rights!;
    const outerShort = Math.max(...cf.whiteRookFiles); // toward h
    const outerLong = Math.min(...cf.whiteRookFiles); // toward a
    // X-FEN: use K/Q when the rook backing the right is the outermost on its side.
    // Here both rooks ARE the only rooks, so the kingside rook is always the outermost
    // kingside and the queenside rook the outermost queenside → KQkq is correct unless a
    // future variant adds inner rooks. Emit Shredder letters only if that invariant breaks.
    const kingsideIsOuter = outerShort > cf.whiteKingFile;
    const queensideIsOuter = outerLong < cf.whiteKingFile;
    if (kingsideIsOuter && queensideIsOuter) {
      let s = '';
      if (r.w.short) s += 'K';
      if (r.w.long) s += 'Q';
      if (r.b.short) s += 'k';
      if (r.b.long) s += 'q';
      return s || '-';
    }
    // Shredder fallback: file letters (uppercase = white) of the rook backing each right.
    let s = '';
    if (r.w.short) s += FILES[outerShort].toUpperCase();
    if (r.w.long) s += FILES[outerLong].toUpperCase();
    if (r.b.short) s += FILES[outerShort];
    if (r.b.long) s += FILES[outerLong];
    return s || '-';
  }

  /** Add king-onto-own-rook castle destinations for the side to move, if legal right now. */
  private addCastleDests(dests: Dests): void {
    const color = this.turn;
    const cf = this.castleFiles;
    const rights = this.rights;
    if (!cf || !rights) return;
    const rank = color === 'w' ? 1 : 8;
    const kingFile = color === 'w' ? cf.whiteKingFile : cf.blackKingFile;
    const rookFiles = color === 'w' ? cf.whiteRookFiles : cf.blackRookFiles;
    const kingSq = sqOf(kingFile, rank);
    for (const rookFile of rookFiles) {
      const side: 'short' | 'long' = rookFile > kingFile ? 'short' : 'long';
      if (!rights[color][side]) continue;
      if (!this.castleLegal(color, side)) continue;
      const arr = dests.get(kingSq);
      const rookSq = sqOf(rookFile, rank);
      if (arr) arr.push(rookSq);
      else dests.set(kingSq, [rookSq]);
    }
  }

  /** If (from,to) is the side-to-move king onto one of its own rooks, return the side. */
  private castleSideFor(from: string, to: string): 'short' | 'long' | null {
    const cf = this.castleFiles;
    if (!cf) return null;
    const color = this.turn;
    const rank = color === 'w' ? 1 : 8;
    const kingFile = color === 'w' ? cf.whiteKingFile : cf.blackKingFile;
    const rookFiles = color === 'w' ? cf.whiteRookFiles : cf.blackRookFiles;
    if (from !== sqOf(kingFile, rank)) return null;
    if (rankOf(to) !== rank) return null;
    const toFile = fileOf(to);
    if (!rookFiles.includes(toFile)) return null;
    return toFile > kingFile ? 'short' : 'long';
  }

  /** Generalised 960 castle legality: right live, not in/through check, paths clear. */
  private castleLegal(color: Color, side: 'short' | 'long'): boolean {
    const cf = this.castleFiles!;
    const rights = this.rights!;
    if (!rights[color][side]) return false;

    const rank = color === 'w' ? 1 : 8;
    const kingFile = color === 'w' ? cf.whiteKingFile : cf.blackKingFile;
    const rookFiles = color === 'w' ? cf.whiteRookFiles : cf.blackRookFiles;
    const rookFile = side === 'short' ? Math.max(...rookFiles) : Math.min(...rookFiles);
    const kingTargetFile = side === 'short' ? SHORT_KING_FILE : LONG_KING_FILE;
    const rookTargetFile = side === 'short' ? SHORT_ROOK_FILE : LONG_ROOK_FILE;

    // Rook still on its home file (right could be stale if board edited).
    const rookHome = this.chess.get(sqOf(rookFile, rank) as Square);
    if (!rookHome || rookHome.type !== 'r' || rookHome.color !== color) return false;

    // 1) King not currently in check; every square the king PASSES (start..target inclusive)
    //    must be free of opponent attack.
    const kingPath = inclusiveRange(kingFile, kingTargetFile);
    const enemy: Color = color === 'w' ? 'b' : 'w';
    for (const f of kingPath) {
      if (this.chess.isAttacked(sqOf(f, rank) as Square, enemy)) return false;
    }

    // 2) Squares in (king-path ∪ rook-path), except the king-start and rook-start, must be
    //    empty. In 960 the king and rook can start adjacent / overlap paths; only those two
    //    pieces may occupy the union.
    const rookPath = inclusiveRange(rookFile, rookTargetFile);
    const union = new Set<number>([...kingPath, ...rookPath]);
    union.add(kingTargetFile);
    union.add(rookTargetFile);
    for (const f of union) {
      if (f === kingFile || f === rookFile) continue; // the two castling pieces
      if (this.chess.get(sqOf(f, rank) as Square)) return false;
    }
    return true;
  }

  /** Manually relocate king→target and rook→target, flip turn, clear that side's rights. */
  private applyCastle(side: 'short' | 'long'): string | null {
    const color = this.turn;
    if (!this.castleLegal(color, side)) return null;

    const cf = this.castleFiles!;
    const rank = color === 'w' ? 1 : 8;
    const kingFile = color === 'w' ? cf.whiteKingFile : cf.blackKingFile;
    const rookFiles = color === 'w' ? cf.whiteRookFiles : cf.blackRookFiles;
    const rookFile = side === 'short' ? Math.max(...rookFiles) : Math.min(...rookFiles);
    const kingTargetFile = side === 'short' ? SHORT_KING_FILE : LONG_KING_FILE;
    const rookTargetFile = side === 'short' ? SHORT_ROOK_FILE : LONG_ROOK_FILE;

    // Mutate the board via remove/put (order matters when start/target squares overlap):
    // lift both pieces first, then place them.
    this.chess.remove(sqOf(kingFile, rank) as Square);
    this.chess.remove(sqOf(rookFile, rank) as Square);
    this.chess.put({ type: 'k' as PieceSymbol, color }, sqOf(kingTargetFile, rank) as Square);
    this.chess.put({ type: 'r' as PieceSymbol, color }, sqOf(rookTargetFile, rank) as Square);

    // Rebuild a FEN with the turn flipped and this side's KQkq subset dropped, then reload
    // so chess.js's turn/clocks/legal-move generation continue correctly.
    this.rights![color] = { short: false, long: false };
    this.reloadWithTurnFlippedAndRights(color);

    const san = side === 'short' ? 'O-O' : 'O-O-O';
    this.san960.push(san);
    return san;
  }

  /** After a manual board edit, flip side-to-move and write the decorative KQkq subset. */
  private reloadWithTurnFlippedAndRights(justMoved: Color): void {
    const parts = this.chess.fen().split(' ');
    parts[1] = justMoved === 'w' ? 'b' : 'w';
    parts[2] = this.decorativeKQkq();
    parts[3] = '-'; // castling clears any ep
    // Increment halfmove clock (castle is not a capture/pawn move → +1),
    // and bump fullmove when black just moved.
    parts[4] = String(Number(parts[4] || '0') + 1);
    if (justMoved === 'b') parts[5] = String(Number(parts[5] || '1') + 1);
    this.chess.load(parts.join(' '));
  }

  /**
   * Returns '-' so that chess.js generates zero phantom standard castles after a manual
   * board reload in 960 mode. The shim owns all castling rights; chess.js must not see
   * any castling indicator in the FEN it loads.
   */
  private decorativeKQkq(): string {
    return '-';
  }

  /** A normal king move clears both that side's rights; a rook leaving home clears its side;
   *  capturing a rook on its home square clears the opponent's matching right. */
  private updateRightsAfterNormalMove(m: Move): void {
    const cf = this.castleFiles!;
    const r = this.rights!;
    if (m.piece === 'k') {
      r[m.color] = { short: false, long: false };
    }
    if (m.piece === 'r') {
      const homeRank = m.color === 'w' ? 1 : 8;
      if (rankOf(m.from) === homeRank) {
        const files = m.color === 'w' ? cf.whiteRookFiles : cf.blackRookFiles;
        const kingFile = m.color === 'w' ? cf.whiteKingFile : cf.blackKingFile;
        const f = fileOf(m.from);
        if (f === Math.max(...files) && f > kingFile) r[m.color].short = false;
        if (f === Math.min(...files) && f < kingFile) r[m.color].long = false;
      }
    }
    // Capture of an enemy rook on its home square.
    if (m.captured === 'r') {
      const enemy: Color = m.color === 'w' ? 'b' : 'w';
      const homeRank = enemy === 'w' ? 1 : 8;
      if (rankOf(m.to) === homeRank) {
        const files = enemy === 'w' ? cf.whiteRookFiles : cf.blackRookFiles;
        const kingFile = enemy === 'w' ? cf.whiteKingFile : cf.blackKingFile;
        const f = fileOf(m.to);
        if (f === Math.max(...files) && f > kingFile) r[enemy].short = false;
        if (f === Math.min(...files) && f < kingFile) r[enemy].long = false;
      }
    }
  }

  /** Drop any right whose rook is no longer on its home square (after a board load). */
  private syncRightsToBoard(): void {
    if (!this.castleFiles || !this.rights) return;
    for (const color of ['w', 'b'] as Color[]) {
      const rank = color === 'w' ? 1 : 8;
      const files = color === 'w' ? this.castleFiles.whiteRookFiles : this.castleFiles.blackRookFiles;
      const kingFile = color === 'w' ? this.castleFiles.whiteKingFile : this.castleFiles.blackKingFile;
      const short = Math.max(...files);
      const long = Math.min(...files);
      const hasRook = (f: number) => {
        const pc = this.chess.get(sqOf(f, rank) as Square);
        return !!pc && pc.type === 'r' && pc.color === color;
      };
      const kingHome = (() => {
        const pc = this.chess.get(sqOf(kingFile, rank) as Square);
        return !!pc && pc.type === 'k' && pc.color === color;
      })();
      if (!kingHome) this.rights[color] = { short: false, long: false };
      if (short > kingFile && !hasRook(short)) this.rights[color].short = false;
      if (long < kingFile && !hasRook(long)) this.rights[color].long = false;
    }
  }
}

/**
 * Replace field index 2 (castling) of a FEN string with '-'.
 * Used in Chess960 mode so chess.js never sees a live castling indicator and therefore
 * never generates phantom standard ±2 king moves; the shim owns all 960 castling logic.
 */
function neutralizeCastling(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length >= 3) parts[2] = '-';
  return parts.join(' ');
}

/** Inclusive integer range between a and b in either direction. */
function inclusiveRange(a: number, b: number): number[] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}
