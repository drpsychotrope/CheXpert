// Validate every endgame drill FEN: legal, side-not-to-move NOT in check
// (Syzygy rejects "opposite check" with HTTP 400), and <= 7 pieces (tablebase
// coverage). Run before shipping drills so an illegal position can't ship again.
//
// Run: node scripts/validate-endgames.mjs   (exit 1 if any drill is invalid)

import { Chess } from '../node_modules/chess.js/dist/esm/chess.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/endgame/drills.ts'), 'utf8');
const re = /id:\s*'([^']+)',[\s\S]*?fen:\s*'([^']+)'/g;

let bad = 0;
let n = 0;
let m;
while ((m = re.exec(src))) {
  const [, id, fen] = m;
  n++;
  const pieces = (fen.split(' ')[0].match(/[a-zA-Z]/g) || []).length;
  let verdict = 'ok';
  try {
    const c = new Chess(fen);
    // opposite check: flip the side to move; if that side is in check, the
    // original position has the not-to-move side in check → illegal.
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    const flipped = new Chess(parts.join(' '));
    if (flipped.inCheck()) verdict = 'OPPOSITE-CHECK';
    else if (c.isGameOver()) verdict = 'ALREADY-OVER';
    else if (pieces > 7) verdict = `TOO-MANY-PIECES(${pieces})`;
    else if (c.moves().length === 0) verdict = 'NO-MOVES';
  } catch (e) {
    verdict = 'LOAD-FAIL ' + String(e).slice(0, 40);
  }
  if (verdict !== 'ok') {
    bad++;
    console.log(`BAD  ${id.padEnd(22)} ${verdict.padEnd(18)} ${fen}`);
  }
}
console.log(`checked ${n} drills, ${bad} bad`);
process.exit(bad ? 1 : 0);
