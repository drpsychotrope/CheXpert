# Spec fille — PR-13 `repertoire-deviation` (roadmap enhance V1, vague 4)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-13 (F12).

## §0 Contexte
L'analyse nommait la sortie du *book général* (firstOutOfBook) mais personne ne croisait jamais une partie avec **tes propres lignes engagées** — le dernier grand silo non connecté (répertoire ↔ parties réelles).

## §2 Scope
**IN** : core pur `findDeviation` — lignes de ta couleur, **ligne la plus profonde** en jeu (plancher 2 plis appariés contre le spam « 1. e4 matche tout »), première divergence, distinction honnête **byPlayer** (tu as quitté ta ligne → « revoir la carte ») vs adversaire sorti (→ « étendre la ligne », une opportunité pas une faute) ; panneau dans AnalysisResult avec saut dans le replay (PR-08) + route répertoire ; null quand la ligne entière est suivie (succès = silence) ou partie finie dedans.
**OUT** : deep-link vers LA carte dans la vue Répertoire (pas d'état de sélection existant — §11) ; création auto d'extension ; drill immédiat.

## §4-6 — livré
`repertoire/deviation.ts` + tests (5 : joueur dévie, adversaire dévie, plus-profonde préférée, 3 cas null, couleur filtrée). `AnalysisResult.svelte` (chargement best-effort + panneau 2 cas + jump replay). i18n 4 clés. **1030 verts** (1025 + 5), svelte-check **0/0** (463 fichiers), build vert. Gate vague 4 : une partie analysée avec déviation produit **exactement une** proposition (ligne la plus profonde unique).

## §9 Anti-patterns
**AP-DEV-1** : flag sur un appariement trivial (1 pli) → plancher MIN_MATCHED_PLIES. **AP-DEV-2** : traiter la sortie ADVERSE comme une faute du joueur → byPlayer explicite, wording distinct. **AP-DEV-3** : bruit quand la ligne est suivie → null (le succès se tait).

## §10 Rollback
Revert ; zéro schéma.
