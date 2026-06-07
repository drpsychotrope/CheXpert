// Chess Trainer desktop launcher (CommonJS — packages cleanly with pkg/SEA).
//
// The app is a static, client-only build that MUST be served over http://localhost
// (module Web Workers, WASM fetch, and IndexedDB all break under file://). This
// launcher starts a tiny 127.0.0.1 static server on a FIXED port (see PORT below)
// for the bundled `dist/`, then opens it in a borderless app window via Edge/Chrome
// `--app=` mode (falls back to the default browser). No backend, no telemetry, no
// network needed to play.
//
// Asset resolution: when run as a packaged .exe, `dist/` sits NEXT TO the exe
// (process.execPath dir). In dev (`node launcher/server.cjs`), it's ../dist.

'use strict';
const http = require('node:http');
const { readFile, stat } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { join, normalize, extname, dirname, relative, isAbsolute } = require('node:path');
const { spawn } = require('node:child_process');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

// Content-Security-Policy (audit W10). ENFORCED: the only intended egress is the Syzygy tablebase;
// everything else is same-origin. `wasm-unsafe-eval` + `worker-src blob:` are required by the
// Stockfish WASM engine (the multi-thread build spawns blob workers); if it can't boot under the
// policy the app already auto-falls back to the lite single-thread build (ADR-0032), which needs the
// same directives. Kill switch: set CHESS_TRAINER_NO_CSP=1 to drop the header entirely.
const CSP_ENABLED = process.env.CHESS_TRAINER_NO_CSP !== '1';
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'wasm-unsafe-eval'; " +
  "worker-src 'self' blob:; " +
  "connect-src 'self' https://tablebase.lichess.ovh; " +
  "img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "object-src 'none'; base-uri 'none'";

// In a pkg/SEA exe, __dirname points inside the snapshot; the real on-disk
// location is dirname(process.execPath). Check both, plus the dev layout.
const exeDir = dirname(process.execPath);
const candidates = [
  join(exeDir, 'dist'),
  join(exeDir, 'resources', 'dist'),
  join(__dirname, '..', 'dist'),
  join(process.cwd(), 'dist'),
];
const ROOT = candidates.find((c) => existsSync(join(c, 'index.html')));

if (!ROOT) {
  console.error('Chess Trainer: built app not found (dist/index.html). Place dist/ next to the exe.');
  setTimeout(() => process.exit(1), 8000); // keep console readable if double-clicked
  return;
}

function safeJoin(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const p = normalize(join(root, clean));
  // Exact containment: startsWith(root) alone would also accept a sibling dir sharing the
  // prefix (e.g. dist-extra). path.relative gives '' for root itself and a '..'-prefixed or
  // absolute path for anything outside it (audit W10).
  const rel = relative(root, p);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) return null;
  return p;
}

// Fixed listen port → STABLE ORIGIN across launches. Browser storage (IndexedDB,
// where the player profile + ratings live) is partitioned per origin = scheme + host
// + PORT. This launcher used to call listen(0) — a fresh random ephemeral port every
// run — so each session landed on a different origin with its own empty IndexedDB
// partition, and the profile looked like it was never saved (ADR-0049). A constant
// port keeps every session on one partition. Override with CHESS_TRAINER_PORT only if
// 7424 collides on your machine — note a different port is a different origin, hence a
// separate profile.
const PORT = Number(process.env.CHESS_TRAINER_PORT) || 7424;

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = req.url || '/';
    if (urlPath === '/') urlPath = '/index.html';
    let filePath = safeJoin(ROOT, urlPath);
    if (!filePath) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const st = await stat(filePath).catch(() => null);
    if (!st || st.isDirectory()) filePath = join(ROOT, 'index.html'); // SPA fallback
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      // Enforced (audit W10); disable with CHESS_TRAINER_NO_CSP=1 if the engine can't boot.
      ...(CSP_ENABLED ? { 'Content-Security-Policy': CSP } : {}),
      // Sentinel: lets a second launch recognise *our* server (vs a foreign program
      // that grabbed the port) before reusing it on EADDRINUSE.
      'X-Chess-Trainer': '1',
      // Cross-origin isolation → SharedArrayBuffer → the multi-thread engine (ADR-0032).
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Server error: ' + String(err));
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    // Port busy. Almost always our own previous instance still serving on the fixed
    // port — reusing it is exactly right (same origin = same profile), so just open
    // another window at the running URL. If a *foreign* program holds the port, bail
    // with a clear message rather than opening a stranger's page.
    const url = `http://127.0.0.1:${PORT}/`;
    probeOurServer(PORT).then((ours) => {
      if (ours) {
        console.log(`Chess Trainer is already running — opening a window at ${url}`);
        openAppWindow(url);
        setTimeout(() => process.exit(0), 1500);
      } else {
        console.error(
          `Chess Trainer: port ${PORT} is in use by another program.\n` +
            `Relaunch on a free port, e.g.  set CHESS_TRAINER_PORT=8080  (PowerShell: $env:CHESS_TRAINER_PORT=8080).\n` +
            `Note: a different port is a different browser origin, so it starts a separate profile.`
        );
        setTimeout(() => process.exit(1), 8000);
      }
    });
  } else {
    console.error('Chess Trainer: server error:', err);
    setTimeout(() => process.exit(1), 8000);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`Chess Trainer running at ${url}`);
  console.log('(Keep this window open while you play. Close it to quit.)');
  openAppWindow(url);
});

// Confirm an already-listening server on `port` is *us* (sentinel header) and not a
// foreign program that happens to hold the port. Resolves false on any error/timeout.
function probeOurServer(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (res) => {
      const ours = res.headers['x-chess-trainer'] === '1';
      res.resume(); // drain so the socket can close
      resolve(ours);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openAppWindow(url) {
  // Headless / "I'll open my own tab" escape hatch (also used by the launcher smoke test).
  if (process.env.CHESS_TRAINER_NO_OPEN === '1') {
    console.log(`Open your browser at: ${url}`);
    return;
  }
  const isWin = process.platform === 'win32';
  const pf = process.env['ProgramFiles'] || 'C:/Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
  const localApp = process.env['LOCALAPPDATA'] || exeDir;

  const appBrowsers = isWin
    ? [
        join(pf, 'Microsoft/Edge/Application/msedge.exe'),
        join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
        join(pf, 'Google/Chrome/Application/chrome.exe'),
        join(pf86, 'Google/Chrome/Application/chrome.exe'),
        join(localApp, 'Google/Chrome/Application/chrome.exe'),
      ]
    : [];

  const browser = appBrowsers.find((b) => existsSync(b));
  if (browser) {
    const args = [
      `--app=${url}`,
      '--window-size=1100,860',
      `--user-data-dir=${join(localApp, 'ChessTrainerProfile')}`,
    ];
    const child = spawn(browser, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return;
  }

  const opener = isWin
    ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : ['xdg-open', [url]];
  try {
    spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    console.log(`Open your browser at: ${url}`);
  }
}
