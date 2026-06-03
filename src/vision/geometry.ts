// Square-relation geometry for the board-vision "diagonal / line / reach" drill (ADR-0043).
// Pure + deterministic. Colour is a by-product (same-color), never the drill's sole end.

import { allSquares, squareColor } from './vision';

const FILES = 'abcdefgh';
function toXY(sq: string): [number, number] {
  return [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
}
function fromXY(x: number, y: number): string {
  return `${FILES[x]}${y + 1}`;
}

/** Same rank, distinct squares. */
export function sameRank(a: string, b: string): boolean {
  return a !== b && toXY(a)[1] === toXY(b)[1];
}
/** Same file, distinct squares. */
export function sameFile(a: string, b: string): boolean {
  return a !== b && toXY(a)[0] === toXY(b)[0];
}
/** On a common diagonal: |Δfile| === |Δrank| (and distinct). */
export function sameDiagonal(a: string, b: string): boolean {
  if (a === b) return false;
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dfx = bx - ax;
  const dfy = by - ay;
  return dfx !== 0 && Math.abs(dfx) === Math.abs(dfy);
}

export type Line = 'rank' | 'file' | 'diagonal';

/** Which line a and b share, or null if not aligned. */
export function aligned(a: string, b: string): Line | null {
  if (a === b) return null;
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dfx = bx - ax;
  const dfy = by - ay;
  if (dfy === 0 && dfx !== 0) return 'rank';
  if (dfx === 0 && dfy !== 0) return 'file';
  if (Math.abs(dfx) === Math.abs(dfy)) return 'diagonal';
  return null;
}

/** Squares strictly between a and b along their shared line; [] if not aligned/adjacent. */
export function squaresBetween(a: string, b: string): string[] {
  if (aligned(a, b) === null) return [];
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = Math.sign(bx - ax);
  const dy = Math.sign(by - ay);
  const out: string[] = [];
  let x = ax + dx;
  let y = ay + dy;
  while (x !== bx || y !== by) {
    out.push(fromXY(x, y));
    x += dx;
    y += dy;
  }
  // Canonical (endpoint-order-independent) ordering. Lexical sort of algebraic squares
  // orders by file then rank — ascending for ranks, files, and diagonals alike.
  return out.sort();
}

export type RelationKind = 'same-diagonal' | 'between' | 'same-color';
export interface Relation {
  a: string;
  b: string;
  kind: RelationKind;
  prompt: string;
  answer: boolean | number;
}

const SQ = allSquares();

/** Deterministic relation question from a pick in [0,1). No Math.random. */
export function genRelation(pick: number): Relation {
  const i = Math.min(63, Math.max(0, Math.floor(pick * 64)));
  const a = SQ[i];
  const kind: RelationKind = (['same-diagonal', 'between', 'same-color'] as const)[i % 3];

  if (kind === 'between') {
    const [ax, ay] = toXY(a);
    const b = fromXY(7 - ax, ay); // same rank, mirrored file → always aligned + distinct
    return { a, b, kind, prompt: `How many squares are strictly between ${a} and ${b}?`, answer: squaresBetween(a, b).length };
  }
  if (kind === 'same-diagonal') {
    let j = (i * 7 + 3) % 64;
    if (j === i) j = (j + 1) % 64;
    const b = SQ[j];
    return { a, b, kind, prompt: `Are ${a} and ${b} on the same diagonal?`, answer: sameDiagonal(a, b) };
  }
  let j = (i * 5 + 1) % 64;
  if (j === i) j = (j + 1) % 64;
  const b = SQ[j];
  return { a, b, kind, prompt: `Are ${a} and ${b} the same colour?`, answer: squareColor(a) === squareColor(b) };
}
