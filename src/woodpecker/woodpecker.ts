// Woodpecker set logic — pure functions over WoodpeckerSet + IndexedDB store.
// Pure core is unit-tested without a DB; the store helpers wrap openTrainerDB.

import { openTrainerDB } from '../store/db';
import type { WoodpeckerSet, WoodpeckerCycle } from './types';

/** Create a new set from a fixed ordered list of puzzle ids. */
export function createSet(id: string, name: string, puzzleIds: string[], now: number): WoodpeckerSet {
  return { id, name, puzzleIds: [...puzzleIds], createdAt: now, cycles: [] };
}

/** Begin a new cycle (the next pass through the whole set). */
export function startCycle(set: WoodpeckerSet, now: number): WoodpeckerSet {
  const cycle: WoodpeckerCycle = {
    cycle: set.cycles.length + 1,
    startedAt: now,
    completedAt: null,
    msPerPuzzle: set.puzzleIds.map(() => null),
    solved: set.puzzleIds.map(() => false),
  };
  return { ...set, cycles: [...set.cycles, cycle] };
}

/** The cycle currently in progress, or null. */
export function currentCycle(set: WoodpeckerSet): WoodpeckerCycle | null {
  const last = set.cycles[set.cycles.length - 1];
  return last && last.completedAt == null ? last : null;
}

/** Index of the next unattempted puzzle in the current cycle, or -1 if done/none. */
export function nextIndex(set: WoodpeckerSet): number {
  const cur = currentCycle(set);
  if (!cur) return -1;
  return cur.msPerPuzzle.findIndex((ms) => ms == null);
}

/** Record one puzzle result into the current cycle (immutably). */
export function recordResult(set: WoodpeckerSet, index: number, solved: boolean, ms: number): WoodpeckerSet {
  const cur = currentCycle(set);
  if (!cur) return set;
  const msPerPuzzle = [...cur.msPerPuzzle];
  const solvedArr = [...cur.solved];
  msPerPuzzle[index] = ms;
  solvedArr[index] = solved;
  const updated: WoodpeckerCycle = { ...cur, msPerPuzzle, solved: solvedArr };
  const cycles = [...set.cycles];
  cycles[cycles.length - 1] = updated;
  return { ...set, cycles };
}

/** Stamp the current cycle complete at `now`. */
export function completeCycle(set: WoodpeckerSet, now: number): WoodpeckerSet {
  const cur = currentCycle(set);
  if (!cur) return set;
  const cycles = [...set.cycles];
  cycles[cycles.length - 1] = { ...cur, completedAt: now };
  return { ...set, cycles };
}

export interface CycleStats {
  cycle: number;
  totalMs: number;
  solvedCount: number;
  total: number;
  accuracy: number; // 0..1
}

/** Total time + accuracy for a (completed or partial) cycle. */
export function cycleStats(cycle: WoodpeckerCycle): CycleStats {
  const times = cycle.msPerPuzzle.filter((m): m is number => m != null);
  const totalMs = times.reduce((s, m) => s + m, 0);
  const solvedCount = cycle.solved.filter(Boolean).length;
  return {
    cycle: cycle.cycle,
    totalMs,
    solvedCount,
    total: cycle.msPerPuzzle.length,
    accuracy: cycle.msPerPuzzle.length ? solvedCount / cycle.msPerPuzzle.length : 0,
  };
}

/** Did the latest completed cycle improve on the previous (faster + ≥ accurate)? */
export function improvement(set: WoodpeckerSet): { fasterMs: number; moreAccurate: boolean } | null {
  const done = set.cycles.filter((c) => c.completedAt != null);
  if (done.length < 2) return null;
  const a = cycleStats(done[done.length - 2]);
  const b = cycleStats(done[done.length - 1]);
  return { fasterMs: a.totalMs - b.totalMs, moreAccurate: b.accuracy >= a.accuracy };
}

// --- store helpers ---------------------------------------------------------

export async function saveSet(set: WoodpeckerSet): Promise<void> {
  const db = await openTrainerDB();
  await db.put('woodpeckerSets', set);
}

export async function listSets(): Promise<WoodpeckerSet[]> {
  const db = await openTrainerDB();
  return db.getAll('woodpeckerSets');
}

export async function getSet(id: string): Promise<WoodpeckerSet | undefined> {
  const db = await openTrainerDB();
  return db.get('woodpeckerSets', id);
}

export async function deleteSet(id: string): Promise<void> {
  const db = await openTrainerDB();
  await db.delete('woodpeckerSets', id);
}
