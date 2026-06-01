// The vendored nmrugg builds are themselves Web Workers: loaded via `new Worker(url)`
// they install their own UCI onmessage handler and locate their sibling .wasm.
// EngineClient instantiates one directly (AP-CHESS-1: engine off the main thread).
//
// Engine selection (spec F / ADR-0032): the MULTI-THREAD build is faster but needs
// SharedArrayBuffer → the page must be cross-origin isolated (COOP/COEP, sent by the
// launcher + vite). When isolated we load the MT engine; otherwise (or if it fails to
// boot — see EngineClient's fallback) the lite single-thread build, which needs no
// special headers and works on any static host (ADR-0004).

/** Lite single-thread engine (default / universal fallback). */
export const LITE_WORKER_URL = '/stockfish/stockfish.js';
/** Multi-thread engine (vendored as stockfish-mt.* by copy-engine; needs isolation). */
export const MT_WORKER_URL = '/stockfish/stockfish-mt.js';

/** Back-compat: the original constant still points at the lite engine. */
export const ENGINE_WORKER_URL = LITE_WORKER_URL;

/** True only when the page can use SharedArrayBuffer (cross-origin isolated). */
export function multiThreadAvailable(): boolean {
  return typeof globalThis !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/** Which engine file to load. Pure — caller passes the isolation + fallback flags. */
export function engineWorkerUrl(isolated: boolean, forceLite: boolean): string {
  return isolated && !forceLite ? MT_WORKER_URL : LITE_WORKER_URL;
}

// Module flag: set when an MT boot fails so we fall back to lite for the session.
let _forceLite = false;
export const forceLiteFallback = {
  get: (): boolean => _forceLite,
  set: (v: boolean): void => {
    _forceLite = v;
  },
};

/** Thread count for the MT engine: leave one core for the UI, cap for sanity. */
export function threadCount(): number {
  const hc = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? 2;
  return Math.max(1, Math.min(hc - 1, 8));
}
