# Spec fille — PR-17 `puzzle-playout` (roadmap enhance V1, vague 4)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-17 (F22).

## §0 Contexte
Post-résolution : ligne animée + motif, mais aucun « continue contre le bot depuis ici ». Le runner sparring acceptait déjà n'importe quel FEN — il manquait un signal et un bouton.

## §2 Scope
**IN** : signal one-shot `app.sparringCustomFen {fen, sideToTrain, label}` (miroir des signaux existants, non persisté) ; bouton « Jouer la position contre le bot » quand le puzzle est TERMINÉ (solve ou échec) ET la position a des coups légaux (un mat final n'offre rien) ; scénario ad-hoc `custom:playout` (jamais listé) démarré à la consommation ; **fix générique dans `start()`** : si le trait n'est pas au joueur (cas normal post-solve — ta ligne gagnante vient de finir), le bot joue d'abord — les scénarios bibliothèque/leaks (joueur-au-trait par contrat) ne passent jamais par ce chemin.
**OUT** : comptage/rating (sparring = non compté par nature) ; play-out depuis le replay d'analyse (le lien « Explorer cette position » y route déjà vers l'analysis board — §11 pour un play-out là aussi).

## §4-6 — livré
`app.svelte.ts` (signal), `Tactics.svelte` (bouton gated `dests().size > 0`), `Sparring.svelte` (consommation + kick bot conditionnel), i18n 3 clés. Câblage pur sur runner testé — **1036 verts** inchangés, svelte-check **0/0** (465 fichiers), build vert.

## §9 Anti-patterns
**AP-PLAYOUT-1** : proposer le play-out sur un mat final → gate coups légaux. **AP-PLAYOUT-2** : bot muet quand ce n'est pas au joueur → kick conditionnel dans start(). **AP-PLAYOUT-3** : lister le scénario ad-hoc dans le picker → consommé une fois, jamais dans `scenarios`.

## §10 Rollback
Revert ; zéro schéma.
