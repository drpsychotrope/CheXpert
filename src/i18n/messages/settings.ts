// Settings view messages (V2-W18). Includes the language switch (the W18 deliverable itself).
import type { Messages } from '../translate';

export const settings: Messages = {
  'settings.title': { fr: 'Réglages', en: 'Settings' },

  // Language switch (the W18 bascule)
  'settings.language': { fr: 'Langue', en: 'Language' },
  'settings.languageLabel': { fr: "Langue de l'interface", en: 'Interface language' },
  'settings.languageFr': { fr: 'Français', en: 'French' },
  'settings.languageEn': { fr: 'Anglais', en: 'English' },

  'settings.coaching': { fr: 'Coaching', en: 'Coaching' },
  'settings.coachedLabel': {
    fr: "Mode coaché — signale une gaffe évidente juste après que je l'ai jouée (annuler ou continuer)",
    en: 'Coached mode — flag an obvious blunder right after I play it (take it back or keep going)',
  },
  'settings.coachedHint': {
    fr: "Au mieux en Phase 1 (vérification moteur rapide). Les alertes de gaffe avant le coup et la revue post-partie obligatoire viendront en Phase 2.",
    en: 'Best-effort in Phase 1 (a quick engine check). Full pre-move gaffe alerts + mandatory post-game review come with Phase 2.',
  },

  'settings.metacog': { fr: 'Métacognition', en: 'Metacognition' },
  'settings.metacogLabel': {
    fr: "Suivre la confiance et la cause d'erreur sur les problèmes",
    en: 'Track confidence & error cause on puzzles',
  },
  'settings.metacogHint': {
    fr: "Quand c'est activé, Tactique et Calcul affichent des pastilles optionnelles : votre confiance (avant la solution) et, après une erreur, pourquoi vous pensez l'avoir ratée. Le Bilan montre alors un compte rendu descriptif de calibration. Désactivé par défaut ; les pastilles sont toujours ignorables et ne bloquent jamais la résolution.",
    en: 'When on, Tactics and Calculation show optional chips: how sure you were (before the reveal) and, after a miss, why you think you missed. Insights then shows a descriptive calibration readout — how your confidence lines up with your results. Off by default; the chips are always skippable and never block solving.',
  },

  // T3/TR8 daily training goal (Q-E, default 10 puzzles, configurable).
  'settings.training': { fr: 'Entraînement', en: 'Training' },
  'settings.dailyGoalLabel': { fr: 'Objectif quotidien (problèmes)', en: 'Daily goal (puzzles)' },
  'settings.dailyGoalHint': {
    fr: 'Nombre de problèmes à résoudre par jour. Votre série progresse à chaque nouveau jour d\'entraînement. Par défaut : 10.',
    en: 'How many puzzles to solve each day. Your streak advances on each new training day. Default: 10.',
  },

  'settings.privacy': { fr: 'Confidentialité', en: 'Privacy' },
  'settings.privacyBody': {
    fr: "Tout reste sur cet appareil. Vos parties, votre historique de problèmes et votre modèle de joueur vivent dans l'IndexedDB de votre navigateur. Rien n'est envoyé où que ce soit par défaut.",
    en: "Everything stays on this device. Your games, puzzle history, and player model live in your browser's IndexedDB. Nothing is sent anywhere by default.",
  },
  'settings.networkLabel': {
    fr: 'Autoriser le réseau pour la base de finales Syzygy',
    en: 'Allow network for the Syzygy endgame tablebase',
  },
  'settings.networkHint': {
    fr: "Le retour parfait du trainer de finales vient de l'API Syzygy de Lichess. Désactivé, les finales fonctionnent quand même contre le moteur — sans la notation parfaite de la table. Activé, seule la position (un FEN) est envoyée ; les résultats sont mis en cache pour ne récupérer chaque position qu'une fois.",
    en: "The endgame trainer's perfect feedback comes from the Lichess Syzygy API. With this off, endgame drills still work against the engine — you just won't get tablebase-perfect move grading. When on, only the position (a FEN) is sent; results are cached so each position is fetched at most once.",
  },
  'settings.networkStatus': { fr: 'Réseau : {state}', en: 'Network: {state}' },
  'settings.on': { fr: 'activé', en: 'on' },
  'settings.off': { fr: 'désactivé', en: 'off' },

  'settings.yourData': { fr: 'Vos données', en: 'Your data' },
  'settings.rerunEval': { fr: "Refaire l'évaluation de niveau", en: 'Re-run skill evaluation' },
  'settings.rerunCoach': { fr: "Refaire l'évaluation du coach", en: 'Re-run coaching assessment' },
  'settings.deleteData': { fr: 'Supprimer toutes mes données', en: 'Delete all my data' },

  'settings.wipeTitle': { fr: 'Tout supprimer ?', en: 'Delete all data?' },
  'settings.wipeBody': {
    fr: 'Cela supprime définitivement TOUTES les données locales — classements, parties, historique de problèmes et réglages. Irréversible.',
    en: 'This permanently deletes ALL local data — ratings, games, puzzle history, and settings. This cannot be undone.',
  },
  'settings.wipeConfirm': { fr: 'Tout supprimer', en: 'Delete everything' },
  'settings.allowTitle': { fr: "Autoriser l'accès réseau ?", en: 'Allow network access?' },
  'settings.allowBody': {
    fr: "Cela laisse le trainer de finales interroger la table Syzygy de Lichess pour un retour parfait. Seule la position (un FEN) est envoyée — aucune identité, aucun compte. Les résultats sont mis en cache localement ; désactivable à tout moment.",
    en: 'This lets the Endgame trainer query the Lichess Syzygy tablebase for perfect endgame feedback. Only the board position (a FEN) is sent — no identity, no account. Results are cached locally; you can turn this off any time.',
  },
  'settings.allowConfirm': { fr: 'Autoriser', en: 'Allow' },
};
