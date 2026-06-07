// Weakness fingerprint (spec A / ADR-0027): cluster the player's recurring mistakes
// across all analysed games into ranked "leaks", and recompute the weakness radar over
// time for a trend. Pure, local, no engine, no LLM. Honesty: cluster on a confident
// motif when present, else fall back to a phase:severity bucket (cf. ADR-0007/0009).

import type { GameAnalysis, GamePhase, PlyAnalysis } from './types';
import { buildWeaknessProfile, type Dimension } from './weakness';

/** Stable cluster key for a player mistake ply: a confident motif tag, else
 *  `${phase}:${severity}`. SINGLE source of truth shared by buildFingerprint and
 *  the efficacy readout so they never disagree about what "fork" means (AP-ES-1). */
export function leakKey(p: PlyAnalysis): string {
  return p.motif && p.motif.confidence === 'high' ? p.motif.tag : `${p.phase}:${p.severity}`;
}

export interface Leak {
  /** Stable cluster key (motif tag, or `${phase}:${severity}`). */
  key: string;
  /** Display label. */
  motif: string;
  phase: GamePhase | 'mixed';
  count: number;
  avgWpl: number;
  /** Up to 3 example positions, highest win-prob loss first. */
  sampleFens: string[];
  severity: { mistake: number; blunder: number };
}

/** Single routing decision for a leak's one-click drill (audit W14): opening→repertoire,
 *  endgame→endgames, everything else→tactics. Shared by Insights and the study plan so the two
 *  can never disagree (previously each re-implemented this `startsWith` branching inline). */
export function leakTarget(leak: Leak): 'repertoire' | 'endgames' | 'tactics' {
  const m = leak.motif.toLowerCase();
  if (leak.key.startsWith('opening') || m.includes('opening')) return 'repertoire';
  if (leak.key.startsWith('endgame') || leak.phase === 'endgame' || m.includes('endgame')) return 'endgames';
  return 'tactics';
}

/** Rank the player's recurring mistakes by impact (count × avg win-prob loss). */
export function buildFingerprint(analyses: GameAnalysis[]): { leaks: Leak[] } {
  interface Acc {
    key: string; motif: string; phases: Set<GamePhase>; wplSum: number; count: number;
    fens: Array<{ fen: string; wpl: number }>; mistake: number; blunder: number;
  }
  const map = new Map<string, Acc>();
  for (const a of analyses) {
    for (const p of a.plies as PlyAnalysis[]) {
      if (p.color !== a.playerColor) continue;
      if (p.severity !== 'mistake' && p.severity !== 'blunder') continue;
      const confident = p.motif && p.motif.confidence === 'high';
      const key = leakKey(p);
      const label = confident ? p.motif!.tag : `${p.phase} ${p.severity}`;
      let acc = map.get(key);
      if (!acc) {
        acc = { key, motif: label, phases: new Set(), wplSum: 0, count: 0, fens: [], mistake: 0, blunder: 0 };
        map.set(key, acc);
      }
      acc.phases.add(p.phase);
      acc.wplSum += p.winProbLoss;
      acc.count += 1;
      acc.fens.push({ fen: p.fenBefore, wpl: p.winProbLoss });
      if (p.severity === 'blunder') acc.blunder += 1;
      else acc.mistake += 1;
    }
  }
  const leaks: Leak[] = [...map.values()].map((a) => ({
    key: a.key,
    motif: a.motif,
    phase: a.phases.size === 1 ? [...a.phases][0] : 'mixed',
    count: a.count,
    avgWpl: a.wplSum / a.count,
    sampleFens: a.fens.sort((x, y) => y.wpl - x.wpl).slice(0, 3).map((f) => f.fen),
    severity: { mistake: a.mistake, blunder: a.blunder },
  }));
  leaks.sort((x, y) => y.count * y.avgWpl - x.count * x.avgWpl || (x.key < y.key ? -1 : 1));
  return { leaks: leaks.slice(0, 8) };
}

export interface TrendPoint {
  window: number;
  games: number;
  dims: Record<Dimension, number>;
}

/** Recompute the weakness radar over rolling windows of games (oldest→newest). */
export function weaknessTrend(analyses: GameAnalysis[], opts: { window?: number } = {}): TrendPoint[] {
  const window = opts.window ?? 5;
  const sorted = [...analyses].sort((a, b) => a.analyzedAt - b.analyzedAt);
  const out: TrendPoint[] = [];
  for (let i = 0, w = 1; i < sorted.length; i += window, w++) {
    const block = sorted.slice(i, i + window);
    if (block.length === 0) continue;
    const profile = buildWeaknessProfile(block, 1200);
    const dims = {} as Record<Dimension, number>;
    for (const d of profile.dimensions) dims[d.dimension] = d.score;
    out.push({ window: w, games: block.length, dims });
  }
  return out;
}
