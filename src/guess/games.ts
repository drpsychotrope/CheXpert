// Built-in annotated master games for Guess-the-Move (spec §4 item, ADR-0017).
// Short, famous, instructive games. PGNs are validated at load time by chess.js;
// the test suite asserts every line is legal so a typo can't ship.

export interface MasterGame {
  id: string;
  name: string;
  white: string;
  black: string;
  /** Which side's moves the player guesses (the brilliant side). */
  guessColor: 'w' | 'b';
  /** Short note shown before starting. */
  note: string;
  pgn: string;
}

export const MASTER_GAMES: MasterGame[] = [
  {
    id: 'opera',
    name: 'The Opera Game',
    white: 'Morphy',
    black: 'Duke of Brunswick & Count Isouard',
    guessColor: 'w',
    note: 'Paris, 1858. Morphy’s model of rapid development and open lines. Guess White.',
    pgn:
      '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 ' +
      '8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 ' +
      '13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0',
  },
  {
    id: 'immortal',
    name: 'The Immortal Game',
    white: 'Anderssen',
    black: 'Kieseritzky',
    guessColor: 'w',
    note: 'London, 1851. Anderssen sacrifices both rooks and the queen. Guess White.',
    pgn:
      '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 ' +
      '8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 ' +
      '15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 ' +
      '21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0',
  },
  {
    id: 'evergreen',
    name: 'The Evergreen Game',
    white: 'Anderssen',
    black: 'Dufresne',
    guessColor: 'w',
    note: 'Berlin, 1852. A famous combinational finish. Guess White.',
    pgn:
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 ' +
      '8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 ' +
      '14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 ' +
      '20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0',
  },
  {
    id: 'pillsbury-lasker',
    name: 'Pillsbury vs Lasker (sham? no — a crush)',
    white: 'Pillsbury',
    black: 'Lasker',
    guessColor: 'b',
    note: 'St. Petersburg, 1895–96. Lasker’s queenside attack with ...Rxc3 is a model. Guess Black.',
    pgn:
      '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c5 5. Bg5 cxd4 6. Qxd4 Nc6 7. Qh4 Be7 8. O-O-O Qa5 ' +
      '9. e3 Bd7 10. Kb1 h6 11. cxd5 exd5 12. Nd4 O-O 13. Bxf6 Bxf6 14. Qh5 Nxd4 15. exd4 Be6 ' +
      '16. f4 Rac8 17. f5 Rxc3 18. fxe6 Ra3 19. exf7+ Rxf7 20. bxa3 Qb6+ 21. Bb5 Qxb5+ ' +
      '22. Ka1 Rc7 23. Rd2 Rc4 24. Rhd1 Rc3 25. Qf5 Qc4 0-1',
  },
  {
    id: 'byrne-fischer',
    name: 'The Game of the Century',
    white: 'Donald Byrne',
    black: 'Fischer',
    guessColor: 'b',
    note: 'New York, 1956. 13-year-old Fischer’s ...Be6!! queen sacrifice and windmill. Guess Black.',
    pgn:
      '1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 ' +
      '9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 ' +
      '16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ ' +
      '22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 ' +
      '29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ ' +
      '36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1',
  },
  {
    id: 'morphy-paulsen',
    name: 'Paulsen vs Morphy (...Qxf3!!)',
    white: 'Paulsen',
    black: 'Morphy',
    guessColor: 'b',
    note: 'New York, 1857. Morphy’s ...Qxf3!! queen sac for a winning attack. Guess Black.',
    pgn:
      '1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Bb5 Bc5 5. O-O O-O 6. Nxe5 Re8 7. Nxc6 dxc6 8. Bc4 b5 ' +
      '9. Be2 Nxe4 10. Nxe4 Rxe4 11. Bf3 Re6 12. c3 Qd3 13. b4 Bb6 14. a4 bxa4 15. Qxa4 Bd7 ' +
      '16. Ra2 Rae8 17. Qa6 Qxf3 18. gxf3 Rg6+ 19. Kh1 Bh3 20. Rd1 Bg2+ 21. Kg1 Bxf3+ ' +
      '22. Kf1 Bg2+ 23. Kg1 Bh3+ 24. Kh1 Bxf2 25. Qf1 Bxf1 26. Rxf1 Re2 27. Ra1 Rh6 28. d4 Be3 0-1',
  },
  {
    id: 'kasparov-topalov',
    name: 'Kasparov’s Immortal',
    white: 'Kasparov',
    black: 'Topalov',
    guessColor: 'w',
    note: 'Wijk aan Zee, 1999. The famous 24.Rxd4!! rook sac and king hunt. Guess White.',
    pgn:
      '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 ' +
      '9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 ' +
      '16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 ' +
      '23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 ' +
      '29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 ' +
      '35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 ' +
      '41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0',
  },
  {
    id: 'short-timman',
    name: 'Short vs Timman (the king walk)',
    white: 'Short',
    black: 'Timman',
    guessColor: 'w',
    note: 'Tilburg, 1991. Short marches his king up the board to force mate. Guess White.',
    pgn:
      '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 g6 5. Bc4 Nb6 6. Bb3 Bg7 7. Qe2 Nc6 8. O-O O-O ' +
      '9. h3 a5 10. a4 dxe5 11. dxe5 Nd4 12. Nxd4 Qxd4 13. Re1 e6 14. Nd2 Nd5 15. Nf3 Qc5 ' +
      '16. Qe4 Qb4 17. Bc4 Nb6 18. b3 Nxc4 19. bxc4 Re8 20. Rd1 Qc5 21. Qh4 b6 22. Be3 Qc6 ' +
      '23. Bh6 Bh8 24. Rd8 Bb7 25. Rad1 Bg7 26. R8d7 Rf8 27. Bxg7 Kxg7 28. R1d4 Rae8 ' +
      '29. Qf6+ Kg8 30. h4 h5 31. Kh2 Rc8 32. Kg3 Rce8 33. Kf4 Bc8 34. Kg5 1-0',
  },
];

export function masterGameById(id: string): MasterGame | undefined {
  return MASTER_GAMES.find((g) => g.id === id);
}
