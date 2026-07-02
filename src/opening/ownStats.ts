// Your own per-opening stats (PR-15 explorer-own-stats, ADR-0073). The DEFER'd "explorer with
// frequency/win-rate stats" wanted a bundled global-stats DB (openings Q-B); the local-first
// answer is cheaper and more personal: aggregate YOUR analysed played games by named opening —
// score, sample size, and opening-phase ACPL. Computed at aggregation time (the ECO is
// deliberately NOT stored on GameAnalysis — verified during the roadmap scan); pure and injected.

import type { GameAnalysis } from '../analysis/types';
import type { EcoEntry, OpeningName } from './eco';
import { nameOpening } from './eco';

export interface OwnOpeningInput {
  analysis: GameAnalysis;
  result: 'win' | 'loss' | 'draw';
}

export interface OwnOpeningStat {
  eco: string;
  name: string;
  n: number;
  wins: number;
  draws: number;
  losses: number;
  /** Score % (win=1, draw=0.5) — descriptive, small n stays visible next to it. */
  scorePct: number;
  /** Mean opening-phase ACPL across those games (rounded). */
  avgOpeningAcpl: number;
}

/** Aggregate analysed PLAYED games by their named opening, most-played first. Games whose line
 *  matches no book entry are grouped under '—' only if `includeUnnamed`; default: skipped
 *  (an unnamed 1. a3 game says nothing about your repertoire choices). */
export function ownOpeningStats(
  items: OwnOpeningInput[],
  table: EcoEntry[],
  opts: { includeUnnamed?: boolean; namer?: typeof nameOpening } = {},
): OwnOpeningStat[] {
  const namer = opts.namer ?? nameOpening;
  const byKey = new Map<string, OwnOpeningStat & { acplSum: number }>();
  for (const { analysis, result } of items) {
    const named: OpeningName | null = namer(analysis.plies.map((p) => p.uci), table);
    if (!named && !opts.includeUnnamed) continue;
    const eco = named?.eco ?? '—';
    const name = named?.name ?? '—';
    const key = `${eco}:${name}`;
    const cur = byKey.get(key) ?? { eco, name, n: 0, wins: 0, draws: 0, losses: 0, scorePct: 0, avgOpeningAcpl: 0, acplSum: 0 };
    cur.n += 1;
    if (result === 'win') cur.wins += 1;
    else if (result === 'draw') cur.draws += 1;
    else cur.losses += 1;
    cur.acplSum += analysis.byPhase.opening?.acpl ?? 0;
    byKey.set(key, cur);
  }
  return [...byKey.values()]
    .map(({ acplSum, ...s }) => ({
      ...s,
      scorePct: Math.round(((s.wins + 0.5 * s.draws) / s.n) * 100),
      avgOpeningAcpl: Math.round(acplSum / s.n),
    }))
    .sort((a, b) => b.n - a.n || a.eco.localeCompare(b.eco));
}
