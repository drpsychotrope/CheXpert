# Spec fille — PR-15 `explorer-own-stats` (roadmap enhance V1, vague 4)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-15 (F15).

## §0 Contexte
L'explorer nommait les lignes, zéro stat personnelle. Le DEFER openings Q-B voulait une DB de stats globales bundlée ; la réponse local-first est moins chère et plus utile : **tes** résultats par ouverture. L'ECO n'est PAS stocké sur l'analyse (vérifié au scan roadmap) → calcul à l'agrégation.

## §2 Scope
**IN** : core pur `ownOpeningStats` (nommage par partie via `nameOpening` injecté, groupement ECO+nom, score % avec nulles=0.5, n, ACPL moyen de la phase d'ouverture, tri par fréquence) ; parties **jouées analysées standard** uniquement (résultat + couleur fiables) ; lignes non nommées ignorées par défaut (1. a3 ne dit rien des choix de répertoire) ; section Explorer + note d'honnêteté (« un petit n reste un petit n »).
**OUT** : parties importées (résultat via header, moins fiable — §11) ; stats globales/communautaires (le DEFER original) ; tri configurable.

## §4-6 — livré
`opening/ownStats.ts` + tests (3 : groupement/score/ACPL/tri, unnamed skip + opt-in, vide). `Explorer.svelte` (chargement best-effort + liste + note). i18n 3 clés. **1033 verts** (1030 + 3), svelte-check **0/0** (465 fichiers), build vert. Gate vague 4 : stats sur ≥3 ECO après import en masse — le groupement est le cœur testé ; l'affichage est gated sur `ownStats.length`.

## §9 Anti-patterns
**AP-OSTAT-1** : score % sans n visible → n toujours affiché à côté. **AP-OSTAT-2** : compter les lignes non nommées comme une « ouverture » → skip par défaut. **AP-OSTAT-3** : casser l'explorer sur un échec storage → best-effort.

## §10 Rollback
Revert ; zéro schéma.
