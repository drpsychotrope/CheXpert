// Chess Trainer desktop launcher (CommonJS — packages cleanly with pkg/SEA).
//
// The app is a static, client-only build that MUST be served over http://localhost
// (module Web Workers, WASM fetch, and IndexedDB all break under file://). This
// launcher starts a tiny 127.0.0.1 static server for the bundled `dist/`, then
// opens it in a borderless app window via Edge/Chrome `--app=` mode (falls back to
// the default browser). No backend, no telemetry, no network needed to play.
//
// Asset resolution: when run as a packaged .exe, `dist/` sits NEXT TO the exe
// (process.execPath dir). In dev (`node launcher/server.cjs`), it's ../dist.

'use strict';
const http = require('node:http');
const { readFile, stat } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { join, normalize, extname, dirname } = require('node:path');
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
  if (!p.startsWith(root)) return null;
  return p;
}

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
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Server error: ' + String(err));
  }
});

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Chess Trainer running at ${url}`);
  console.log('(Keep this window open while you play. Close it to quit.)');
  openAppWindow(url);
});

function openAppWindow(url) {
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
