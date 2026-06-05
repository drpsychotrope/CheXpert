// Reusable ETL core for the Lichess CC0 puzzle DB. Consumes an async-iterable of
// CSV lines (header included) and writes a curated, NORMALIZED subset to puzzles.json.
//
// Used by:
//   - scripts/build-puzzle-subset.mjs  (CLI: a decompressed CSV already on disk)
//   - scripts/fetch-puzzles.mjs        (download + stream-decompress the .csv.zst)
//
// Normalization (see src/trainer/puzzle.ts): the Lichess FEN is one ply BEFORE the
// solver's turn and Moves[0] is the opponent's setup move. We APPLY Moves[0] to the
// FEN here so the client always gets "solver to move, moves[0] = solver move".
//
// Curation (spec Q-E=a): keep a bounded subset spread across rating bands and themes,
// filtered by popularity, so the client stays light (~80k target).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../../node_modules/chess.js/dist/esm/chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Default output: public/puzzles/puzzles.json (the app prefers this over the seed set). */
export const DEFAULT_OUT = join(root, 'public', 'puzzles', 'puzzles.json');

/** Rating-band edges; one bucket per [BANDS[i], BANDS[i+1]) so the subset is spread. */
export const BANDS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 3000];

const MIN_POPULARITY = 80; // Lichess popularity is roughly -100..100
const MIN_NBPLAYS = 50;

function bandIndex(rating) {
  for (let i = 0; i < BANDS.length - 1; i++) {
    if (rating >= BANDS[i] && rating < BANDS[i + 1]) return i;
  }
  return -1;
}

function uciToObj(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' };
}

/**
 * Run the ETL over an async-iterable of CSV lines (the header line included).
 * @param {AsyncIterable<string>|Iterable<string>} lines
 * @param {{ max?: number, out?: string }} [opts]
 * @returns {Promise<{ scanned: number, kept: number, counts: number[], bytes: number }>}
 */
export async function buildSubset(lines, { max = 80000, out = DEFAULT_OUT } = {}) {
  // Per-rating-band cap so the subset is spread, not clustered at one level.
  const perBand = Math.ceil(max / (BANDS.length - 1));
  const counts = new Array(BANDS.length - 1).fill(0);
  const result = [];
  let scanned = 0;
  let kept = 0;
  let header = true;

  for await (const line of lines) {
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
    if (bi < 0 || counts[bi] >= perBand) continue;

    const moves = Moves.trim().split(/\s+/);
    if (moves.length < 2) continue;

    // Normalize: apply the opponent's setup move (Moves[0]) to the FEN.
    let userFen;
    try {
      const chess = new Chess(FEN);
      const m = chess.move(uciToObj(moves[0]));
      if (!m) continue;
      userFen = chess.fen();
    } catch {
      continue;
    }

    result.push({
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
    if (kept >= max) break;
  }

  mkdirSync(dirname(out), { recursive: true });
  const json = JSON.stringify(result);
  writeFileSync(out, json);
  return { scanned, kept, counts, bytes: json.length };
}
