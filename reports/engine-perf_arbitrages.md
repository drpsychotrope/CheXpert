# Arbitrages: engine-perf

## Critical defects
None in code. **Q-A is a prerequisite licensing decision** — resolve before executing.

## Decisions

### Q-A (headline): Adopt the multi-thread engine (AGPL-3.0)?
- (a) Yes — MT when `crossOriginIsolated`, lite fallback; record the AGPL-3.0 distribution obligation in ADR-0032 (recommended for personal/local use, ADR-0002 keeps obligations dormant). Big analysis speedup.
- (b) No — stay lite-only (GPL-3.0, simplest licensing); this spec becomes docs-only / dropped.
- (c) Yes but MT only inside the `.exe` (not on any future public host) to keep hosting on lite/GPL.
**Reco: (a)** — you run it locally (ADR-0002), so AGPL stays dormant; revisit only if you publicly host.

### Q-B: Headers in dev/preview too?
- (a) Yes — `server.cjs` + `vite.config` (dev + preview) (recommended) — MT works everywhere you run it.
- (b) `.exe` only.
**Reco: (a).**

### Q-C: MT scope
- (a) MT for analysis (biggest win) AND opponent (recommended) — single engine, simplest.
- (b) MT for batch analysis only; opponent stays lite.
**Reco: (a).**

## Auto-applied
MT as runtime fallback never hard-required (AP-CHESS-65); verify Syzygy/all assets under COEP (AP-CHESS-66); ADR-0032 states the AGPL obligation (AP-CHESS-67); pre-flight verifies the MT build exists in the package.

## Stop status
3/3 cycles; decreasing returns. Spec `specs/engine-perf-spec.md`. ADR-0032 (extends ADR-0004).
**If Q-A=(b), this spec is dropped/docs-only.**

## Next steps
Reply e.g. `F: Q-A a, Q-B a, Q-C a`.
