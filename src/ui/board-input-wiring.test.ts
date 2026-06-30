import { describe, it, expect } from 'vitest';

// F2 board-input-a11y (spec §5 B2) — static wiring-presence guard.
//
// The repo has NO Svelte component-test harness (no @testing-library/svelte, zero
// *.svelte.test.ts) and adding one is a separate infra concern (spec §11 D3). So this
// test does not mount components. It reads the consumer sources and asserts the keyboard
// text-move path is wired, locking the rollout so a future edit can't silently drop the
// prop and regress a consumer back to mouse-only.
//
// HONEST LIMIT (spec §5 B2 / FOLD A8): this guards the *presence* of `onMoveText` +
// `resolveMove(`, NOT the correctness of each consumer's turn/play guard. Behavioural
// correctness (a typed move can't be applied off-turn — AP-A11Y-2) is verified manually
// in spec §6 C2, not here.
//
// require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves
// import.meta.url to a non-file URL that readFileSync rejects. Same pattern as
// board-turn-color.test.ts / concept-card-board-size.test.ts.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

// Strip JS block/line comments AND Svelte HTML comments so we assert against real code,
// not the prose explaining it (these files' own comments mention onMoveText/resolveMove
// and even the literal role="grid" in the deferral note).
const stripComments = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
const read = (rel: string) => stripComments(readFileSync(resolve(process.cwd(), rel), 'utf8'));

// The 12 interactive Board instances across 9 files (spec §1 Gap 2; +1 = C2's timed block).
// Each entry is a file plus the number of <Board> instances it must wire with onMoveText.
const INTERACTIVE: Array<{ file: string; boards: number }> = [
  { file: 'src/ui/Coach.svelte', boards: 3 }, // ladders + timed block (C2/CO15) + calibration game
  { file: 'src/ui/Comeback.svelte', boards: 1 },
  { file: 'src/ui/Sparring.svelte', boards: 1 },
  { file: 'src/ui/Endgames.svelte', boards: 1 },
  { file: 'src/ui/GuessMove.svelte', boards: 1 },
  { file: 'src/ui/AnalysisBoard.svelte', boards: 1 },
  { file: 'src/ui/Repertoire.svelte', boards: 1 }, // scratch ChessGame(drill.fen())
  { file: 'src/ui/Woodpecker.svelte', boards: 1 },
  { file: 'src/ui/Onboarding.svelte', boards: 2 }, // ladder + calibration game
];

// Boards that MUST NOT get onMoveText: onSelect square-tap drills + view-only boards
// (spec §1 Out / Q-E / AP-A11Y-3). A text MOVE is a no-op (guarded by `!viewOnly`) or
// semantically wrong (a square-tap drill has no from->to move).
const EXCLUDED = [
  'src/ui/Calculate.svelte', // onSelect (tap-to-build)
  'src/ui/AnalysisResult.svelte', // viewOnly
  'src/ui/ConceptCard.svelte', // viewOnly
  'src/ui/SolutionReveal.svelte', // viewOnly
  'src/ui/WhenToThink.svelte', // viewOnly
];

describe('F2 keyboard move entry — interactive Board consumers are wired (spec §5 B2)', () => {
  for (const { file, boards } of INTERACTIVE) {
    it(`${file} passes onMoveText on each of its ${boards} interactive board(s)`, () => {
      const src = read(file);
      const onMoveText = (src.match(/onMoveText\s*=/g) ?? []).length;
      expect(onMoveText, `${file}: expected ${boards} onMoveText prop(s)`).toBe(boards);
    });

    it(`${file} resolves the typed move via resolveMove (canonical pattern)`, () => {
      const src = read(file);
      // Each wired callback must funnel the typed text through resolveMove (the legality
      // gate) before applying it — never re-implement parsing per consumer (AP-A11Y-1).
      const resolves = (src.match(/\.resolveMove\(/g) ?? []).length;
      expect(resolves, `${file}: expected >= ${boards} resolveMove() call(s)`).toBeGreaterThanOrEqual(
        boards,
      );
    });

    it(`${file} defaults a promo-less move to a queen (parity with Tactics/Play/Review)`, () => {
      const src = read(file);
      // The text path auto-queens a bare last-rank push, matching the existing wiring
      // (spec §11 D6). Guards against an undefined promo silently reaching onMove.
      expect(src).toMatch(/\.promo\s*\?\?\s*'q'/);
    });
  }
});

describe('F2 — excluded boards stay mouse/tap only (spec §1 Out / AP-A11Y-3)', () => {
  for (const file of EXCLUDED) {
    it(`${file} does NOT wire onMoveText`, () => {
      const src = read(file);
      expect(src).not.toMatch(/onMoveText\s*=/);
    });
  }
});

describe('F2 — Board.svelte single source: region aria + keyboard feedback loop (spec §4 A1)', () => {
  const board = read('src/ui/Board.svelte');

  it('derives an `interactive` flag from `!viewOnly && onMoveText`', () => {
    // The region label and the rendered form share one condition (spec §4 A1).
    expect(board).toMatch(/const\s+interactive\s*=\s*\$derived\(\s*!viewOnly\s*&&\s*!!onMoveText/);
  });

  it('labels the board region with role + a bilingual t() aria-label, split by interactivity', () => {
    // Interactive -> role="group" + board.label; otherwise role="img" + board.labelView.
    // The label MUST be a t() key, never a hard-coded string (AP-A11Y-5 / ADR-0053).
    expect(board).toMatch(/role=\{interactive \? 'group' : 'img'\}/);
    expect(board).toMatch(/aria-label=\{interactive \? t\('board\.label'\) : t\('board\.labelView'\)\}/);
  });

  it('does NOT announce role="grid" (deferred; AP-A11Y-4)', () => {
    // Announcing a grid with no arrow-key model is worse than a group (spec §11 D1).
    expect(board).not.toMatch(/role=["']grid["']/);
  });

  it('returns focus to the move input and announces a polite status on a successful typed move', () => {
    // FOLD A1 (focus return) + FOLD A3 (polite aria-live success). The assertive error
    // region stays as-is; this is its polite counterpart.
    expect(board).toMatch(/kbInput\?\.focus\(\)/);
    expect(board).toMatch(/kbStatus\s*=\s*t\('board\.movePlayed'\)/);
    expect(board).toMatch(/role="status"\s+aria-live="polite"/);
  });
});
