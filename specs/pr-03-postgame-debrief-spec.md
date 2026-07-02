# Spec fille — PR-03 `postgame-debrief` (roadmap enhance V1, vague 1)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-03 (F2, I6 crée la primitive carte). Dépend : PR-02 (livré).

## §0 Contexte
Fin de partie = résultat + ligne d'adaptation, rien d'autre. Le delta Elo était calculé puis jeté (fold), `rollingWinRate` jamais rendu, l'ouverture jamais nommée sans analyse complète, le temps jamais résumé. Le moment le plus attentif de l'utilisateur restait muet.

## §2 Scope
**IN** : carte de débrief à `status==='over'` — classement avant→après (+delta), forme récente (% sur N, cible 55 % expliquée), ouverture jouée (nommage ECO local, localisé FR), temps par camp + moyenne/coup (depuis le trace PR-02) ; primitive `RecapCard` réutilisable (I6 — PR-09 la consommera).
**OUT** : historique/graphes (PR-04) ; toute donnée nécessitant l'analyse moteur ; 960 (pas d'ouverture) et untimed (pas de temps) — lignes simplement absentes.

## §4 Phase A — livré
- `src/game/debrief.ts` (NEUF, pur) : `clockSummary` (dépense par camp depuis les snapshots %clk, incrément compté comme temps réel — même dérivation que `parsePgn.secondsSpent` ; clamp ≥0), `fmtDuration` M:SS, `avgSecPerMove`, `ratingDelta` signé, `DebriefData` tout-optionnel.
- `src/ui/RecapCard.svelte` (NEUF) : panneau titre + lignes label/valeur (valeur vide → ligne sautée) + note. Présentational pur.
- `gameSession.ts` : getter `uciMoves` (copie lecture seule de `playedUci`).
- `Play.svelte` : assemblage dans `finishGame` (post-fold : `foldRating`, `opp.state.recent` — cette partie incluse), nommage async `describeOpening` best-effort, rows `$derived`, rendu conditionné à ≥1 ligne non vide.
- Honnêteté : pas de fold (unrated/override) → pas de ligne classement NI forme (rien n'a bougé, rien à raconter — AP-TELEM-3 étendu).

## §5-6 Tests + gates — livré
`debrief.test.ts` (7) : split par camp avec incrément, trace vide → null, clamp désync, joueur Noir, formats, moyenne, delta signé. **984 verts** (977 + 7), svelte-check **0/0** (443 fichiers), build vert. Gate vague 1 (part débrief) : delta + forme + ouverture + temps visibles sans clic après une partie comptée — les quatre lignes alimentées par des données vérifiées présentes au call-site.

## §9 Anti-patterns
**AP-DEBRIEF-1** : ligne affichée sans donnée réelle (placeholder) → valeur vide = ligne absente. **AP-DEBRIEF-2** : bloquer la fin de partie sur le nommage d'ouverture → async best-effort, patch à l'arrivée.

## §10 Rollback
Revert ; aucun schéma, composant + module purs additifs.
