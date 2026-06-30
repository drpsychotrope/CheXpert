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

  // ── C5/CO3 intake goal picker (coach.*) — one short, SKIPPABLE goal before the assessment. The
  // goal softly weights the program (re-order + ≤1 step); it never replaces the weakness-first plan
  // (AP-CINTAKE-1). Skipping behaves exactly like today's coach. ──
  'coach.goalsTitle': { fr: 'Quel est votre objectif ?', en: 'What is your goal?' },
  'coach.goalsIntro': {
    fr: 'Optionnel — cela oriente légèrement votre programme. Vos points faibles restent la priorité ; vous pouvez passer.',
    en: 'Optional — this gently steers your program. Your weak spots still lead; you can skip.',
  },
  'coach.goalTargetRating': { fr: 'Monter en classement', en: 'Raise my rating' },
  'coach.goalFixBlunders': { fr: 'Arrêter de gaffer', en: 'Stop blundering' },
  'coach.goalOpeningPrep': { fr: 'Travailler mes ouvertures', en: 'Prepare my openings' },
  'coach.goalTimeTrouble': { fr: 'Gérer le temps (zeitnot)', en: 'Fix time trouble' },
  'coach.goalSkip': { fr: 'Passer — évaluez-moi simplement', en: 'Skip — just assess me' },

  // C5: small inline tags on program steps the goal/strength added (the row stays a normal step).
  'coach.tagLeverage': { fr: 'point fort', en: 'strength' },
  'coach.tagGoal': { fr: 'objectif', en: 'goal' },
  // C5: descriptive metacog coach line header + the off-state gentle hint for the fix-blunders goal.
  'coach.metacogTitle': { fr: 'Votre confiance', en: 'Your confidence' },
  'coach.metacogOffHint': {
    fr: 'Pour coacher vos gaffes, activez les check-ins de confiance (Réglages) — vous verrez alors où votre assurance vous trompe.',
    en: 'To coach your blunders, enable confidence check-ins (Settings) — you’ll then see where your certainty misleads you.',
  },

  // ── C2/CF7 à-la-carte scope picker (coach.*) ──────────────────────────────
  'coach.scopeTitle': { fr: 'Que voulez-vous évaluer ?', en: 'What to assess?' },
  'coach.scopeMotifs': { fr: 'Motifs tactiques', en: 'Tactical motifs' },
  'coach.scopeEndgame': { fr: 'Finales (tours, pions, pièces mineures)', en: 'Endgames (rook, pawn, minor-piece)' },
  'coach.scopeTimed': { fr: 'Bloc chronométré (gestion du temps)', en: 'Timed block (time management)' },
  'coach.scopeEmptyAll': {
    fr: 'Rien de sélectionné — tout sera évalué.',
    en: 'Nothing selected — everything will be assessed.',
  },

  // ── C2/CO15 timed block (coach.*) ─────────────────────────────────────────
  'coach.timedTitle': {
    fr: 'Bloc chronométré : résolvez autant de problèmes que possible avant la fin du temps.',
    en: 'Timed block: solve as many puzzles as you can before time runs out.',
  },
  'coach.timedRemaining': { fr: 'Temps restant : {sec} s — ', en: 'Time left: {sec}s — ' },
  'coach.timedSolved': { fr: '{n} résolus', en: '{n} solved' },
  'coach.timedDone': { fr: 'Terminer le bloc', en: 'End the block' },

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

  // ── C4 real-data assessment (coach.*) — source-choice step + history provenance. The coach can
  // assess from a recent WINDOW of the user's real analysed games (imported + played) via the same
  // buildWeaknessProfile, instead of one toy game. Directional, sample-size-labelled, no grade. ──
  'coach.useMyGames': { fr: '📊 Utiliser mes parties récentes →', en: '📊 Use my recent games →' },
  'coach.useMyGamesHint': {
    fr: 'Évaluer à partir de vos {n} dernières parties analysées (importées ou jouées) — pas de partie à jouer.',
    en: 'Assess from your last {n} analysed games (imported or played) — no game to play.',
  },
  'coach.importMore': { fr: 'Importer d\'autres parties →', en: 'Import more games →' },
  'coach.basedOnGames': {
    fr: '{n} parties récentes ({played} jouées, {imported} importées)',
    en: '{n} recent games ({played} played, {imported} imported)',
  },
  'coach.fromHistory': { fr: 'votre historique', en: 'your history' },
  'coach.fromSingleGame': { fr: 'une courte partie', en: 'one short game' },

  // ── C3 designed-position probes (coach.*) — opt-in top-ups at the offer-game step for the two axes
  // a short even game under-measures. Directional, no grade (AP-CDESIGN-5); each is one designed game. ──
  'coach.probesTitle': {
    fr: 'Optionnel : sondez deux axes difficiles à mesurer en une partie équilibrée — depuis des positions conçues.',
    en: 'Optional: probe two axes a balanced game rarely measures — from designed positions.',
  },
  'coach.probeConversion': { fr: 'Tester la conversion (finale, un pion de plus) →', en: 'Test conversion (rook-up endgame) →' },
  'coach.probeResilience': { fr: 'Tester la résilience (défendre une position inférieure) →', en: 'Test resilience (defend a worse position) →' },
  'coach.probeDone': {
    fr: 'Sondage enregistré : {dim}. Lancez l\'autre, jouez la partie, ou terminez.',
    en: 'Probe recorded: {dim}. Run the other, play the game, or finish.',
  },
  'coach.probeUnmeasured': {
    fr: 'Sondage trop court pour mesurer {dim} — cet axe reste « n/a ».',
    en: 'Probe too short to measure {dim} — that axis stays “n/a”.',
  },
  'coach.probeAborted': {
    fr: 'Sondage interrompu (erreur du moteur) — {dim} reste « n/a ».',
    en: 'Probe interrupted (engine error) — {dim} stays “n/a”.',
  },
  'coach.finishAssessment': { fr: 'Terminer l\'évaluation', en: 'Finish assessment' },
  'coach.probeRunning': { fr: 'Position conçue — jouez votre meilleur jeu.', en: 'Designed position — play your best.' },
  // C2/CO7: name the radar dimensions that stay n/a if the game is skipped (informed choice, not forced).
  'coach.skipCost': {
    fr: 'Passer laisse non mesuré(e) : {dims} (affiché « n/a »).',
    en: 'Skipping leaves unmeasured: {dims} (shown as “n/a”).',
  },

  'coach.startingEngine': { fr: 'Démarrage du moteur…', en: 'Starting engine…' },
  // CF8: the calibration game's engine failed to boot. The message shown immediately (info slot) +
  // the honest result note, so a failure is never mistaken for a deliberate Skip (AP-CFUNNEL-4),
  // symmetric with Onboarding's engineFailedSkipping.
  'coach.engineFailed': {
    fr: "Impossible de démarrer le moteur — évaluation sur les problèmes uniquement.",
    en: "Couldn't start the engine — assessed puzzles only.",
  },
  'coach.engineFailedNote': {
    fr: "La partie n'a pas pu démarrer (erreur du moteur) — ce profil repose sur les problèmes seuls, pas sur une partie passée.",
    en: 'The game could not start (engine error) — this profile is from puzzles only, not a skipped game.',
  },
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
  // CF10: export the current coach profile as a JSON snapshot (client-side; a snapshot, not a
  // printable report — AP-CFUNNEL-5). Surfaced on the result panel and in Settings → Your data.
  'coach.exportProfile': { fr: '⤓ Exporter le profil (JSON)', en: '⤓ Export profile (JSON)' },

  // ── CF4 mid-assessment resume (coach.*) — the in-memory resume banner + start-over (FOLD-C1). ──
  'coach.resumedNote': {
    fr: 'Évaluation reprise là où vous en étiez.',
    en: 'Resumed your assessment where you left off.',
  },
  'coach.startOver': { fr: 'Tout recommencer', en: 'Start over' },

  // ── C1: saved-profile intro card + progress trend + staleness (coach.*) ───
  // Surfaces the write-only coachProfile/Prev/assessedAt (ADR-0045). Directional, never a grade
  // (AP-CPROF-2); staleness is a soft, ignorable nudge (AP-CPROF-3).
  'coach.savedTitle': { fr: 'Votre dernière évaluation', en: 'Your last assessment' },
  'coach.lastAssessed': { fr: 'Évalué le {date}', en: 'Assessed on {date}' },
  'coach.ageSuffix': { fr: ' · il y a {days} j', en: ' · {days}d ago' },
  'coach.staleNudge': {
    fr: 'Cette lecture date de plus de {days} jours — une nouvelle évaluation pourrait être utile.',
    en: 'This read is over {days} days old — a fresh assessment may help.',
  },
  'coach.startProgram': { fr: '▶ Reprendre le programme', en: '▶ Start program' },
  'coach.reassess': { fr: 'Réévaluer', en: 'Re-assess' },
  'coach.trendTitle': { fr: 'Évolution depuis la dernière fois', en: 'Change since last time' },
  'coach.trendTactics': { fr: 'Tactique {arrow} ({delta} pts)', en: 'Tactics {arrow} ({delta} pts)' },
  'coach.trendMotif': { fr: '({delta} pts · {nPrev}→{nCurrent} essais)', en: '({delta} pts · {nPrev}→{nCurrent} tries)' },
  'coach.trendDisclaimer': {
    fr: 'Directionnel — ratings absolus par motif, petits échantillons. Pas une note.',
    en: 'Directional — absolute per-motif ratings, small samples. Not a grade.',
  },

  // ── C7 configurable budget + mastery steps + closed loop (coach.*) ─────────
  // Budget toggle: a 15/30/60 lever mirroring Insights (drives BOTH the preview AND the launched
  // Session — AP-CPROG-1). The min15/30/60 values are reused from insights.* (already FR/EN).
  'coach.budgetLabel': { fr: 'Budget', en: 'Budget' },
  // Mastery badge (CO16): the per-step criterion + cap, e.g. "4 d'affilée · ≤8 min". The cap is the
  // hard bound; the criterion can only end a step earlier (AP-CPROG-2/3).
  'coach.masteryStreak': { fr: '{n} d\'affilée', en: '{n} in a row' },
  'coach.masteryMissRate': { fr: 'taux d\'échec < {pct} %', en: 'miss-rate < {pct}%' },
  'coach.masteryCap': { fr: '≤ {min} min', en: '≤{min} min' },
  // Closed loop (CO10): the soft, DESCRIPTIVE advisory shown only when enoughData && deltaPct<0. Never
  // a causal claim — the header carries the insights.didItMoveBody caveat verbatim (AP-CPROG-4).
  'coach.looksImproved': {
    fr: 'Semble en progrès — vous pouvez passer à la suite.',
    en: 'Looks improved — you can move on.',
  },
  // Never-measured (E2): this motif never occurred in any analysed game — distinct from thin data.
  'coach.notMeasuredYet': {
    fr: 'Pas encore mesuré — jouez quelques parties pour voir si cela bouge.',
    en: 'Not measured yet — play a few games to see if this moves.',
  },

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

  // ── C6 coach-output result surface (coachReview.*) — component labels for the narrative read,
  // the concept-teaching toggle, and the game-review section. The PROSE sentences live in
  // generators.ts (pure-core, gt-resolved); these are the surrounding UI chrome. Directional,
  // no grade (AP-CTEACH-2). Reuses motif.*/dim.*/evalGraph.*/calc.solution — never redefined. ──
  'coachReview.heading': { fr: 'Votre bilan', en: 'Your read' },
  'coachReview.learnPattern': { fr: '📖 Apprendre le motif', en: '📖 Learn the pattern' },
  'coachReview.gameReviewTitle': { fr: 'Revue de la partie', en: 'Game review' },
  'coachReview.turningPoints': { fr: 'Moments décisifs', en: 'Turning points' },
  // Turning-point row: who caused the swing (player vs opponent) so a swing is never misattributed
  // (AP-CTEACH-9). {move}=full-move number, {san}=move, {pct}=win-prob points lost.
  'coachReview.tpPlayer': { fr: 'Coup {move} {san} — votre erreur (−{pct} %)', en: 'Move {move} {san} — your slip (−{pct}%)' },
  'coachReview.tpOpponent': { fr: "Coup {move} {san} — erreur de l'adversaire (−{pct} %)", en: "Move {move} {san} — opponent's slip (−{pct}%)" },
  'coachReview.replayWhy': { fr: 'Pourquoi :', en: 'Why:' },
  'coachReview.noSwings': {
    fr: 'Aucun grand revirement dans cette partie — jeu propre des deux côtés.',
    en: 'No big swings in this game — clean play on both sides.',
  },
};
