// Player color choice for games (ADR-0047). Pure; rng injected so 'random' is
// testable. The UI resolves a choice to a concrete side once per game start.

export type ColorChoice = 'white' | 'black' | 'random';

/** Resolve a choice to a concrete side. 'random' uses rng() (< 0.5 → white). */
export function resolveColor(choice: ColorChoice, rng: () => number = Math.random): 'white' | 'black' {
  if (choice === 'white' || choice === 'black') return choice;
  return rng() < 0.5 ? 'white' : 'black';
}
