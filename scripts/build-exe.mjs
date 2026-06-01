// Build a single-file Windows .exe launcher using Node's built-in SEA
// (Single Executable Application) — no compiler, no external packager toolchain.
//
// Steps (all via the user's own Node — nothing downloaded to build):
//   1. vite build            → dist/ (done separately by `npm run build`)
//   2. node --experimental-sea-config → build/sea-prep.blob (bundles server.cjs)
//   3. copy node.exe         → build/ChessTrainer.exe
//   4. postject inject blob  → makes the copied node run our launcher
//   5. copy dist/            → build/dist/  (assets sit NEXT TO the exe)
//
// Result: build/ChessTrainer.exe + build/dist/ — zip the build/ folder and ship it.
// Double-click the exe → local server + borderless app window. No install.
//
// Run: npm run build:exe   (assumes `npm run build` already produced dist/)

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const exePath = join(buildDir, 'ChessTrainer.exe');
const blobPath = join(buildDir, 'sea-prep.blob');

function run(cmd, args, opts = {}) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  return execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
}

if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

// 1. Generate the SEA blob from the launcher.
run(process.execPath, ['--experimental-sea-config', 'launcher/sea-config.json']);

// 2. Copy the running node.exe as our exe base.
copyFileSync(process.execPath, exePath);
console.log(`copied node → ${exePath}`);

// 3. Remove the signature (Windows; ignore if signtool absent).
try {
  run('signtool', ['remove', '/s', exePath]);
} catch {
  console.log('(signtool not available — skipping signature removal; injection still works)');
}

// 4. Inject the blob with postject (installed as a dev dep).
const postject = join(root, 'node_modules', 'postject', 'dist', 'cli.js');
run(process.execPath, [
  postject,
  exePath,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
]);

// 5. Copy the app assets next to the exe.
const distOut = join(buildDir, 'dist');
rmSync(distOut, { recursive: true, force: true });
cpSync(join(root, 'dist'), distOut, { recursive: true });
console.log(`copied dist → ${distOut}`);

// Clean the intermediate blob.
rmSync(blobPath, { force: true });

console.log('\nDone. Ship the whole build/ folder:');
console.log('  build/ChessTrainer.exe   (the launcher)');
console.log('  build/dist/              (app + engine + puzzles, must sit beside the exe)');
console.log('Double-click ChessTrainer.exe to play.');
