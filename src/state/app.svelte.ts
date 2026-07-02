// Global app state (Svelte 5 runes in a module). Holds the loaded player model,
// settings, the engine client, and the current view. Components import `app`.

import { EngineClient } from '../engine/EngineClient';
import { PuzzleRepo } from '../trainer/PuzzleRepo';
import { loadPlayerModel, savePlayerModel, loadSettings, saveSettings } from '../store/playerModel';
import { dueCount } from '../srs/SrsStore';
import type { PlayerModel, SettingsRecord } from '../store/db';
import type { SessionPlan } from '../analysis/session';
import { setLocaleState, type Locale } from '../i18n';

export type View =
  | 'home'
  | 'onboarding'
  | 'play'
  | 'tactics'
  | 'import'
  | 'dashboard'
  | 'review'
  | 'endgames'
  | 'repertoire'
  | 'woodpecker'
  | 'guess'
  | 'vision'
  | 'comeback'
  | 'insights'
  | 'explorer'
  | 'calculate'
  | 'sparring'
  | 'analysis-board'
  | 'concepts'
  | 'when-to-think'
  | 'session'
  | 'coach'
  | 'settings';

class AppState {
  view = $state<View>('home');
  ready = $state(false);
  /** Set when boot() fails (e.g. IndexedDB unavailable). The UI shows this instead of
   *  a normal view or an endless "Loading…" (audit W2). */
  bootError = $state<string | null>(null);
  model = $state<PlayerModel | null>(null);
  settings = $state<SettingsRecord | null>(null);
  /** Set by the dashboard "Drill" buttons; consumed by the tactics trainer. */
  tacticsFilterThemes = $state<string[] | null>(null);
  /** Set by the time-management drill; runs Tactics under a per-puzzle clock. */
  tacticsTimed = $state(false);
  /** Optional start position for the interactive analysis board. */
  analysisFen = $state<string | null>(null);
  /** Optional motif to focus the Concepts library on (set by a "Learn the pattern" link). */
  conceptFocusMotif = $state<string | null>(null);
  /** Due vision squares (ADR-0043); set by the session builder, consumed by Vision.svelte to
   *  seed coordinate/blindfold prompts onto weak squares. NOT persisted. */
  visionWeakSquares = $state<string[] | null>(null);
  /** Active deliberate-practice session (in-memory, survives view swaps; NOT persisted).
   *  `budgetMin` (C7/CO5): the chosen coach budget (15/30/60), so Session.svelte honours the toggle
   *  instead of a hardcoded 30 (AP-CPROG-1). Optional — Insights' generic session path omits it
   *  (Session falls back to 30). In-memory only → no DB_VERSION concern. */
  activeSession = $state<{ plan: SessionPlan; current: number; startedAt: number; reflection: string; budgetMin?: number } | null>(null);
  /** In-progress coach assessment (C8/CF4, in-memory; survives view swaps; NOT persisted by default
   *  — mirrors `activeSession`). Lets the wizard RESUME after navigating away mid-assessment instead
   *  of silently losing every probe. Carries the wizard cursor: `step`, the built à-la-carte `plan`
   *  (C2/CF7 — needed to re-enter the right ladder), `themeIdx`, and the probe results so far.
   *  In-memory only → NO DB_VERSION concern (AP-CFUNNEL-3). */
  coachAssessment = $state<{
    step: string;
    plan: import('../coach/probePlan').ProbeSpec[];
    themeIdx: number;
    probes: import('../coach/types').ThemeProbeResult[];
  } | null>(null);
  /** CF/CO20 (C8): the Home rough-patch coaching card was dismissed this session. In-memory cooldown
   *  (mirrors the other ephemeral flags here) so "Not now" doesn't re-nag during the session and the
   *  prompt stays gentle (AP-CFUNNEL-1). Resets on reload by design — no schema change. */
  coachOfferDismissed = $state(false);
  /** Set by a coach 'sparring' program step; consumed once by Sparring.svelte to auto-open a scenario. */
  sparringScenarioId = $state<string | null>(null);
  /** Set by a coach 'play-steered' program step; consumed once by Play.svelte to override the steer dimension. */
  steerDimension = $state<import('../analysis/weakness').Dimension | null>(null);
  /** Due SRS cards (puzzle + repertoire) for the Home/Review badge — the loop's re-engagement
   *  signal in a no-backend app (audit v2 P1-07). Recomputed on boot and each view change. */
  dueReview = $state(0);
  /** Unanalysed played games (P1, play-loop-closure): the count surfaced as a Dashboard/Home
   *  badge linking to the played-game history. Derived from the persisted stores so it survives
   *  navigation (AP-PLAYLOOP-1); == unanalyzedPlayedGames(...).length so it never overstates what a
   *  batch run would analyse (AP-PLAYLOOP-13). Recomputed on boot + each view change, like dueReview. */
  unanalyzedGames = $state(0);

  readonly engine = new EngineClient();
  readonly puzzles = new PuzzleRepo();

  async boot(now: number): Promise<void> {
    try {
      this.model = await loadPlayerModel(now);
      this.settings = await loadSettings();
      // Apply the persisted UI language before the first render (V2-W18). Default FR.
      setLocaleState(this.settings.locale ?? 'fr');
      // PR-05 (ADR-0063): sync the sound kill-switch (ON by default, Q-F=a) before any board mounts.
      const { setSoundEnabled } = await import('../ui/sound');
      setSoundEnabled(this.settings.soundEnabled ?? true);
      await this.puzzles.init();
      await this.refreshDue(now);
      await this.refreshUnanalyzed();
      // First run → route to onboarding (launch-time skill evaluation).
      this.view = this.model.onboarded ? 'home' : 'onboarding';
    } catch (e) {
      // Never hang on "Loading…": surface an explicit error and stop (audit W2).
      this.bootError = e instanceof Error ? e.message : String(e);
    } finally {
      this.ready = true;
    }
  }

  go(view: View): void {
    this.view = view;
  }

  /** Recompute the due-card count for the Review badge (cheap `due` index range query). */
  async refreshDue(now: number): Promise<void> {
    try {
      const [p, r] = await Promise.all([dueCount(now, 'puzzle'), dueCount(now, 'repertoire')]);
      this.dueReview = p + r;
    } catch {
      /* storage unavailable — leave the badge at 0 */
    }
  }

  /** Recompute the unanalysed-played-games count for the Dashboard/Home badge (P1). Pure selector
   *  over the F5 reads (excludes 960 + color-less legacy records). */
  async refreshUnanalyzed(): Promise<void> {
    try {
      const { getAllGames, getAnalyzedGameIds } = await import('../store/gamesRepo');
      const { unanalyzedPlayedGames } = await import('../analysis/unanalyzedGames');
      const [games, analyzed] = await Promise.all([getAllGames(), getAnalyzedGameIds()]);
      this.unanalyzedGames = unanalyzedPlayedGames(games, analyzed).length;
    } catch {
      /* storage unavailable — leave the badge at its last value */
    }
  }

  async persistModel(now: number): Promise<void> {
    if (this.model) await savePlayerModel($state.snapshot(this.model), now);
  }

  async persistSettings(): Promise<void> {
    if (this.settings) await saveSettings($state.snapshot(this.settings));
  }

  /** Switch UI language (V2-W18): update the live locale + <html lang>, then persist. */
  async setLocale(locale: Locale): Promise<void> {
    setLocaleState(locale);
    if (this.settings) {
      this.settings.locale = locale;
      await this.persistSettings();
    }
  }
}

export const app = new AppState();
