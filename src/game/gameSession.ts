// Shared game-session controller (Foundation F6, ADR-0057). The stateful
// `onMove → checkEnd → engineReply → checkEnd` loop that Play/Sparring/Comeback each
// reimplement, extracted into ONE DOM-free, dependency-injected core. It *consumes* the pure
// helpers in `playSession.ts` (audit W12's "pure home") and an `AdaptiveOpponent`-shaped engine
// port; it never imports the worker, `Date`, `Math.random`, or `performance.now` (AP-CTRL-2).
//
// API shape = RETURN-STATE (Q-G), mirroring `makeBoardState` (board-reactivity): each mutating
// method returns a fresh view snapshot `{ status, fen, lastMove, terminal }` and the caller
// reassigns its own `$state` `fen` from the snapshot to honour the ADR-0050/0051 reactivity
// contract (Svelte 5 does not deep-proxy a ChessGame instance). The in-check `$derived` stays in
// the component, anchored on `fen`; the core only exposes `inCheckFor(fen)`.
//
// NO AUTO-CHAIN (Q-G / C1-1): `applyPlayerMove` does NOT internally call `engineReply`. The caller
// orchestrates the two steps so Play's coached take-back + the clock press can interpose between
// them (Play.svelte commitPlayerMove). Fusing them silently breaks Play's coached mode (AP-CTRL-8).
//
// The two guards carried over verbatim from the inline loops: the illegal-engine-move halt (P1-17)
// and the resign-during-think guard (P1-14, `(status as string) === 'over'`). `checkTerminal` is a
// pure, idempotent query — it returns a structured result, NEVER a localized string (AP-CTRL-1),
// and has no side effects (the rating fold + persistence stay in the component behind its own
// `gameFinished` guard — AP-CTRL-9). Calling it twice is safe (W6 double-fold guard lives caller-side).

import { ChessGame, type Chess960CastleFiles, type TerminalState, type Variant } from './ChessGame';

/** Game status, mirroring the inline loops' state machine. */
export type GameStatus = 'idle' | 'playing' | 'thinking' | 'over';

/** chessground orientation / player-side, as the components use it. */
export type PlayerColor = 'white' | 'black';

/** Structured terminal result. NEVER a localized string (AP-CTRL-1): the component maps
 *  `reason`/`winner`/`outcome` through `t()`. `outcome` is from the player's POV. */
export interface TerminalResult {
  over: boolean;
  reason?: TerminalState['reason'];
  /** Winning side ('w'/'b') on a checkmate; absent on a draw. */
  winner?: 'w' | 'b';
  /** Player-POV outcome ('win' | 'loss' | 'draw'); absent while the game is live. */
  outcome?: 'win' | 'loss' | 'draw';
}

/** A view snapshot returned by every mutating method. The component reassigns its `$state` `fen`
 *  from this (ADR-0050/0051) and reads `status`/`lastMove`/`terminal` for rendering. */
export interface SessionSnapshot {
  status: GameStatus;
  fen: string;
  lastMove: [string, string] | null;
  terminal: TerminalResult;
}

/**
 * Engine port (Q-F): the subset of `AdaptiveOpponent` the core needs. Injected so the core never
 * imports the worker; `pickHumanMove`/`pickMove` may use `Math.random` internally — that impurity
 * lives behind the port, not in the core (AP-CTRL-2). `interrupt` drops a stuck search on retry.
 */
export interface EnginePort {
  pickMove(fen: string, movetime?: number): Promise<string | null>;
  pickHumanMove(fen: string, movetime?: number): Promise<string | null>;
  interrupt(): Promise<void>;
}

/**
 * Optional capabilities (Q-B/Q-C/Q-F). Every flag defaults to preserve each caller's CURRENT
 * behaviour, so turning none on reproduces the WEAK siblings (pickMove, fixed 500ms, no retry) and
 * Play turns on exactly what it uses today. A capability is *exposed*, never silently *enabled*
 * (AP-CTRL-4).
 */
export interface GameSessionConfig {
  /** Use `pickHumanMove` (style sampling) instead of `pickMove`. Default false (siblings). */
  humanMove?: boolean;
  /** On an engine throw set an error state instead of surfacing the throw. Default false (siblings). */
  retry?: boolean;
  /** Opening-book steering: given the played-UCI list, return the book move to play, or null to
   *  let the engine pick. Absent → no book (siblings). */
  bookMove?: (playedUci: string[]) => string | null;
  /** Per-move engine budget in ms, or `null` to use the engine port's own default (matches Play's
   *  untimed branch: `pickHumanMove(fen)` at 300ms; `pickMove(fen, 500)`). Absent (provider not
   *  supplied) → the siblings' fixed 500ms via the `?? 500` fallback. Receives the bot side so a
   *  clock-aware provider can read the bot's own remaining time. */
  movetime?: (game: ChessGame, botSide: 'w' | 'b') => number | null;
  /** Feed the engine an X-FEN/Shredder FEN (Chess960). Absent → plain `game.fen`. */
  engineFen?: (game: ChessGame) => string;
}

export interface GameSessionInit {
  /** Starting FEN (C3/P3 enabler). Required — Play passes START_FEN or the 960 start FEN. */
  startFen: string;
  /** The side the human plays; the bot plays the opposite side. */
  playerSide: PlayerColor;
  engine: EnginePort;
  /** Chess960 routing for the underlying ChessGame (ADR-0041). Default standard. */
  variant?: Variant;
  castle?: Chess960CastleFiles | null;
  config?: GameSessionConfig;
}

/** A side flag ('w'/'b'), used in `inCheckFor` etc. */
export type Side = 'w' | 'b';

/**
 * The DOM-free game-session controller. Plain fields + explicit getters — NO Svelte runes. The
 * component owns the `$state` mirror; this core owns the rules-truth (`game`), the loop status, and
 * the last move. Created via `createGameSession`.
 */
export class GameSession {
  private game: ChessGame;
  private readonly playerSide: PlayerColor;
  private readonly engine: EnginePort;
  private readonly config: GameSessionConfig;
  private _status: GameStatus;
  private _lastMove: [string, string] | null = null;
  /** Set true when the bot's move throws and `retry` is enabled (Play's `engineError`). */
  private _engineError = false;
  /** Set true when `engineReply` halts on an illegal engine move (P1-17). Lets the caller tell an
   *  illegal-halt 'over' apart from a resign-during-think 'over' (P1-14) so it applies the right
   *  result string + clock side effects. Cleared at the start of each `engineReply`. */
  private _illegalHalt = false;
  /** Set true when the last `engineReply` actually advanced the board with a bot move (so the caller
   *  knows to press the clock to the bot). False on book-less null, P1-14 drop, P1-17 halt, or error.
   *  Cleared at the start of each `engineReply`. */
  private _movePlayed = false;
  /** UCI move list — book steering consults it (Play's `playedUci`). */
  private readonly playedUci: string[] = [];

  constructor(init: GameSessionInit) {
    const variant = init.variant ?? 'standard';
    this.game =
      variant === 'chess960'
        ? new ChessGame(init.startFen, { variant: 'chess960', castle: init.castle ?? undefined })
        : new ChessGame(init.startFen);
    this.playerSide = init.playerSide;
    this.engine = init.engine;
    this.config = init.config ?? {};
    // Start 'playing' — the component flips to 'thinking' itself around the opening engine reply
    // when the human is Black, exactly as the inline loops do.
    this._status = 'playing';
  }

  // ── Read-only accessors (the component mirrors these into $state) ──

  get status(): GameStatus {
    return this._status;
  }
  get lastMove(): [string, string] | null {
    return this._lastMove;
  }
  get engineError(): boolean {
    return this._engineError;
  }
  /** True when the last `engineReply` halted on an illegal engine move (P1-17). */
  get illegalHalt(): boolean {
    return this._illegalHalt;
  }
  /** True when the last `engineReply` advanced the board with a bot move (caller presses the clock). */
  get movePlayed(): boolean {
    return this._movePlayed;
  }
  get fen(): string {
    return this.game.fen;
  }
  /** chessground turn-color, derived from the underlying game (Play's `turnColor()`). */
  get turn(): PlayerColor {
    return this.game.turn === 'w' ? 'white' : 'black';
  }
  /** Read-only copy of the played UCI list — the post-game debrief names the opening from it
   *  (PR-03, ADR-0061); the book steering already consumed it internally. */
  get uciMoves(): string[] {
    return [...this.playedUci];
  }
  /** The bot plays the side opposite the player. */
  get botSide(): Side {
    return this.playerSide === 'white' ? 'b' : 'w';
  }
  /** Legal destinations for the side to move (chessground `dests`). */
  dests(): ReturnType<ChessGame['dests']> {
    return this.game.dests();
  }
  /** Underlying game handle for the component's view concerns (history/pgn/eval-fen). Read-only use. */
  get gameRef(): ChessGame {
    return this.game;
  }

  /** In-check query anchored on a FEN (ADR-0051): the component's `$derived` calls this. The arg
   *  is the reactive `fen` so the highlight refreshes per move; the value itself is read off the
   *  live game (positions match because the component reassigns `fen` from each snapshot). */
  inCheckFor(fen: string): boolean {
    return fen ? this.game.inCheck() : false;
  }

  /** Set the engine-feed FEN per config (Chess960 X-FEN) or plain `game.fen`. */
  private engineFen(): string {
    return this.config.engineFen ? this.config.engineFen(this.game) : this.game.fen;
  }

  private snapshot(): SessionSnapshot {
    return {
      status: this._status,
      fen: this.game.fen,
      lastMove: this._lastMove,
      terminal: this.checkTerminal(),
    };
  }

  /**
   * Apply the player's move. Validates turn + legality via `game.move`; on success advances the
   * board, records the UCI, and sets `lastMove`. If the player's move ended the game, status →
   * 'over'. Returns a fresh snapshot (the component reassigns `fen` — ADR-0050/0051).
   *
   * NO AUTO-CHAIN (C1-1): this does NOT call `engineReply`. The caller orchestrates
   * applyPlayerMove → (coached gate + clock press) → engineReply (AP-CTRL-8).
   *
   * Returns `null` if the move is rejected (wrong turn, not playing, or illegal) so the caller can
   * bail exactly as the inline `onMove` did (`if (!san) return`).
   */
  applyPlayerMove(from: string, to: string, promo: 'q' | 'r' | 'b' | 'n' = 'q'): SessionSnapshot | null {
    if (this._status !== 'playing' || this.turn !== this.playerSide) return null;
    const uci = from + to + (this.game.isPromotion(from, to) ? promo : '');
    const san = this.game.move(from, to, promo);
    if (!san) return null;
    this.playedUci.push(uci);
    this._lastMove = [from, to];
    // If the player's move ended the game, reflect it in status now (Play relies on checkEnd()
    // running inside commitPlayerMove; here the terminal is surfaced via the snapshot + checkEnd()).
    if (this.game.terminal().over) this._status = 'over';
    return this.snapshot();
  }

  /**
   * The bot's reply. Book-move-first (if `bookMove` provided) else a movetime-budgeted
   * `pickHumanMove`/`pickMove` by the `humanMove` flag. Carries both guards VERBATIM:
   *  - P1-14: resign-during-think — re-check `(status) === 'over'` after the await; drop the late move.
   *  - P1-17: illegal-engine-move halt — if `moveUci` rejects, status → 'over', no phantom move.
   * On a throw: if `retry` is enabled set the error state (Play offers Retry); else surface as
   * today (re-throw so the sibling caller's try/catch behaves unchanged). Returns a snapshot.
   */
  async engineReply(): Promise<SessionSnapshot> {
    this._status = 'thinking';
    this._engineError = false;
    this._illegalHalt = false;
    this._movePlayed = false;
    try {
      const engineFen = this.engineFen();
      // Loop closure: play the steering book move if still on the line; else let the engine pick.
      let uci = this.config.bookMove ? this.config.bookMove(this.playedUci) : null;
      if (!uci) {
        const budget = this.config.movetime ? this.config.movetime(this.game, this.botSide) : null;
        if (this.config.humanMove) {
          uci = budget != null ? await this.engine.pickHumanMove(engineFen, budget) : await this.engine.pickHumanMove(engineFen);
        } else {
          uci = await this.engine.pickMove(engineFen, budget ?? 500);
        }
      }
      // P1-14: a resign (or any terminal) landed while the search was in flight. Drop the late
      // move and stay 'over' rather than reviving a finished game on the board.
      if ((this._status as string) === 'over') return this.snapshot();
      if (uci) {
        // shim routes a king-to-rook castle UCI (e.g. e1h1); chess.js handles the rest.
        const san = this.game.moveUci(uci);
        if (!san) {
          // P1-17: engine returned a move the rules layer rejected (desync/illegal). Halt rather
          // than advance a phantom move and corrupt the board/last-move.
          this._status = 'over';
          this._illegalHalt = true;
          return this.snapshot();
        }
        this.playedUci.push(uci);
        this._lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
        this._movePlayed = true;
      }
    } catch (e) {
      if (this.config.retry) {
        // The bot's move threw (worker crash / timeout). Don't strand the game on a frozen board —
        // flag an error so the component can offer an explicit Retry (P1-05). Stay 'thinking' so
        // the board is not movable while the error is shown (matches Play: it leaves status as the
        // pre-existing 'thinking' and shows the Retry button).
        this._engineError = true;
        return this.snapshot();
      }
      // Siblings: no retry — surface the throw to the caller's try/catch exactly as today.
      throw e;
    }
    // Reflect a terminal reached by the bot's move; else return to 'playing'.
    if (this.game.terminal().over) this._status = 'over';
    else this._status = 'playing';
    return this.snapshot();
  }

  /** Drop a stuck engine search (best-effort), e.g. before a retry (P1-05). The caller then re-runs
   *  `engineReply` so the search/thinking timing matches the inline loop exactly (Play orchestrates
   *  interrupt → engineReply, mirroring its original `retryEngineMove` → `engineMove`). */
  async interruptEngine(): Promise<void> {
    this._engineError = false;
    try {
      await this.engine.interrupt();
    } catch {
      /* respawn is best-effort */
    }
  }

  /** Recover from a bot-move engine error in one call: interrupt then re-reply (P1-05). Convenience
   *  for callers that don't need to interleave view state between the two steps (used by tests). */
  async retryEngineMove(): Promise<SessionSnapshot> {
    await this.interruptEngine();
    return this.engineReply();
  }

  /**
   * PURE, IDEMPOTENT terminal query (AP-CTRL-1/9). Reads `game.terminal()` and maps it to a
   * structured result from the player's POV — NEVER a localized string, NO side effects. Calling it
   * any number of times is safe; the rating fold + persistence stay in the component behind its own
   * `gameFinished` guard (W6). The component runs `checkTerminal()` after each step and, when
   * `over`, sets its own status + result string and folds the result.
   */
  checkTerminal(): TerminalResult {
    const term = this.game.terminal();
    if (!term.over) return { over: false };
    if (term.reason === 'checkmate') {
      const outcome: 'win' | 'loss' = term.winner === this.playerSide[0] ? 'win' : 'loss';
      return { over: true, reason: term.reason, winner: term.winner, outcome };
    }
    return { over: true, reason: term.reason, outcome: 'draw' };
  }

  /** Undo the player's last move (coached take-back hook, spec §2): pop the UCI, revert the game,
   *  clear `lastMove`. The player stays on move. Returns a snapshot (the component reassigns `fen`).
   *  Coached-takeback POLICY stays in the component; the controller only exposes this hook + the
   *  pre-commit eval gate (which is the component's `coachEvalBad`, kept in Play). */
  undoPlayerMove(): SessionSnapshot {
    this.game.undo();
    this._lastMove = null;
    this.playedUci.pop();
    // After undoing the player's move the player is back on move (a coached take-back never follows
    // a terminal move — a blunder-flagged move can't also end the game — but keep the status honest).
    this._status = 'playing';
    return this.snapshot();
  }

  /** On-demand in-play take-back (P2, ADR-0058): undo the bot's last reply AND the player's move
   *  beneath it, landing back on the player's turn. Pops both UCIs, reverts the game twice, and
   *  recomputes `lastMove` from the now-last ply (or null) so the prior move stays highlighted.
   *  Caller MUST pre-gate with the pure `canTakeBackInPlay` (the player has actually moved — this
   *  must never undo the bot's OPENING move, AP-PLAYUX-10). NEVER fires the engine: after the double
   *  undo it is the player's turn and the loop resumes on their next move (the component must not
   *  call engineReply here). Returns a snapshot (the component reassigns `fen`). */
  takeBackPlayerMove(): SessionSnapshot {
    // Undo the bot's reply, then the player's move.
    this.game.undo();
    this.playedUci.pop();
    this.game.undo();
    this.playedUci.pop();
    // Recompute the highlight from the now-last ply: the player's previous move if any, else none.
    const last = this.playedUci[this.playedUci.length - 1];
    this._lastMove = last ? [last.slice(0, 2), last.slice(2, 4)] : null;
    // After undoing back past the player's move it is the player's turn again.
    this._status = 'playing';
    return this.snapshot();
  }

  /** Resign (P1-14 partner): set status 'over' synchronously so an in-flight `engineReply` drops
   *  its late move. Mirrors the inline `resign()` guard; the component does the result string +
   *  fold + clock stop. Returns a snapshot. */
  resign(): SessionSnapshot {
    if (this._status === 'playing' || this._status === 'thinking') {
      this._status = 'over';
    }
    return this.snapshot();
  }

  /** Force the session into a terminal state (e.g. a clock flag resolved in the component). Keeps
   *  the controller's status in sync with a component-owned end condition (Play's `onFlag`). */
  markOver(): SessionSnapshot {
    this._status = 'over';
    return this.snapshot();
  }
}

/** Factory — the construction entry point used by the components (mirrors the spec's
 *  `createGameSession`). */
export function createGameSession(init: GameSessionInit): GameSession {
  return new GameSession(init);
}
