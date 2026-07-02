import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '../test/resetDb';
import { putSessionLog, recentSessionLogs } from './sessionLogRepo';
import type { SessionLogRecord } from './db';
import { buildStudyPlan } from '../analysis/studyPlan';
import type { Leak } from '../analysis/fingerprint';

const log = (startedAt: number, over: Partial<SessionLogRecord> = {}): SessionLogRecord => ({
  id: `s:${startedAt}`,
  startedAt,
  endedAt: startedAt + 30 * 60_000,
  budgetMin: 30,
  steps: [
    { kind: 'vision', focus: 'board vision', minutes: 3, done: true },
    { kind: 'tactics', focus: 'fork', minutes: 10, done: true, capReached: true },
    { kind: 'endgames', focus: 'endgame: rook', minutes: 10, done: false },
  ],
  ...over,
});

describe('sessionLog store (PR-09, ADR-0067 — v5)', () => {
  beforeEach(resetDb);

  it('round-trips a record with reflection + the born-additive programId/day (I8)', async () => {
    await putSessionLog(log(1000, { reflection: 'les fourchettes passent mieux', programId: 'coach:1', day: 2 }));
    const [r] = await recentSessionLogs();
    expect(r.reflection).toBe('les fourchettes passent mieux');
    expect(r.programId).toBe('coach:1');
    expect(r.day).toBe(2);
    expect(r.steps[1].capReached).toBe(true);
    expect(r.steps[2].done).toBe(false);
  });

  it('recentSessionLogs walks newest-first and honours the limit', async () => {
    await putSessionLog(log(1000));
    await putSessionLog(log(2000));
    await putSessionLog(log(3000));
    const two = await recentSessionLogs(2);
    expect(two.map((r) => r.startedAt)).toEqual([3000, 2000]);
  });
});

describe('buildStudyPlan deprioritizeFocus (PR-09 — the plan reads completions)', () => {
  const leak = (motif: string, count: number): Leak =>
    ({ key: motif, motif, phase: 'middlegame', count, avgWpl: 10, samples: [], severities: {} }) as unknown as Leak;

  it('moves last-session-completed focuses to the END without dropping them', () => {
    const plan = buildStudyPlan([leak('fork', 6), leak('pin', 6), leak('skewer', 6)], null, 60, {
      locale: 'fr',
      deprioritizeFocus: ['fork'],
    });
    const tactics = plan.filter((p) => p.activity === 'tactics').map((p) => p.focus);
    expect(tactics).toEqual(['pin', 'skewer', 'fork']); // fork last, still present
  });

  it('no option → order unchanged (Insights path byte-identical)', () => {
    const base = buildStudyPlan([leak('fork', 6), leak('pin', 6)], null, 60, { locale: 'fr' });
    expect(base.filter((p) => p.activity === 'tactics').map((p) => p.focus)).toEqual(['fork', 'pin']);
  });
});
