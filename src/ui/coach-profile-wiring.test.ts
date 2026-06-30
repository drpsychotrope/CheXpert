import { describe, it, expect } from 'vitest';

// C1 coach-profile-persistence (spec §5/§10) — static wiring-presence guard.
//
// The repo has NO Svelte component-test harness (portfolio fact; enhancements-architecture-spec.md
// §8). So this test does NOT mount Coach.svelte — it reads the source and asserts the C1 seams are
// wired: the saved-profile read, the trend/staleness cores, and the resume-via-rebuild path. This
// locks the rollout so a future edit can't silently drop a seam and regress the feature. Behavioural
// correctness lives in the pure coachTrend.test.ts cores + manual PWA checks (spec §6), not here.
//
// require('fs'/'path') + process.cwd() (not import.meta.url): jsdom resolves import.meta.url to a
// non-file URL that readFileSync rejects. Same pattern as tactics-personalization-wiring.test.ts.
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

// Strip JS block/line comments AND Svelte HTML comments so we assert against real code, not the
// prose explaining it (this file's own comments mention every symbol below).
const stripComments = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
const src = stripComments(readFileSync(resolve(process.cwd(), 'src/ui/Coach.svelte'), 'utf8'));

describe('C1 Coach.svelte wiring-presence (spec §5)', () => {
  it('imports the pure trend + staleness cores and the program rebuilder', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bbuildCoachTrend\b[^}]*\}\s*from\s*'\.\.\/coach\/coachTrend'/);
    expect(src).toMatch(/\bisStale\b/);
    expect(src).toMatch(/\bprofileAgeDays\b/);
    expect(src).toMatch(/import\s*\{[^}]*\bbuildCoachProgram\b[^}]*\}\s*from\s*'\.\.\/coach\/program'/);
  });

  it('reads the already-persisted (write-only) saved profile off app.model — CF2', () => {
    expect(src).toMatch(/app\.model\?\.coachProfile\b/);
    expect(src).toMatch(/app\.model\?\.coachProfilePrev\b/);
  });

  it('stamps `now` only at the UI boundary (cores stay pure — AP-CPROF-1)', () => {
    expect(src).toMatch(/nowMs\s*=\s*Date\.now\(\)/);
  });

  it('surfaces the saved-profile card with the C1 i18n keys + the always-on view (AP-CPROF-8)', () => {
    for (const k of ['coach.savedTitle', 'coach.lastAssessed', 'coach.startProgram', 'coach.reassess']) {
      expect(src, `missing ${k}`).toContain(k);
    }
    // No dead "View profile" control — the card IS the view (FOLD-1 / AP-CPROF-8).
    expect(src).not.toMatch(/coach\.viewProfile/);
  });

  it('shows the soft staleness nudge gated on the predicate (AP-CPROF-3)', () => {
    expect(src).toMatch(/\{#if savedStale\}/);
    expect(src).toContain('coach.staleNudge');
  });

  it('renders the trend on the intro card AND the result screen via TrendList', () => {
    expect(src).toMatch(/import TrendList from '\.\/TrendList\.svelte'/);
    expect(src).toMatch(/<TrendList trend=\{savedTrend\}/);
    expect(src).toMatch(/<TrendList trend=\{resultTrend\}/);
  });

  it('resumes by REBUILDING the program from the saved profile, not re-probing (Q-D / AP-CPROF-6)', () => {
    // buildCoachProgram on the saved profile → buildSession → in-memory activeSession → route.
    expect(src).toMatch(/function resumeProgram\(\)/);
    expect(src).toMatch(/buildCoachProgram\(saved,/);
    expect(src).toMatch(/app\.activeSession\s*=\s*\{[^}]*buildSession\(/);
    expect(src).toMatch(/resumeProgram[\s\S]*?app\.go\('session'\)/);
  });
});
