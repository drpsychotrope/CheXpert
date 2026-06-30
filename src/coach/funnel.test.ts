import { describe, it, expect, vi } from 'vitest';
import {
  shouldOfferCoach,
  hasLosingStreak,
  hasFreshProfile,
  coachProfileFilename,
  STREAK_LEN,
  FRESH_MS,
} from './funnel';
import type { PlayerModel } from '../store/db';
import type { GameOutcome } from '../engine/AdaptiveOpponent';
import type { CoachProfile } from './types';

// A minimal valid-ish PlayerModel for the funnel predicate. Only the fields shouldOfferCoach reads
// matter (opponentByPool, coachProfile); the rest satisfy the type without affecting the logic.
function model(over: Partial<PlayerModel> = {}): PlayerModel {
  return {
    id: 'singleton',
    puzzleRating: { rating: 1200, rd: 250, vol: 0.06 },
    gameRatings: {},
    opponentByPool: {},
    weaknessCounters: {},
    onboarded: true,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const recent = (...o: GameOutcome[]) => o;
function profileAt(assessedAt: number): CoachProfile {
  return {
    assessedAt,
    puzzleRating: 1200,
    motifs: [],
    dimensions: [],
    strengths: [],
    weaknesses: [],
    source: { ladders: true, game: false },
    gameAnalyzed: false,
  };
}

describe('hasLosingStreak (pure) — trailing run of losses, newest last', () => {
  it('true when the last STREAK_LEN outcomes are all losses', () => {
    expect(hasLosingStreak(recent('win', 'loss', 'loss', 'loss'))).toBe(true);
  });
  it('false when the streak is below threshold', () => {
    expect(hasLosingStreak(recent('loss', 'loss'))).toBe(false); // only 2 (STREAK_LEN is 3)
  });
  it('false when a recent win/draw breaks the tail', () => {
    expect(hasLosingStreak(recent('loss', 'loss', 'loss', 'win'))).toBe(false);
    expect(hasLosingStreak(recent('loss', 'loss', 'draw'))).toBe(false);
  });
  it('false for empty / undefined', () => {
    expect(hasLosingStreak([])).toBe(false);
    expect(hasLosingStreak(undefined)).toBe(false);
  });
  it('only the TAIL counts (earlier losses with a later win do not qualify)', () => {
    expect(hasLosingStreak(recent('loss', 'loss', 'loss', 'win', 'win'))).toBe(false);
  });
  it('STREAK_LEN is the documented default (3)', () => {
    expect(STREAK_LEN).toBe(3);
  });
});

describe('hasFreshProfile (pure) — now injected', () => {
  const NOW = 1_700_000_000_000;
  it('true within the freshness window', () => {
    expect(hasFreshProfile(model({ coachProfile: profileAt(NOW - 1000) }), NOW)).toBe(true);
    expect(hasFreshProfile(model({ coachProfile: profileAt(NOW - (FRESH_MS - 1)) }), NOW)).toBe(true);
  });
  it('false once older than the window', () => {
    expect(hasFreshProfile(model({ coachProfile: profileAt(NOW - (FRESH_MS + 1)) }), NOW)).toBe(false);
  });
  it('false when there is no profile (or no model)', () => {
    expect(hasFreshProfile(model(), NOW)).toBe(false);
    expect(hasFreshProfile(null, NOW)).toBe(false);
  });
});

describe('shouldOfferCoach (pure, total) — losing-streak gate + staleness guard (CO20)', () => {
  const NOW = 1_700_000_000_000;

  it('true on a losing streak with NO profile', () => {
    const m = model({ opponentByPool: { classical: { targetElo: 1200, recent: recent('loss', 'loss', 'loss') } } });
    expect(shouldOfferCoach(m, NOW)).toBe(true);
  });

  it('true on a losing streak with a STALE profile', () => {
    const m = model({
      opponentByPool: { classical: { targetElo: 1200, recent: recent('loss', 'loss', 'loss') } },
      coachProfile: profileAt(NOW - (FRESH_MS + 1)),
    });
    expect(shouldOfferCoach(m, NOW)).toBe(true);
  });

  it('false when a FRESH profile exists (staleness guard, even on a streak)', () => {
    const m = model({
      opponentByPool: { classical: { targetElo: 1200, recent: recent('loss', 'loss', 'loss') } },
      coachProfile: profileAt(NOW - 1000),
    });
    expect(shouldOfferCoach(m, NOW)).toBe(false);
  });

  it('false when the model is null', () => {
    expect(shouldOfferCoach(null, NOW)).toBe(false);
  });

  it('false when pools are empty (no signal)', () => {
    expect(shouldOfferCoach(model({ opponentByPool: {} }), NOW)).toBe(false);
  });

  it('false when the streak is below threshold', () => {
    const m = model({ opponentByPool: { classical: { targetElo: 1200, recent: recent('loss', 'loss') } } });
    expect(shouldOfferCoach(m, NOW)).toBe(false);
  });

  it('true if ANY pool has a losing streak (checks every pool)', () => {
    const m = model({
      opponentByPool: {
        rapid: { targetElo: 1200, recent: recent('win', 'draw') },
        blitz: { targetElo: 1200, recent: recent('loss', 'loss', 'loss') },
      },
    });
    expect(shouldOfferCoach(m, NOW)).toBe(true);
  });

  it('is non-nagging: a recovering streak (win after losses) does not offer', () => {
    const m = model({ opponentByPool: { classical: { targetElo: 1200, recent: recent('loss', 'loss', 'loss', 'win') } } });
    expect(shouldOfferCoach(m, NOW)).toBe(false);
  });

  it('does NOT call Date.now (purity)', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const m = model({ opponentByPool: { classical: { targetElo: 1200, recent: recent('loss', 'loss', 'loss') } } });
      expect(shouldOfferCoach(m, NOW)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('coachProfileFilename (pure) — derived from assessedAt (no Date.now, AP-CFUNNEL-2)', () => {
  it('is deterministic for a fixed epoch and ends with .json', () => {
    const ts = 1_700_000_000_000;
    expect(coachProfileFilename(ts)).toBe(coachProfileFilename(ts));
    expect(coachProfileFilename(ts).endsWith('.json')).toBe(true);
    expect(coachProfileFilename(ts).startsWith('coach-profile-')).toBe(true);
  });

  it('embeds the assessedAt date (local)', () => {
    const ts = 1_700_000_000_000;
    const d = new Date(ts);
    const p = (n: number) => (n < 10 ? `0${n}` : String(n));
    const expected = `coach-profile-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
    expect(coachProfileFilename(ts)).toBe(expected);
  });

  it('matches a safe [a-z0-9-] shape (sanitised by construction)', () => {
    expect(coachProfileFilename(1_700_000_000_000)).toMatch(/^coach-profile-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('does NOT call Date.now (purity): result is independent of the wall clock', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const ts = 1_700_000_000_000;
      const d = new Date(ts);
      const p = (n: number) => (n < 10 ? `0${n}` : String(n));
      const expected = `coach-profile-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
      expect(coachProfileFilename(ts)).toBe(expected);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
