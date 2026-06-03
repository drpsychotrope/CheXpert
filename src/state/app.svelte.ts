// Global app state (Svelte 5 runes in a module). Holds the loaded player model,
// settings, the engine client, and the current view. Components import `app`.

import { EngineClient } from '../engine/EngineClient';
import { PuzzleRepo } from '../trainer/PuzzleRepo';
import { loadPlayerModel, savePlayerModel, loadSettings, saveSettings } from '../store/playerModel';
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
  | 'settings';

class AppState {
  view = $state<View>('home');
  ready = $state(false);
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
  /** Due vision squares (ADR-0042); set by the session builder, consumed by Vision.svelte to
   *  seed coordinate/blindfold prompts onto weak squares. NOT persisted. */
  visionWeakSquares = $state<string[] | null>(null);
  /** Active deliberate-practice session (in-memory, survives view swaps; NOT persisted). */
  activeSession = $state<{ plan: SessionPlan; current: number; startedAt: number; reflection: string } | null>(null);

  readonly engine = new EngineClient();
  readonly puzzles = new PuzzleRepo();

  async boot(now: number): Promise<void> {
    this.model = await loadPlayerModel(now);
    this.settings = await loadSettings();
    await this.puzzles.init();
    this.ready = true;
    // First run → route to onboarding (launch-time skill evaluation).
    this.view = this.model.onboarded ? 'home' : 'onboarding';
  }

  go(view: View): void {
    this.view = view;
  }

  async persistModel(now: number): Promise<void> {
    if (this.model) await savePlayerModel($state.snapshot(this.model), now);
  }

  async persistSettings(): Promise<void> {
    if (this.settings) await saveSettings($state.snapshot(this.settings));
  }
}

export const app = new AppState();
