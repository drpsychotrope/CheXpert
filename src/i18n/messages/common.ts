// Shared/shell messages (V2-W18). Owned by the shell + shared choke-points (App nav,
// ConfirmDialog, ColorPicker, Board). Keys are stable; values are the two locales.
import type { Messages } from '../translate';

export const common: Messages = {
  // App shell / topbar (App.svelte)
  'shell.brand': { fr: '♞ Chess Trainer', en: '♞ Chess Trainer' },
  'shell.skipToContent': { fr: 'Aller au contenu', en: 'Skip to content' },
  'shell.docTitle': { fr: "Chess Trainer — la progression d'abord", en: 'Chess Trainer — progression first' },
  'shell.navLabel': { fr: 'Principal', en: 'Main' },
  'shell.loading': { fr: 'Chargement…', en: 'Loading…' },
  'shell.storageTitle': { fr: '⚠️ Stockage indisponible', en: '⚠️ Storage unavailable' },
  'shell.storageHint': {
    fr: "Chess Trainer garde tout sur votre appareil via le stockage du navigateur (IndexedDB). Essayez une fenêtre normale (non privée), autorisez les données du site, puis rechargez.",
    en: "Chess Trainer keeps everything on your device using your browser's storage (IndexedDB). Try a normal (non-private) window, allow site data for this page, then reload.",
  },
  'shell.reload': { fr: 'Recharger', en: 'Reload' },
  'shell.loadErrorTitle': { fr: "⚠️ Impossible de charger cet écran", en: "⚠️ Couldn't load this screen" },
  'shell.loadErrorBody': {
    fr: "Une partie de l'app n'a pas pu se charger — cela peut arriver après une mise à jour. Recharger règle généralement le problème.",
    en: 'A part of the app failed to load — this can happen after an update. Reloading usually fixes it.',
  },

  // Navigation labels (App.svelte NAV)
  'nav.home': { fr: 'Accueil', en: 'Home' },
  'nav.play': { fr: 'Jouer', en: 'Play' },
  'nav.spar': { fr: 'Sparring', en: 'Spar' },
  'nav.tactics': { fr: 'Tactique', en: 'Tactics' },
  'nav.review': { fr: 'Révisions', en: 'Review' },
  'nav.woodpecker': { fr: 'Woodpecker', en: 'Woodpecker' },
  'nav.analyse': { fr: 'Analyser', en: 'Analyse' },
  'nav.board': { fr: 'Échiquier', en: 'Board' },
  'nav.dashboard': { fr: 'Profil', en: 'Dashboard' },
  'nav.insights': { fr: 'Bilan', en: 'Insights' },
  'nav.coach': { fr: 'Coach', en: 'Coach' },
  'nav.session': { fr: 'Session', en: 'Session' },
  'nav.endgames': { fr: 'Finales', en: 'Endgames' },
  'nav.repertoire': { fr: 'Répertoire', en: 'Repertoire' },
  'nav.explorer': { fr: 'Explorateur', en: 'Explorer' },
  'nav.guess': { fr: 'Deviner', en: 'Guess' },
  'nav.vision': { fr: 'Vision', en: 'Vision' },
  'nav.concepts': { fr: 'Concepts', en: 'Concepts' },
  'nav.calculate': { fr: 'Calcul', en: 'Calculate' },
  'nav.settings': { fr: 'Réglages', en: 'Settings' },

  // Generic actions (shared)
  'common.ok': { fr: 'OK', en: 'OK' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },

  // Colors / sides (ColorPicker, Board)
  'color.playAs': { fr: 'Jouer :', en: 'Play as:' },
  'color.white': { fr: 'Blancs', en: 'White' },
  'color.black': { fr: 'Noirs', en: 'Black' },
  'color.random': { fr: 'Aléatoire', en: 'Random' },

  // Piece names (Board promotion picker aria-labels; keyed by UCI promo letter)
  'piece.q': { fr: 'Dame', en: 'Queen' },
  'piece.r': { fr: 'Tour', en: 'Rook' },
  'piece.b': { fr: 'Fou', en: 'Bishop' },
  'piece.n': { fr: 'Cavalier', en: 'Knight' },

  // Board (turn badge, keyboard move, promotion)
  'board.youPlay': { fr: 'Vous jouez les {color}', en: 'You play {color}' },
  'board.toMove': { fr: 'Trait aux {color}', en: '{color} to move' },
  'board.kbMove': { fr: 'Coup (clavier) :', en: 'Move (keyboard):' },
  'board.kbPlaceholder': { fr: 'ex. Nf3 ou g1f3', en: 'e.g. Nf3 or g1f3' },
  'board.kbPlay': { fr: 'Jouer', en: 'Play' },
  'board.notLegal': { fr: "« {move} » n'est pas un coup légal ici", en: '"{move}" is not a legal move here' },
  'board.cancelPromotion': { fr: 'Annuler la promotion', en: 'Cancel promotion' },
  'board.choosePromo': { fr: 'Choisir la pièce de promotion', en: 'Choose promotion piece' },
  'board.promoteTo': { fr: 'Promouvoir en', en: 'Promote to' },
};
