// Severity labels (sev.*) — T2-owned closed namespace (TR4 provenance).
//
// NOTE ON THE PREFIX: the spec §8 named this namespace `severity.*`, but on the live baseline that
// prefix is ALREADY taken by generators.ts (severity.blunder = "une gaffe", …) — article-prefixed
// EXPLANATION phrases consumed by explain.ts in full sentences and surfaced in Insights. Reusing or
// overwriting those would (a) read wrong in the provenance parenthetical ("vous avez joué Qxf7
// (une gaffe)") and (b) perturb the Insights/explain output the doctrine requires to stay
// byte-identical (AP-COACH-1). So this closed BARE-WORD severity set lives under the distinct,
// collision-free `sev.*` prefix (premise drift: §1 measured 504 tests / no generator severity keys;
// the live baseline is 630 and has them). Same intent, same closed union, same parity gate.
//
// A personal puzzle's `meta.severity` is rendered through these, never raw (AP-TPERS-9). The union
// is closed (mistake/blunder/inaccuracy/missed-win) and parity-gated (labelRouting.test.ts): a
// future severity value without a label fails the exhaustiveness test. Standard French chess
// register, consistent with motif.* (mirrors F1 I2 terminology fidelity).
import type { Messages } from '../translate';

export const severity: Messages = {
  'sev.mistake': { fr: 'erreur', en: 'mistake' },
  'sev.blunder': { fr: 'gaffe', en: 'blunder' },
  'sev.inaccuracy': { fr: 'imprécision', en: 'inaccuracy' },
  'sev.missed-win': { fr: 'gain manqué', en: 'missed win' },
};
