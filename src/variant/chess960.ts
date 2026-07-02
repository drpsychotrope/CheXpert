// Pure Chess960 (Fischer-Random) start-position generator.
//
// SP-ID 0..959 uses the canonical Scharnagl/Lichess numbering, so id 518 is the
// standard position (RNBQKBNR) and ids round-trip. `rand` is INJECTED by the caller
// (Play.svelte supplies it), matching every other pure core in the repo
// (AP-960-10: no randomness calls inside the pure generator/shim cores).
//
// Emits: the back-rank (lowercase piece letters), a chess.js-loadable start FEN with
// decorative `KQkq` rights (chess.js accepts only KQkq — Shredder/X-FEN file-letters are
// rejected), and the true king/rook files for the castling shim (db/ChessGame).

export interface Chess960Castle {
  whiteKingFile: number;
  /** [queenside rook file, kingside rook file] — sorted ascending (a-file first). */
  whiteRookFiles: [number, number];
  blackKingFile: number;
  blackRookFiles: [number, number];
}

export interface Chess960Position {
  id: number; // 0..959
  backRank: string; // 8 lowercase letters, e.g. "rnbqkbnr"
  startFen: string; // full FEN, w KQkq - 0 1
  castle: Chess960Castle;
}

const KNIGHT_PLACEMENT: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [1, 2], [1, 3], [1, 4],
  [2, 3], [2, 4],
  [3, 4],
];

/**
 * Derive the back-rank for SP-ID 0..959 (Scharnagl). Light-square bishop, dark-square
 * bishop, queen, then the knight pair from a fixed 10-entry table, king+rooks fill the
 * three remaining squares left-to-right as rook-king-rook (king strictly between rooks).
 */
function backRankForId(id: number): string {
  const sq: (string | null)[] = Array(8).fill(null);

  const n2 = id % 4; // light-square bishop slot (b/d/f/h: files 1,3,5,7)
  const q1 = Math.floor(id / 4);
  const n3 = q1 % 4; // dark-square bishop slot (a/c/e/g: files 0,2,4,6)
  const q2 = Math.floor(q1 / 4);
  const n4 = q2 % 6; // queen index among the 6 remaining squares
  const n5 = Math.floor(q2 / 6); // 0..9 → knight pair from the table

  sq[n2 * 2 + 1] = 'b'; // light-square files are the odd indices on rank 1
  sq[n3 * 2] = 'b'; // dark-square files are the even indices

  // Queen on the n4-th still-empty square.
  placeNth(sq, n4, 'q');

  // Knights on the two empty squares named by the table (indices into the empties).
  const [ka, kb] = KNIGHT_PLACEMENT[n5];
  placeNth(sq, kb, 'n'); // place the higher index first so the lower index stays valid
  placeNth(sq, ka, 'n');

  // The three remaining squares get rook, king, rook (king strictly between).
  const empties = emptyIndices(sq);
  sq[empties[0]] = 'r';
  sq[empties[1]] = 'k';
  sq[empties[2]] = 'r';

  return sq.join('');
}

function emptyIndices(sq: (string | null)[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 8; i++) if (sq[i] === null) out.push(i);
  return out;
}

/** Place `piece` on the n-th currently-empty square (0-based among empties). */
function placeNth(sq: (string | null)[], n: number, piece: string): void {
  const empties = emptyIndices(sq);
  sq[empties[n]] = piece;
}

function castleFromBackRank(backRank: string): Chess960Castle {
  const king = backRank.indexOf('k');
  const rooks = [...backRank]
    .map((ch, i) => (ch === 'r' ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b) as [number, number] | number[];
  const rookFiles = [rooks[0], rooks[1]] as [number, number];
  return {
    whiteKingFile: king,
    whiteRookFiles: rookFiles,
    blackKingFile: king,
    blackRookFiles: rookFiles,
  };
}

function startFenFor(backRank: string): string {
  const black = backRank;
  const white = backRank.toUpperCase();
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

/** Derive the castling shim config from a stored 960 start FEN (PR-20, ADR-0078): the back
 *  rank is the FEN's first segment (Black's rank-8 layout — identical files for both sides at
 *  the start). Lets the analysis replay a persisted `GameRecord.startFen` without re-deriving
 *  the SP-ID. */
export function castleFromStartFen(startFen: string): Chess960Castle {
  const backRank = startFen.split(' ')[0].split('/')[0].toLowerCase();
  return castleFromBackRank(backRank);
}

/** Position by SP-ID (0..959). `byId(id).id === id`; id 518 === standard. */
export function chess960PositionById(id: number): Chess960Position {
  const n = ((id % 960) + 960) % 960;
  const backRank = backRankForId(n);
  return { id: n, backRank, startFen: startFenFor(backRank), castle: castleFromBackRank(backRank) };
}

/** Position from an injected uniform `rand` in [0,1). Maps to an SP-ID 0..959. */
export function chess960Position(rand: number): Chess960Position {
  const clamped = Math.min(0.999999, Math.max(0, rand));
  const id = Math.floor(clamped * 960);
  return chess960PositionById(id);
}
