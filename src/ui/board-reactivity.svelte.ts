// Reactivity regression harness for ADR-0051 — see board-reactivity.test.ts.
//
// AnalysisBoard.svelte (and the calibration/game boards in Play/Sparring/Comeback/Endgames/
// Coach/Onboarding) derive chessground props from a ChessGame held in $state. Svelte 5 does NOT
// deep-proxy a class instance, so an in-place game.move()/moveUci() never re-fires deriveds bound
// only to the `game` signal — only *reassigning* `game` does. The fixes: AnalysisBoard reassigns
// `game` in advance(); the game boards anchor `check` on the reactive `fen`. This harness models
// both so the bug and the fix are captured deterministically (no engine / browser / chessground).
import { ChessGame } from '../game/ChessGame';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function makeBoardState(startFen: string = START) {
  let game = $state(new ChessGame(startFen));
  let fen = $state(startFen);

  // Bound ONLY to the `game` signal — the pre-fix AnalysisBoard pattern (movableColor/turnColor/
  // dests) and the game boards' `check` pattern. Re-fires only when `game` is reassigned.
  const currentTurn = $derived(game.turn);
  const inCheckGameOnly = $derived(game.inCheck());
  // Anchored on the reactive `fen` (reassigned every move) — the game-board `check` fix.
  const inCheckFromFen = $derived(fen ? game.inCheck() : false);

  // AnalysisBoard.advance(): reassign `game` so every game-bound derived refreshes.
  function advance(): void {
    fen = game.fen;
    game = new ChessGame(fen);
  }

  return {
    get turn(): string {
      return currentTurn;
    },
    get checkStale(): boolean {
      return inCheckGameOnly;
    },
    get check(): boolean {
      return inCheckFromFen;
    },
    get fen(): string {
      return fen;
    },
    /** In-place mutation only (no reassignment) — reproduces the stale-binding bug. */
    moveInPlace(from: string, to: string): boolean {
      return game.move(from, to, 'q') != null;
    },
    advance,
    /** The fixed AnalysisBoard onMove/playLine: mutate, then advance (reassign `game`). */
    move(from: string, to: string): boolean {
      if (game.move(from, to, 'q') == null) return false;
      advance();
      return true;
    },
    /** A move as the 6 game boards do it: mutate `game` in place, reassign ONLY `fen`. */
    moveKeepingGame(from: string, to: string): boolean {
      if (game.move(from, to, 'q') == null) return false;
      fen = game.fen;
      return true;
    },
  };
}
