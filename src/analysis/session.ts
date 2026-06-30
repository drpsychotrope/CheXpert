// Deliberate-practice session runner core (ADR-0039). Wraps a deterministic study plan
// (buildStudyPlan output) into an ordered, executable session: each PlanItem → one
// SessionStep, an optional spaced-Review slot after the drills, and a terminal reflection
// step. Pure: NO Date, NO Math.random (the UI stamps elapsed time + ids at the boundary).
// Reuses the Insights/drillTarget leak→trainer mapping for tactics steps — does NOT
// re-derive a parallel routing (AP-ES-2). MUST NOT import Svelte or `app`.

import type { PlanItem, MasteryCriterion } from './studyPlan';

export type SessionStepKind =
  | 'vision' | 'tactics' | 'endgames' | 'repertoire' | 'comeback' | 'sparring' | 'play-steered' | 'review' | 'reflection';

export interface SessionStep {
  index: number;          // 0-based position in the runner
  kind: SessionStepKind;
  focus: string;          // from PlanItem.focus, or 'Reflect on this session'
  minutes: number;        // planned minutes (reflection = 0.5, rendered as "~20s")
  reason: string;         // carried from PlanItem, for the runner's "why this" line
  themes?: string[];      // tactics → app.tacticsFilterThemes
  timed?: boolean;        // tactics → app.tacticsTimed (time-management focus)
  mastery?: MasteryCriterion; // C7/CO16 — carried from PlanItem.mastery (coach steps only; study-plan/review/reflection omit it)
}

export interface SessionPlan {
  steps: SessionStep[];
  totalMinutes: number;   // sum of step.minutes (incl. reflection)
}

const REFLECTION_MINUTES = 0.5;

/** Derive tactics themes/timed from a PlanItem focus the SAME way Insights.drillLeak /
 *  drillTarget do (AP-ES-2): a time-management focus runs timed Tactics; any other focus
 *  filters Tactics to that motif key. Kept here (string-level) so the core has no `app`
 *  import; the UI maps step.themes → app.tacticsFilterThemes and step.timed → app.tacticsTimed. */
function tacticsRouting(focus: string): { themes?: string[]; timed: boolean } {
  const f = focus.toLowerCase();
  if (f.includes('time')) return { timed: true };
  return { themes: [focus], timed: false };
}

/** Wrap a study plan into an executable session. Pure + deterministic. */
export function buildSession(
  plan: PlanItem[],
  opts: { includeReview?: boolean; reviewMinutes?: number } = {},
): SessionPlan {
  const includeReview = opts.includeReview ?? true;
  const reviewMinutes = opts.reviewMinutes ?? 5;

  const steps: SessionStep[] = [];

  for (const item of plan) {
    const base: SessionStep = {
      index: steps.length,
      kind: item.activity, // PlanItem.activity ⊂ SessionStepKind
      focus: item.focus,
      minutes: item.minutes,
      reason: item.reason,
      mastery: item.mastery, // C7: copy through (undefined for study-plan items → no behavioural change)
    };
    if (item.activity === 'tactics') {
      const r = tacticsRouting(item.focus);
      base.themes = r.themes;
      base.timed = r.timed;
    }
    steps.push(base);
  }

  if (includeReview) {
    steps.push({
      index: steps.length,
      kind: 'review',
      focus: 'Spaced review of due cards',
      minutes: reviewMinutes,
      reason: 'Cards are due — reinforce what you have already learned.',
    });
  }

  steps.push({
    index: steps.length,
    kind: 'reflection',
    focus: 'Reflect on this session',
    minutes: REFLECTION_MINUTES,
    reason: 'What did you notice? What will you do differently next time?',
  });

  const totalMinutes = steps.reduce((sum, s) => sum + s.minutes, 0);
  return { steps, totalMinutes };
}
