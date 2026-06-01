// Regenerate public/openings/eco.json from the Lichess chess-openings TSVs (CC0).
// Seed→ETL pattern (like the puzzle DB): a curated seed ships; run this to get the
// full ~3500-line set once you have the TSVs.
//
//   git clone https://github.com/lichess-org/chess-openings   (or download a/b/c/d/e.tsv)
//   npm run etl:eco  path/to/chess-openings
//
// Each TSV row is: eco \t name \t pgn(SAN). We convert SAN→UCI via chess.js and drop
// any line that doesn't parse (logged).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-eco.mjs <chess-openings-tsv-dir>');
  process.exit(1);
}

const out = [];
let dropped = 0;
for (const f of readdirSync(src).filter((n) => n.endsWith('.tsv'))) {
  const rows = readFileSync(join(src, f), 'utf8').split('\n').slice(1); // skip header
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    if (!eco || !name || !pgn) continue;
    const chess = new Chess();
    const uci = [];
    let ok = true;
    for (const tok of pgn.replace(/\d+\.(\.\.)?/g, '').trim().split(/\s+/)) {
      if (!tok) continue;
      try {
        const m = chess.move(tok);
        uci.push(m.from + m.to + (m.promotion ?? ''));
      } catch {
        ok = false;
        break;
      }
    }
    if (ok && uci.length) out.push({ eco, name, uci });
    else dropped++;
  }
}
writeFileSync(join(root, 'public', 'openings', 'eco.json'), JSON.stringify(out));
console.log(`[build-eco] wrote ${out.length} lines to public/openings/eco.json, dropped ${dropped} unparseable.`);
