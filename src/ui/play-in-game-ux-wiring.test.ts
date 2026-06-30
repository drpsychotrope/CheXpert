import { describe, it, expect } from 'vitest';

// P2 play-in-game-ux (spec §5 B3) — static wiring-presence guard.
//
// The repo has NO Svelte component-test harness (no @testing-library/svelte, zero
// *.svelte.test.ts) and adding one is a separate infra concern (spec §11 D3). So this test does NOT
// mount components. It reads Play.svelte's source and asserts the new P2 wiring is present, locking
// the rollout so a future edit can't silently regress confirm-resign / takeback / rematch / check
// (mirrors F2 B2's spirit — board-input-wiring.test.ts).
//
// HONEST LIMIT: this guards the *presence* of the handlers/props, NOT behavioural correctness (the
// degenerate guards, the rating-skip math, the per-position check). Correctness is unit-tested in
// the pure cores (moveList.test.ts, playSession.test.ts) and verified manually in spec §6 C2-C8.
//
// require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves import.meta.url to a
// non-file URL readFileSync rejects. Same pattern as board-input-wiring.test.ts.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

// Strip JS block/line comments AND Svelte HTML comments so we assert against real code, not the
// prose explaining it (the file's own comments mention these symbols).
const stripComments = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
const read = (rel: string) => stripComments(readFileSync(resolve(process.cwd(), rel), 'utf8'));

describe('P2 — Play.svelte resign goes through a confirm dialog (AP-PLAYUX-4)', () => {
  const play = read('src/ui/Play.svelte');

  it('the Resign button routes through requestResign, NOT a bare resign() onclick', () => {
    // The control-row Resign button must open the dialog; only confirmResign() may call resign().
    expect(play).toMatch(/onclick=\{requestResign\}/);
    expect(play).not.toMatch(/onclick=\{resign\}/);
  });

  it('a second ConfirmDialog instance is wired to confirmResign/cancelResign', () => {
    expect(play).toMatch(/onConfirm=\{confirmResign\}/);
    expect(play).toMatch(/onCancel=\{cancelResign\}/);
    // Two ConfirmDialog instances now: the coached take-back + the resign confirm.
    expect((play.match(/<ConfirmDialog/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('P2 — Play.svelte wires rematch / takeback / move-check (spec §4 A4/A5)', () => {
  const play = read('src/ui/Play.svelte');

  it('a Rematch button calls rematch()', () => {
    expect(play).toMatch(/onclick=\{rematch\}/);
    expect(play).toMatch(/function rematch\(/);
  });

  it('a Take back button calls takeBack(), gated by canTakeBack', () => {
    expect(play).toMatch(/onclick=\{takeBack\}/);
    expect(play).toMatch(/function takeBack\(/);
    expect(play).toMatch(/\{#if canTakeBack\}/);
  });

  it('a Check this move button calls checkMove() and shows checkVerdict', () => {
    expect(play).toMatch(/onclick=\{checkMove\}/);
    expect(play).toMatch(/function checkMove\(/);
    expect(play).toMatch(/checkVerdict/);
  });

  it('the takeback goes through the controller (no inline duplicate undo loop)', () => {
    // Integrate with the F6 controller, do not re-implement the undo inline (doctrine).
    expect(play).toMatch(/session\.takeBackPlayerMove\(\)/);
  });

  it('the on-demand check reuses the existing coachEvalBad (no second eval path — Q-C)', () => {
    expect(play).toMatch(/coachEvalBad\(\)/);
  });
});

describe('P2 — Play.svelte move list reads the pure formatter (AP-PLAYUX-1)', () => {
  const play = read('src/ui/Play.svelte');

  it('renders a move-list log region (aria-live="off" — AP-PLAYUX-9)', () => {
    expect(play).toMatch(/class="move-list"/);
    expect(play).toMatch(/role="log"/);
    expect(play).toMatch(/aria-live="off"/);
  });

  it('builds pairs via toMovePairs, the single numbering authority (not from playedUci)', () => {
    expect(play).toMatch(/toMovePairs\(/);
    expect(play).toMatch(/import \{ toMovePairs \}/);
  });
});

describe('P2 — finishGame honours the un-rated marker (ADR-0058 / AP-PLAYUX-3)', () => {
  const play = read('src/ui/Play.svelte');

  it('the rating-write block is gated by shouldRate(unrated)', () => {
    expect(play).toMatch(/shouldRate\(unrated\)/);
  });

  it('the GameRecord carries unrated:true when the game was un-counted', () => {
    expect(play).toMatch(/unrated:\s*true/);
  });
});
