// Onboarding / Session / Comeback / Sparring / WhenToThink / Concepts / Review messages (V2-W18 wave G5).
import type { Messages } from '../translate';

export const journey: Messages = {
  // ── Onboarding (skill evaluation) ──────────────────────────────────────────
  'onboarding.title': { fr: 'Évaluation de niveau', en: 'Skill evaluation' },
  'onboarding.declareIntro': {
    fr: 'Quelques questions rapides, puis une courte échelle de problèmes adaptative pour trouver votre niveau.',
    en: 'A few quick questions, then a short adaptive puzzle ladder to find your level.',
  },
  'onboarding.rateYourself': { fr: 'Comment vous situez-vous ?', en: 'How would you rate yourself?' },
  'onboarding.levelNew': { fr: 'Tout nouveau aux échecs', en: 'Brand new to chess' },
  'onboarding.levelBeginner': { fr: 'Débutant (occasionnel)', en: 'Beginner (casual)' },
  'onboarding.levelIntermediate': { fr: 'Intermédiaire (niveau club)', en: 'Intermediate (club level)' },
  'onboarding.levelAdvanced': { fr: 'Avancé (1800+)', en: 'Advanced (1800+)' },
  'onboarding.priorRatingLabel': { fr: 'Classement sur un autre site ? (optionnel)', en: 'Rating on another site? (optional)' },
  'onboarding.priorRatingPlaceholder': { fr: 'ex. 1450', en: 'e.g. 1450' },
  'onboarding.startLadder': { fr: "Commencer l'échelle →", en: 'Start the ladder →' },
  'onboarding.skip': { fr: 'Passer', en: 'Skip' },
  'onboarding.loadingPuzzles': { fr: 'Chargement des problèmes…', en: 'Loading puzzles…' },
  'onboarding.skipHint': {
    fr: "Passez pour amorcer un classement approximatif à partir de votre auto-évaluation ci-dessus — il s'affine au fil du jeu. Refaites-le quand vous voulez depuis les Réglages.",
    en: 'Skip to seed a rough rating from your self-assessment above — it sharpens as you play. Re-run anytime from Settings.',
  },
  'onboarding.ladderPrompt': {
    fr: 'Problème {n} — résolvez-le. La difficulté s’adapte à vous.',
    en: 'Puzzle {n} — solve it. The difficulty adapts to you.',
  },
  'onboarding.ladderMissed': { fr: 'Raté.', en: 'Missed.' },
  'onboarding.ladderSolved': { fr: 'Résolu ✔', en: 'Solved ✔' },
  'onboarding.skipTheRest': { fr: 'Passer le reste →', en: 'Skip the rest →' },
  'onboarding.puzzleRatingApprox': { fr: 'Classement aux problèmes ≈ {r}', en: 'Puzzle rating ≈ {r}' },
  'onboarding.offerGameBody': {
    fr: "Optionnel : jouez une courte partie contre le moteur pour qu'on estime aussi votre classement en <b>partie</b> (le niveau aux problèmes et la force de jeu diffèrent). Environ 12 coups.",
    en: 'Optional: play a short game vs the engine so we can also estimate your <b>game</b> rating (puzzle skill and playing strength differ). About 12 moves.',
  },
  'onboarding.playCalibrationGame': { fr: 'Jouer la partie de calibration →', en: 'Play the calibration game →' },
  'onboarding.startingEngine': { fr: 'Démarrage du moteur…', en: 'Starting engine…' },
  'onboarding.yourMovePlayNaturally': {
    fr: 'À vous de jouer. Jouez naturellement — ceci calibre votre classement en partie.',
    en: 'Your move. Play naturally — this calibrates your game rating.',
  },
  'onboarding.engineFailedSkipping': { fr: 'Échec du moteur ; passage aux résultats.', en: 'Engine failed; skipping to results.' },
  'onboarding.youPlay': { fr: 'Vous jouez les {color}', en: 'You play {color}' },
  'onboarding.thinking': { fr: 'Réflexion…', en: 'Thinking…' },
  'onboarding.endGameSkip': { fr: 'Terminer la partie et passer →', en: 'End game & skip →' },
  'onboarding.acplReadout': {
    fr: 'Perte moyenne en centièmes de pion : {acpl} (~{elo} Elo)',
    en: 'Average centipawn loss: {acpl} (~{elo} Elo)',
  },
  'onboarding.calibratedTitle': { fr: 'Vous êtes calibré', en: "You're calibrated" },
  'onboarding.puzzleRatingDone': { fr: 'Classement aux problèmes ≈ <b>{r}</b>', en: 'Puzzle rating ≈ <b>{r}</b>' },
  'onboarding.gameRatingDone': { fr: 'Classement en partie ≈ <b>{r}</b>', en: 'Game rating ≈ <b>{r}</b>' },
  'onboarding.roughSeed': {
    fr: "(amorce approximative — il s'affine au fil du jeu)",
    en: '(rough seed — it sharpens as you play)',
  },
  'onboarding.goToHome': { fr: "Aller à l'accueil →", en: 'Go to home →' },
  // CO20 (C8): the onboarding-end coaching offer. Gentle, optional — the coach builds on the same
  // calibration engine that just ran, so this is the natural next step for a motivated new user.
  'onboarding.coachOfferBody': {
    fr: 'Envie d’aller plus loin ? Le coaching analyse vos points faibles et propose un programme ciblé.',
    en: 'Want to go deeper? Coaching reads your weak spots and builds a focused program.',
  },
  'onboarding.coachOffer': { fr: 'Faire une évaluation de coaching →', en: 'Get a full coaching read →' },

  // ── Session (practice session runner) ──────────────────────────────────────
  'session.title': { fr: 'Session de pratique', en: 'Practice session' },
  'session.building': { fr: 'Construction de votre session…', en: 'Building your session…' },
  'session.stepProgress': {
    fr: 'Étape {current} sur {total} · ~{min} min restantes',
    en: 'Step {current} of {total} · ~{min} min left',
  },
  'session.reflectionPlaceholder': {
    fr: "Qu'avez-vous remarqué ? Que ferez-vous différemment ?",
    en: 'What did you notice? What will you do differently?',
  },
  'session.takeYourTime': { fr: 'Prenez tout votre temps.', en: 'Take as long as you like.' },
  'session.sitWithIt': {
    fr: 'Réfléchissez-y ~20 s — puis terminez quand vous êtes prêt.',
    en: 'Sit with it for ~20s — then finish whenever you are ready.',
  },
  // PR-09 (ADR-0067, supersedes ADR-0039 Q-B): the note now persists into your session log.
  'session.notesSaved': {
    fr: 'Vos notes sont enregistrées dans votre journal de session (local, comme tout le reste).',
    en: 'Your notes are saved into your session log (local, like everything else).',
  },
  'session.recapTitle': { fr: 'Bilan de la session', en: 'Session recap' },
  'session.recapSteps': { fr: 'Étapes', en: 'Steps' },
  'session.recapStepsVal': { fr: '{done} / {total} terminées', en: '{done} / {total} done' },
  'session.recapStreak': { fr: 'Série', en: 'Streak' },
  'session.recapStreakVal': { fr: '🔥 {n} jours', en: '🔥 {n} days' },
  'session.recapNotes': { fr: 'Notes', en: 'Notes' },
  'session.recapNotesSaved': { fr: 'enregistrées ✓', en: 'saved ✓' },
  'session.recapAllDone': {
    fr: 'Session complète — la prochaine mènera avec ce qui reste à travailler.',
    en: 'Full session — the next one will lead with what is left to work on.',
  },
  'session.recapPartial': {
    fr: 'Les étapes terminées sont lues par le prochain plan (elles passent en fin de liste, jamais supprimées).',
    en: 'Completed steps are read by the next plan (moved to the end of the list, never dropped).',
  },
  'session.finish': { fr: 'Terminer', en: 'Finish' },
  'session.stepHeader': { fr: '{minutes} min · {kind}', en: '{minutes}m · {kind}' },
  'session.openTrainer': { fr: 'Ouvrir {kind} →', en: 'Open {kind} →' },
  'session.doneNext': { fr: 'Terminé → suivant', en: 'Done → next' },
  'session.skipStep': { fr: 'Passer →', en: 'Skip →' },
  'session.launchesHint': {
    fr: 'Lance le vrai trainer. Revenez ici via « Session » dans la navigation pour reprendre cette étape.',
    en: 'Launches the real trainer. Return here via "Session" in the nav to resume this step.',
  },
  // ── C7/CO16 mastery criterion + cap on a coach step. {goal}=the criterion text, {cap}=the cap min.
  // The criterion can only end a step EARLIER; the cap is the hard bound (AP-CPROG-2/3). ──
  'session.masteryGoal': { fr: 'Objectif : {goal} · plafond {cap} min', en: 'Goal: {goal} · cap {cap} min' },
  'session.masteryStreak': { fr: '{n} d\'affilée', en: '{n} in a row' },
  'session.masteryMissRate': { fr: 'taux d\'échec < {pct} %', en: 'miss-rate < {pct}%' },
  'session.capReached': {
    fr: 'Plafond de temps atteint — vous pouvez passer à la suite.',
    en: 'Time cap reached — you can move on.',
  },
  'session.noSession': { fr: 'Aucune session disponible.', en: 'No session available.' },
  'session.backToInsights': { fr: 'Retour au Bilan', en: 'Back to Insights' },

  // ── Comeback drills ────────────────────────────────────────────────────────
  'comeback.title': { fr: 'Exercices de retour', en: 'Comeback drills' },
  'comeback.loadingPositions': { fr: 'Chargement des positions de vos parties…', en: 'Loading positions from your games…' },
  'comeback.emptyTitle': { fr: 'Aucune position de retour pour le moment.', en: 'No comeback positions yet.' },
  'comeback.emptyBody': {
    fr: "Jouez et analysez quelques parties — les moments où vous avez pris du retard apparaissent ici pour s'entraîner à défendre et à contre-attaquer.",
    en: 'Play and analyse some games — the moments where you fell behind show up here to practise defending and fighting back.',
  },
  'comeback.playAGame': { fr: 'Jouer une partie →', en: 'Play a game →' },
  'comeback.defensiveSparring': { fr: 'Sparring défensif à la place →', en: 'Defensive sparring instead →' },
  'comeback.positionIntro': {
    fr: "Position {idx} / {total} · vous perdiez d'environ ~{pawns} pions ici. Tenez la nulle ou renversez la situation contre un bot à votre niveau.",
    en: 'Position {idx} / {total} · you were losing by ~{pawns} pawns here. Hold the draw or turn it around against a bot at your level.',
  },
  'comeback.youPlay': { fr: 'Vous jouez les {color}', en: 'You play {color}' },
  'comeback.opponentThinking': { fr: "L'adversaire réfléchit…", en: 'Opponent thinking…' },
  'comeback.nextPosition': { fr: 'Position suivante →', en: 'Next position →' },
  'comeback.tryAgain': { fr: 'Réessayer', en: 'Try again' },
  'comeback.backToDashboard': { fr: 'Retour au profil', en: 'Back to dashboard' },
  'comeback.resign': { fr: 'Abandonner', en: 'Resign' },
  'comeback.engineFailedToStart': { fr: 'Le moteur n’a pas pu démarrer : {error}', en: 'Engine failed to start: {error}' },
  'comeback.engineIllegalMove': {
    fr: 'Le moteur a renvoyé un coup illégal — partie interrompue.',
    en: 'Engine returned an illegal move — game halted.',
  },
  'comeback.engineError': { fr: 'Erreur du moteur : {error}', en: 'Engine error: {error}' },
  'comeback.youWin': { fr: 'Vous avez renversé la partie — victoire ! ♚', en: 'You turned it around — win! ♚' },
  'comeback.checkmated': { fr: 'Échec et mat — situation difficile. Essayez la suivante.', en: 'Checkmated — tough spot. Try the next one.' },
  'comeback.heldDraw': { fr: 'Nulle tenue — retour réussi. ✔', en: 'Held the draw — comeback complete. ✔' },
  'comeback.resigned': { fr: 'Abandon — impossible de tenir celle-ci.', en: 'Resigned — couldn’t hold this one.' },

  // ── Scenario sparring ──────────────────────────────────────────────────────
  'sparring.title': { fr: 'Sparring de scénario', en: 'Scenario sparring' },
  'sparring.pickIntro': {
    fr: "Jouez une position ciblée contre un bot à votre niveau. Entraînez un déséquilibre, ou l'une de vos failles récurrentes.",
    en: 'Play out a targeted position vs a bot at your level. Train an imbalance, or one of your own recurring leaks.',
  },
  'sparring.youPlay': { fr: 'Vous jouez les {color}', en: 'You play {color}' },
  'sparring.opponentThinking': { fr: "L'adversaire réfléchit…", en: 'Opponent thinking…' },
  'sparring.tryAgain': { fr: 'Réessayer', en: 'Try again' },
  'sparring.backToScenarios': { fr: '← Scénarios', en: '← Scenarios' },
  'sparring.resign': { fr: 'Abandonner', en: 'Resign' },
  'sparring.engineFailedToStart': { fr: 'Le moteur n’a pas pu démarrer : {error}', en: 'Engine failed to start: {error}' },
  'sparring.engineIllegalMove': {
    fr: 'Le moteur a renvoyé un coup illégal — partie interrompue.',
    en: 'Engine returned an illegal move — game halted.',
  },
  'sparring.engineError': { fr: 'Erreur du moteur : {error}', en: 'Engine error: {error}' },
  'sparring.youWon': { fr: 'Vous avez gagné le scénario ! ♚', en: 'You won the scenario! ♚' },
  'sparring.checkmated': { fr: 'Échec et mat — réessayez, ou choisissez-en un autre.', en: 'Checkmated — try again, or pick another.' },
  'sparring.drawn': { fr: 'Nulle — un beau résultat dans un scénario difficile. ✔', en: 'Drawn — a fine result from a tough scenario. ✔' },
  'sparring.resigned': { fr: 'Abandon.', en: 'Resigned.' },

  // ── When to think (critical-moment drill) ──────────────────────────────────
  'whenToThink.title': { fr: 'Quand réfléchir', en: 'When to think' },
  'whenToThink.loadingPositions': { fr: 'Chargement des positions de vos parties…', en: 'Loading positions from your games…' },
  'whenToThink.emptyTitle': { fr: 'Aucune position à travailler pour le moment.', en: 'No positions to drill yet.' },
  'whenToThink.emptyBody': {
    fr: "Analysez une partie et vos propres moments critiques apparaîtront ici pour s'entraîner.",
    en: 'Analyse a game and your own critical moments will appear here to practise.',
  },
  'whenToThink.analyseAGame': { fr: 'Analyser une partie →', en: 'Analyse a game →' },
  'whenToThink.positionIntro': { fr: 'Position {idx} / {total}', en: 'Position {idx} / {total}' },
  'whenToThink.sampleSuffix': {
    fr: ' · positions d’exemple (analysez une partie pour travailler les vôtres)',
    en: ' · sample positions (analyse a game to drill your own)',
  },
  'whenToThink.positionTail': {
    fr: '. Reconnaître les moments critiques est un ressenti qui se travaille — ceci est de la pratique, pas un verdict noté.',
    en: '. Recognising critical moments is a trainable feel — this is practice, not a graded verdict.',
  },
  'whenToThink.toMovePrompt': {
    fr: '<b>Trait aux {color}</b> — vous arrêteriez-vous pour réfléchir ici ?',
    en: '<b>{color} to move</b> — would you stop and think here?',
  },
  'whenToThink.callCritical': { fr: 'Critique (investir du temps)', en: 'Critical (invest time)' },
  'whenToThink.callRoutine': { fr: 'Routine (jouer vite)', en: 'Routine (play fast)' },
  'whenToThink.verdict': {
    fr: '{judgement} — c’était un moment <b>{truth}</b>.',
    en: '{judgement} — this was a <b>{truth}</b> moment.',
  },
  'whenToThink.verdictCorrect': { fr: 'Correct', en: 'Correct' },
  'whenToThink.verdictNotQuite': { fr: 'Pas tout à fait', en: 'Not quite' },
  'whenToThink.truthCritical': { fr: 'CRITIQUE', en: 'CRITICAL' },
  'whenToThink.truthRoutine': { fr: 'ROUTINE', en: 'ROUTINE' },
  'whenToThink.swingCritical': {
    fr: 'Environ <b>{pct}</b> des chances de gain dépendaient de ce coup — un moment où un mauvais choix coûtait cher.',
    en: 'About <b>{pct}</b> in winning chances hung on this move — a moment where a wrong choice proved expensive.',
  },
  'whenToThink.swingRoutine': {
    fr: 'Seulement environ <b>{pct}</b> des chances de gain dépendaient de ce coup — une position à jouer vite.',
    en: 'Only about <b>{pct}</b> in winning chances hung on this — a position to play quickly.',
  },
  'whenToThink.next': { fr: 'Suivant →', en: 'Next →' },
  'whenToThink.restart': { fr: 'Recommencer', en: 'Restart' },
  'whenToThink.backToDashboard': { fr: 'Retour au profil', en: 'Back to dashboard' },
  'whenToThink.tallyOne': {
    fr: 'Vous avez jugé {n} position · {right} ont correspondu au résultat de la partie.',
    en: "You've called {n} position · {right} matched the game's outcome.",
  },
  'whenToThink.tallyMany': {
    fr: 'Vous avez jugé {n} positions · {right} ont correspondu au résultat de la partie.',
    en: "You've called {n} positions · {right} matched the game's outcome.",
  },
  'whenToThink.tallyEnd': {
    fr: "C'est la fin du set — reconnaître les moments critiques est un ressenti qui se construit avec la pratique.",
    en: "That's the set — recognising critical moments is a feel you build with practice.",
  },

  // ── Concepts (pattern library) — Concepts.svelte + ConceptCard.svelte ───────
  'concepts.title': { fr: 'Concepts — la bibliothèque de motifs', en: 'Concepts — the pattern library' },
  'concepts.subtitle': {
    fr: 'Exemples travaillés, sélectionnés et hors-ligne, pour les tactiques que nous détectons. Référence, pas un test.',
    en: 'Curated, offline worked examples for the tactics we detect. Reference, not a test.',
  },
  'concepts.showing': { fr: 'Affichage : {focus}', en: 'Showing: {focus}' },
  'concepts.showAll': { fr: 'tout afficher', en: 'show all' },
  'concepts.noCards': { fr: 'Aucune carte de concept disponible.', en: 'No concept cards available.' },
  'concepts.dismiss': { fr: 'fermer', en: 'dismiss' },

  // ── Review (spaced repetition) ─────────────────────────────────────────────
  'review.title': { fr: 'Révision', en: 'Review' },
  'review.subtitle': {
    fr: "Répétition espacée (FSRS) des problèmes que vous avez vus — vos motifs les plus faibles reviennent juste avant que vous ne les oubliiez.",
    en: "Spaced repetition (FSRS) of the puzzles you've seen — your weakest patterns resurface right before you'd forget them.",
  },
  'review.loadingQueue': { fr: 'Chargement de votre file à réviser…', en: 'Loading your due queue…' },
  'review.nothingDue': { fr: 'Rien à réviser pour le moment. 🎉', en: 'Nothing due right now. 🎉' },
  'review.scheduledOne': { fr: '{n} problème programmé', en: '{n} puzzle scheduled' },
  'review.scheduledMany': { fr: '{n} problèmes programmés', en: '{n} puzzles scheduled' },
  'review.nextDueSuffix': { fr: ' · prochain à réviser {when}', en: ' · next due {when}' },
  'review.scheduledTail': {
    fr: ". La répétition espacée garde les cartes en réserve jusqu'à ce qu'elles soient à réviser — les problèmes résolus reviennent en quelques minutes, les rapides plus tard.",
    en: ". Spaced repetition holds cards back until they're due — solved puzzles resurface in minutes, fast ones later.",
  },
  'review.emptyHint': {
    fr: 'Résolvez des problèmes en Tactique ou analysez une partie pour ajouter des cartes à votre planning de révision.',
    en: 'Solve puzzles in Tactics or analyse a game to add cards to your review schedule.',
  },
  'review.goToTactics': { fr: 'Aller à la Tactique →', en: 'Go to Tactics →' },
  'review.buildMisses': { fr: 'Créer un set « vos erreurs » →', en: 'Build a "your misses" set →' },
  'review.checkForMore': { fr: "Chercher d'autres →", en: 'Check for more →' },
  'review.completeOne': { fr: 'Révision terminée — {n} carte faite.', en: 'Review complete — {n} card done.' },
  'review.completeMany': { fr: 'Révision terminée — {n} cartes faites.', en: 'Review complete — {n} cards done.' },
  'review.cardProgress': { fr: 'Carte {index} sur {total} · {reviewed} révisées', en: 'Card {index} of {total} · {reviewed} reviewed' },
  'review.missed': { fr: 'Raté — reprogrammé bientôt.', en: 'Missed — scheduled again soon.' },
  // T1/TR6: one on-board second try before the miss locks (the miss is still recorded).
  'review.secondTry': { fr: 'Pas ça — encore un essai.', en: 'Not that — one more try.' },
  'review.solved': { fr: 'Résolu ✔', en: 'Solved ✔' },
  'review.keepGoing': { fr: 'Correct — continuez.', en: 'Correct — keep going.' },
  'review.noFailedPuzzles': {
    fr: "Aucun problème raté pour l'instant — ratez-en quelques-uns en Tactique d'abord.",
    en: 'No failed puzzles yet — miss a few in Tactics first.',
  },
  'review.builtMissesSet': {
    fr: 'Set « vos erreurs » de {n} problèmes créé — entraînez-le dans Woodpecker.',
    en: 'Built a {n}-puzzle "Your misses" set — train it in Woodpecker.',
  },
  'review.next': { fr: 'Suivant →', en: 'Next →' },
};
