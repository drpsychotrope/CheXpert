// Time-control categories + presets + clock formatting (spec §4.2, §4.6, Q-A).
// Pure: no Date / Math.random inside.

export type Category = 'bullet' | 'blitz' | 'rapid' | 'classical';

/**
 * Lichess-style band on the estimate = initialSec + 40 * incrementSec.
 *   est < 179        -> 'bullet'    (1+0 = 60, 2+1 = 160)
 *   179 <= est < 479 -> 'blitz'     (3+2 = 260, 5+0 = 300)
 *   479 <= est < 1499-> 'rapid'     (10+0 = 600, 15+10 = 1300)
 *   est >= 1499      -> 'classical' (30+0 = 1800)
 */
export function categoryFor(initialSec: number, incrementSec: number): Category {
  const est = initialSec + 40 * incrementSec;
  if (est < 179) return 'bullet';
  if (est < 479) return 'blitz';
  if (est < 1499) return 'rapid';
  return 'classical';
}

export interface TimeControlPreset {
  id: string;
  label: string;
  initialSec: number;
  incrementSec: number;
  /** "No clock" — preserves today's untimed Play behavior; rated into the classical pool (Q-B=a). */
  untimed?: boolean;
}

/** Q-A seed (see spec §0.5). "Custom" is a sentinel the UI expands into initial/increment inputs. */
export const TIME_CONTROL_PRESETS: TimeControlPreset[] = [
  { id: 'bullet-1-0', label: 'Bullet 1+0', initialSec: 60, incrementSec: 0 },
  { id: 'bullet-2-1', label: 'Bullet 2+1', initialSec: 120, incrementSec: 1 },
  { id: 'blitz-3-2', label: 'Blitz 3+2', initialSec: 180, incrementSec: 2 },
  { id: 'blitz-5-0', label: 'Blitz 5+0', initialSec: 300, incrementSec: 0 },
  { id: 'rapid-10-0', label: 'Rapid 10+0', initialSec: 600, incrementSec: 0 },
  { id: 'rapid-15-10', label: 'Rapid 15+10', initialSec: 900, incrementSec: 10 },
  { id: 'classical-30-0', label: 'Classical 30+0', initialSec: 1800, incrementSec: 0 },
  { id: 'no-clock', label: 'No clock', initialSec: 0, incrementSec: 0, untimed: true },
  { id: 'custom', label: 'Custom', initialSec: 300, incrementSec: 0 },
];

/** Format remaining ms: mm:ss above 20 s, ss.s at/below 20 s, 0:00 at/below zero. */
export function fmtClock(ms: number): string {
  if (ms <= 0) return '0:00';
  if (ms <= 20_000) return (Math.ceil(ms / 100) / 10).toFixed(1);
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
