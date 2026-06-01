// Procedurally generate a VERIFIED seed puzzle set (no hand-authoring errors).
//
// Strategy: brute-force small material (KQ-vs-K, KR-vs-K, K+2R-vs-K, KQ+P back-rank)
// over board squares; for each legal position with White to move, enumerate moves
// and keep only those where chess.js confirms isCheckmate(). Every emitted puzzle
// is therefore a correct mate-in-1 by construction. Output is normalized to the
// app's format (solver = White to move, moves[0] = the mating move in UCI).
//
// Run: node scripts/gen-seed-puzzles.mjs   → overwrites public/puzzles/seed-puzzles.json

import { Chess } from '../node_modules/chess.js/dist/esm/chess.js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = 'abcdefgh';
const sq = (f, r) => `${FILES[f]}${r + 1}`;
const adjacent = (a, b) => Math.abs(a.f - b.f) <= 1 && Math.abs(a.r - b.r) <= 1;

/** Build a FEN from a piece map { square: 'Q'|'R'|'k'... }, White to move. */
function fen(pieces) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(''));
  for (const [s, p] of Object.entries(pieces)) {
    const f = FILES.indexOf(s[0]);
    const r = Number(s[1]) - 1;
    board[r][f] = p;
  }
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} w - - 0 1`;
}

const seen = new Set();
const out = [];

/** Try a position: if White has a verified mate-in-1, emit a puzzle. */
function tryPosition(pieces, baseTheme, ratingBands) {
  let fenStr;
  try {
    fenStr = fen(pieces);
    const probe = new Chess(fenStr); // throws if illegal
    if (probe.isGameOver()) return; // already mate/stalemate
  } catch {
    return;
  }
  const chess = new Chess(fenStr);
  const mates = [];
  for (const m of chess.moves({ verbose: true })) {
    const c = new Chess(fenStr);
    c.move(m);
    if (c.isCheckmate()) mates.push(m);
  }
  if (mates.length === 0) return;
  // Require a UNIQUE mating move so the puzzle has one right answer.
  if (mates.length > 1) return;
  const m = mates[0];
  const uci = m.from + m.to + (m.promotion ?? '');
  if (seen.has(fenStr)) return;
  seen.add(fenStr);

  // Spread difficulty: more black escape squares before the mate = harder. Map the
  // pre-move legal-king-move count to a rating band so the set isn't all one level.
  const pre = new Chess(fenStr);
  const blackEscapes = (() => {
    const f = fenStr.replace(' w ', ' b ');
    try {
      const cc = new Chess(f);
      return cc.moves({ verbose: true }).filter((mv) => mv.piece === 'k').length;
    } catch {
      return 0;
    }
  })();
  void pre;
  const rating = ratingBands + Math.min(5, blackEscapes) * 90; // base..base+450

  const themes = [...baseTheme];
  const blackKingRank = Object.entries(pieces).find(([, p]) => p === 'k')[0][1];
  if (blackKingRank === '8' && (m.piece === 'r' || m.piece === 'q')) themes.push('backRankMate');
  out.push({
    id: `seed-m1-${out.length + 1}`,
    fen: fenStr,
    moves: [uci],
    rating,
    ratingDeviation: 90,
    themes,
    source: 'curated',
  });
}

// --- KQ vs K: king on edge, queen delivers mate from many geometries ---------
for (let kf = 0; kf < 8; kf++) {
  for (const kr of [0, 7]) {
    const bk = { f: kf, r: kr };
    for (let wkf = 0; wkf < 8; wkf++) {
      for (let wkr = 0; wkr < 8; wkr++) {
        const wk = { f: wkf, r: wkr };
        if (adjacent(bk, wk)) continue;
        if (Math.abs(bk.r - wk.r) > 2 || Math.abs(bk.f - wk.f) > 2) continue; // keep kings near
        for (let qf = 0; qf < 8; qf++) {
          for (let qr = 0; qr < 8; qr++) {
            const q = { f: qf, r: qr };
            if (adjacent(bk, q) && !adjacent(wk, q)) continue; // undefended adjacent Q = not mate anyway
            const ps = {};
            ps[sq(bk.f, bk.r)] = 'k';
            ps[sq(wk.f, wk.r)] = 'K';
            ps[sq(q.f, q.r)] = 'Q';
            if (new Set(Object.keys(ps)).size !== 3) continue;
            tryPosition(ps, ['mate', 'mateIn1'], 500);
          }
        }
      }
    }
  }
}

// --- Two rooks vs K (ladder mate on the edge) --------------------------------
for (let kf = 0; kf < 8; kf++) {
  for (const kr of [0, 7]) {
    const bk = { f: kf, r: kr };
    for (let r1c = 0; r1c < 8; r1c++) {
      for (let r2c = 0; r2c < 8; r2c++) {
        if (r1c === r2c) continue;
        const ps = {};
        ps[sq(bk.f, bk.r)] = 'k';
        // White king parked far away, rooks on two files/ranks.
        ps['a1'] = ps['a1'] || (bk.r === 0 && bk.f === 0 ? undefined : 'K');
        if (!ps['a1']) ps['h1'] = 'K';
        const edge = kr === 0 ? 0 : 7;
        const back = kr === 0 ? 1 : 6;
        ps[sq(r1c, edge)] = ps[sq(r1c, edge)] ? ps[sq(r1c, edge)] : 'R';
        ps[sq(r2c, back)] = ps[sq(r2c, back)] ? ps[sq(r2c, back)] : 'R';
        if (Object.values(ps).filter((p) => p === 'k').length !== 1) continue;
        if (new Set(Object.keys(ps)).size !== Object.keys(ps).length) continue;
        tryPosition(ps, ['mate', 'mateIn1', 'rookEndgame'], 600);
      }
    }
  }
}

// --- Back-rank mates: black king + pawn shield, white heavy piece ------------
for (const kfile of ['g', 'h', 'b', 'c']) {
  for (const heavy of ['R', 'Q']) {
    for (let hf = 0; hf < 8; hf++) {
      const ps = {};
      const kf = FILES.indexOf(kfile);
      ps[`${kfile}8`] = 'k';
      // pawn shield on the 7th in front of the king
      ps[`${kfile}7`] = 'p';
      if (kf + 1 < 8) ps[`${FILES[kf + 1]}7`] = 'p';
      if (kf - 1 >= 0) ps[`${FILES[kf - 1]}7`] = 'p';
      ps[`${FILES[hf]}1`] = heavy;
      ps['a3'] = 'K';
      if (ps[`${FILES[hf]}1`] !== heavy) continue;
      if (Object.keys(ps).includes('a3') && ps['a3'] !== 'K') continue;
      tryPosition(ps, ['mate', 'mateIn1'], 550);
    }
  }
}

// Interleave by rating so a cap keeps the full difficulty + mate-type spread
// (otherwise slice(0,CAP) would keep only the first family generated). Sort by a
// stable hash of the FEN within rating buckets — deterministic, no Math.random.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
out.sort((a, b) => a.rating - b.rating || hash(a.fen) - hash(b.fen));
// Round-robin across rating bands for an even spread.
const byBand = new Map();
for (const p of out) {
  const band = Math.round(p.rating / 100) * 100;
  if (!byBand.has(band)) byBand.set(band, []);
  byBand.get(band).push(p);
}
const bands = [...byBand.keys()].sort((a, b) => a - b);
const CAP = 150;
const kept = [];
let added = true;
while (kept.length < CAP && added) {
  added = false;
  for (const band of bands) {
    const bucket = byBand.get(band);
    if (bucket.length) {
      kept.push(bucket.shift());
      added = true;
      if (kept.length >= CAP) break;
    }
  }
}
// Renumber ids after interleave.
kept.forEach((p, i) => (p.id = `seed-m1-${i + 1}`));

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'public', 'puzzles', 'seed-puzzles.json');
const payload = {
  version: 2,
  note:
    'Procedurally generated, machine-verified mate-in-1 set (every solution confirmed by chess.js isCheckmate). Solver = White to move; moves[0] is the mating move. The real curated subset (~50-100k) comes from scripts/build-puzzle-subset.mjs over the Lichess CC0 DB and is preferred when present at public/puzzles/puzzles.json.',
  license: 'CC0 (generated positions). The Lichess puzzle database is CC0.',
  generatedCount: kept.length,
  puzzles: kept,
};
writeFileSync(outPath, JSON.stringify(payload, null, 0));
console.log(`generated ${kept.length} verified mate-in-1 puzzles → ${outPath}`);
