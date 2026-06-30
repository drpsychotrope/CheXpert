import { describe, it, expect } from 'vitest';
import { unanalyzedPlayedGames } from './unanalyzedGames';
import type { GameRecord } from '../store/db';

// Minimal GameRecord factory — only the fields the selector reads matter (id, playedAt, variant,
// playerColor). result/botElo/coached/pgn are required by the type but irrelevant here.
const game = (over: Partial<GameRecord> & Pick<GameRecord, 'id' | 'playedAt'>): GameRecord => ({
  pgn: '1. e4 e5',
  result: 'win',
  botElo: 1500,
  coached: false,
  playerColor: 'w',
  ...over,
});

describe('unanalyzedPlayedGames (P1)', () => {
  it('returns standard, color-bearing, unanalysed games newest-first by playedAt', () => {
    const games = [
      game({ id: 'g-mid', playedAt: 200 }),
      game({ id: 'g-old', playedAt: 100 }),
      game({ id: 'g-new', playedAt: 300 }),
    ];
    const out = unanalyzedPlayedGames(games, new Set());
    expect(out.map((g) => g.id)).toEqual(['g-new', 'g-mid', 'g-old']);
  });

  it('excludes ids already present in analyzedIds', () => {
    const games = [game({ id: 'g1', playedAt: 1 }), game({ id: 'g2', playedAt: 2 })];
    const out = unanalyzedPlayedGames(games, new Set(['g1']));
    expect(out.map((g) => g.id)).toEqual(['g2']);
  });

  it('excludes chess960 games (AP-PLAYLOOP-4 / AP-960-4)', () => {
    const games = [
      game({ id: 'std', playedAt: 1 }),
      game({ id: 'wild', playedAt: 2, variant: 'chess960' }),
    ];
    const out = unanalyzedPlayedGames(games, new Set());
    expect(out.map((g) => g.id)).toEqual(['std']);
  });

  it('excludes legacy records with no playerColor (AP-PLAYLOOP-12)', () => {
    const games = [
      game({ id: 'withColor', playedAt: 2 }),
      game({ id: 'legacy', playedAt: 1, playerColor: undefined }),
    ];
    const out = unanalyzedPlayedGames(games, new Set());
    expect(out.map((g) => g.id)).toEqual(['withColor']);
  });

  it('count == displayed: 1 standard + 1 legacy-no-color + 1 chess960 → exactly 1 (F-P1-3 fidelity)', () => {
    const games = [
      game({ id: 'std', playedAt: 3 }),
      game({ id: 'legacy', playedAt: 2, playerColor: undefined }),
      game({ id: 'wild', playedAt: 1, variant: 'chess960' }),
    ];
    const out = unanalyzedPlayedGames(games, new Set());
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('std');
  });

  it('is empty when input is empty', () => {
    expect(unanalyzedPlayedGames([], new Set())).toEqual([]);
  });

  it('is empty (stable) when every standard game is already analysed', () => {
    const games = [game({ id: 'g1', playedAt: 1 }), game({ id: 'g2', playedAt: 2 })];
    expect(unanalyzedPlayedGames(games, new Set(['g1', 'g2']))).toEqual([]);
  });

  it('does not mutate the input array (sort works on a copy of the filtered set)', () => {
    const games = [game({ id: 'a', playedAt: 1 }), game({ id: 'b', playedAt: 2 })];
    const before = games.map((g) => g.id);
    unanalyzedPlayedGames(games, new Set());
    expect(games.map((g) => g.id)).toEqual(before);
  });
});
