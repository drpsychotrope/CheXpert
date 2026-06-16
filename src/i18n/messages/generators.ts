// TS-generator + label-map messages (V2-W18 Phase 3, F3): explain / positional / program /
// metacog / diagnostic label VALUES. Keys are the existing stable storage/theme keys
// (motif 'fork', dimension 'tactics', severity 'blunder', self-tag 'rushed') — NEVER translated;
// only the values are bilingual. Pure cores resolve these via translate(GEN, key, locale).
import type { Messages } from '../translate';

export const generators: Messages = {
  // ── Severity phrases (explain.ts SEVERITY_PHRASE) ────────────────────────
  'severity.blunder': { fr: 'une gaffe', en: 'a blunder' },
  'severity.mistake': { fr: 'une erreur', en: 'a mistake' },
  'severity.inaccuracy': { fr: 'une imprécision', en: 'an inaccuracy' },
  'severity.good': { fr: 'correct', en: 'fine' },
  'severity.best': { fr: 'le meilleur coup', en: 'the best move' },

  // ── Phase phrases (explain.ts PHASE_PHRASE) ──────────────────────────────
  'phase.opening': { fr: "à l'ouverture", en: 'in the opening' },
  'phase.middlegame': { fr: 'au milieu de partie', en: 'in the middlegame' },
  'phase.endgame': { fr: 'en finale', en: 'in the endgame' },

  // ── Motif explanations (explain.ts MOTIF_EXPLANATION) ────────────────────
  'motifExpl.mate': { fr: 'force le mat', en: 'forces checkmate' },
  'motifExpl.mateIn1': { fr: 'donne mat en un', en: 'delivers mate in one' },
  'motifExpl.mateIn2': { fr: 'force le mat en deux', en: 'forces mate in two' },
  'motifExpl.mateIn3': { fr: 'force le mat en trois', en: 'forces mate in three' },
  'motifExpl.backRankMate': { fr: 'exploite la faiblesse de la dernière rangée', en: 'exploits the weak back rank' },
  'motifExpl.hangingPiece': { fr: 'gagne une pièce non défendue', en: 'wins an undefended piece' },
  'motifExpl.fork': { fr: 'fait une fourchette sur deux cibles', en: 'forks two targets at once' },
  'motifExpl.knightFork': { fr: 'place une fourchette de cavalier', en: 'lands a knight fork' },
  'motifExpl.pin': { fr: 'cloue une pièce contre une plus précieuse', en: 'pins a piece against a more valuable one' },
  'motifExpl.absolutePin': { fr: 'cloue une pièce sur le roi', en: 'pins a piece to the king' },
  'motifExpl.relativePin': { fr: 'cloue une pièce sur une plus précieuse', en: 'pins a piece to a more valuable one' },
  'motifExpl.skewer': { fr: 'enfile deux pièces sur une même ligne', en: 'skewers two pieces on one line' },
  'motifExpl.discoveredAttack': { fr: 'déclenche une attaque à la découverte', en: 'unleashes a discovered attack' },
  'motifExpl.discoveredCheck': { fr: 'donne un échec à la découverte', en: 'gives a discovered check' },
  'motifExpl.doubleCheck': { fr: 'donne un échec double', en: 'delivers a double check' },

  // ── Motif family labels (diagnostic.ts MOTIF_LABELS) ─────────────────────
  'motif.fork': { fr: 'Fourchettes', en: 'Forks' },
  'motif.pin': { fr: 'Clouages', en: 'Pins' },
  'motif.skewer': { fr: 'Enfilades', en: 'Skewers' },
  'motif.hangingPiece': { fr: 'Pièces en prise', en: 'Hanging pieces' },
  'motif.discoveredAttack': { fr: 'Attaques à la découverte', en: 'Discovered attacks' },
  'motif.mate': { fr: 'Schémas de mat', en: 'Mating patterns' },
  'motif.endgame': { fr: 'Finales', en: 'Endgames' },

  // ── Weakness dimension labels (diagnostic.ts DIM_LABELS — full) ──────────
  'dim.tactics': { fr: 'Tactique', en: 'Tactics' },
  'dim.openingAccuracy': { fr: 'Précision en ouverture', en: 'Opening accuracy' },
  'dim.endgameConversion': { fr: 'Conversion en finale', en: 'Endgame conversion' },
  'dim.timeManagement': { fr: 'Gestion du temps', en: 'Time management' },
  'dim.resilience': { fr: 'Résilience', en: 'Resilience' },

  // ── Dimension labels — short (Radar.svelte; abbreviated for the chart) ────
  'dimShort.tactics': { fr: 'Tactique', en: 'Tactics' },
  'dimShort.openingAccuracy': { fr: 'Ouverture', en: 'Opening' },
  'dimShort.endgameConversion': { fr: 'Finale', en: 'Endgame' },
  'dimShort.timeManagement': { fr: 'Temps', en: 'Time' },
  'dimShort.resilience': { fr: 'Résilience', en: 'Resilience' },

  // ── Self-tag labels (metacog.ts SELF_TAG_LABELS) ─────────────────────────
  'selfTag.miscalculated': { fr: 'Mal calculé', en: 'Miscalculated' },
  'selfTag.missed-opponent-resource': { fr: 'Ressource adverse ratée', en: "Missed opponent's resource" },
  'selfTag.rushed': { fr: 'Précipité', en: 'Rushed' },
  'selfTag.unfamiliar-pattern': { fr: 'Motif méconnu', en: 'Unfamiliar pattern' },
  'selfTag.wrong-plan': { fr: 'Mauvais plan', en: 'Wrong plan' },
  'selfTag.other': { fr: 'Autre', en: 'Other' },

  // ── explain.ts sentence templates (bilingual per case — no fragment concat) ──
  'explain.headlineGood': { fr: 'Coup {n} {san} — {sev}.', en: 'Move {n} {san} — {sev}.' },
  'explain.headline': {
    fr: 'Coup {n} {san} — {sev} (−{wp} % de chances de gain) {phase}.',
    en: 'Move {n} {san} — {sev} (−{wp}% winning chances) {phase}.',
  },
  'explain.magLarge': {
    fr: "Cet écart est important : il offre à l'adversaire environ {wp} % de chances de gain.",
    en: 'This swing is large: it hands the opponent roughly {wp}% in winning chances.',
  },
  'explain.magMed': { fr: 'Cela coûte environ {wp} % de chances de gain.', en: 'It costs about {wp}% in winning chances.' },
  'explain.magSmall': {
    fr: 'Un petit relâchement — environ {wp} % de chances de gain.',
    en: 'A smaller slip — about {wp}% in winning chances.',
  },
  'explain.missedTacticSan': { fr: 'Vous avez raté une tactique : {san} {what}.', en: 'You missed a tactic: {san} {what}.' },
  'explain.missedTacticNoSan': { fr: 'Vous avez raté une tactique qui {what}.', en: 'You missed a tactic that {what}.' },
  'explain.forcedMate': { fr: 'Un mat forcé était disponible{from}.', en: 'A forced mate was available{from}.' },
  'explain.forcedMateFrom': { fr: ' commençant par {san}', en: ' starting with {san}' },
  'explain.fallback': {
    fr: "Impossible de nommer un motif tactique précis ici avec certitude — le moteur évalue simplement {alt} comme nettement meilleur.",
    en: "We can't name a specific tactical pattern here with confidence — the engine simply evaluates {alt} as clearly better.",
  },
  'explain.altWithSan': { fr: "{san} et d'autres coups", en: '{san} and other moves' },
  'explain.altNoSan': { fr: 'un autre coup', en: 'another move' },
  'explain.materialCue': {
    fr: "Concrètement, c'est environ une pièce (ou plus) qui bascule vers l'adversaire.",
    en: 'In practical terms this is around a piece (or more) of value swung to your opponent.',
  },
  'explain.betterSan': { fr: 'Mieux valait {san}.', en: 'Better was {san}.' },

  // ── positional.ts (verb baked per locale; {who} is the localized subject) ──
  'pos.subjectW': { fr: 'Les Blancs', en: 'White' },
  'pos.subjectB': { fr: 'Les Noirs', en: 'Black' },
  'pos.isolated': { fr: '{who} ont un pion isolé ({sq}).', en: '{who} has an isolated pawn ({sq}).' },
  'pos.doubled': { fr: '{who} ont des pions doublés sur la colonne {sq}.', en: '{who} has doubled pawns on the {sq}-file.' },
  'pos.passed': { fr: '{who} ont un pion passé ({sq}).', en: '{who} has a passed pawn ({sq}).' },

  // ── metacog.ts calibration readout ───────────────────────────────────────
  'metacog.sentence': {
    fr: 'Quand votre confiance était « {word} », vous aviez raison {pct} % du temps.',
    en: 'When you said you were {word}, you were right {pct}% of the time.',
  },
  'metacog.wordSure': { fr: 'sûr', en: 'sure' },
  'metacog.wordUnsure': { fr: 'pas sûr', en: 'unsure' },
  'metacog.wordGuess': { fr: 'au pif', en: 'just guessing' },
  'metacog.verdictWellCalibrated': { fr: 'bien calibré', en: 'well-calibrated' },
  'metacog.verdictOverconfident': { fr: 'trop confiant', en: 'overconfident' },
  'metacog.verdictUnderconfident': { fr: 'pas assez confiant', en: 'underconfident' },
  'metacog.verdictMixed': { fr: 'variable', en: 'mixed' },

  // ── diagnostic.ts ────────────────────────────────────────────────────────
  'diag.placeholderDim': { fr: 'Jouez la partie de calibration pour évaluer ceci', en: 'Play the calibration game to assess this' },
  'diag.motifsProbed': { fr: '{n} motifs sondés ({puzzles} problèmes)', en: '{n} motifs probed ({puzzles} puzzles)' },

  // ── program.ts coach-program reasons ─────────────────────────────────────
  'program.endgameDrill': {
    fr: 'Problèmes de finale −{delta} vs votre référence — travaillez la conversion.',
    en: 'Endgame puzzles −{delta} vs your baseline — drill conversion.',
  },
  'program.motifDrill': {
    fr: '{motif} −{delta} vs votre référence — travaillez le motif.',
    en: '{motif} −{delta} vs your baseline — drill the pattern.',
  },
  'program.endgameConversion': {
    fr: 'La conversion en finale est un point faible (score {score}).',
    en: 'Endgame conversion is a weak spot (score {score}).',
  },
  'program.openingAccuracy': {
    fr: "La précision en ouverture est un point faible (score {score}).",
    en: 'Opening accuracy is a weak spot (score {score}).',
  },
  'program.openingSteer': {
    fr: "Jouez une partie où le bot oriente vers votre lacune d'ouverture.",
    en: 'Play a game where the bot steers into your opening gap.',
  },
  'program.timeManagement': {
    fr: 'La gestion du temps est un point faible (score {score}) — résolvez sous pendule.',
    en: 'Time management is a weak spot (score {score}) — solve under a clock.',
  },
  'program.resilience': {
    fr: 'La résilience est un point faible (score {score}) — entraînez-vous dans des positions inférieures.',
    en: 'Resilience is a weak spot (score {score}) — practise worse positions.',
  },
  'program.maintenance': {
    fr: 'Aucune faiblesse nette — gardez votre reconnaissance de motifs affûtée.',
    en: 'No clear weakness surfaced — keep your pattern recognition sharp.',
  },

  // ── studyPlan.ts plan-item reasons (focus/activity stay English routing keys) ──
  'studyPlan.warmupTargeted': { fr: '{n} cases à réviser — rappel ciblé.', en: '{n} squares due — targeted recall.' },
  'studyPlan.warmupVision': {
    fr: 'Échauffement : repérez tous les échecs, prises et pièces en prise.',
    en: 'Warm-up: spot all checks, captures, and hanging pieces.',
  },
  'studyPlan.resilience': {
    fr: 'La résilience est votre dimension la plus faible — entraînez-vous à tenir des positions inférieures.',
    en: 'Resilience is your weakest dimension — practise holding worse positions.',
  },
  'studyPlan.leak': { fr: '{count}× (perte moy. −{wpl} %) — travaillez cette fuite.', en: '{count}× (avg −{wpl}% win) — drill this leak.' },

  // ── weakness.ts DimensionScore.detail (measured + unmeasured) ────────────
  'weakness.tacticsDetail': { fr: '{n} coups de milieu de partie analysés', en: '{n} middlegame moves analysed' },
  'weakness.tacticsUnmeasured': { fr: 'Trop peu de coups de milieu de partie pour évaluer', en: 'Too few middlegame moves to assess' },
  'weakness.openingDetail': { fr: "ACPL d'ouverture {acpl} vs ~{exp} attendu", en: 'Opening ACPL {acpl} vs ~{exp} expected' },
  'weakness.openingUnmeasured': { fr: "Trop peu de coups d'ouverture pour évaluer", en: 'Too few opening moves to assess' },
  'weakness.endgameDetail': { fr: 'ACPL de finale {acpl} vs ~{exp} attendu', en: 'Endgame ACPL {acpl} vs ~{exp} expected' },
  'weakness.endgameUnmeasured': { fr: 'Aucune finale atteinte — jouez des parties plus longues pour évaluer', en: 'No endgame reached — play longer games to assess' },
  'weakness.timeDetail': { fr: '{n} gaffes vérifiées pour précipitation', en: '{n} blunders checked for rushing' },
  'weakness.timeUnmeasured': { fr: 'Pas assez de données de pendule pour évaluer', en: 'Not enough clock data to assess' },
  'weakness.resilienceDetail': { fr: '{n} fois en difficulté ; taux de récupération', en: '{n} times behind; recovery rate' },
  'weakness.resilienceUnmeasured': { fr: 'Rarement en difficulté — pas assez pour évaluer la récupération', en: 'Rarely behind — not enough to assess recovery' },

  // ── scenarios.ts (weakness-derived; library names/goals carry nameFr/goalFr inline) ──
  'scenario.weakName': { fr: 'Votre fuite : {motif}', en: 'Your leak: {motif}' },
  'scenario.weakGoal': {
    fr: "Vous vous êtes trompé ici ({motif}). Trouvez la bonne continuation contre un bot à votre niveau.",
    en: 'You went wrong here ({motif}). Find the right continuation against a bot at your level.',
  },

  // ── Phase labels (standalone, for Insights leak rows) ────────────────────
  'phaseLabel.opening': { fr: 'Ouverture', en: 'Opening' },
  'phaseLabel.middlegame': { fr: 'Milieu de partie', en: 'Middlegame' },
  'phaseLabel.endgame': { fr: 'Finale', en: 'Endgame' },
};
