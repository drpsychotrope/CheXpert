// One-shot installer — `npm install` runs this (postinstall). It sets up EVERYTHING
// needed to run the app AND to ship the desktop launcher, in dependency order:
//
//   1. copy-engine    — vendor the Stockfish asset           → public/stockfish/
//   2. fetch-puzzles  — download + unpack the CC0 puzzle DB   → public/puzzles/puzzles.json
//   3. vite build     — production build (bundles the above) → dist/
//   4. build-exe      — SEA single-file .exe launcher        → build/ChessTrainer.exe
//
// Each step is IDEMPOTENT (skips when its output already exists, so re-installs are
// cheap) and NON-FATAL (a failure warns but never breaks `npm install`).
//
// Opt-outs (env):
//   SKIP_INSTALL_EXTRAS=1   skip puzzles + launcher build (engine still vendored) — CI-friendly
//   CHESS_SKIP_PUZZLES=1    skip only the puzzle download/unpack
//   CHESS_SKIP_EXE=1        skip only the app + .exe build
//   CHESS_FORCE=1           rebuild even when outputs already exist

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const env = process.env;
const FORCE = env.CHESS_FORCE === '1';
const skipExtras = env.SKIP_INSTALL_EXTRAS === '1';

/** Run `node <args...>` from the repo root, inheriting stdio. Returns true on exit 0. */
function run(label, args) {
  console.log(`\n[install] ${label}…`);
  const r = spawnSync(node, args, { cwd: root, stdio: 'inherit', env });
  if (r.error) console.warn(`[install] ${label} could not start: ${r.error.message} (continuing).`);
  else if (r.status !== 0) console.warn(`[install] ${label} did not complete (continuing).`);
  return !r.error && r.status === 0;
}

const script = (file) => join(root, 'scripts', file);

// 1. Engine asset — needed for `npm run dev` and bundled into the app. Non-fatal if the
//    stockfish devDep is absent (e.g. `npm install --omit=dev`).
run('vendoring Stockfish engine', [script('copy-engine.mjs')]);

// 2. Puzzles — download the CC0 DB + unpack into puzzles.json (self-skips if present).
if (skipExtras || env.CHESS_SKIP_PUZZLES === '1') {
  console.log('\n[install] puzzle DB step skipped (env opt-out).');
} else {
  run('fetching + unpacking puzzle DB', [script('fetch-puzzles.mjs')]);
}

// 3 + 4. App build (vite → dist/) then the SEA .exe launcher (→ build/). Skip the whole
//    block when the exe already exists, so adding a dep later doesn't rebuild 69 MB.
const exePath = join(root, 'build', 'ChessTrainer.exe');
if (skipExtras || env.CHESS_SKIP_EXE === '1') {
  console.log('\n[install] launcher build skipped (env opt-out).');
} else if (existsSync(exePath) && !FORCE) {
  console.log(`\n[install] launcher already built (${exePath}) — skipping (CHESS_FORCE=1 to rebuild).`);
} else {
  const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) {
    console.warn('\n[install] vite not installed (devDependencies omitted?) — skipping app + .exe build.');
  } else if (run('building app (vite build → dist/)', [viteBin, 'build'])) {
    run('building .exe launcher (SEA → build/)', [script('build-exe.mjs')]);
  } else {
    console.warn('[install] skipping .exe build because the app build did not complete.');
  }
}

console.log('\n[install] done.');
