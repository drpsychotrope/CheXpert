// Coach / Dashboard / Insights / Radar messages (V2-W18 wave G3).
import type { Messages } from '../translate';

export const coach: Messages = {
  // ── Coach.svelte (coach.*) ────────────────────────────────────────────────
  'coach.title': { fr: 'Coaching personnel', en: 'Personal coaching' },
  'coach.intro': {
    fr: "Une évaluation rapide — deux problèmes par motif tactique (environ 14) plus une courte partie optionnelle — puis un programme d'exercices et de modes de jeu ciblant vos points faibles. Jouez simplement votre meilleur coup à chaque fois : résolu ou non, on lit la tentative et on continue. Directionnel, pas une note.",
    en: 'A quick assessment — two puzzles per tactical motif (about 14) plus an optional short game — then a program of drills and game modes aimed at your weak spots. Just play your best move on each: solved or not, we read the attempt and move on. Directional, not a grade.',
  },
  'coach.startAssessment': { fr: "Commencer l'évaluation →", en: 'Start the assessment →' },
  'coach.loadingPuzzles': { fr: 'Chargement des problèmes…', en: 'Loading puzzles…' },

  'coach.themeProgress': {
    fr: 'Motif {current}/{total} — ',
    en: 'Theme {current}/{total} — ',
  },
  'coach.themeProgressSuffix': {
    fr: ' (2 problèmes). Jouez votre meilleur coup ; résolu ou non, on continue.',
    en: ' (2 puzzles). Play your best move; solved or not, we move on.',
  },
  'coach.missed': { fr: 'Raté.', en: 'Missed.' },
  'coach.solved': { fr: 'Résolu ✔', en: 'Solved ✔' },

  'coach.assessmentDone': { fr: "Problèmes d'évaluation terminés", en: 'Assessment puzzles done' },
  'coach.offerGameBody': {
    fr: "Optionnel : jouez une partie (~24 coups) pour évaluer votre ouverture, votre milieu de partie et votre jeu général. La conversion en finale, la gestion du temps et la résilience exigent des parties complètes — elles s'affichent en « n/a » jusqu'à ce que vous jouiez davantage.",
    en: 'Optional: play a game (~24 moves) for a read on your opening, middlegame, and general play. Endgame conversion, time, and resilience need full games — they show as “n/a” until you play more.',
  },
  'coach.playGame': { fr: 'Jouer la partie →', en: 'Play the game →' },
  'coach.skip': { fr: 'Passer', en: 'Skip' },

  'coach.startingEngine': { fr: 'Démarrage du moteur…', en: 'Starting engine…' },
  'coach.yourMove': { fr: 'À vous de jouer — jouez naturellement.', en: 'Your move — play naturally.' },
  'coach.youPlayWhite': { fr: 'Vous jouez les Blancs', en: 'You play White' },
  'coach.youPlayBlack': { fr: 'Vous jouez les Noirs', en: 'You play Black' },
  'coach.botThinking': { fr: 'Le bot réfléchit…', en: 'Bot thinking…' },

  'coach.analysingGame': { fr: 'Analyse de votre partie…', en: 'Analysing your game…' },

  'coach.profileTitle': { fr: 'Votre profil de coaching', en: 'Your coaching profile' },
  'coach.directional': {
    fr: 'Directionnel — construit à partir de {source}. Petits échantillons ; à prendre comme « où se concentrer ». Les axes grisés « n/a » n\'ont pas été mesurés par cette évaluation.',
    en: 'Directional — built from {source}. Small samples; treat as "where to focus". Greyed “n/a” axes weren\'t measured by this assessment.',
  },
  'coach.sourceLadders': { fr: 'deux problèmes par motif', en: 'two puzzles per motif' },
  'coach.sourceNoData': { fr: "aucune donnée de problème", en: 'no puzzle data' },
  'coach.sourceGameSuffix': { fr: ' + une courte partie', en: ' + one short game' },
  'coach.strengths': { fr: 'Points forts', en: 'Strengths' },
  'coach.focusOn': { fr: 'À travailler', en: 'Focus on' },
  'coach.yourProgram': { fr: 'Votre programme', en: 'Your program' },
  'coach.programItemMeta': { fr: '({minutes} min · {reason})', en: '({minutes}m · {reason})' },
  'coach.startSession': { fr: '▶ Démarrer la session de coaching', en: '▶ Start coaching session' },
  'coach.later': { fr: 'Plus tard', en: 'Later' },

  // ── Dashboard.svelte (dashboard.*) ────────────────────────────────────────
  'dashboard.title': { fr: 'Tableau des faiblesses', en: 'Weakness dashboard' },
  'dashboard.loading': { fr: 'Chargement…', en: 'Loading…' },
  'dashboard.noGamesTitle': { fr: 'Aucune partie analysée pour le moment.', en: 'No analysed games yet.' },
  'dashboard.noGamesBody': {
    fr: 'Importez une partie et analysez-la — vos faiblesses apparaîtront ici.',
    en: 'Import a game and analyse it — your weaknesses will appear here.',
  },
  'dashboard.analyseGame': { fr: 'Analyser une partie →', en: 'Analyse a game →' },
  'dashboard.basedOn': {
    fr: "D'après {games} ({moves} de vos coups). L'anneau en pointillés est le niveau typique pour votre classement — à l'intérieur, c'est une faiblesse. Ce sont des repères directionnels, pas une note précise.",
    en: 'Based on {games} ({moves} of your moves). The dashed ring is the typical level for your rating — inside it is a weakness. These are directional pointers, not a precise grade.',
  },
  'dashboard.gamesOne': { fr: '{n} partie analysée', en: '{n} analysed game' },
  'dashboard.gamesMany': { fr: '{n} parties analysées', en: '{n} analysed games' },
  'dashboard.insightsLink': {
    fr: 'Bilan : principales fuites + plan d\'étude + progression →',
    en: 'Insights: top leaks + study plan + progress →',
  },
  'dashboard.lowData': { fr: ' · peu de données', en: ' · low data' },
  'dashboard.defend': { fr: 'Défendre', en: 'Defend' },
  'dashboard.drill': { fr: 'Exercice', en: 'Drill' },
  'dashboard.trainWhenToThink': { fr: 'Travailler quand réfléchir →', en: 'Train when to think →' },
  'dashboard.biggestOpportunity': { fr: 'Plus grande marge de progrès :', en: 'Biggest opportunity:' },
  'dashboard.trainItNow': { fr: "L'entraîner maintenant →", en: 'Train it now →' },

  // ── Insights.svelte (insights.*) ──────────────────────────────────────────
  'insights.title': { fr: 'Bilan', en: 'Insights' },
  'insights.loading': { fr: 'Chargement…', en: 'Loading…' },
  'insights.noGamesTitle': { fr: 'Aucune partie analysée pour le moment.', en: 'No analysed games yet.' },
  'insights.noGamesBody': {
    fr: "Jouez et analysez des parties — vos fuites récurrentes, un plan d'étude et votre progression apparaissent ici.",
    en: 'Play and analyse games — your recurring leaks, a study plan, and your progress appear here.',
  },
  'insights.playGame': { fr: 'Jouer une partie →', en: 'Play a game →' },
  'insights.startSession': { fr: '▶ Démarrer la session', en: '▶ Start session' },
  'insights.coachingAssessment': { fr: '▶ Évaluation du coach', en: '▶ Coaching assessment' },

  'insights.topLeaks': { fr: 'Vos principales fuites', en: 'Your top leaks' },
  'insights.leakStat': {
    fr: '{count}× · moy. −{pct} de gain',
    en: '{count}× · avg −{pct} win',
  },
  'insights.notEnoughMistakes': { fr: "Pas encore assez d'erreurs signalées.", en: 'Not enough flagged mistakes yet.' },
  'insights.drill': { fr: 'Exercice', en: 'Drill' },

  'insights.didItMove': { fr: 'Y a-t-il eu du changement ?', en: 'Did it move?' },
  'insights.didItMoveBody': {
    fr: "Descriptif, pas une preuve. Ceci montre votre taux d'échec avant/après ; cela ne prouve pas que l'entraînement a causé le changement. « Le personnalisé bat le générique » reste plausible, non prouvé — les données sont locales, vous pouvez donc les observer vous-même.",
    en: 'Descriptive, not proof. This shows your before/after miss-rate; it does not prove the training caused the change. "Personalised beats generic" stays plausible, not proven — the data is local so you can watch it for yourself.',
  },
  'insights.missRate': {
    fr: 'taux d\'échec {early} → {recent}',
    en: 'miss rate {early} → {recent}',
  },
  'insights.deltaPts': { fr: '({sign}{pts} pts)', en: '({sign}{pts} pts)' },
  'insights.earlyRecent': {
    fr: '{earlyMisses}/{earlyMoves} au début · {recentMisses}/{recentMoves} récemment',
    en: '{earlyMisses}/{earlyMoves} early · {recentMisses}/{recentMoves} recent',
  },
  'insights.tooLittleData': { fr: 'trop peu de données pour lire une tendance', en: 'too little data to read a trend' },

  'insights.studyPlan': { fr: "Plan d'étude", en: 'Study plan' },
  'insights.min15': { fr: '15 min', en: '15 min' },
  'insights.min30': { fr: '30 min', en: '30 min' },
  'insights.min60': { fr: '60 min', en: '60 min' },
  'insights.planItem': { fr: '{minutes} min · {activity}', en: '{minutes}m · {activity}' },

  'insights.progress': { fr: 'Progression', en: 'Progress' },
  'insights.windowsOfGames': { fr: '({n} fenêtres de parties)', en: '({n} windows of games)' },
  'insights.scorePerWindow': {
    fr: 'Score par fenêtre (plus haut = plus fort). Directionnel, pas une note.',
    en: 'Score per window (higher = stronger). Directional, not a grade.',
  },

  'insights.calibration': { fr: 'Calibration', en: 'Calibration' },
  'insights.topCause': {
    fr: 'Cause auto-diagnostiquée la plus fréquente :',
    en: 'Most common self-diagnosed cause:',
  },
  'insights.topCausePct': {
    fr: '({pct} des erreurs étiquetées).',
    en: '({pct} of tagged misses).',
  },
  'insights.selfTagLine': { fr: '{label} — {n} ({pct})', en: '{label} — {n} ({pct})' },
  'insights.calibrationDescriptive': {
    fr: 'Descriptif, pas une note — ceci reflète comment votre confiance correspond à vos résultats.',
    en: 'Descriptive, not a grade — this reflects how your confidence lines up with your results.',
  },
  'insights.calibrationNeedsMore': {
    fr: 'La calibration a besoin de quelques tentatives signalées de plus ({reported}/10 pour l\'instant).',
    en: 'Calibration needs a few more reported attempts ({reported}/10 so far).',
  },

  // ── T3 impulsivity / move-time readout (descriptive — AP-TINTEG-7). Sentences describe the
  // ATTEMPTS (no label noun for the player — /enrich#8b) and carry denominators (/enrich#3). ──
  'insights.impulsivity': { fr: 'Vitesse & précipitation', en: 'Speed & impulsivity' },
  'insights.impulsivityImpulsive': {
    fr: 'Vos tentatives rapides ratent souvent : {pct} de vos {fastTotal} tentatives rapides sont fausses.',
    en: 'Your quick attempts miss often: {pct} of your {fastTotal} quick attempts are wrong.',
  },
  'insights.impulsivityDeliberate': {
    fr: 'Quand vous prenez votre temps, vous trouvez : la plupart de vos {slowTotal} tentatives réfléchies sont justes.',
    en: 'When you take your time, you solve: most of your {slowTotal} slower attempts are right.',
  },
  'insights.impulsivityMixed': {
    fr: 'Résultats partagés selon la vitesse : {pct} de vos {fastTotal} tentatives rapides sont fausses.',
    en: 'Mixed results by speed: {pct} of your {fastTotal} quick attempts are wrong.',
  },
  'insights.avgSolveTime': { fr: 'Temps de résolution moyen : {sec} s.', en: 'Average solve time: {sec}s.' },
  'insights.impulsivityDetail': {
    fr: 'Rapides : {fastWrong}/{fastTotal} ratées · Lentes : {slowRight}/{slowTotal} réussies.',
    en: 'Fast: {fastWrong}/{fastTotal} missed · Slow: {slowRight}/{slowTotal} solved.',
  },
  'insights.impulsivityDescriptive': {
    fr: 'Descriptif, pas une note — ceci décrit vos tentatives, pas vous.',
    en: 'Descriptive, not a grade — this describes your attempts, not you.',
  },

  // ── EvalGraph.svelte (evalGraph.*) ────────────────────────────────────────
  'evalGraph.ariaLabel': {
    fr: 'Vos chances de gain au fil de la partie',
    en: 'Your winning chances across the game',
  },
  'evalGraph.markerLabel': {
    fr: 'Coup {move} {san} : {severity}, −{pct} de gain',
    en: 'Move {move} {san}: {severity}, −{pct} win',
  },
  'evalGraph.caption': {
    fr: "Vos chances de gain au fil de la partie. Les points sont vos erreurs (pleins) et celles de l'adversaire (creux) — cliquez sur l'un d'eux. Pas de note de « précision » unique : ce sont des repères directionnels.",
    en: 'Your winning chances over the game. Dots are your (filled) and the opponent\'s (hollow) mistakes — click one. No single "accuracy" grade: these are directional pointers.',
  },
};
