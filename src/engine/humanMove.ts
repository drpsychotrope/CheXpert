// Human-like move selection (Maia-spike alternative): instead of always the engine's
// best move, sample among the top moves weighted by eval with a temperature — so the
// opponent plays varied, plausible, beatable moves, but never a catastrophic blunder
// (moves worse than `maxGapCp` below best are excluded). Pure: `rand` is injected.

export interface CandidateMove {
  uci: string;
  /** Mover-POV centipawns (higher = better for the side to move). */
  cp: number;
}

export interface SampleOpts {
  /** Softmax temperature in cp units; higher = more variety (weaker/more human). */
  temperature: number;
  /** Never play a move worse than this many cp below the best. */
  maxGapCp: number;
  /** Uniform random in [0,1). */
  rand: number;
}

export function sampleHumanMove(moves: CandidateMove[], opts: SampleOpts): string | null {
  if (!moves.length) return null;
  const best = Math.max(...moves.map((m) => m.cp));
  const viable = moves.filter((m) => m.cp >= best - opts.maxGapCp);
  const T = Math.max(1, opts.temperature);
  const weights = viable.map((m) => Math.exp((m.cp - best) / T));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.min(0.999999, Math.max(0, opts.rand)) * total;
  for (let i = 0; i < viable.length; i++) {
    r -= weights[i];
    if (r < 0) return viable[i].uci;
  }
  return viable[viable.length - 1].uci;
}

/** Map a target Elo to a sampling temperature: lower Elo → hotter (more human variety). */
export function temperatureForElo(elo: number): number {
  const loElo = 1320;
  const hiElo = 3190;
  const tHot = 120; // cp, at loElo
  const tCool = 25; // cp, at hiElo
  const e = Math.max(loElo, Math.min(hiElo, elo));
  return tHot - ((e - loElo) / (hiElo - loElo)) * (tHot - tCool);
}
