// Import / AnalysisResult / AnalysisBoard / Explorer / Endgames / Repertoire messages (V2-W18 wave G4).
import type { Messages } from '../translate';

export const analysis: Messages = {
  // ── Import.svelte (import.*) ─────────────────────────────────────────────
  'import.title': { fr: 'Analyser une partie', en: 'Analyse a game' },
  'import.introBefore': {
    fr: "Collez un PGN d'une partie externe. Nous lançons le moteur localement sur chaque coup, signalons vos imprécisions / erreurs / gaffes, étiquetons l'idée ratée et transformons vos vraies erreurs en problèmes personnalisés. Rien ne quitte votre appareil. (Les parties que vous jouez dans ",
    en: 'Paste a PGN from an external game. We run the engine locally over every move, flag your inaccuracies / mistakes / blunders, tag the missed idea, and turn your real mistakes into personalised puzzles. Nothing leaves your device. (Games you play in ',
  },
  'import.playTab': { fr: 'Jouer', en: 'Play' },
  'import.introAfter': {
    fr: ' peuvent être analysées en un clic — sans coller.)',
    en: ' can be analysed in one click — no paste needed.)',
  },
  'import.pgnPlaceholder': { fr: 'Collez le PGN ici…', en: 'Paste PGN here…' },
  'import.nameLabel': { fr: 'Votre nom dans le PGN (optionnel)', en: 'Your name in the PGN (optional)' },
  'import.namePlaceholder': { fr: 'ex. Vous', en: 'e.g. You' },
  'import.youPlayed': { fr: 'Vous jouiez', en: 'You played' },
  'import.autoDetect': { fr: 'Détection auto', en: 'Auto-detect' },
  'import.white': { fr: 'Blancs', en: 'White' },
  'import.black': { fr: 'Noirs', en: 'Black' },
  'import.analyse': { fr: 'Analyser', en: 'Analyse' },
  'import.analysing': { fr: 'Analyse…', en: 'Analysing…' },
  'import.loadSample': { fr: "Charger un exemple", en: 'Load sample' },
  'import.progress': { fr: 'Analyse de la position {progress} / {total}…', en: 'Analysing position {progress} / {total}…' },
  'import.couldNotAnalyse': { fr: "Analyse impossible : {error}", en: 'Could not analyse: {error}' },
  'import.resultTitle': { fr: 'Résultat', en: 'Result' },
  'import.analysedIn': { fr: 'Analysé en {seconds}s ({ms}ms/coup)', en: 'Analysed in {seconds}s ({ms}ms/ply)' },
  // Status / error notices (set in script)
  'import.detectedGames': {
    fr: '{n} parties détectées — analysez tout ou seulement la première.',
    en: 'Detected {n} games — analyse them all, or just the first.',
  },
  // PR-06 (ADR-0064): bulk multi-game import.
  'import.loadFile': { fr: 'Charger un fichier .pgn…', en: 'Load a .pgn file…' },
  'import.analyseAll': { fr: 'Analyser les {n} parties', en: 'Analyse all {n} games' },
  'import.analyseFirstOnly': { fr: 'Seulement la 1ʳᵉ', en: 'First only' },
  'import.bulkProgress': { fr: 'Partie {i} / {n}…', en: 'Game {i} / {n}…' },
  'import.bulkCancel': { fr: 'Arrêter après cette partie', en: 'Stop after this game' },
  'import.bulkDoneTitle': { fr: 'Import terminé', en: 'Import finished' },
  'import.bulkDoneLine': {
    fr: '{analyzed} parties analysées · {puzzles} puzzles personnels créés',
    en: '{analyzed} games analysed · {puzzles} personal puzzles created',
  },
  'import.bulkSkippedColor': {
    fr: "{n} ignorées : couleur indéterminable (renseignez votre pseudo tel qu'il apparaît dans le PGN, puis réessayez — jamais devinée).",
    en: '{n} skipped: colour undeterminable (set your name as it appears in the PGN and retry — never guessed).',
  },
  'import.bulkSkippedDup': { fr: '{n} déjà analysées (ignorées).', en: '{n} already analysed (skipped).' },
  'import.bulkFailed': { fr: '{n} en échec (PGN illisible ou erreur moteur) — le lot a continué.', en: '{n} failed (unreadable PGN or engine error) — the batch continued.' },
  // PR-07 (ADR-0065): opt-in Lichess fetch.
  'import.lichessTitle': { fr: 'Récupérer depuis Lichess', en: 'Fetch from Lichess' },
  'import.lichessUserLabel': { fr: 'Pseudo Lichess', en: 'Lichess username' },
  'import.lichessMaxLabel': { fr: 'Parties', en: 'Games' },
  'import.lichessFetch': { fr: 'Récupérer', en: 'Fetch' },
  'import.lichessFetching': { fr: 'Récupération…', en: 'Fetching…' },
  'import.lichessHint': {
    fr: 'Envoie uniquement ce pseudo à lichess.org (API publique, aucun compte requis) et récupère vos dernières parties avec leurs pendules — elles alimentent aussi le diagnostic de gestion du temps.',
    en: 'Sends only this username to lichess.org (public API, no account needed) and fetches your latest games with their clocks — they feed the time-management diagnosis too.',
  },
  'import.lichessNeedsNetwork': {
    fr: "La récupération Lichess nécessite l'accès réseau (désactivé par défaut).",
    en: 'The Lichess fetch needs network access (off by default).',
  },
  'import.lichessOpenSettings': { fr: 'Ouvrir les Réglages', en: 'Open Settings' },
  'import.lichessErrInvalid': { fr: 'Pseudo Lichess invalide (2-30 caractères, lettres/chiffres/_/-).', en: 'Invalid Lichess username (2-30 chars, letters/digits/_/-).' },
  'import.lichessErrNotFound': { fr: 'Utilisateur introuvable sur Lichess — vérifiez le pseudo.', en: 'User not found on Lichess — check the username.' },
  'import.lichessErrRate': { fr: 'Lichess limite le débit — réessayez dans une minute.', en: 'Lichess is rate-limiting — retry in a minute.' },
  'import.lichessErrNetwork': { fr: 'Erreur réseau en contactant Lichess.', en: 'Network error reaching Lichess.' },
  'import.lichessErrEmpty': { fr: 'Aucune partie renvoyée pour ce pseudo.', en: 'No games returned for this username.' },
  'import.noMoves': { fr: 'Aucun coup trouvé dans ce PGN.', en: 'No moves found in this PGN.' },
  'import.colorNotDetected': {
    fr: "Impossible de détecter automatiquement votre couleur (Blancs : « {white} », Noirs : « {black} »). Tapez votre nom tel qu'il apparaît dans le PGN, ou choisissez Blancs/Noirs ci-dessus, puis relancez Analyser.",
    en: 'Couldn\'t auto-detect your colour (White: "{white}", Black: "{black}"). Type your name as it appears in the PGN, or pick White/Black above, then Analyse again.',
  },

  // ── AnalysisResult.svelte (analysisResult.*) ─────────────────────────────
  'analysisResult.yourAcpl': { fr: 'votre ACPL', en: 'your ACPL' },
  'analysisResult.blunders': { fr: 'gaffes', en: 'blunders' },
  'analysisResult.mistakes': { fr: 'erreurs', en: 'mistakes' },
  'analysisResult.inaccuracies': { fr: 'imprécisions', en: 'inaccuracies' },
  'analysisResult.opening': { fr: 'Ouverture :', en: 'Opening:' },
  'analysisResult.leftBook': { fr: 'sorti du livre au coup {move}.', en: 'left book at move {move}.' },
  'analysisResult.addedToRep': { fr: '✓ ajouté au répertoire', en: '✓ added to repertoire' },
  'analysisResult.addLineToRep': { fr: 'Ajouter cette ligne au répertoire', en: 'Add this line to repertoire' },
  'analysisResult.phaseAcpl': { fr: 'ACPL {phase}', en: '{phase} ACPL' },
  'analysisResult.criticalMoments': { fr: 'Moments critiques', en: 'Critical moments' },
  'analysisResult.moveLabel': { fr: 'Coup {n}', en: 'Move {n}' },
  'analysisResult.you': { fr: 'vous', en: 'you' },
  'analysisResult.opponent': { fr: 'adversaire', en: 'opponent' },
  'analysisResult.exploreThisPosition': { fr: 'Explorer cette position →', en: 'Explore this position →' },
  'analysisResult.createdPuzzlesOne': {
    fr: 'Créé {n} problème personnalisé à partir de vos erreurs — retrouvez-le dans ',
    en: 'Created {n} personalised puzzle from your mistakes — find them in ',
  },
  'analysisResult.createdPuzzlesMany': {
    fr: 'Créé {n} problèmes personnalisés à partir de vos erreurs — retrouvez-les dans ',
    en: 'Created {n} personalised puzzles from your mistakes — find them in ',
  },
  'analysisResult.tacticsLink': { fr: 'Tactique', en: 'Tactics' },
  'analysisResult.tacticsLinkSuffix': { fr: '.', en: '.' },
  'analysisResult.noPuzzles': {
    fr: 'Aucune erreur nette à solution unique trouvée pour en faire des problèmes.',
    en: 'No clear-cut, unique-solution mistakes found to turn into puzzles.',
  },
  'analysisResult.seeDashboard': { fr: 'Voir votre tableau de bord des faiblesses →', en: 'See your weakness dashboard →' },
  'analysisResult.mistakesExplained': { fr: 'Vos erreurs, expliquées', en: 'Your mistakes, explained' },
  'analysisResult.moveColon': { fr: 'Coup {n} :', en: 'Move {n}:' },
  'analysisResult.winSuffix': { fr: ' de gain', en: ' win' },
  'analysisResult.explanationsNote': {
    fr: "Les explications sont basées sur des règles et dérivées uniquement de l'évaluation du moteur — jamais inventées. Quand nous ne pouvons pas nommer un motif tactique précis, nous le disons plutôt que de deviner.",
    en: "Explanations are rule-based and derived only from the engine's own evaluation — never invented. When we can't name a specific tactical pattern, we say so rather than guess.",
  },

  // ── AnalysisBoard.svelte (analysisBoard.*) ───────────────────────────────
  'analysisBoard.title': { fr: "Échiquier d'analyse", en: 'Analysis board' },
  'analysisBoard.whiteWinningChance': { fr: 'Chances de gain des Blancs', en: 'White winning chance' },
  'analysisBoard.engineLines': { fr: 'Lignes du moteur', en: 'Engine lines' },
  'analysisBoard.noLegalMoves': { fr: 'Aucun coup légal (partie terminée).', en: 'No legal moves (game over).' },
  'analysisBoard.back': { fr: '← Retour', en: '← Back' },
  'analysisBoard.reset': { fr: 'Réinitialiser', en: 'Reset' },

  // ── Explorer.svelte (explorer.*) ─────────────────────────────────────────
  'explorer.title': { fr: "Explorateur d'ouvertures", en: 'Opening explorer' },
  'explorer.intro': {
    fr: 'Tapez des coups (SAN) pour nommer la ligne et voir les continuations de livre.',
    en: 'Type moves (SAN) to name the line and see book continuations.',
  },
  'explorer.lookUp': { fr: 'Rechercher', en: 'Look up' },
  'explorer.illegalMove': { fr: 'Coup illégal : {move}', en: 'Illegal move: {move}' },
  'explorer.line': { fr: 'Ligne :', en: 'Line:' },
  'explorer.notInBookBefore': { fr: 'Pas dans le livre de base (lancez ', en: 'Not in the seed book (run ' },
  'explorer.notInBookAfter': { fr: ' pour le jeu complet).', en: ' for the full set).' },
  'explorer.bookContinuations': { fr: 'Continuations de livre', en: 'Book continuations' },

  // ── Endgames.svelte (endgames.*) ─────────────────────────────────────────
  'endgames.title': { fr: 'Entraîneur de finales', en: 'Endgame trainer' },
  'endgames.intro': {
    fr: 'Jouez des finales fondamentales contre le moteur avec un retour parfait de la table de finale Syzygy (≤7 pièces).',
    en: 'Play out fundamental endgames against the engine with perfect feedback from the Syzygy tablebase (≤7 pieces).',
  },
  'endgames.networkHintBefore': {
    fr: 'Le retour de la table de finale nécessite un accès réseau (désactivé par défaut). Activez-le dans ',
    en: 'Tablebase feedback needs network access (off by default). Enable it in ',
  },
  'endgames.settingsLink': { fr: 'Réglages', en: 'Settings' },
  'endgames.networkHintAfter': {
    fr: ' pour une notation parfaite des coups. Les exercices fonctionnent quand même contre le moteur sans cela.',
    en: ' for perfect move grading. Drills still work against the engine without it.',
  },
  'endgames.engineThinking': { fr: 'Le moteur réfléchit…', en: 'Engine thinking…' },
  'endgames.tablebasePosition': {
    fr: 'Table de finale : la position est ',
    en: 'Tablebase: position is ',
  },
  'endgames.cached': { fr: ' · en cache', en: ' · cached' },
  'endgames.restart': { fr: 'Recommencer', en: 'Restart' },
  'endgames.allDrills': { fr: '← Tous les exercices', en: '← All drills' },
  // Feedback (set in script)
  'endgames.perfectKeeps': { fr: 'Parfait — conserve {category}.', en: 'Perfect — keeps the {category}.' },
  'endgames.moveCategory': {
    fr: 'Table de finale : ce coup est « {category} ». Le meilleur était {best} (conserve {bestCategory}).',
    en: 'Tablebase: that move is "{category}". Best was {best} (keeps the {bestCategory}).',
  },
  'endgames.bestByTablebase': { fr: 'Le meilleur selon la table de finale était {best}.', en: 'Best by tablebase was {best}.' },
  'endgames.playingNoFeedbackNetwork': {
    fr: 'Jeu sans retour de table de finale (réseau désactivé — activez-le dans Réglages).',
    en: 'Playing without tablebase feedback (network off — enable it in Settings).',
  },
  'endgames.playingNoFeedbackFailed': {
    fr: 'Jeu sans retour de table de finale (échec de la consultation de la table).',
    en: 'Playing without tablebase feedback (tablebase lookup failed).',
  },
  'endgames.lookupFailed': {
    fr: "Échec de la consultation de la table de finale ({error}).",
    en: 'Tablebase lookup failed ({error}).',
  },
  'endgames.checkmateYouWin': { fr: 'Échec et mat — Vous gagnez.', en: 'Checkmate — You win.' },
  'endgames.checkmateEngineWins': { fr: 'Échec et mat — Le moteur gagne.', en: 'Checkmate — Engine wins.' },
  'endgames.draw': { fr: 'Nulle ({reason}).', en: 'Draw ({reason}).' },

  // ── Repertoire.svelte (repertoire.*) ─────────────────────────────────────
  'repertoire.title': { fr: "Répertoire d'ouvertures", en: 'Opening repertoire' },
  'repertoire.intro': {
    fr: "Construisez les lignes que vous voulez jouer, puis travaillez-les en répétition espacée jusqu'à ce qu'elles deviennent automatiques.",
    en: "Build the lines you want to play, then drill them with spaced repetition until they're automatic.",
  },
  'repertoire.newLine': { fr: '+ Nouvelle ligne', en: '+ New line' },
  'repertoire.noLines': { fr: 'Aucune ligne pour le moment.', en: 'No lines yet.' },
  'repertoire.white': { fr: 'Blancs', en: 'White' },
  'repertoire.black': { fr: 'Noirs', en: 'Black' },
  'repertoire.drill': { fr: 'Exercice', en: 'Drill' },
  'repertoire.deleteLineAria': { fr: 'Supprimer la ligne', en: 'Delete line' },
  'repertoire.nameLabel': { fr: 'Nom', en: 'Name' },
  'repertoire.namePlaceholder': { fr: 'ex. Italienne — ligne principale', en: 'e.g. Italian — main line' },
  'repertoire.youPlay': { fr: 'Vous jouez', en: 'You play' },
  'repertoire.movesLabel': { fr: 'Coups (SAN, séparés par des espaces)', en: 'Moves (SAN, space-separated)' },
  'repertoire.saveLine': { fr: 'Enregistrer la ligne', en: 'Save line' },
  'repertoire.cancel': { fr: 'Annuler', en: 'Cancel' },
  'repertoire.playYourMoves': { fr: 'jouez vos coups', en: 'play your moves' },
  'repertoire.again': { fr: 'Recommencer', en: 'Again' },
  'repertoire.linesBack': { fr: '← Lignes', en: '← Lines' },
  'repertoire.deleteTitle': { fr: 'Supprimer cette ligne ?', en: 'Delete this line?' },
  'repertoire.deleteBody': {
    fr: "La ligne du répertoire et sa carte de révision seront supprimées. Irréversible.",
    en: "The repertoire line and its review card will be removed. This can't be undone.",
  },
  'repertoire.deleteConfirm': { fr: 'Supprimer', en: 'Delete' },
  // Builder / drill feedback (set in script)
  'repertoire.giveName': { fr: 'Donnez un nom à cette ligne.', en: 'Give this line a name.' },
  'repertoire.couldNotBuild': { fr: 'Impossible de construire la ligne', en: 'Could not build line' },
  'repertoire.notYourMove': { fr: 'Ce coup n\'est pas dans votre répertoire — réessayez.', en: 'Not your repertoire move — try again.' },
  'repertoire.lineCompleteNoMistakes': { fr: 'Ligne terminée, aucune erreur ✔', en: 'Line complete, no mistakes ✔' },
  'repertoire.lineCompleteMistakesOne': { fr: 'Ligne terminée ({n} erreur).', en: 'Line complete ({n} mistake).' },
  'repertoire.lineCompleteMistakesMany': { fr: 'Ligne terminée ({n} erreurs).', en: 'Line complete ({n} mistakes).' },
  'repertoire.correct': { fr: 'Correct.', en: 'Correct.' },
};
