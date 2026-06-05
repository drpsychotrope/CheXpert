// ETL: Lichess CC0 puzzle DB (CSV) -> curated, NORMALIZED subset for the client.
//
// Input  : a DECOMPRESSED Lichess puzzle CSV (PuzzleId,FEN,Moves,Rating,RatingDeviation,
//          Popularity,NbPlays,Themes,GameUrl,OpeningTags).
//          Download (CC0): https://database.lichess.org/#puzzles  (lichess_db_puzzle.csv.zst)
//          Decompress to lichess_db_puzzle.csv, then point INPUT at it.
//          (Or just run `npm run fetch:puzzles`, which downloads + unpacks for you.)
// Output : public/puzzles/puzzles.json  (array of normalized Puzzle objects)
//
// The curation/normalization logic lives in ./lib/puzzle-etl.mjs so the download
// path (fetch-puzzles.mjs) and this on-disk-CSV path share exactly one implementation.
//
// Usage: node scripts/build-puzzle-subset.mjs [path-to-csv] [maxPuzzles]

import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSubset, BANDS, DEFAULT_OUT } from './lib/puzzle-etl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = process.argv[2] || join(root, 'lichess_db_puzzle.csv');
const MAX = Number(process.argv[3] || 80000);

if (!existsSync(INPUT)) {
  console.error(`[etl] CSV not found at ${INPUT}`);
  console.error('[etl] Download the CC0 DB from https://database.lichess.org/#puzzles');
  console.error('[etl] Decompress lichess_db_puzzle.csv.zst, then re-run with the path —');
  console.error('[etl] or run `npm run fetch:puzzles` to download + unpack automatically.');
  console.error('[etl] The app still works without this — it falls back to public/puzzles/seed-puzzles.json.');
  process.exit(1);
}

const lines = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });
const { scanned, kept, counts, bytes } = await buildSubset(lines, { max: MAX, out: DEFAULT_OUT });
console.log(`[etl] scanned ${scanned} rows, kept ${kept} puzzles`);
console.log('[etl] per-band counts:', counts.map((c, i) => `${BANDS[i]}-${BANDS[i + 1]}:${c}`).join(' '));
console.log(`[etl] wrote ${DEFAULT_OUT} (${(bytes / 1048576).toFixed(1)} MB)`);
