import { describe, it, expect } from 'vitest';
import { engineWorkerUrl, threadCount, LITE_WORKER_URL, MT_WORKER_URL } from './stockfish.worker';

describe('engine selection (spec F / ADR-0032)', () => {
  it('uses the multi-thread engine only when isolated and not forced to lite', () => {
    expect(engineWorkerUrl(true, false)).toBe(MT_WORKER_URL);
  });

  it('falls back to lite when not cross-origin isolated', () => {
    expect(engineWorkerUrl(false, false)).toBe(LITE_WORKER_URL);
  });

  it('falls back to lite when an MT boot has failed (forceLite)', () => {
    expect(engineWorkerUrl(true, true)).toBe(LITE_WORKER_URL);
  });

  it('threadCount leaves a core for the UI and is capped', () => {
    const t = threadCount();
    expect(t).toBeGreaterThanOrEqual(1);
    expect(t).toBeLessThanOrEqual(8);
  });
});
