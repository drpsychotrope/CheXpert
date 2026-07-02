// Home + Play messages (V2-W18 wave G1). Filled during the Play/Home migration.
import type { Messages } from '../translate';

export const play: Messages = {
  // ---- Home view (home.*) ----
  'home.title': { fr: 'Chess Trainer', en: 'Chess Trainer' },
  'home.tagline': {
    fr: 'Un seul objectif : vous rendre plus fort. Jouez lentement, analysez, travaillez vos vraies faiblesses.',
    en: 'One job: make you stronger. Play slow, analyse, drill your real weaknesses.',
  },
  'home.gameRating': { fr: 'Classement en partie', en: 'Game rating' },
  'home.puzzleRating': { fr: 'Classement aux problèmes', en: 'Puzzle rating' },
  'home.puzzleNote': {
    fr: 'Le classement aux problèmes mesure la reconnaissance de motifs, pas la force de jeu — les deux diffèrent.',
    en: 'Puzzle rating measures pattern recognition, not playing strength — they differ.',
  },
  // T3/TR8: training-day streak shown beside the Review badge (re-engagement signal).
  'home.streak': { fr: '🔥 Série de {n} jours', en: '🔥 {n}-day streak' },
  // CO20 (C8): the dismissible rough-patch coaching card on Home. Gentle, opt-in (AP-CFUNNEL-1) —
  // surfaced only on a losing streak with no fresh profile (shouldOfferCoach).
  'home.roughPatch': {
    fr: 'Passage difficile ? Une évaluation de coaching peut cibler ce qui coince.',
    en: 'Rough patch? A coaching read can pinpoint what to work on.',
  },
  'home.roughPatchCta': { fr: 'M’évaluer →', en: 'Assess me →' },
  'home.roughPatchDismiss': { fr: 'Plus tard', en: 'Not now' },
  'home.playBot': { fr: "Jouer contre le bot adaptatif", en: 'Play the adaptive bot' },
  'home.todaysSession': { fr: "Session du jour", en: "Today's session" },
  'home.insights': { fr: 'Bilan', en: 'Insights' },
  'home.trainTactics': { fr: 'Travailler la tactique', en: 'Train tactics' },
  'home.review': { fr: 'Révisions (répétition espacée)', en: 'Review (spaced repetition)' },
  'home.reviewDue': { fr: '{n} à réviser', en: '{n} due' },
  'home.woodpecker': { fr: 'Woodpecker (exercices rapides)', en: 'Woodpecker (speed drills)' },
  'home.analyseGame': { fr: 'Analyser une partie', en: 'Analyse a game' },
  'home.weaknessDashboard': { fr: 'Tableau des faiblesses', en: 'Weakness dashboard' },
  'home.personalCoaching': { fr: 'Coaching personnel', en: 'Personal coaching' },
  'home.endgameTrainer': { fr: 'Entraîneur de finales', en: 'Endgame trainer' },
  'home.openingRepertoire': { fr: "Répertoire d'ouvertures", en: 'Opening repertoire' },
  'home.guessMove': { fr: 'Deviner le coup', en: 'Guess the move' },
  'home.calcVision': { fr: 'Calcul et vision', en: 'Calculation & vision' },
  'home.rerunEval': { fr: "Refaire l'évaluation de niveau", en: 'Re-run skill evaluation' },
  'home.settings': { fr: 'Réglages', en: 'Settings' },

  // ---- Play view (play.*) ----
  'play.title': { fr: 'Jouer contre le bot adaptatif', en: 'Play the adaptive bot' },
  'play.ratingLine': {
    fr: 'Votre classement {pool} {rating} · bot ≈ {elo} Elo',
    en: 'Your {pool} rating {rating} · bot ≈ {elo} Elo',
  },
  'play.coachedOn': { fr: 'coaché activé', en: 'coached on' },

  // ---- Difficulty control (P3, play-opponent-agency) ----
  // The rating line under an override shows the EFFECTIVE bot Elo + a mode tag so it never lies about
  // who you're playing (E1/AP-OPPAGENCY-14); the Adaptive line keeps `play.ratingLine` verbatim.
  'play.ratingLineOverride': {
    fr: 'Votre classement {pool} {rating} · bot {elo} Elo ({mode})',
    en: 'Your {pool} rating {rating} · bot {elo} Elo ({mode})',
  },
  'play.difficultyLabel': { fr: 'Difficulté :', en: 'Difficulty:' },
  'play.difficultyAdaptive': { fr: 'Adaptatif', en: 'Adaptive' },
  'play.difficultyEasier': { fr: 'Plus facile (−200)', en: 'Easier (−200)' },
  'play.difficultyHarder': { fr: 'Plus difficile (+200)', en: 'Harder (+200)' },
  'play.difficultyFixed': { fr: 'Elo fixe', en: 'Fixed Elo' },
  'play.fixedEloLabel': { fr: 'Elo :', en: 'Elo:' },
  // Short tags shown inside `play.ratingLineOverride` ({mode}); adaptive needs none (uses the base line).
  'play.difficultyTagEasier': { fr: 'plus facile', en: 'easier' },
  'play.difficultyTagHarder': { fr: 'plus difficile', en: 'harder' },
  'play.difficultyTagFixed': { fr: 'Elo fixe', en: 'fixed Elo' },

  // Bot resign / player draw-offer (P3/Q-B/Q-C). Result strings + the offer button + pending line.
  'play.offerDraw': { fr: 'Proposer nulle', en: 'Offer draw' },
  'play.botResigns': { fr: "L'adversaire abandonne — vous gagnez ! ♚", en: 'Your opponent resigns — you win! ♚' },
  'play.drawAgreed': { fr: 'Nulle par accord mutuel.', en: 'Draw by agreement.' },
  'play.drawDeclined': { fr: 'Le bot refuse la nulle.', en: 'The bot declines the draw.' },
  'play.drawOfferedPending': { fr: 'Nulle proposée — en attente du bot…', en: 'Draw offered — awaiting the bot…' },

  // Post-game adaptation line (P3/Q-D), adaptive games only; suppressed for override games.
  'play.adaptTougher': { fr: 'Le bot sera plus fort la prochaine fois (+{delta} Elo).', en: 'The bot will be tougher next game (+{delta} Elo).' },
  'play.adaptEasier': { fr: 'Le bot sera plus faible la prochaine fois (−{delta} Elo).', en: 'The bot will be easier next game (−{delta} Elo).' },
  'play.adaptUnchanged': { fr: 'La force du bot est inchangée pour la prochaine partie.', en: "The bot's strength is unchanged for the next game." },

  // PR-03 (ADR-0061): post-game debrief card — surfaces what the game end already computed.
  'play.debrief.title': { fr: 'Bilan de la partie', en: 'Game debrief' },
  'play.debrief.rating': { fr: 'Votre classement', en: 'Your rating' },
  'play.debrief.winRate': { fr: 'Forme récente', en: 'Recent form' },
  'play.debrief.winRateVal': {
    fr: '{pct} % sur vos {n} dernières (cible ~{target} %)',
    en: '{pct}% over your last {n} (target ~{target}%)',
  },
  'play.debrief.opening': { fr: 'Ouverture', en: 'Opening' },
  'play.debrief.clock': { fr: 'Temps', en: 'Time' },
  'play.debrief.clockVal': {
    fr: 'vous {you} (moy. {avg} s/coup) · bot {bot}',
    en: 'you {you} (avg {avg}s/move) · bot {bot}',
  },
  // PR-05 (ADR-0063): sober personal-best line (set with the milestone cue).
  'play.newRatingBest': { fr: 'Nouveau record personnel : {rating} !', en: 'New personal best: {rating}!' },
  'play.debrief.note': {
    fr: "Le bot vise ~55 % de victoires pour vous : c'est la zone où l'on progresse le plus.",
    en: 'The bot aims for you to win ~55% of games: the zone where you improve fastest.',
  },

  'play.opponentLabel': { fr: 'Adversaire :', en: 'Opponent:' },
  'play.opponentHuman': { fr: 'Type humain (coups variés)', en: 'Human-like (varied moves)' },
  'play.opponentEngine': { fr: 'Moteur (meilleurs coups)', en: 'Engine (best moves)' },

  'play.modeLabel': { fr: 'Mode :', en: 'Mode:' },
  'play.modeStandard': { fr: 'Standard', en: 'Standard' },
  'play.modeChess960': { fr: 'Chess960 (Wild)', en: 'Chess960 (Wild)' },

  'play.startLabel': { fr: 'Départ (vide = 960 aléatoire) :', en: 'Start (blank = random 960):' },
  'play.startPlaceholder': { fr: '0–959', en: '0–959' },

  'play.timeLabel': { fr: 'Cadence :', en: 'Time:' },
  'play.customMin': { fr: 'min', en: 'min' },
  'play.customInc': { fr: '+sec', en: '+sec' },

  'play.youPlayWhite': { fr: 'Vous jouez les Blancs', en: 'You play White' },
  'play.youPlayBlack': { fr: 'Vous jouez les Noirs', en: 'You play Black' },

  'play.botThinking': { fr: 'Le bot réfléchit…', en: 'Bot is thinking…' },

  'play.retryBotMove': { fr: "↻ Refaire le coup du bot", en: "↻ Retry the bot's move" },
  'play.newGame': { fr: 'Nouvelle partie', en: 'New game' },
  'play.resign': { fr: 'Abandonner', en: 'Resign' },
  'play.analysing': { fr: 'Analyse…', en: 'Analysing…' },
  'play.reanalyse': { fr: 'Réanalyser', en: 'Re-analyse' },
  'play.analyseThisGame': { fr: 'Analyser cette partie', en: 'Analyse this game' },

  'play.chess960NoAnalysis': {
    fr: "Les parties Chess960 ne sont pas encore analysées automatiquement — le pipeline d'analyse suppose les règles standard et la théorie des ouvertures, il induirait donc en erreur. (Prévu pour un futur analyseur compatible 960.)",
    en: "Chess960 games aren't auto-analysed yet — the analysis pipeline assumes standard rules and opening theory, so it would mislead. (Tracked for a future 960-aware analyser.)",
  },

  'play.analysingPosition': {
    fr: 'Analyse de la position {progress} / {total}…',
    en: 'Analysing position {progress} / {total}…',
  },

  'play.tip': {
    fr: 'Astuce : jouez lentement et réfléchissez. Après la partie, cliquez sur <b>Analyser cette partie</b> — un clic transforme vos erreurs en problèmes et met à jour votre tableau des faiblesses (rien à coller). Le bot oriente ensuite les futures ouvertures vers vos points les plus faibles.',
    en: 'Tip: play slowly and think. After the game, hit <b>Analyse this game</b> — one click turns your mistakes into puzzles and updates your weakness dashboard (nothing to paste). The bot then steers future openings toward whatever you\'re weakest at.',
  },

  // Coached take-back dialog
  'play.coachTitle': { fr: 'Coach', en: 'Coach' },
  'play.coachBody': {
    fr: 'Ce coup semble perdre du matériel, voire pire.',
    en: 'That move looks like it loses material or worse.',
  },
  'play.coachTakeBack': { fr: 'Annuler le coup', en: 'Take it back' },
  'play.coachKeep': { fr: 'Continuer', en: 'Keep playing' },

  // Chess960 steering note (script-assigned)
  'play.chess960Steer': {
    fr: 'Chess960 · SP-ID {id} · glissez le roi sur sa propre tour pour roquer',
    en: 'Chess960 · SP-ID {id} · drag the king onto its own rook to castle',
  },

  // Result / status messages (script-assigned to `result`)
  'play.engineFailedStart': { fr: 'Le moteur n\'a pas pu démarrer : ', en: 'Engine failed to start: ' },
  'play.flagDraw': {
    fr: 'Au temps — mais matériel insuffisant pour mater : nulle (FIDE Art. 6.9).',
    en: 'Flag — but insufficient mating material: draw (FIDE Art. 6.9).',
  },
  'play.flagYouLost': { fr: 'Vous êtes tombé — manque de temps.', en: 'You flagged — out of time.' },
  'play.flagYouWin': {
    fr: "L'adversaire est tombé — vous gagnez au temps ! ♚",
    en: 'Opponent flagged — you win on time! ♚',
  },
  'play.engineIllegal': {
    fr: 'Le moteur a renvoyé un coup illégal — partie interrompue.',
    en: 'Engine returned an illegal move — game halted.',
  },
  'play.engineError': {
    fr: 'Erreur du moteur — le bot n\'a pas pu jouer. Réessayez, ou lancez une nouvelle partie.',
    en: 'Engine error — the bot could not move. Retry, or start a new game.',
  },
  'play.checkmateWin': { fr: 'Échec et mat — vous gagnez ! ♚', en: 'Checkmate — you win! ♚' },
  'play.checkmateLost': { fr: 'Échec et mat — vous avez perdu.', en: 'Checkmate — you lost.' },
  'play.drawReason': { fr: 'Nulle ({reason}).', en: 'Draw ({reason}).' },
  'play.analysisFailed': { fr: "Échec de l'analyse : ", en: 'Analysis failed: ' },
  'play.youResigned': { fr: 'Vous avez abandonné.', en: 'You resigned.' },

  // Export a played game's PGN (F5, ADR-0056) — Play tail + history rows.
  'play.exportPgn': { fr: 'Exporter le PGN', en: 'Export PGN' },

  // ---- In-game / after-game UX (P2, play-in-game-ux-spec) ----
  'play.rematch':            { fr: 'Revanche',                       en: 'Rematch' },
  'play.takeBack':           { fr: 'Annuler le coup',                en: 'Take back' },
  'play.checkMove':          { fr: 'Vérifier ce coup',               en: 'Check this move' },
  'play.checkRisky':         { fr: 'Ce coup semble risqué.',         en: 'This move looks risky.' },
  'play.checkFine':          { fr: 'Ce coup semble correct.',        en: 'This move looks fine.' },
  'play.unratedNote':        { fr: 'Coup repris — cette partie ne comptera pas.', en: "Move taken back — this game won't count." },
  'play.moveListLabel':      { fr: 'Liste des coups',                en: 'Move list' },
  'play.moveListEmpty':      { fr: "Aucun coup pour l'instant.",     en: 'No moves yet.' },
  'play.resignConfirmTitle': { fr: 'Abandonner ?',                   en: 'Resign?' },
  'play.resignConfirmBody':  { fr: 'La partie sera perdue et comptera comme une défaite.', en: 'The game will be lost and counts as a defeat.' },
  'play.resignConfirmYes':   { fr: 'Abandonner',                     en: 'Resign' },
  'play.resignConfirmNo':    { fr: 'Continuer',                      en: 'Keep playing' },

  // ---- Play→analysis loop closure (play.loop.*) — P1, play-loop-closure-spec ----
  // "Analyse your N unanalysed games" — N is unanalyzedPlayedGames(...).length (F-P1-3).
  'play.loop.analyseAllOne': {
    fr: 'Analyser votre {n} partie non analysée',
    en: 'Analyse your {n} unanalysed game',
  },
  'play.loop.analyseAllMany': {
    fr: 'Analyser vos {n} parties non analysées',
    en: 'Analyse your {n} unanalysed games',
  },
  // Sequential batch progress (games done / total).
  'play.loop.queueProgress': {
    fr: 'Analyse de la partie {done} / {total}…',
    en: 'Analysing game {done} / {total}…',
  },
  'play.loop.cancel': { fr: 'Annuler', en: 'Cancel' },
  'play.loop.cancelling': { fr: 'Arrêt…', en: 'Stopping…' },
  // Quiet confirmation after the opt-in auto-run analyses the just-finished game (F-P1-2).
  'play.loop.autoAnalysed': { fr: 'Analysée ✓', en: 'Analysed ✓' },
  // Dashboard / Home badge — N unanalysed games (links to the played-game history).
  'play.loop.badgeOne': { fr: '{n} partie non analysée', en: '{n} unanalysed game' },
  'play.loop.badgeMany': { fr: '{n} parties non analysées', en: '{n} unanalysed games' },
  'play.loop.reviewHistory': { fr: "Voir l'historique →", en: 'Review history →' },
  // Settings: opt-in auto-analyse-on-finish.
  'play.loop.autoAnalyzeLabel': {
    fr: 'Analyser automatiquement chaque partie à la fin',
    en: 'Auto-analyse each game when it finishes',
  },
  'play.loop.autoAnalyzeHelp': {
    fr: "Quand c'est activé, la partie que vous venez de terminer est analysée toute seule (sans clic) — vos erreurs deviennent des problèmes et votre tableau des faiblesses se met à jour. Seule la partie qui vient de se terminer est analysée, jamais tout l'arriéré (lourd pour le moteur). Désactivé par défaut ; les parties Chess960 ne sont jamais analysées.",
    en: "When on, the game you just finished is analysed on its own (no click) — your mistakes become puzzles and your weakness dashboard updates. Only the just-finished game is analysed, never the whole backlog (heavy for the engine). Off by default; Chess960 games are never analysed.",
  },

  // ---- Played-game history (history.*) — section inside the Import view (F5, ADR-0056) ----
  'history.title': { fr: 'Vos parties jouées', en: 'Your played games' },
  'history.subtitle': {
    fr: 'Les parties jouées contre le bot, les plus récentes en premier. Exportez le PGN ou analysez une partie non analysée.',
    en: 'Games you played against the bot, newest first. Export the PGN or analyse a game that has not been analysed yet.',
  },
  'history.empty': {
    fr: "Aucune partie jouée pour l'instant. Jouez une partie contre le bot, puis revenez ici.",
    en: 'No played games yet. Play a game against the bot, then come back here.',
  },
  'history.analysed': { fr: 'Analysée', en: 'Analysed' },
  'history.notAnalysed': { fr: 'Non analysée', en: 'Not analysed' },
  'history.analyse': { fr: 'Analyser', en: 'Analyse' },
  'history.export': { fr: 'Exporter le PGN', en: 'Export PGN' },
  'history.resultWin': { fr: 'Victoire', en: 'Win' },
  'history.resultLoss': { fr: 'Défaite', en: 'Loss' },
  'history.resultDraw': { fr: 'Nulle', en: 'Draw' },
  'history.botElo': { fr: 'Bot {elo} Elo', en: 'Bot {elo} Elo' },
  'history.chess960': { fr: 'Chess960', en: 'Chess960' },
  'history.untimed': { fr: 'Sans pendule', en: 'Untimed' },
  'history.catBullet': { fr: 'Bullet', en: 'Bullet' },
  'history.catBlitz': { fr: 'Blitz', en: 'Blitz' },
  'history.catRapid': { fr: 'Rapide', en: 'Rapid' },
  'history.catClassical': { fr: 'Classique', en: 'Classical' },
};
