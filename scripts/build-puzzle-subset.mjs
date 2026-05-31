// ETL: Lichess CC0 puzzle DB (CSV) -> curated, NORMALIZED subset for the client.
//
// Input  : a Lichess puzzle CSV (PuzzleId,FEN,Moves,Rating,RatingDeviation,
//          Popularity,NbPlays,Themes,GameUrl,OpeningTags).
//          Download (CC0): https://database.lichess.org/#puzzles  (lichess_db_puzzle.csv.zst)
//          Decompress to lichess_db_puzzle.csv, then point INPUT at it.
// Output : public/puzzles/puzzles.json  (array of normalized Puzzle objects)
//
// Normalization (see src/trainer/puzzle.ts): Lichess FEN is one ply BEFORE the
// solver's turn and Moves[0] is the opponent's setup move. We APPLY Moves[0] to
// the FEN here so the client always gets "solver to move, moves[0] = solver move".
//
// Curation (spec Q-E=a): keep a bounded subset spread across rating bands and
// themes, filtered by popularity, so the client stays light (~50-100k target).
//
// Usage: node scripts/build-puzzle-subset.mjs [path-to-csv] [maxPuzzles]

import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../node_modules/chess.js/dist/esm/chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = process.argv[2] || join(root, 'lichess_db_puzzle.csv');
const MAX = Number(process.argv[3] || 80000);
const OUT = join(root, 'public', 'puzzles', 'puzzles.json');

// Per-rating-band cap so the subset is spread, not clustered at one level.
const BANDS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 3000];
const PER_BAND = Math.ceil(MAX / (BANDS.length - 1));
const MIN_POPULARITY = 80; // Lichess popularity is roughly -100..100
const MIN_NBPLAYS = 50;

if (!existsSync(INPUT)) {
  console.error(`[etl] CSV not found at ${INPUT}`);
  console.error('[etl] Download the CC0 DB from https://database.lichess.org/#puzzles');
  console.error('[etl] Decompress lichess_db_puzzle.csv.zst, then re-run with the path.');
  console.error('[etl] The app still works without this — it falls back to public/puzzles/seed-puzzles.json.');
  process.exit(1);
}

function bandIndex(rating) {
  for (let i = 0; i < BANDS.length - 1; i++) {
    if (rating >= BANDS[i] && rating < BANDS[i + 1]) return i;
  }
  return -1;
}

const counts = new Array(BANDS.length - 1).fill(0);
const out = [];
let scanned = 0;
let kept = 0;

const rl = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });
let header = true;

for await (const line of rl) {
  if (header) {
    header = false;
    continue;
  }
  scanned++;
  // CSV fields are simple (no embedded commas in the columns we use up to Themes).
  const cols = line.split(',');
  if (cols.length < 8) continue;
  const [PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes] = cols;

  const rating = Number(Rating);
  const pop = Number(Popularity);
  const plays = Number(NbPlays);
  if (!Number.isFinite(rating)) continue;
  if (pop < MIN_POPULARITY || plays < MIN_NBPLAYS) continue;

  const bi = bandIndex(rating);
  if (bi < 0 || counts[bi] >= PER_BAND) continue;

  const moves = Moves.trim().split(/\s+/);
  if (moves.length < 2) continue;

  // Normalize: apply opponent setup move (Moves[0]) to FEN.
  let userFen;
  try {
    const chess = new Chess(FEN);
    const m = chess.move(uciToObj(moves[0]));
    if (!m) continue;
    userFen = chess.fen();
  } catch {
    continue;
  }

  out.push({
    id: PuzzleId,
    fen: userFen,
    moves: moves.slice(1),
    rating,
    ratingDeviation: Number(RatingDeviation) || 75,
    themes: Themes ? Themes.trim().split(/\s+/) : [],
    source: 'curated',
  });
  counts[bi]++;
  kept++;
  if (kept >= MAX) break;
}

function uciToObj(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`[etl] scanned ${scanned} rows, kept ${kept} puzzles`);
console.log(`[etl] per-band counts:`, counts.map((c, i) => `${BANDS[i]}-${BANDS[i + 1]}:${c}`).join(' '));
console.log(`[etl] wrote ${OUT} (${(JSON.stringify(out).length / 1048576).toFixed(1)} MB)`);
