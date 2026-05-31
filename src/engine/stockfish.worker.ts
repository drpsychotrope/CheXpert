// NOTE: We do NOT bundle a custom worker for Stockfish.
//
// The vendored nmrugg "lite single-thread" build (public/stockfish/stockfish.js,
// copied from node_modules by scripts/copy-engine.mjs) is ITSELF a Web Worker:
// when loaded via `new Worker('/stockfish/stockfish.js')` it installs its own
// onmessage handler (accepts UCI command strings) and posts every engine line
// back via postMessage. It also auto-locates its sibling .wasm. So EngineClient
// just instantiates that file directly — see ENGINE_WORKER_URL below.
//
// This keeps the engine off the main thread (AP-CHESS-1) with no extra glue.

/** Public path to the vendored lite single-thread engine, served as a worker. */
export const ENGINE_WORKER_URL = '/stockfish/stockfish.js';
