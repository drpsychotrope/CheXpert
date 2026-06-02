// Per-time-control rating pools (spec §4.4; owned by the time-controls spec).
//
// The RatingPool union is defined ONCE here and re-exported where convenient.
// The `chess960` member is part of the contract now but is populated lazily by
// the chess960 spec (the standard pools are seeded at onboarding/migration).

export type RatingPool = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'chess960';

/** The four standard (time-category) pools, seeded eagerly. chess960 is lazy. */
export const STANDARD_POOLS = ['bullet', 'blitz', 'rapid', 'classical'] as const;
