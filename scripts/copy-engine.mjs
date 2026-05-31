// Copies the Stockfish *lite single-thread* asset out of the ~251MB `stockfish`
// dev package into public/stockfish/ so the runtime loads ONLY that file
// (never the whole package). Reproducible per spec G3 — globs for the
// single-threaded build regardless of the exact 18.0.7 filenames.
//
// Selection priority (single-thread = no SharedArrayBuffer = no COOP/COEP):
//   1. a *-single* build with SIMD (fastest single-thread)
//   2. any *-single* build
//   3. fallback: the root stockfish.js loader (auto-selects at runtime)
//
// Run: npm run copy:engine   (wired in package.json postinstall)

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'node_modules', 'stockfish');
const outDir = join(root, 'public', 'stockfish');

if (!existsSync(pkgDir)) {
  console.error('[copy-engine] node_modules/stockfish not found. Run: npm i -D stockfish@18.0.7');
  process.exit(1);
}

/** Recursively collect files under dir. */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push({ path: p, name, size: st.size });
  }
  return acc;
}

const files = walk(pkgDir);
const js = files.filter((f) => f.name.endsWith('.js'));
const wasm = files.filter((f) => f.name.endsWith('.wasm'));

const isSingle = (n) => /single/i.test(n);
const isMulti = (n) => /(threaded|-mt-|worker)/i.test(n) && !isSingle(n);
const hasSimd = (n) => /simd/i.test(n) || (!/no[-_]?simd/i.test(n));

// Pick the single-thread JS loader.
let pickJs =
  js.filter((f) => isSingle(f.name) && hasSimd(f.name)).sort((a, b) => b.size - a.size)[0] ||
  js.filter((f) => isSingle(f.name)).sort((a, b) => b.size - a.size)[0] ||
  js.filter((f) => !isMulti(f.name)).sort((a, b) => a.size - b.size)[0] ||
  js[0];

if (!pickJs) {
  console.error('[copy-engine] No .js engine file found in package. Inspect node_modules/stockfish.');
  process.exit(1);
}

// Match the wasm whose basename shares the JS stem (e.g. foo-single.js -> foo-single.wasm),
// else the single-thread wasm, else the smallest wasm.
const stem = basename(pickJs.name).replace(/\.js$/, '');
let pickWasm =
  wasm.find((f) => f.name.replace(/\.wasm$/, '') === stem) ||
  wasm.filter((f) => isSingle(f.name)).sort((a, b) => a.size - b.size)[0] ||
  wasm.sort((a, b) => a.size - b.size)[0] ||
  null;

mkdirSync(outDir, { recursive: true });

const copied = [];
function take(f, asName) {
  if (!f) return;
  const dest = join(outDir, asName ?? f.name);
  copyFileSync(f.path, dest);
  copied.push({ name: basename(dest), mb: (f.size / 1048576).toFixed(2) });
}

// Copy under stable names the runtime expects.
take(pickJs, 'stockfish.js');
if (pickWasm) take(pickWasm, 'stockfish.wasm');

// Some loaders fetch a sibling .wasm by the ORIGINAL name embedded in the JS.
// Copy the original-named wasm too, so either resolution path works.
if (pickWasm && pickWasm.name !== 'stockfish.wasm') take(pickWasm);

console.log('[copy-engine] selected JS  :', pickJs.name, `(${(pickJs.size / 1048576).toFixed(2)} MB)`);
console.log('[copy-engine] selected WASM:', pickWasm ? pickWasm.name : '(none — JS-embedded?)');
console.log('[copy-engine] wrote to public/stockfish/:', copied.map((c) => `${c.name} ${c.mb}MB`).join(', '));
console.log('[copy-engine] G3 next: load /stockfish/stockfish.js in a Worker, expect uciok/readyok, NO COOP/COEP.');
