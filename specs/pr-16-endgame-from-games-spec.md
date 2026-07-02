# Spec fille — PR-16 `endgame-from-games` (roadmap enhance V1, vague 4)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-16 (F17).

## §0 Contexte
La faiblesse endgame routait vers un catalogue fixe (Lucena, Philidor…) ; jamais vers **la** finale que tu as ratée hier. Les bornes de phase + l'éval d'entrée (`bestWhiteCp`) + le résultat étaient tous stockés.

## §2 Scope + décisions
**IN** : `scenariosFromFailedEndgames` pur — position au **premier pli de finale DU joueur** (garanti à son trait — le contrat sparring), éval d'entrée POV joueur : ≥ +150 sans victoire = **conversion ratée** ; |cp| < 100 avec défaite = **tenue ratée** ; entre les deux bandes → aucun claim ; pas de résultat → skip ; plafond 6, plus récentes d'abord ; source tierce dans le picker Sparring (avant la bibliothèque), noms/objectifs datés FR/EN.
**Déviation documentée** : le « feedback Syzygy » de la ligne roadmap ne s'applique pas ici — les entrées de finale réelles dépassent presque toujours 7 pièces et le sparring est un play-out vs bot, pas une notation coup-à-coup ; le drill Syzygy reste le trainer Endgames (§11 : proposer la table quand ≤7 pièces).
**OUT** : notation Syzygy en sparring ; extraction multi-positions par partie (une entrée = un drill).

## §4-6 — livré
`analysis/scenarios.ts` (+extracteur + seuils exportés), `Sparring.svelte` (3ᵉ source best-effort), `generators.ts` (4 clés gt). Tests (+3) : convert/hold/entre-bandes/sans-résultat, POV Noirs, plafond + tri récence. **1036 verts** (1033 + 3), svelte-check **0/0** (465 fichiers), build vert. Gate vague 4 : une finale ratée devient un drill jouable en 1 clic — le scénario arrive en tête du picker Sparring.

## §9 Anti-patterns
**AP-ENDG-1** : claim entre les bandes (+100..+150 : ni gagnant ni égal) → silence. **AP-ENDG-2** : position au trait adverse (le sparring ne kick pas le bot au départ) → premier pli DU joueur. **AP-ENDG-3** : sans résultat stocké → pas de scénario.

## §10 Rollback
Revert ; zéro schéma.
