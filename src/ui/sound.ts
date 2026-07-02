// Synthesized UI sounds (PR-05 sound-celebration, ADR-0063). WebAudio only — zero binary assets,
// license-clean by construction (Q-F=a). ON by default with a one-click Settings kill-switch;
// every call is feature-detected and try/catch-guarded so a missing/blocked AudioContext (jsdom,
// autoplay policy, user agent quirks) can NEVER break gameplay. Sounds are short (< 400 ms) and
// quiet by design — feedback, not fanfare (AP-ROADMAP-7: no forced noise, celebrations sober).
//
// Board.svelte is the single move-sound integration point (roadmap I7): every consumer that sets
// `lastMove` (Play, Tactics, Endgames, Sparring, Comeback, replays) sounds for free; boards without
// a lastMove (vision drills, static diagrams) stay silent by construction.

export type SoundEvent = 'move' | 'capture' | 'check' | 'win' | 'loss' | 'draw' | 'milestone';

interface Note {
  /** Frequency in Hz. */
  f: number;
  /** Start offset ms from the event. */
  at: number;
  /** Duration ms. */
  d: number;
  /** Peak gain 0..1 (kept low — these are cues, not effects). */
  g: number;
  type: OscillatorType;
}

/** Synth recipes — data, so the shape is unit-testable without an AudioContext. */
export const RECIPES: Record<SoundEvent, Note[]> = {
  move: [{ f: 260, at: 0, d: 70, g: 0.12, type: 'sine' }],
  capture: [
    { f: 200, at: 0, d: 60, g: 0.14, type: 'triangle' },
    { f: 150, at: 45, d: 80, g: 0.12, type: 'triangle' },
  ],
  check: [{ f: 660, at: 0, d: 110, g: 0.1, type: 'sine' }],
  win: [
    { f: 392, at: 0, d: 110, g: 0.11, type: 'sine' },
    { f: 494, at: 110, d: 110, g: 0.11, type: 'sine' },
    { f: 587, at: 220, d: 170, g: 0.11, type: 'sine' },
  ],
  loss: [
    { f: 330, at: 0, d: 140, g: 0.1, type: 'sine' },
    { f: 262, at: 140, d: 200, g: 0.1, type: 'sine' },
  ],
  draw: [
    { f: 330, at: 0, d: 120, g: 0.1, type: 'sine' },
    { f: 330, at: 140, d: 120, g: 0.08, type: 'sine' },
  ],
  milestone: [
    { f: 523, at: 0, d: 90, g: 0.11, type: 'sine' },
    { f: 659, at: 90, d: 90, g: 0.11, type: 'sine' },
    { f: 784, at: 180, d: 90, g: 0.11, type: 'sine' },
    { f: 1047, at: 270, d: 150, g: 0.11, type: 'sine' },
  ],
};

// Module-level enabled flag, synced from Settings at boot + on toggle (the store stays free of
// audio concerns; the view boundary owns the sync — same pattern as setLocaleState).
let enabled = true;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}
export function isSoundEnabled(): boolean {
  return enabled;
}

let ctx: AudioContext | null = null;

/** Play one event's recipe. Never throws; no-ops when disabled or WebAudio is unavailable. */
export function playSound(ev: SoundEvent): void {
  if (!enabled) return;
  try {
    if (typeof AudioContext === 'undefined') return;
    ctx ??= new AudioContext();
    // Autoplay policy: contexts start suspended until a user gesture; our triggers ARE gestures
    // (a move, a game end the user played into), so resume is safe and idempotent.
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of RECIPES[ev]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.f;
      const start = t0 + n.at / 1000;
      const end = start + n.d / 1000;
      // Quick attack, exponential-ish decay to zero — no clicks.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(n.g, start + 0.008);
      gain.gain.linearRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.01);
    }
  } catch {
    /* audio is best-effort, never in the way of the game */
  }
}

/** Count the pieces on a FEN's board field (pure). */
export function pieceCount(fen: string): number {
  const board = fen.split(' ')[0] ?? '';
  let n = 0;
  for (const ch of board) if (/[a-zA-Z]/.test(ch)) n++;
  return n;
}

/** Classify the sound for a position change (pure, unit-tested): check beats capture beats move.
 *  A capture is a strict piece-count drop (covers en passant too — the pawn leaves the board). */
export function moveSoundEvent(prevFen: string, fen: string, check: boolean): SoundEvent {
  if (check) return 'check';
  return pieceCount(fen) < pieceCount(prevFen) ? 'capture' : 'move';
}
