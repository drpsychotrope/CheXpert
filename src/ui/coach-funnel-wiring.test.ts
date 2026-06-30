import { describe, it, expect } from 'vitest';

// C8 coach-funnel-robustness (spec §5) — static wiring-presence guard.
//
// The repo has NO Svelte component-test harness (0 *.svelte.test.ts; spec §1). So this test does
// not mount components — it reads the consumer sources and asserts the funnel/resume/engine-fail/
// export wiring is present, locking the rollout so a future edit can't silently drop a surface and
// regress CO20/CF4/CF8/CF10. Mirrors board-input-wiring.test.ts's philosophy.
//
// HONEST LIMIT: this guards the *presence* of the wiring (the singleton field, the mount-resume read,
// the engine-fail message, the guarded export button), NOT runtime behaviour — that is the pure-core
// unit tests (funnel.test.ts) + the manual smoke (spec §6 C4).
const { readFileSync } = require('fs') as { readFileSync(p: string, enc: string): string };
const { resolve } = require('path') as { resolve(...s: string[]): string };

const stripComments = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
const read = (rel: string) => stripComments(readFileSync(resolve(process.cwd(), rel), 'utf8'));

describe('C8 — in-memory resume singleton (CF4, AP-CFUNNEL-3)', () => {
  const appState = read('src/state/app.svelte.ts');

  it('app.svelte.ts declares the in-memory coachAssessment singleton', () => {
    expect(appState).toMatch(/coachAssessment\s*=\s*\$state/);
  });

  it('coachAssessment is NOT persisted via a DB_VERSION bump (stays in-memory)', () => {
    // The whole point (AP-CFUNNEL-3): no schema change. There is no DB_VERSION token in app state.
    expect(appState).not.toMatch(/DB_VERSION/);
  });

  it('Coach.svelte resumes from the singleton on mount and clears it on commit', () => {
    const coach = read('src/ui/Coach.svelte');
    // reads app.coachAssessment to restore, and nulls it when the assessment completes / starts over
    expect(coach).toMatch(/app\.coachAssessment/);
    expect(coach).toMatch(/app\.coachAssessment\s*=\s*null/);
    // a Start over affordance (FOLD-C1) exists
    expect(coach).toMatch(/coach\.startOver/);
  });
});

describe('C8 — engine-fail message (CF8, AP-CFUNNEL-4)', () => {
  const coach = read('src/ui/Coach.svelte');

  it('the even-game engine-fail path sets the coach.engineFailed info message before finishing', () => {
    // The catch must surface coach.engineFailed (not the old silent finishWithoutGame()).
    expect(coach).toMatch(/coach\.engineFailed/);
    // and flag the failure so the result note distinguishes it from a deliberate Skip
    expect(coach).toMatch(/gameFailed\s*=\s*true/);
    expect(coach).toMatch(/coach\.engineFailedNote/);
  });
});

describe('C8 — profile export (CF10, AP-CFUNNEL-5/6/7)', () => {
  it('export uses the shared downloadText primitive + the pure filename helper (no re-serialise)', () => {
    const coach = read('src/ui/Coach.svelte');
    const settings = read('src/ui/Settings.svelte');
    for (const [name, src] of [['Coach', coach], ['Settings', settings]] as const) {
      expect(src, `${name}: imports downloadText`).toMatch(/downloadText/);
      expect(src, `${name}: derives filename from coachProfileFilename`).toMatch(/coachProfileFilename/);
      // JSON.stringify the live profile VERBATIM (no lossy projection — AP-CFUNNEL-6)
      expect(src, `${name}: stringifies the profile`).toMatch(/JSON\.stringify\(/);
      // the button is guarded on a persisted profile existing
      expect(src, `${name}: guards on coachProfile`).toMatch(/coachProfile/);
    }
  });

  it('downloadText is the shared primitive in pgnDownload.ts (reuse-if-shipped, AP-CFUNNEL-11)', () => {
    const dl = read('src/ui/pgnDownload.ts');
    expect(dl).toMatch(/export function downloadText\(/);
    // downloadPgn delegates to it (one primitive, not two)
    expect(dl).toMatch(/downloadText\(pgn,/);
  });
});

describe('C8 — funnel surfaces (CO20, AP-CFUNNEL-1)', () => {
  it('Home shows a dismissible rough-patch card gated on the pure shouldOfferCoach predicate', () => {
    const home = read('src/ui/Home.svelte');
    expect(home).toMatch(/shouldOfferCoach\(/);
    // the Date.now() boundary lives in the component (AP-CFUNNEL-2), not the core
    expect(home).toMatch(/shouldOfferCoach\([^)]*Date\.now\(\)\s*\)/);
    // dismissible (an in-memory cooldown flag) — non-nagging
    expect(home).toMatch(/coachOfferDismissed/);
    expect(home).toMatch(/home\.roughPatch/);
  });

  it('Onboarding end offers a coaching read routing to the coach view', () => {
    const onb = read('src/ui/Onboarding.svelte');
    expect(onb).toMatch(/onboarding\.coachOffer/);
    expect(onb).toMatch(/app\.go\('coach'\)/);
  });
});
