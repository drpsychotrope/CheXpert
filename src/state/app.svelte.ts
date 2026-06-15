// Global app state (Svelte 5 runes in a module). Holds the loaded player model,
// settings, the engine client, and the current view. Components import `app`.

import { EngineClient } from '../engine/EngineClient';
import { PuzzleRepo } from '../trainer/PuzzleRepo';
import { loadPlayerModel, savePlayerModel, loadSettings, saveSettings } from '../store/playerModel';
import { dueCount } from '../srs/SrsStore';
import type { PlayerModel, SettingsRecord } from '../store/db';
import type { SessionPlan } from '../analysis/session';

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
  /** Active deliberate-practice session (in-memory, survives view swaps; NOT persisted). */
  activeSession = $state<{ plan: SessionPlan; current: number; startedAt: number; reflection: string } | null>(null);
  /** Set by a coach 'sparring' program step; consumed once by Sparring.svelte to auto-open a scenario. */
  sparringScenarioId = $state<string | null>(null);
  /** Set by a coach 'play-steered' program step; consumed once by Play.svelte to override the steer dimension. */
  steerDimension = $state<import('../analysis/weakness').Dimension | null>(null);
  /** Due SRS cards (puzzle + repertoire) for the Home/Review badge — the loop's re-engagement
   *  signal in a no-backend app (audit v2 P1-07). Recomputed on boot and each view change. */
  dueReview = $state(0);

  readonly engine = new EngineClient();
  readonly puzzles = new PuzzleRepo();

  async boot(now: number): Promise<void> {
    try {
      this.model = await loadPlayerModel(now);
      this.settings = await loadSettings();
      await this.puzzles.init();
      await this.refreshDue(now);
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

  async persistModel(now: number): Promise<void> {
    if (this.model) await savePlayerModel($state.snapshot(this.model), now);
  }

  async persistSettings(): Promise<void> {
    if (this.settings) await saveSettings($state.snapshot(this.settings));
  }
}

export const app = new AppState();
