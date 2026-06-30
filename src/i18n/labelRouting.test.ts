// F1 i18n-label-routing (spec §5). Pure-logic tests for the display resolvers
// (labelOrRaw / motifLabelOrRaw) and a union-exhaustive parity gate for activity.*.
// No Svelte component harness — the components call these pure helpers, so testing
// the helpers + the catalogue proves the routed display. Display-only: the raw key
// keeps feeding routing/filters (AP-I18N-1), which these tests assert via the fallback.
import { describe, it, expect } from 'vitest';
import { labelOrRaw, motifLabelOrRaw } from './gen';
import { generators } from './messages/generators';
import { severity as severityMessages } from './messages/severity';
import { buildStudyPlan, type PlanItem } from '../analysis/studyPlan';
import type { Leak } from '../analysis/fingerprint';
import type { Severity } from '../trainer/provenance';

// FOLD I3: the REAL PlanItem.activity union, surfaced for runtime iteration. The
// `Record<PlanItem['activity'], true>` type forces TS to list EVERY union member —
// add a value to the union without adding it here and svelte-check fails (compile-time
// exhaustiveness, mirrors the coach-mode gate). The test then asserts each listed value
// has an activity.* label (runtime). A future activity without a label fails one of the two.
const ACTIVITY_VALUES: Record<PlanItem['activity'], true> = {
  tactics: true,
  endgames: true,
  repertoire: true,
  comeback: true,
  vision: true,
  sparring: true,
  'play-steered': true,
};
const ACTIVITIES = Object.keys(ACTIVITY_VALUES) as PlanItem['activity'][];

describe('labelOrRaw (F1 generic display resolver)', () => {
  it('returns the localized FR + EN label for every activity.* key', () => {
    expect(labelOrRaw('activity', 'play-steered', 'fr')).toBe('Partie ciblée');
    expect(labelOrRaw('activity', 'play-steered', 'en')).toBe('Steered game');
    expect(labelOrRaw('activity', 'comeback', 'fr')).toBe('Retour au score');
    expect(labelOrRaw('activity', 'comeback', 'en')).toBe('Comeback');
  });

  it('falls back to the raw key when the namespace has no entry (AP-I18N-1: routing key stays raw)', () => {
    // An unknown key must come back verbatim — that raw value is what keeps feeding routing.
    expect(labelOrRaw('activity', 'totally-unknown-activity', 'fr')).toBe('totally-unknown-activity');
    expect(labelOrRaw('nope', 'tactics', 'en')).toBe('tactics');
  });
});

describe('motifLabelOrRaw (F1 Q-B trainer theme coverage)', () => {
  it('localizes the common detector sub-tags FR + EN (standard chess register, FOLD I2)', () => {
    expect(motifLabelOrRaw('hangingPiece', 'fr')).toBe('Pièces en prise');
    expect(motifLabelOrRaw('hangingPiece', 'en')).toBe('Hanging pieces');
    expect(motifLabelOrRaw('knightFork', 'fr')).toBe('Fourchette de cavalier');
    expect(motifLabelOrRaw('backRankMate', 'fr')).toBe('Mat de la dernière rangée');
    expect(motifLabelOrRaw('doubleCheck', 'en')).toBe('Double check');
  });

  it('falls back to raw for the open-vocabulary long tail (§11, AP-I18N-4 tail is OK here)', () => {
    expect(motifLabelOrRaw('someExoticLichessTheme', 'fr')).toBe('someExoticLichessTheme');
  });
});

describe('activity.* bilingual parity — union-exhaustive (FOLD I3, AP-I18N-2/4)', () => {
  it('every real PlanItem.activity value has a non-empty FR AND EN activity.* label', () => {
    for (const activity of ACTIVITIES) {
      const entry = generators['activity.' + activity];
      expect(entry, `missing activity.* catalogue entry for "${activity}"`).toBeTruthy();
      expect(entry.fr.trim().length, `empty FR for activity.${activity}`).toBeGreaterThan(0);
      expect(entry.en.trim().length, `empty EN for activity.${activity}`).toBeGreaterThan(0);
    }
  });

  it('resolves a non-raw (translated) label for every activity in both locales (closed union — no raw)', () => {
    for (const activity of ACTIVITIES) {
      // A raw activity on a closed union is a bug, not a tail (AP-I18N-4):
      // the resolved label must differ from the raw key in at least the FR register.
      const fr = labelOrRaw('activity', activity, 'fr');
      const en = labelOrRaw('activity', activity, 'en');
      expect(fr.length, `empty FR label for ${activity}`).toBeGreaterThan(0);
      expect(en.length, `empty EN label for ${activity}`).toBeGreaterThan(0);
      expect(fr, `activity "${activity}" rendered raw in FR — closed union must have a label`).not.toBe(activity);
    }
  });
});

describe('F1 regression — routed displays (spec §5)', () => {
  it('a Coach/Insights program item with activity:"play-steered" renders a non-raw FR string', () => {
    const item: PlanItem = { activity: 'play-steered', focus: 'openingAccuracy', minutes: 8, reason: 'r' };
    const display = labelOrRaw('activity', item.activity, 'fr');
    expect(display).toBe('Partie ciblée');
    expect(display).not.toBe('play-steered'); // no raw routing key leaks to the user
    // Routing invariant (AP-I18N-1): the raw key on the item is untouched by display.
    expect(item.activity).toBe('play-steered');
  });

  it('a puzzle theme "hangingPiece" renders "Pièces en prise" (FR), not the raw key', () => {
    const themes = ['hangingPiece'];
    const line = themes.map((th) => motifLabelOrRaw(th, 'fr')).join(', ');
    expect(line).toBe('Pièces en prise');
    expect(line).not.toContain('hangingPiece');
  });

  it('mixed known + unknown themes: known localized, unknown raw (Q-B common set + raw tail)', () => {
    const themes = ['fork', 'someTailTheme'];
    const line = themes.map((th) => motifLabelOrRaw(th, 'fr')).join(', ');
    expect(line).toBe('Fourchettes, someTailTheme');
  });
});

describe('sev.* severity bilingual parity — union-exhaustive (T2/TR4, AP-TPERS-9)', () => {
  // Mirror the activity.* gate: Record<Severity, true> forces TS to list EVERY union member, so a
  // future severity added to the union without a label here fails svelte-check (compile-time
  // exhaustiveness). The test then asserts each listed value has a non-empty FR AND EN label.
  // (Closed BARE-WORD severity set under `sev.*`, distinct from the article-prefixed `severity.*`
  // explanation phrases in generators.ts — see i18n/messages/severity.ts for why.)
  const SEVERITY_VALUES: Record<Severity, true> = {
    mistake: true,
    blunder: true,
    inaccuracy: true,
    'missed-win': true,
  };
  const SEVERITIES = Object.keys(SEVERITY_VALUES) as Severity[];

  it('every severity value has a non-empty FR AND EN sev.* label (closed union, no raw)', () => {
    for (const s of SEVERITIES) {
      const entry = severityMessages['sev.' + s];
      expect(entry, `missing sev.* catalogue entry for "${s}"`).toBeTruthy();
      expect(entry.fr.trim().length, `empty FR for sev.${s}`).toBeGreaterThan(0);
      expect(entry.en.trim().length, `empty EN for sev.${s}`).toBeGreaterThan(0);
    }
  });

  it('renders the FR chess-register word, not the raw English enum (e.g. blunder → "gaffe")', () => {
    expect(severityMessages['sev.blunder'].fr).toBe('gaffe');
    expect(severityMessages['sev.inaccuracy'].fr).toBe('imprécision');
    expect(severityMessages['sev.missed-win'].fr).toBe('gain manqué');
  });
});

describe('F1 routing invariant — study-plan DATA byte-identical across locales (AP-I18N-5)', () => {
  // The display label is computed at render time from the raw key; it is NEVER stored on the
  // plan item. So the DATA the Insights/Coach display reads (activity/focus/minutes/order) must
  // be byte-identical regardless of locale — only `reason` (already-localized prose) may differ.
  const leak = (motif: string, phase: Leak['phase'], count: number, avgWpl: number): Leak => ({
    key: motif, motif, phase, count, avgWpl, sampleFens: [], severity: { mistake: count, blunder: 0 },
  });
  const routing = (p: PlanItem[]) => p.map((i) => ({ activity: i.activity, focus: i.focus, minutes: i.minutes }));

  it('activity/focus/minutes and ordering are identical for fr vs en plans (routing keys stay raw)', () => {
    const leaks = [leak('fork', 'middlegame', 5, 30), leak('endgameMistake', 'endgame', 2, 20)];
    const fr = buildStudyPlan(leaks, 'tactics', 30, { locale: 'fr' });
    const en = buildStudyPlan(leaks, 'tactics', 30, { locale: 'en' });
    expect(routing(fr)).toEqual(routing(en));
    // Routing keys are English regardless of locale (display does not mutate them).
    for (const item of fr) expect(item.activity).toMatch(/^[a-z-]+$/);
  });
});
