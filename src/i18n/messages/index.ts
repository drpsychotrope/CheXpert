// Catalogue aggregator (V2-W18). One domain file per migration wave so parallel work never
// touches the same file; merged here. A collision test (translate.test.ts) guards against two
// domains declaring the same key (silent spread overwrite).
import type { Messages } from '../translate';
import { common } from './common';
import { play } from './play';
import { tactics } from './tactics';
import { coach } from './coach';
import { analysis } from './analysis';
import { journey } from './journey';
import { settings } from './settings';
import { generators } from './generators';

/** All per-domain catalogues, in merge order. */
export const DOMAINS: Record<string, Messages> = {
  common,
  play,
  tactics,
  coach,
  analysis,
  journey,
  settings,
  generators,
};

export const ALL_MESSAGES: Messages = Object.assign({}, ...Object.values(DOMAINS));
