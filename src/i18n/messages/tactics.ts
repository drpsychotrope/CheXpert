// Tactics / Calculate / Woodpecker / GuessMove / Vision messages (V2-W18 wave G2).
import type { Messages } from '../translate';

export const tactics: Messages = {
  // ── Tactics.svelte (tactics.*) ───────────────────────────────────────────
  'tactics.title': { fr: 'Tactique', en: 'Tactics' },
  'tactics.ratingLine': {
    fr: 'Classement problèmes {rating} ±{rd} · session {solved}/{attempted}',
    en: 'Puzzle rating {rating} ±{rd} · session {solved}/{attempted}',
  },
  'tactics.drilling': { fr: 'Vous travaillez votre faiblesse : {themes}', en: 'Drilling your weakness: {themes}' },
  'tactics.clear': { fr: 'effacer', en: 'clear' },
  'tactics.fromYourGames': { fr: '★ Issu de vos parties', en: '★ From your own games' },
  'tactics.beatClock': { fr: '⏱ {n}s — battez le chrono', en: '⏱ {n}s — beat the clock' },
  'tactics.confidence': { fr: 'Confiance :', en: 'Confidence:' },
  'tactics.confidenceGroup': { fr: 'Quelle est votre confiance ?', en: 'How confident are you?' },
  'tactics.sure': { fr: 'Sûr', en: 'Sure' },
  'tactics.unsure': { fr: 'Pas sûr', en: 'Unsure' },
  'tactics.guess': { fr: 'Au pif', en: 'Guess' },
  'tactics.timeMiss': { fr: '⏱ Temps écoulé — compté comme raté.', en: '⏱ Time — counts as a miss.' },
  'tactics.noMore': { fr: 'Plus aucun problème disponible dans votre fourchette.', en: 'No more puzzles available in your range.' },
  'tactics.wrong': { fr: 'Pas le bon coup — réessayez la position, ou passez.', en: 'Not the move — Retry the position, or move on.' },
  'tactics.solved': { fr: 'Résolu ! ✔', en: 'Solved! ✔' },
  'tactics.keepGoing': { fr: 'Correct — continuez.', en: 'Correct — keep going.' },
  // ── T3 progressive hints (TR5, Q-A) — 3 escalating tiers; ANY tier clamps the grade ──
  // Tier 1 names the motif (least reveal), tier 2 the target square, tier 3 the full move.
  'tactics.hintMotif': { fr: 'Indice : pensez au motif — {motif}.', en: 'Hint: think about the motif — {motif}.' },
  'tactics.hintTarget': { fr: 'Indice : une pièce arrive en {sq}.', en: 'Hint: a piece lands on {sq}.' },
  'tactics.hintMove': { fr: 'Indice : le coup est {move}.', en: 'Hint: the move is {move}.' },
  // Transparency marker on a hinted solve (the clamp is visible to the player). AP-TINTEG-1.
  'tactics.hintedTag': { fr: '(indice utilisé)', en: '(hint used)' },
  // T3/TR8 retention header: day-streak + today's goal progress (descriptive).
  'tactics.streakLine': { fr: 'Série de {n} jours', en: '{n}-day streak' },
  'tactics.goalLine': { fr: 'Objectif du jour : {done}/{goal}', en: 'Today: {done}/{goal}' },
  // T3 impulsivity inline nudge (Q-D): gentle, self-dismissing, after a fast miss. Never blocks.
  'tactics.fastMiss': { fr: 'Raté en {n} s — ralentissez ?', en: 'Missed in {n}s — slow down?' },
  'tactics.retryFind': { fr: 'Réessayez — trouvez le coup.', en: 'Retry — find the move.' },
  'tactics.leech': { fr: 'Celui-ci vous résiste sans arrêt.', en: 'This one keeps beating you.' },
  'tactics.learnPattern': { fr: 'Apprendre le motif →', en: 'Learn the pattern →' },
  'tactics.openInLibrary': { fr: 'ouvrir dans la bibliothèque', en: 'open in library' },
  'tactics.whyMissGroup': { fr: 'Pourquoi avez-vous raté ?', en: 'Why did you miss?' },
  'tactics.whyMiss': { fr: 'Pourquoi avez-vous raté ? (optionnel)', en: 'Why did you miss? (optional)' },
  'tactics.hintBtn': { fr: 'Indice', en: 'Hint' },
  'tactics.retryBtn': { fr: '↻ Réessayer', en: '↻ Retry' },
  'tactics.nextBtn': { fr: 'Problème suivant →', en: 'Next puzzle →' },
  'tactics.themes': { fr: 'Thèmes : {themes}', en: 'Themes: {themes}' },
  'tactics.themesEmpty': { fr: '—', en: '—' },
  'tactics.fromYourGameTag': { fr: ' · ★ issu de votre partie', en: ' · ★ from your game' },

  // ── T2 personal-puzzle provenance (TR4, Q-A=b) ───────────────────────────
  // Pre-solve: which move you played + how bad (severity rendered via severity.*). After-solve: the
  // win/move you left, SAN computed at the call site from moves[0] (AP-TPERS-1/6).
  'tactics.provenancePre': {
    fr: 'Coup {move} de votre partie — vous avez joué {played} ({severity}). Trouvez ce que vous avez manqué.',
    en: 'Move {move} of your game — you played {played} ({severity}). Find what you missed.',
  },
  'tactics.provenancePostWin': { fr: 'Le gain que vous avez laissé : {san}.', en: 'The win you left: {san}.' },
  'tactics.provenancePostMove': { fr: 'Le coup que vous avez manqué : {san}.', en: 'The move you missed: {san}.' },

  // ── T2 source toggle + theme/difficulty picker (TR9, Q-B/Q-C) ────────────
  'tactics.sourceLabel': { fr: 'Source :', en: 'Source:' },
  'tactics.sourceMixed': { fr: 'Mixte', en: 'Mixed' },
  'tactics.sourcePersonal': { fr: 'Mes parties', en: 'From my games' },
  'tactics.sourceCurated': { fr: 'Sélection', en: 'Curated' },
  'tactics.themePickerLabel': { fr: 'Thème :', en: 'Theme:' },
  'tactics.themeAll': { fr: 'Tous', en: 'All' },
  'tactics.diffLabel': { fr: 'Difficulté :', en: 'Difficulty:' },
  'tactics.diffEasier': { fr: 'Plus facile', en: 'Easier' },
  'tactics.diffOnLevel': { fr: 'À mon niveau', en: 'On level' },
  'tactics.diffHarder': { fr: 'Plus difficile', en: 'Harder' },

  // ── T2 honest theme-exhaustion (TR10, Q-D=c) ─────────────────────────────
  'tactics.themeExhausted': { fr: 'Plus aucun problème {theme} dans votre fourchette.', en: 'No more {theme} puzzles in your range.' },
  'tactics.themeExhaustedWidened': {
    fr: 'Même en élargissant, plus aucun {theme} — passer en mixte ?',
    en: 'Even widened, no more {theme} — switch to mixed?',
  },
  'tactics.widenRange': { fr: 'Élargir la fourchette', en: 'Widen range' },
  'tactics.switchToMixed': { fr: 'Passer en mixte', en: 'Switch to mixed' },

  // ── SolutionReveal toggle (reveal.*) — Trainer-miss "Show solution" (F4, Q-F) ──
  // Opt-in (Q-D / AP-TEACH-4): never auto-spoils a Retry. reveal.themeWhy lives in
  // generators.ts (resolved by the pure missWhy core via gt); calc.solution is reused
  // for the SAN line. These two are the UI toggle labels (resolved by t in-component).
  'reveal.showSolution': { fr: 'Voir la solution', en: 'Show solution' },
  'reveal.hideSolution': { fr: 'Masquer la solution', en: 'Hide solution' },

  // ── T1 trainer-feedback (second try, alt-accept, self-tag reactions) — Q-G ──
  // Complete per-locale templates (AP-TFEED-5); offers/hints framed honestly, never verdicts.
  'tactics.secondTry': {
    fr: 'Pas ça — il vous reste un essai sur l’échiquier.',
    en: 'Not that — you have one more try on the board.',
  },
  'tactics.checkingAlt': { fr: 'Vérification du coup…', en: 'Checking your move…' },
  'tactics.altAccepted': { fr: 'Coup différent, mais tout aussi gagnant. ✔', en: 'Different move, but equally winning. ✔' },
  'tactics.tryTimed': { fr: 'Essayer en mode chrono', en: 'Try this timed' },
  'tactics.offerTimed': { fr: 'Pressé ? Entraînez-vous contre la montre.', en: 'Rushed? Train against the clock.' },
  'tactics.reactUnfamiliar': { fr: 'Motif peu familier — voici la fiche.', en: "Unfamiliar pattern — here's the card." },

  // ── Calculate.svelte (calc.*) ────────────────────────────────────────────
  'calc.title': { fr: 'Calcul', en: 'Calculation' },
  // Intro split to preserve the three inline <b> emphases from the original markup.
  'calc.introLead': {
    fr: 'Voyez toute la ligne forcée dans votre tête, puis posez-la coup par coup —',
    en: 'See the whole forcing line in your head, then tap it out one move at a time —',
  },
  'calc.introTapBold': { fr: 'case de départ, puis case d’arrivée', en: 'from-square, then to-square' },
  'calc.introMid': { fr: '. Les pièces ne bougent pas.', en: '. The pieces won’t move.' },
  'calc.introSubmitBold': { fr: 'Valider', en: 'Submit' },
  'calc.introSubmitTail': { fr: ' la vérifie ;', en: ' checks it;' },
  'calc.introUndoBold': { fr: 'Annuler', en: 'Undo' },
  'calc.introUndoTail': { fr: ' reprend le dernier coup.', en: ' takes back the last move.' },
  'calc.confidence': { fr: 'Confiance :', en: 'Confidence:' },
  'calc.confidenceGroup': { fr: 'Quelle est votre confiance ?', en: 'How confident are you?' },
  'calc.sure': { fr: 'Sûr', en: 'Sure' },
  'calc.unsure': { fr: 'Pas sûr', en: 'Unsure' },
  'calc.guess': { fr: 'Au pif', en: 'Guess' },
  'calc.noPuzzles': { fr: 'Aucun problème dans la fourchette.', en: 'No puzzles in range.' },
  'calc.myLine': { fr: 'Ma ligne :', en: 'My line:' },
  'calc.tapHint': { fr: '— touchez une case de départ, puis une case d’arrivée', en: '— tap a from-square, then a to-square' },
  'calc.fullLineOne': { fr: 'Ligne complète ✓ — {n} coup, tout correct.', en: 'Full line ✓ — {n} move, all correct.' },
  'calc.fullLineMany': { fr: 'Ligne complète ✓ — {n} coups, tout correct.', en: 'Full line ✓ — {n} moves, all correct.' },
  'calc.stoppedEarly': { fr: 'Vous vous êtes arrêté trop tôt — la ligne continue après votre coup {k}.', en: 'You stopped early — the line continues past your move {k}.' },
  'calc.diverged': {
    fr: 'Divergence à votre coup {k} — vous avez joué {played}, la ligne était {want}. Vous avez calculé {ok} de vos coups.',
    en: 'Diverged at your move {k} — you played {played}, the line was {want}. You calculated {ok} of your moves.',
  },
  'calc.whyMissGroup': { fr: 'Pourquoi avez-vous raté ?', en: 'Why did you miss?' },
  'calc.whyMiss': { fr: 'Pourquoi avez-vous raté ? (optionnel)', en: 'Why did you miss? (optional)' },
  'calc.solution': { fr: 'Solution : {line}', en: 'Solution: {line}' },
  'calc.undo': { fr: '⌫ Annuler', en: '⌫ Undo' },
  'calc.submit': { fr: 'Valider', en: 'Submit' },
  'calc.next': { fr: 'Position suivante →', en: 'Next position →' },

  // ── Woodpecker.svelte (woodpecker.*) ─────────────────────────────────────
  'woodpecker.title': { fr: 'Woodpecker', en: 'Woodpecker' },
  // Intro split to preserve the inline <b>fixed</b> emphasis from the original markup.
  'woodpecker.introLead': { fr: 'Un ensemble ', en: 'A ' },
  'woodpecker.introFixedBold': { fr: 'fixe', en: 'fixed' },
  'woodpecker.introTail': {
    fr: ' de problèmes, résolus encore et encore — plus vite à chaque cycle — jusqu’à ce que les motifs deviennent automatiques. Cela complète la répétition espacée : Révisions étale beaucoup de problèmes dans le temps ; Woodpecker travaille un seul ensemble jusqu’à la vitesse.',
    en: ' set of puzzles, solved again and again — faster each cycle — until the patterns are automatic. This complements spaced repetition: Review spreads many puzzles over time; Woodpecker drills one set to speed.',
  },
  'woodpecker.setSize': { fr: 'Taille de l’ensemble', en: 'Set size' },
  'woodpecker.newSet': { fr: '+ Nouvel ensemble', en: '+ New set' },
  'woodpecker.setName': { fr: 'Ensemble de {n}', en: 'Set of {n}' },
  'woodpecker.noSets': { fr: 'Aucun ensemble pour l’instant — créez-en un pour commencer.', en: 'No sets yet — create one to start.' },
  'woodpecker.setSummaryOne': {
    fr: '{puzzles} problèmes · {n} cycle effectué',
    en: '{puzzles} puzzles · {n} cycle done',
  },
  'woodpecker.setSummaryMany': {
    fr: '{puzzles} problèmes · {n} cycles effectués',
    en: '{puzzles} puzzles · {n} cycles done',
  },
  'woodpecker.lastTime': { fr: '· dernier {time}', en: '· last {time}' },
  'woodpecker.nextCycle': { fr: 'Cycle suivant', en: 'Next cycle' },
  'woodpecker.start': { fr: 'Démarrer', en: 'Start' },
  'woodpecker.runHeader': { fr: '{name} · cycle {cycle}', en: '{name} · cycle {cycle}' },
  'woodpecker.runSolved': { fr: '· {solved}/{total} résolus', en: '· {solved}/{total} solved' },
  'woodpecker.missed': { fr: 'Raté — compté comme raté ce cycle.', en: 'Missed — counts as a miss this cycle.' },
  'woodpecker.solved': { fr: 'Résolu ✔', en: 'Solved ✔' },
  'woodpecker.continue': { fr: 'Bien — continuez.', en: 'Good — continue.' },
  'woodpecker.cycleComplete': { fr: 'Cycle terminé', en: 'Cycle complete' },
  // Time/accuracy line split to preserve the inline <b> values from the original markup.
  'woodpecker.timeLabel': { fr: 'Temps :', en: 'Time:' },
  'woodpecker.accuracyLabel': { fr: ' · Précision :', en: ' · Accuracy:' },
  'woodpecker.faster': { fr: '{time} plus rapide que le cycle précédent', en: '{time} faster than last cycle' },
  'woodpecker.fasterAndAccurate': { fr: ' — et au moins aussi précis. ✔', en: ' — and at least as accurate. ✔' },
  'woodpecker.fasterPeriod': { fr: '.', en: '.' },
  'woodpecker.notFaster': { fr: 'Pas encore plus rapide que le cycle précédent — relancez-le.', en: 'Not faster than last cycle yet — run it again.' },
  'woodpecker.runAgain': { fr: 'Relancer →', en: 'Run again →' },
  'woodpecker.backToSets': { fr: '← Ensembles', en: '← Sets' },
  'woodpecker.pause': { fr: 'Pause (progression sauvegardée)', en: 'Pause (progress saved)' },
  'woodpecker.deleteTitle': { fr: 'Supprimer cet ensemble ?', en: 'Delete this set?' },
  'woodpecker.deleteBody': {
    fr: 'Cet ensemble Woodpecker et son historique de cycles seront supprimés. Irréversible.',
    en: "This Woodpecker set and its cycle history will be removed. This can't be undone.",
  },
  'woodpecker.deleteConfirm': { fr: 'Supprimer', en: 'Delete' },

  // ── GuessMove.svelte (guess.*) ───────────────────────────────────────────
  'guess.title': { fr: 'Devine le coup', en: 'Guess the move' },
  'guess.intro': {
    fr: 'Parcourez une partie de maître et trouvez le coup réellement joué. Du rappel actif sur de vraies brillances — deviner entraîne la même prédiction que devant l’échiquier.',
    en: 'Step through a master game and find the move that was actually played. Active recall on real brilliancies — guessing trains the same prediction you do over the board.',
  },
  'guess.youAreWhite': { fr: 'Vous jouez les Blancs. Trouvez chaque coup.', en: 'You are White. Find each move.' },
  'guess.youAreBlack': { fr: 'Vous jouez les Noirs. Trouvez chaque coup.', en: 'You are Black. Find each move.' },
  'guess.header': { fr: '{name} — {white} contre {black} · trouvés {score}/{guesses}', en: '{name} — {white} vs {black} · matched {score}/{guesses}' },
  'guess.versus': { fr: '{white} contre {black}', en: '{white} vs {black}' },
  'guess.wrong': { fr: 'Pas le coup qui a été joué — réessayez, ou Révélez.', en: 'Not the move that was played — try again, or Reveal.' },
  'guess.gameOverScored': {
    fr: 'Partie terminée — vous avez trouvé {score}/{guesses} ({pct}).',
    en: 'Game over — you matched {score}/{guesses} ({pct}).',
  },
  'guess.gameOver': { fr: 'Partie terminée — vous avez trouvé {score}/{guesses}.', en: 'Game over — you matched {score}/{guesses}.' },
  // PR-14 (ADR-0072): guess-the-move on your own analysed games.
  'guess.ownTitle': { fr: 'Vos parties analysées', en: 'Your analysed games' },
  'guess.mastersTitle': { fr: 'Parties de maîtres', en: 'Master games' },
  'guess.ownCard': { fr: '{result} · bot {elo} Elo', en: '{result} · bot {elo} Elo' },
  'guess.ownNote': { fr: 'Rejouez-vous — ACPL {acpl}. Devinez vos propres coups.', en: 'Replay yourself — ACPL {acpl}. Guess your own moves.' },
  'guess.ownHeader': { fr: 'Votre partie · {score}/{guesses} retrouvés', en: 'Your game · {score}/{guesses} matched' },
  'guess.ownWasClassified': {
    fr: "Vous l'aviez joué — et l'analyse l'avait classé {severity}.",
    en: 'You played it — and the analysis classified it {severity}.',
  },
  'guess.correct': { fr: 'Correct ! ✔', en: 'Correct! ✔' },
  'guess.theMoveWas': { fr: 'Le coup était {san}.', en: 'The move was {san}.' },
  'guess.revealMove': { fr: 'Révéler le coup', en: 'Reveal move' },
  'guess.backToGames': { fr: '← Parties', en: '← Games' },

  // ── Vision.svelte (vision.*) ─────────────────────────────────────────────
  'vision.title': { fr: 'Calcul & vision', en: 'Calculation & vision' },
  'vision.menuIntro': {
    fr: 'Une vision de l’échiquier qu’on ne peut pas tricher — chaque exercice exige de localiser ou de relier de vraies cases, pas de calculer une formule. Le rappel par case est en répétition espacée pour que les cases faibles reviennent.',
    en: "Board vision you can't fake — every drill needs you to locate or relate real squares, not compute a formula. Per-square recall is spaced-repeated so weak squares come back.",
  },
  // Label only (the percent value is rendered in <b> in the template to keep the markup).
  'vision.boardMasteryLabel': { fr: 'Maîtrise de l’échiquier :', en: 'Board mastery:' },
  'vision.coordTitle': { fr: 'Coordonnée → case', en: 'Coordinate → square' },
  'vision.coordDesc': { fr: 'Une coordonnée est annoncée — cliquez-la sur un échiquier vide, le plus vite possible.', en: 'A coordinate is named — click it on a blank board, as fast as you can.' },
  'vision.blindfoldTitle': { fr: 'À l’aveugle', en: 'Blindfold' },
  'vision.blindfoldDesc': { fr: 'Étudiez une position, puis rappelez de mémoire ce qui se trouve sur une case.', en: 'Study a position, then recall what stands on a square from memory.' },
  'vision.relationTitle': { fr: 'Lignes & diagonales', en: 'Lines & diagonals' },
  'vision.relationDesc': { fr: 'Même diagonale ? Même couleur ? Combien de cases entre les deux ?', en: 'Same diagonal? Same colour? How many squares between?' },
  'vision.knightTitle': { fr: 'Distance du cavalier', en: 'Knight distance' },
  'vision.knightDesc': { fr: 'Combien de coups faut-il à un cavalier pour aller de A à B ?', en: 'How many moves does a knight need from A to B?' },
  'vision.findallTitle': { fr: 'Trouvez-les tous', en: 'Find them all' },
  'vision.findallDesc': { fr: 'Comptez chaque échec, prise ou pièce en prise dans une position.', en: 'Count every check, capture, or hanging piece in a position.' },
  'vision.scoreLine': { fr: 'Score {correct}/{asked} · série {streak}', en: 'Score {correct}/{asked} · streak {streak}' },
  // Coordinate drill
  'vision.clickThisSquare': { fr: 'Cliquez cette case.', en: 'Click this square.' },
  'vision.coordCorrect': { fr: '✔ {sq}.', en: '✔ {sq}.' },
  'vision.coordWrong': { fr: '✗ c’était {sq}.', en: '✗ it was {sq}.' },
  // Blindfold drill
  'vision.memorise': { fr: 'Mémorisez — l’échiquier disparaît dans un instant…', en: 'Memorise — board hides in a moment…' },
  // Split so the square coordinate stays inside <b> in the template.
  'vision.whatPieceOnPre': { fr: 'Quelle pièce est sur ', en: 'What piece is on ' },
  'vision.whatPieceOnPost': { fr: ' ?', en: '?' },
  'vision.empty': { fr: 'Vide', en: 'Empty' },
  'vision.blindCorrectPiece': { fr: '✔ {sq} = {piece}.', en: '✔ {sq} = {piece}.' },
  'vision.blindWrongPiece': { fr: '✗ {sq} = {piece}.', en: '✗ {sq} = {piece}.' },
  'vision.blindCorrectEmpty': { fr: '✔ {sq} est vide.', en: '✔ {sq} is empty.' },
  'vision.blindWrongEmpty': { fr: '✗ {sq} est vide.', en: '✗ {sq} is empty.' },
  // Relation drill
  'vision.relCorrect': { fr: '✔ réponse : {answer}.', en: '✔ answer: {answer}.' },
  'vision.relWrong': { fr: '✗ réponse : {answer}.', en: '✗ answer: {answer}.' },
  'vision.yes': { fr: 'oui', en: 'yes' },
  'vision.no': { fr: 'non', en: 'no' },
  'vision.yesBtn': { fr: 'Oui', en: 'Yes' },
  'vision.noBtn': { fr: 'Non', en: 'No' },
  'vision.check': { fr: 'Vérifier', en: 'Check' },
  // Knight drill
  'vision.fewestKnightMoves': { fr: 'Le moins de coups de cavalier ?', en: 'Fewest knight moves?' },
  'vision.knightCorrectOne': { fr: '✔ {n} coup.', en: '✔ {n} move.' },
  'vision.knightCorrectMany': { fr: '✔ {n} coups.', en: '✔ {n} moves.' },
  'vision.knightWrongOne': { fr: '✗ {n} coup.', en: '✗ {n} move.' },
  'vision.knightWrongMany': { fr: '✗ {n} coups.', en: '✗ {n} moves.' },
  'vision.next': { fr: 'Suivant →', en: 'Next →' },
  'vision.path': { fr: 'Chemin : {path}', en: 'Path: {path}' },
  // Find-all drill
  'vision.labelChecks': { fr: 'coups d’échec', en: 'checking moves' },
  'vision.labelCaptures': { fr: 'prises', en: 'captures' },
  'vision.labelHanging': { fr: 'pièces à gagner', en: 'pieces you can win' },
  // Split so the (translated) label stays inside <b> in the template.
  'vision.howManyForPre': { fr: 'Combien de ', en: 'How many ' },
  'vision.howManyForPost': { fr: ' pour le trait ?', en: ' for the side to move?' },
  'vision.findAllCorrectIs': { fr: '✔ il y a {n} {label}.', en: '✔ there is {n} {label}.' },
  'vision.findAllCorrectAre': { fr: '✔ il y a {n} {label}.', en: '✔ there are {n} {label}.' },
  'vision.findAllWrongIs': { fr: '✗ il y a {n} {label}.', en: '✗ there is {n} {label}.' },
  'vision.findAllWrongAre': { fr: '✗ il y a {n} {label}.', en: '✗ there are {n} {label}.' },
  'vision.backToDrills': { fr: '← Exercices', en: '← Drills' },
};
