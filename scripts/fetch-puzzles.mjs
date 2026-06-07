// Download the CC0 Lichess puzzle DB (lichess_db_puzzle.csv.zst, ~286 MB),
// stream-decompress it with Node's built-in Zstandard, and run the ETL straight
// into public/puzzles/puzzles.json — no multi-GB CSV is ever written to disk.
//
//   download (.zst, cached) ─► zstd decompress ─► CSV lines ─► buildSubset() ─► puzzles.json
//
// Idempotent : skips entirely if public/puzzles/puzzles.json already exists.
// Cached     : the .zst lands in scripts/.cache/ (gitignored); re-runs reuse it.
// Non-fatal  : any failure is swallowed — the app falls back to seed-puzzles.json.
//
// Requires Node >= 22.15 (built-in zlib Zstd). Older Node prints a friendly hint
// and exits 0 so `npm install` never breaks; use `npm run etl:puzzles <csv>` there.
//
// Env:
//   CHESS_FORCE=1     rebuild even if puzzles.json already exists
//   PUZZLE_MAX=N      target subset size (default 80000)
//   PUZZLE_DB_URL=…   override the source URL (e.g. a local mirror)
//
// Run: npm run fetch:puzzles   (also part of `npm install` via postinstall)

import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import zlib from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSubset, BANDS, DEFAULT_OUT } from './lib/puzzle-etl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.PUZZLE_DB_URL || 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const MAX = Number(process.env.PUZZLE_MAX || 80000);
const FORCE = process.env.CHESS_FORCE === '1';
// Supply-chain hardening (audit W10): optional integrity pin + a decompressed-size ceiling.
const EXPECT_SHA = process.env.PUZZLE_DB_SHA256;
const MAX_DECOMP_BYTES = Number(process.env.PUZZLE_MAX_DECOMPRESSED_BYTES || 5 * 1024 * 1024 * 1024);

const cacheDir = join(root, 'scripts', '.cache');
const zstPath = join(cacheDir, 'lichess_db_puzzle.csv.zst');
const partPath = zstPath + '.partial';

const mb = (n) => (n / 1048576).toFixed(1);

/** Optional supply-chain check: verify the cached .zst against PUZZLE_DB_SHA256 (audit W10).
 *  The Lichess file isn't versioned, so this is OPT-IN — set the env to pin a known-good build.
 *  Without it we still rely on HTTPS; with it the download is tamper-evident. */
async function verifyHash() {
  if (!EXPECT_SHA) return;
  const hash = createHash('sha256');
  await pipeline(createReadStream(zstPath), hash);
  const got = hash.digest('hex');
  if (got.toLowerCase() !== EXPECT_SHA.trim().toLowerCase()) {
    rmSync(zstPath, { force: true }); // drop the bad file so a re-run re-downloads
    throw new Error(`puzzle DB sha256 mismatch (expected ${EXPECT_SHA}, got ${got})`);
  }
  console.log('[puzzles] sha256 verified');
}

/** Abort if the decompressed stream blows past a sane ceiling (anti zip-bomb, audit W10). */
function decompressedCap() {
  let seen = 0;
  return new Transform({
    transform(chunk, _enc, cb) {
      seen += chunk.length;
      if (seen > MAX_DECOMP_BYTES) {
        cb(new Error(`decompressed stream exceeded the ${mb(MAX_DECOMP_BYTES)} MB cap (possible zip-bomb)`));
        return;
      }
      cb(null, chunk);
    },
  });
}

async function downloadZst() {
  if (existsSync(zstPath) && statSync(zstPath).size > 0) {
    console.log(`[puzzles] using cached DB (${mb(statSync(zstPath).size)} MB): ${zstPath}`);
    return;
  }
  mkdirSync(cacheDir, { recursive: true });
  console.log(`[puzzles] downloading CC0 puzzle DB (~286 MB, one-time): ${SRC}`);

  const res = await fetch(SRC);
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;

  // Count bytes in-stream (lossless, unlike a raw 'data' listener alongside a pipe).
  const isTty = Boolean(process.stdout.isTTY);
  let got = 0;
  let lastPct = -1;
  const meter = new Transform({
    transform(chunk, _enc, cb) {
      got += chunk.length;
      if (total) {
        const pct = Math.floor((got / total) * 100);
        const stepN = isTty ? 5 : 25;
        if (pct >= lastPct + stepN) {
          lastPct = pct;
          const msg = `[puzzles] ${pct}% (${mb(got)}/${mb(total)} MB)`;
          if (isTty) process.stdout.write(`\r${msg}   `);
          else console.log(msg);
        }
      }
      cb(null, chunk);
    },
  });

  rmSync(partPath, { force: true });
  await pipeline(Readable.fromWeb(res.body), meter, createWriteStream(partPath));
  if (isTty && total) process.stdout.write('\n');
  renameSync(partPath, zstPath); // atomic: only a complete download gets the final name
  console.log(`[puzzles] downloaded ${mb(statSync(zstPath).size)} MB → ${zstPath}`);
}

async function main() {
  if (existsSync(DEFAULT_OUT) && !FORCE) {
    console.log(`[puzzles] ${DEFAULT_OUT} already present — skipping (CHESS_FORCE=1 to rebuild).`);
    return;
  }
  if (typeof zlib.createZstdDecompress !== 'function') {
    console.warn('[puzzles] this Node build lacks Zstd support (need Node >= 22.15).');
    console.warn('[puzzles] download lichess_db_puzzle.csv.zst manually, decompress, then:');
    console.warn('[puzzles]   npm run etl:puzzles path/to/lichess_db_puzzle.csv');
    return;
  }

  await downloadZst();
  await verifyHash();

  console.log('[puzzles] decompressing (zstd) + running ETL…');
  let stats;
  try {
    const input = createReadStream(zstPath).pipe(zlib.createZstdDecompress()).pipe(decompressedCap());
    const lines = createInterface({ input, crlfDelay: Infinity });
    stats = await buildSubset(lines, { max: MAX, out: DEFAULT_OUT });
  } catch (err) {
    // A corrupt cache would fail every run — drop it so the next attempt re-downloads.
    rmSync(zstPath, { force: true });
    throw err;
  }

  const { scanned, kept, counts, bytes } = stats;
  console.log(`[puzzles] scanned ${scanned} rows, kept ${kept} puzzles (${mb(bytes)} MB)`);
  console.log('[puzzles] per-band:', counts.map((c, i) => `${BANDS[i]}-${BANDS[i + 1]}:${c}`).join(' '));
  console.log(`[puzzles] wrote ${DEFAULT_OUT}`);
}

main().catch((err) => {
  console.warn(`[puzzles] skipped: ${err?.message || err}`);
  console.warn('[puzzles] the app still works — it falls back to public/puzzles/seed-puzzles.json.');
  // Non-fatal: never fail `npm install` over an optional asset.
  process.exitCode = 0;
});
