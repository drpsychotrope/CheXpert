import { describe, it, expect } from 'vitest';
import { resolveColor, type ColorChoice } from './color';

describe('resolveColor', () => {
  it('passes white/black through unchanged', () => {
    expect(resolveColor('white')).toBe('white');
    expect(resolveColor('black')).toBe('black');
  });

  it('resolves random via the injected rng (deterministic in tests)', () => {
    expect(resolveColor('random', () => 0.1)).toBe('white'); // < 0.5 → white
    expect(resolveColor('random', () => 0.9)).toBe('black'); // >= 0.5 → black
    expect(resolveColor('random', () => 0.5)).toBe('black'); // boundary → black
  });

  it('accepts ColorChoice values', () => {
    const c: ColorChoice = 'random';
    expect(['white', 'black']).toContain(resolveColor(c, () => 0));
  });
});
