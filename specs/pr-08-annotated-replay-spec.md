# Spec fille — PR-08 `annotated-replay` (roadmap enhance V1, vague 2)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-08 (F7 ; PR-02 enrichit via `secondsSpent` ; débloque PR-21).

## §0 Contexte
Chaque pli stockait `severity`/`cpLoss`/`playedWhiteCp`/`bestUci`/`secondsSpent`/explications — l'UI ne montrait qu'agrégats + moments critiques + une liste d'erreurs repliée. L'expérience standard de review (liste annotée cliquable + board piloté) manquait alors que toutes les pièces existaient.

## §2 Scope
**IN** : composant `AnnotatedReplay` — liste de coups appariés avec NAG (?!/?/??) colorés (coups du joueur en gras), board piloté (fenAfter + surlignage du coup), navigation ⏮◀▶⏭ + clavier (flèches/Home/End, région labellisée AT), détail par coup (éval White-POV en pions, −cp perdu, temps de réflexion PR-02), explication (headline + « mieux ») sur les coups classés, lien « Explorer cette position ». **Un seul curseur** partagé : courbe d'éval, moments critiques, liste d'erreurs (« Voir dans le rejeu ») et replay pilotent le même ply.
**OUT** : re-éval moteur au replay (doctrine ADR-0038 : rien que le stocké ; PR-23 pour l'analysis board) ; badge « seul coup » (PR-21, consommateur prévu) ; replay 960 (hérite via PR-20, I1).

## §4 Phase A — livré
- `src/analysis/replay.ts` (NEUF, pur) : `nagFor` (silencieux sur best/good — pas de bruit), `evalLabel` (pions signés, White POV), `moveRows` (appariement W/B, flag `mine`), `clampIndex` (curseur -1..n-1).
- `src/ui/AnnotatedReplay.svelte` (NEUF) : board `--board-size:300px`, auto-scroll du coup courant, sons de replay gratuits (Board+lastMove — PR-05).
- `AnalysisResult.svelte` : le curseur `selectedPly` devient le pivot unique ; l'ancien bloc board-du-moment est **absorbé** par le replay ; la liste d'erreurs gagne « Voir dans le rejeu ».

## §5-6 Tests + gates — livré
`replay.test.ts` (4) : NAGs, label d'éval signé, appariement + flag joueur + coup manquant, clamp. **1012 verts** (1008 + 4), svelte-check **0/0** (455 fichiers), build vert. Gate vague 2 : « le replay navigue les 40 coups d'une partie analysée avec annotation par coup » — porté par moveRows/clampIndex testés + le câblage du curseur unique.

## §9 Anti-patterns
**AP-REPLAY-1** : moteur au replay → lecture du stocké uniquement (ADR-0038). **AP-REPLAY-2** : deux curseurs (graph vs replay) qui divergent → un seul état parent. **AP-REPLAY-3** : NAG sur les bons coups → silencieux sur best/good.

## §10 Rollback
Revert ; composant + module purs additifs (l'ancien bloc moment revient avec le revert).
