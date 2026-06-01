# Spec — `engine-perf`: multi-thread Stockfish via the launcher

**Scope:** feature (perf) · **Status:** V1 (3 cycles) · **Date:** 2026-06-01
Batch 2, spec F of 6. **Carries a licensing decision (Q-A) — resolve first.**

## §0 Context
Analysis uses the **lite single-thread** Stockfish (ADR-0004) — no COOP/COEP needed, works on any host,
but slow. The faster **multi-thread** build needs `SharedArrayBuffer` → `crossOriginIsolated` → the
page must be served with **COOP/COEP** headers. The `.exe` launcher controls its own headers, so it can
opt in; static hosts that don't set headers fall back to lite. This spec: send COOP/COEP from the
launcher (+ dev), vendor the MT build, and select MT at runtime when isolated. **Licensing:** the MT
build is **AGPL-3.0** (ADR-0004); adopting it escalates obligations if the app is ever distributed/hosted
(ADR-0002 is local/no-distribution). That trade-off is **Q-A**.

## §1 Empirical baseline
- `launcher/server.cjs:69` sets `Content-Type` + `Cache-Control` only — **no COOP/COEP**.
- `copy-engine.mjs` copies the lite single-thread build only; an `isMulti()` detector already exists (unused).
- `EngineClient` loads `ENGINE_WORKER_URL` (lite worker) and `setOption`s freely (can set `Threads`).
- ADR-0004 documents the hybrid intent + the AGPL implication of MT.
- 162 tests, svelte-check clean. AP-CHESS 65-67. ADR-0032.

## §2 Scope
**In:**
- `launcher/server.cjs`: add `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` to every response → `crossOriginIsolated` in the app window.
- `vite.config`: dev `server.headers` (+ `preview.headers`) with the same two headers, so MT works in `npm run dev`/`preview` too.
- `copy-engine.mjs`: also copy the **multi-thread** build (JS + wasm + any worker/threads helper) into `public/stockfish/` under stable names (e.g. `stockfish-mt.*`), keeping lite as the default fallback.
- `stockfish.worker.ts` / `EngineClient`: at boot, if `self.crossOriginIsolated` → load the MT engine and `setOption('Threads', N)` (N = `min(hardwareConcurrency-1, cap)`); else load lite. Single switch point; the rest of `EngineClient` is unchanged.
**Deferred:** NNUE/depth tuning; per-task engine pools; WASM SIMD feature-detection beyond build selection.

## §3 Pre-flight gates
1. The `stockfish` package actually contains an MT build (verify via the existing `isMulti()` glob); if absent → STOP (Q-A moot), stay lite.
2. With COOP/COEP set, all bundled assets still load (no third-party cross-origin resources — the app is fully local; Syzygy is `fetch` to lichess which COEP `require-corp` could block → must verify Syzygy still works, or set `crossorigin`/credentialless).
3. 162 tests green; svelte-check clean; build OK.

## §4 Phase A
### §4.1 Headers
- `server.cjs`: add the two headers in the `res.writeHead(200, {...})` map (and 403/500 paths harmless).
- `vite.config`: `server.headers` + `preview.headers` = the two headers.
### §4.2 Vendor MT build
- `copy-engine.mjs`: after the lite copy, select the MT JS/wasm (via `isMulti()`), copy as `stockfish-mt.js` / `stockfish-mt.wasm` (+ helper). Log both. Lite remains `stockfish.js` (default/fallback).
### §4.3 Runtime selection
- `stockfish.worker.ts`: export the URL conditionally — `crossOriginIsolated ? MT_URL : LITE_URL`. `EngineClient.bootInternal`: after `uciok`, if MT, `setOption('Threads', cap)` + `setOption('Hash', …)`. Everything else (evaluate/analyzeLines/interrupt) unchanged.
### §4.4 Syzygy under COEP
- Verify the endgame tablebase `fetch` to lichess still succeeds under `require-corp` (it's a cross-origin GET). If blocked, switch that fetch to a mode that COEP allows or document the constraint. (Endgame drills still work offline vs engine regardless.)

## §5 Phase B — tests
- `copy-engine` MT selection: unit/spot test the `isMulti` pick on a fixture file list (lite still chosen as default; MT chosen for the mt slot).
- Worker URL selection: a small test that the selector returns MT_URL when a `crossOriginIsolated`-true stub is set, lite otherwise.
- Existing 162 engine/integration tests stay green (lite path unchanged in the test env, which isn't cross-origin-isolated).

## §6 Phase C — verification
- Build the `.exe`; launch; in the app console confirm `crossOriginIsolated === true` and the MT engine loaded (`Threads` set); analyse a 40-move game and confirm it's faster than the lite baseline (~20s).
- Confirm Syzygy endgame lookups still work (or are gracefully handled) under COEP.
- `npm test` + svelte-check + build green.

## §7 Phase Z — docs
ADR-0032 (adopt MT under crossOriginIsolated; lite fallback; **AGPL-3.0 obligation on distribution** per Q-A; supersedes ADR-0004's "MT is opt-in/unused"). README "Engine asset" + Licensing: document MT-when-isolated, lite fallback, and the AGPL trigger on hosting/distribution. ATTRIBUTION updated.

## §8 Acceptance
COOP/COEP sent by launcher + dev/preview; MT build vendored; runtime selects MT when isolated (Threads set) else lite; Syzygy verified under COEP; analysis measurably faster in the `.exe`; lite path + 162 tests unchanged; ADR-0032 records the AGPL decision; README/ATTRIBUTION updated.

## §9 Anti-patterns
- **AP-CHESS-65** — Shipping MT without COOP/COEP → `SharedArrayBuffer` undefined → engine fails to boot; must fall back to lite when not isolated (never hard-require MT).
- **AP-CHESS-66** — COEP `require-corp` silently breaking the Syzygy fetch (or any asset); verify every network/asset path.
- **AP-CHESS-67** — Adopting AGPL MT without recording the distribution obligation (ADR-0002/0004); the ADR must state it explicitly.

## §10 Rollback
Headers + copy-engine MT copy + a worker URL switch + Threads option. Revert the four edits → back to lite-only (ADR-0004 state). No schema/data.

## §11 Follow-up
Thread/Hash auto-tuning; background batch-analysis queue (re-analyse all played games faster); SIMD detection; per-task engine instances.
