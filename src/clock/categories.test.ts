import { describe, it, expect } from 'vitest';
import { categoryFor, TIME_CONTROL_PRESETS, fmtClock, type Category } from './categories';

describe('categoryFor band classifier', () => {
  it('maps each timed preset into its intended band', () => {
    const expected: Record<string, Category> = {
      '1+0': 'bullet', '2+1': 'bullet',
      '3+2': 'blitz', '5+0': 'blitz',
      '10+0': 'rapid', '15+10': 'rapid',
      '30+0': 'classical',
    };
    for (const p of TIME_CONTROL_PRESETS) {
      if (p.untimed) continue;
      const want = expected[`${p.initialSec / 60 % 1 === 0 ? p.initialSec / 60 : p.initialSec}+${p.incrementSec}`];
      // The map above is keyed by minutes+inc for the standard presets; only assert known ones.
      if (want) expect(categoryFor(p.initialSec, p.incrementSec)).toBe(want);
    }
  });

  it('classifies the canonical presets directly', () => {
    expect(categoryFor(60, 0)).toBe('bullet'); // est 60
    expect(categoryFor(120, 1)).toBe('bullet'); // est 160
    expect(categoryFor(180, 2)).toBe('blitz'); // est 260
    expect(categoryFor(300, 0)).toBe('blitz'); // est 300
    expect(categoryFor(600, 0)).toBe('rapid'); // est 600
    expect(categoryFor(900, 10)).toBe('rapid'); // est 1300
    expect(categoryFor(1800, 0)).toBe('classical'); // est 1800
  });

  it('respects the band boundaries (178/179, 478/479, 1498/1499)', () => {
    expect(categoryFor(178, 0)).toBe('bullet');
    expect(categoryFor(179, 0)).toBe('blitz');
    expect(categoryFor(478, 0)).toBe('blitz');
    expect(categoryFor(479, 0)).toBe('rapid');
    expect(categoryFor(1498, 0)).toBe('rapid');
    expect(categoryFor(1499, 0)).toBe('classical');
  });

  it('uses initial + 40*increment as the estimate (increment pushes up a band)', () => {
    // 2+1 = 120 + 40 = 160 -> bullet; 2+2 = 120 + 80 = 200 -> blitz.
    expect(categoryFor(120, 1)).toBe('bullet');
    expect(categoryFor(120, 2)).toBe('blitz');
  });
});

describe('TIME_CONTROL_PRESETS table', () => {
  it('contains the Q-A seed: bullet 1+0/2+1, blitz 3+2/5+0, rapid 10+0/15+10, classical 30+0, No clock, Custom', () => {
    const labels = TIME_CONTROL_PRESETS.map((p) => p.label);
    expect(labels).toEqual([
      'Bullet 1+0', 'Bullet 2+1', 'Blitz 3+2', 'Blitz 5+0',
      'Rapid 10+0', 'Rapid 15+10', 'Classical 30+0', 'No clock', 'Custom',
    ]);
  });

  it('marks exactly the "No clock" preset as untimed', () => {
    expect(TIME_CONTROL_PRESETS.filter((p) => p.untimed).map((p) => p.label)).toEqual(['No clock']);
  });

  it('every preset has a unique id', () => {
    const ids = TIME_CONTROL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the standard timed presets carry the right seconds', () => {
    const bullet = TIME_CONTROL_PRESETS.find((p) => p.id === 'bullet-1-0');
    expect(bullet).toMatchObject({ initialSec: 60, incrementSec: 0 });
    const rapidInc = TIME_CONTROL_PRESETS.find((p) => p.id === 'rapid-15-10');
    expect(rapidInc).toMatchObject({ initialSec: 900, incrementSec: 10 });
  });
});

describe('fmtClock', () => {
  it('formats minutes:seconds above 20 s', () => {
    expect(fmtClock(125_000)).toBe('2:05');
    expect(fmtClock(60_000)).toBe('1:00');
    expect(fmtClock(20_001)).toBe('0:21'); // ceil to whole seconds above the 20s threshold
  });

  it('formats seconds with one decimal at or below 20 s', () => {
    expect(fmtClock(19_900)).toBe('19.9');
    expect(fmtClock(5_400)).toBe('5.4');
  });

  it('shows 0:00 at or below zero', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(-50)).toBe('0:00');
  });
});
