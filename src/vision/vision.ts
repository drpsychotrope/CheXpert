// Board-vision / visualisation primitives (spec §4 item, ADR-0018). Pure functions
// — fully deterministic and unit-tested. Power two drills:
//   1) Square-colour trainer (instant board vision)
//   2) Knight-path visualiser (calculation: shortest knight route via BFS)

export type SquareColor = 'light' | 'dark';

const FILES = 'abcdefgh';

/** True if `sq` like "e4" is a valid algebraic square. */
export function isSquare(sq: string): boolean {
  return /^[a-h][1-8]$/.test(sq);
}

/** Colour of a square. a1 is dark; light when (file index + rank index) is odd. */
export function squareColor(sq: string): SquareColor {
  const file = FILES.indexOf(sq[0]); // 0..7
  const rank = Number(sq[1]) - 1; // 0..7
  return (file + rank) % 2 === 0 ? 'dark' : 'light';
}

/** All squares on the board, a1..h8. */
export function allSquares(): string[] {
  const out: string[] = [];
  for (let r = 1; r <= 8; r++) for (const f of FILES) out.push(`${f}${r}`);
  return out;
}

/** Pick a square deterministically from a 0..1 value (no Math.random in core). */
export function squareFrom(pick: number): string {
  const sq = allSquares();
  const i = Math.min(sq.length - 1, Math.max(0, Math.floor(pick * sq.length)));
  return sq[i];
}

function toXY(sq: string): [number, number] {
  return [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
}
function fromXY(x: number, y: number): string {
  return `${FILES[x]}${y + 1}`;
}

const KNIGHT_DELTAS: Array<[number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

/** All squares a knight can reach from `sq` in one move. */
export function knightMovesFrom(sq: string): string[] {
  const [x, y] = toXY(sq);
  const out: string[] = [];
  for (const [dx, dy] of KNIGHT_DELTAS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) out.push(fromXY(nx, ny));
  }
  return out;
}

/** True if from→to is a single legal knight move. */
export function isKnightMove(from: string, to: string): boolean {
  return knightMovesFrom(from).includes(to);
}

/**
 * Shortest knight path from `from` to `to` inclusive (BFS). Returns the list of
 * squares [from, ..., to], or null if from/to invalid. from===to → [from].
 */
export function knightShortestPath(from: string, to: string): string[] | null {
  if (!isSquare(from) || !isSquare(to)) return null;
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const visited = new Set<string>([from]);
  let frontier = [from];
  while (frontier.length) {
    const next: string[] = [];
    for (const sq of frontier) {
      for (const m of knightMovesFrom(sq)) {
        if (visited.has(m)) continue;
        visited.add(m);
        prev.set(m, sq);
        if (m === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) {
            cur = prev.get(cur)!;
            path.unshift(cur);
          }
          return path;
        }
        next.push(m);
      }
    }
    frontier = next;
  }
  return null; // unreachable on a standard 8x8 board this never happens
}

/** Number of knight moves in the shortest path (path length - 1), or -1. */
export function knightDistance(from: string, to: string): number {
  const p = knightShortestPath(from, to);
  return p ? p.length - 1 : -1;
}
