# Spec fille — PR-14 `guess-own-games` (roadmap enhance V1, vague 4)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-14 (F13).

## §0 Contexte
Guess-the-Move = 3 parties de maîtres hard-codées, déconnecté de tout. Le driver (`GuessGame(pgn, guessColor)`) acceptait déjà n'importe quel PGN — un trainer entier devenait personnalisable pour un provider de données.

## §2 Scope
**IN** : picker « Vos parties analysées » (10 dernières standard analysées, plus récentes d'abord) au-dessus des classiques ; `startOwn(rec, analysis)` réutilise le driver tel quel (couleur = `playerColor` persistée F5) ; **enrichissement par l'analyse stockée** : quand le coup deviné/révélé était classé inaccuracy/mistake/blunder, le feedback le dit + montre le « mieux » de `explainPly` — tu redécouvres tes propres erreurs en les redevinant ; `side()` lit désormais le driver (source-agnostique).
**OUT** : guess sur parties importées (960/couleur legacy edge-cases — §11) ; scoring séparé/rating ; comparaison à `bestUci` comme critère de « correct » (le driver reste exact-match honnête, ADR-0017 — l'analyse ENRICHIT, ne re-note pas).

## §4-6 — livré
`GuessMove.svelte` (chargement best-effort, deux sections picker, header conditionnel, notes de sévérité aux deux chemins correct/révélé), i18n 7 clés. Driver intact (zéro edit dans guess.ts — provider pur). **1030 verts** inchangés (aucun core nouveau — le driver était déjà testé), svelte-check **0/0** (463 fichiers), build vert. Gate vague 4 : guess perso tourne sur ≥1 partie analysée — chemin gated sur `analyzedIds` + analysis non-null.

## §9 Anti-patterns
**AP-GUESS-1** : re-noter la « justesse » via bestUci (changerait le contrat exact-match ADR-0017) → l'analyse n'est qu'un commentaire. **AP-GUESS-2** : casser le chemin maîtres quand le storage échoue → best-effort, ownGames=[].

## §10 Rollback
Revert ; zéro schéma, driver intact.
