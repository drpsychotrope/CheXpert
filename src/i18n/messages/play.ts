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
