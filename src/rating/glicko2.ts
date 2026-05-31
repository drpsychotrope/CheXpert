// Glicko-2 rating system (Glickman 2013).
// Pure, deterministic, framework-free. Used for BOTH the player's puzzle rating
// and game rating, kept as separate Rating values (spec §4.5: do not conflate).
//
// Reference: http://www.glicko.net/glicko/glicko2.pdf
// Scale: human-readable rating r ~ 1500, internal mu = (r-1500)/173.7178.

export interface Rating {
  /** Human-readable rating, e.g. 1500. */
  rating: number;
  /** Rating deviation (uncertainty), e.g. 350 for a new player. */
  rd: number;
  /** Volatility, default 0.06. */
  vol: number;
}

export interface MatchResult {
  /** Opponent's rating (e.g. a puzzle's rating, or the bot's Elo). */
  opponentRating: number;
  /** Opponent's RD (use a small value for a "known" puzzle/bot, e.g. 50). */
  opponentRd: number;
  /** 1 = win, 0 = loss, 0.5 = draw. */
  score: number;
}

const SCALE = 173.7178;
const DEFAULT_TAU = 0.5; // system constant; smaller = less volatile swings

export function defaultRating(rating = 1500, rd = 350, vol = 0.06): Rating {
  return { rating, rd, vol };
}

function toMu(r: number): number {
  return (r - 1500) / SCALE;
}
function toPhi(rd: number): number {
  return rd / SCALE;
}
function fromMu(mu: number): number {
  return mu * SCALE + 1500;
}
function fromPhi(phi: number): number {
  return phi * SCALE;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}
function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Update a rating from one or more match results within a rating period.
 * Pass a single result in an array for the puzzle/game one-at-a-time flow.
 */
export function updateRating(player: Rating, results: MatchResult[], tau = DEFAULT_TAU): Rating {
  const mu = toMu(player.rating);
  const phi = toPhi(player.rd);
  const sigma = player.vol;

  if (results.length === 0) {
    // No games: RD increases toward the prior (decay of certainty).
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { rating: player.rating, rd: clampRd(fromPhi(phiStar)), vol: sigma };
  }

  // Step 3: variance v.
  let vInv = 0;
  // Step 4: delta.
  let deltaSum = 0;
  for (const r of results) {
    const muJ = toMu(r.opponentRating);
    const phiJ = toPhi(r.opponentRd);
    const gj = g(phiJ);
    const e = expectedScore(mu, muJ, phiJ);
    vInv += gj * gj * e * (1 - e);
    deltaSum += gj * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Step 5: new volatility via iteration (Illinois algorithm).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  let iter = 0;
  while (Math.abs(B - A) > 1e-6 && iter < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
    iter += 1;
  }
  const newSigma = Math.exp(A / 2);

  // Step 6: pre-rating-period RD.
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  // Step 7: new phi and mu.
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: Math.round(fromMu(newMu) * 100) / 100,
    rd: clampRd(fromPhi(newPhi)),
    vol: newSigma,
  };
}

/** RD bounds: floor avoids over-confidence, cap matches a fresh player. */
function clampRd(rd: number): number {
  return Math.max(30, Math.min(350, Math.round(rd * 100) / 100));
}

/** Probability `player` beats an opponent of given rating (for UI / matchmaking). */
export function winProbability(player: Rating, opponentRating: number, opponentRd = 50): number {
  return expectedScore(toMu(player.rating), toMu(opponentRating), toPhi(opponentRd));
}
