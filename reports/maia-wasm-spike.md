# Spike — Maia-WASM (client-side human-like opponent)

**Goal:** can we run a human-like move model (Maia / a small policy net) **client-side, no backend**,
within the app's local-only posture — and is it worth it? Time-boxed feasibility, go/no-go.

## Empirical findings
- **`onnxruntime-web`** (the only realistic WASM inference runtime): v1.26.0, **134 MB unpacked** package;
  you ship a subset — the SIMD+threaded `ort-wasm-*.wasm` is **~10–20 MB** + ~1 MB JS. Threaded build
  needs `SharedArrayBuffer` → `crossOriginIsolated`, **already enabled** (COOP/COEP, ADR-0032). License MIT.
- **No Maia/lc0 ONNX model is packaged** (`maia-chess`, `maia-onnx`, `lc0-onnx`, … all npm 404). A model
  must be **sourced + converted manually** from lc0 Maia weights (`.pb.gz`, ~2–6 MB per Elo level:
  maia-1100/1500/1900). Maia weights' license must be confirmed (lc0 is GPL-3.0; the Maia nets are a
  separate release — verify before bundling/distributing).

## Feasibility breakdown
| Piece | Status | Cost / risk |
|---|---|---|
| Runtime (onnxruntime-web) | available, MIT, headers ready | **+10–20 MB WASM** to a ~7 MB-engine app — large bloat |
| Model | not packaged; convert lc0 Maia `.pb.gz` → ONNX | tooling + license check; per-level files (~2–6 MB each) |
| **Input encoding** | must build the **112-plane** lc0 input (8 plies of history + side/castling/rule50 aux) from FEN+history | **the bulk of the work** — fiddly, error-prone glue |
| **Output decoding** | map the **1858-move** policy head → legal moves (lc0 index table) + mask + sample | substantial glue |
| Inference perf | WASM CNN ~tens–hundreds ms/move + ort init + model load startup | acceptable per move; noticeable startup |
| Fit with doctrine | a new heavy dep + a model file; "no LLM" intact (it's a policy net) but stretches "tiny local app" | medium |

## Verdict: **feasible, but NOT recommended now** — high effort/risk/bloat
~2–4 weeks of work (encoder + decoder + model conversion + ort integration + perf/fallback), a
**10–20 MB** runtime + per-level model files, and an **unproven path** (no reference Maia-on-ort-web in
this stack). The payoff — human-like mistakes to punish — is real but disproportionate for a local hobby
trainer when a far cheaper approximation exists.

## Recommended instead: human-like-ish via the engine we already have (no ML, no dep)
Approximate "instructive, beatable, varied, human-feeling" with **Stockfish MultiPV + temperature
sampling at a low Elo** — reusing `AdaptiveOpponent` + `analyzeLines` (and the new MT engine):

```
// sketch — in AdaptiveOpponent
async pickHumanMove(fen) {
  const lines = await engine.analyzeLines(fen, { multipv: 4, movetime: 250 }); // top moves + evals
  // weight by eval with a temperature: lower Elo / higher temp → more often a non-best (human) move,
  // but never a catastrophic blunder (drop lines worse than ~150cp below best).
  const viable = lines.filter(l => moverGap(l, lines[0]) < 150);
  return softmaxSample(viable, temperatureForElo(this.state.targetElo));
}
```
- **Cost:** ~1–2 days; no new dependency; reuses the engine.
- **Gets ~80% of the value:** varied, plausible, beatable moves that aren't always the engine's best — the
  thing that makes a bot feel human and gives the player chances to punish — without Maia's bloat/risk.
- Pairs naturally with the existing ZPD Elo steering and the comeback/scenario sparring loops.

## Revisit Maia-WASM only if
1. A **ready Maia ONNX** + a **proven onnxruntime-web chess inference** reference exists (encoder/decoder
   already solved), AND
2. The model's license permits bundling under the project's posture, AND
3. There's appetite for the +10–20 MB and the startup cost.

Until then: **keep ADR-0019's deferral**; ship the temperature-sampling opponent if a more human feel is
wanted. (This spike supersedes the "spec a full Maia impl" option — start with the cheap path.)
