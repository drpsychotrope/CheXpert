import { describe, it, expect } from 'vitest';

// T2 trainer-personalization (spec §5) — static wiring-presence guard.
//
// The repo has NO Svelte component-test harness (zero *.svelte.test.ts; portfolio fact,
// enhancements-architecture-spec.md §8). So this test does NOT mount the component. It reads
// Tactics.svelte and asserts the T2 seams are wired — provenance, the source toggle, the honest
// exhaustion path, and the F3 steer consumption — locking the rollout so a future edit can't
// silently drop a seam and regress the feature. Behavioural correctness is verified by the pure
// provenance.test.ts cores + manual PWA checks (spec §6), not here.
//
// require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves import.meta.url to a
// non-file URL that readFileSync rejects. Same pattern as board-input-wiring.test.ts.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

// Strip JS block/line comments AND Svelte HTML comments so we assert against real code, not the
// prose explaining it (this file's own comments mention every symbol below).
const stripComments = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
const src = stripComments(readFileSync(resolve(process.cwd(), 'src/ui/Tactics.svelte'), 'utf8'));

describe('T2 Tactics.svelte wiring-presence (spec §5)', () => {
  it('consumes the pure provenance core (provenanceOf) — TR4', () => {
    expect(src).toMatch(/provenanceOf\(/);
    // The generic "from your game" tag is gated on the NULL-provenance case (AP-TPERS-1): when prov
    // is present, the pre/post lines carry it instead of re-burying it under the generic star.
    expect(src).toMatch(/source === 'personal' && !prov/);
  });

  it('renders the pre + after-solve provenance lines via the T2 i18n keys — TR4', () => {
    expect(src).toMatch(/tactics\.provenancePre/);
    expect(src).toMatch(/tactics\.provenancePostWin/);
    expect(src).toMatch(/tactics\.provenancePostMove/);
    // Severity rendered through the closed sev.* namespace, never raw (AP-TPERS-9).
    expect(src).toMatch(/sev\.' \+ prov\.severity/);
  });

  it('computes the after-solve SAN via the EXISTING ChessGame.moveUci on moves\\[0\\] (E1)', () => {
    // No new UCI->SAN parser; SAN is computed at the call site and the pure core stays dependency-free.
    expect(src).toMatch(/new ChessGame\(puzzle\.fen\)\.moveUci\(/);
  });

  it('wires the persisted 3-way source toggle (trainerSource) — TR9', () => {
    expect(src).toMatch(/app\.settings\?\.trainerSource \?\? 'mixed'/); // read `?? 'mixed'`
    expect(src).toMatch(/app\.settings\.trainerSource = /); // write
    expect(src).toMatch(/persistSettings\(\)/); // persisted (no DB_VERSION bump)
    for (const k of ['tactics.sourceMixed', 'tactics.sourcePersonal', 'tactics.sourceCurated']) {
      expect(src, `missing ${k}`).toContain(k);
    }
  });

  it('wires the in-trainer theme picker into the SAME app.tacticsFilterThemes (AP-TPERS-11)', () => {
    expect(src).toMatch(/app\.tacticsFilterThemes = theme/);
    expect(src).toMatch(/motifLabelOrRaw\(/); // theme labels via the F1 routing helper
  });

  it('wires the coarse difficulty band via bandToQuery (AP-TPERS-7)', () => {
    expect(src).toMatch(/bandToQuery\(/);
    for (const k of ['tactics.diffEasier', 'tactics.diffOnLevel', 'tactics.diffHarder']) {
      expect(src, `missing ${k}`).toContain(k);
    }
  });

  it('surfaces the honest exhaustion state + widen/switch actions, never a silent flip — TR10', () => {
    expect(src).toMatch(/exhaustedTheme/);
    expect(src).toContain('tactics.themeExhausted');
    expect(src).toContain('tactics.widenRange');
    expect(src).toContain('tactics.switchToMixed');
  });

  it('consumes F3\'s steerFromWeakness in the mixed branch (T2 routes, does not reimplement) — AP-TPERS-5', () => {
    // F3 is present in this baseline; the mixed branch reuses its read rather than inlining a copy.
    expect(src).toMatch(/steerFromWeakness\(/);
  });
});
