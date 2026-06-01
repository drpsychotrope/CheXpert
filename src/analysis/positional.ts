// Honest, FEN-derived positional features (spec E / ADR-0031). Pure (chess.js).
// Used to give a "why" for non-tactical mistakes — only asserting features that are
// actually present (extends the no-LLM honesty doctrine, ADR-0007/AP-CHESS-19).

import { Chess } from 'chess.js';

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface SideStructure {
  doubledFiles: string[]; // file letters with ≥2 pawns
  isolated: string[]; // squares of isolated pawns
  passed: string[]; // squares of passed pawns
}
export interface PositionalFeatures {
  material: number; // white − black
  w: SideStructure;
  b: SideStructure;
}

interface Pawn { f: number; r: number; sq: string }

export function positionalFeatures(fen: string): PositionalFeatures {
  let board: ReturnType<Chess['board']>;
  let material = 0;
  try {
    const c = new Chess(fen);
    board = c.board();
  } catch {
    return { material: 0, w: empty(), b: empty() };
  }
  const pawns: Record<'w' | 'b', Pawn[]> = { w: [], b: [] };
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      material += (cell.color === 'w' ? 1 : -1) * (VAL[cell.type] ?? 0);
      if (cell.type === 'p') {
        pawns[cell.color].push({ f: cell.square.charCodeAt(0) - 97, r: Number(cell.square[1]), sq: cell.square });
      }
    }
  }
  return { material, w: structure('w', pawns), b: structure('b', pawns) };
}

function empty(): SideStructure {
  return { doubledFiles: [], isolated: [], passed: [] };
}

function structure(color: 'w' | 'b', pawns: Record<'w' | 'b', Pawn[]>): SideStructure {
  const mine = pawns[color];
  const enemy = pawns[color === 'w' ? 'b' : 'w'];
  const fileCount = new Map<number, number>();
  for (const p of mine) fileCount.set(p.f, (fileCount.get(p.f) ?? 0) + 1);

  const doubledFiles = [...fileCount.entries()].filter(([, n]) => n >= 2).map(([f]) => String.fromCharCode(97 + f)).sort();

  const isolated = mine
    .filter((p) => !mine.some((q) => Math.abs(q.f - p.f) === 1))
    .map((p) => p.sq);

  const passed = mine
    .filter((p) => {
      const ahead = (er: number) => (color === 'w' ? er > p.r : er < p.r);
      return !enemy.some((e) => Math.abs(e.f - p.f) <= 1 && ahead(e.r));
    })
    .map((p) => p.sq)
    .sort();

  return { doubledFiles, isolated: isolated.sort(), passed };
}

/** Honest phrases for present structural features. Optionally restricted to one side. */
export function explainPositional(fen: string, side?: 'w' | 'b'): string[] {
  const F = positionalFeatures(fen);
  const out: string[] = [];
  for (const c of ['w', 'b'] as const) {
    if (side && side !== c) continue;
    const who = c === 'w' ? 'White' : 'Black';
    if (F[c].isolated.length) out.push(`${who} has an isolated pawn (${F[c].isolated.join(', ')}).`);
    if (F[c].doubledFiles.length) out.push(`${who} has doubled pawns on the ${F[c].doubledFiles.join('/')}-file.`);
    if (F[c].passed.length) out.push(`${who} has a passed pawn (${F[c].passed.join(', ')}).`);
  }
  return out;
}
