# Spec fille — PR-06 `bulk-import` (roadmap enhance V1, vague 2)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-06 (F4). Précède PR-07 (même vague, ordre imposé).

## §0 Contexte
Un PGN multi-parties était détecté mais seule la **première** était analysée (`Import.svelte:156-160`, audit v2 P1-10). Le nouvel utilisateur avec 200 parties Lichess démarrait avec un profil vide — la boucle personnalisée ne devenait réelle qu'à la partie ~20.

## §2 Scope
**IN** : split multi-parties → **choix explicite** (tout ou 1ʳᵉ — l'ancienne première-silencieuse disparaît) ; boucle séquentielle annulable entre parties (« Partie i/N » + barre par position) ; dédup par id contenu-adressé ; couleur inférée **par partie** (pseudo vs headers), indéterminable → **ignorée et comptée, jamais devinée** (audit C-3) ; upload fichier `.pgn` ; résumé honnête (analysées / ignorées-couleur / doublons / échecs / puzzles créés).
**OUT** : fetch réseau (PR-07) ; parallélisme (un seul worker moteur — AP-PLAYLOOP-2) ; gestion/suppression de l'historique importé (§11 roadmap).

## §4 Phase A — livré
- `src/analysis/bulkImport.ts` (NEUF) : `splitPgnGames` + `shortHash`/`importGameId` (extraits d'Import.svelte — une seule autorité d'id pour simple ET bulk) + `importBulk` orchestrateur **injectable** (seams parse/runAnalysis/getAnalysis/putImportedGame/now — testable sans moteur, pattern `analyzeBacklog`). Par partie : parse → plies vides = failed (L21) → couleur (refus de deviner) → dédup `getAnalysis` → persist → analyse → persist analyzed ; try/catch par partie (F-P1-4).
- `Import.svelte` : `analyze()` devient un détecteur ; `analyzeSingle` extrait ; `runBulk` + annulation ; input fichier ; panneaux progression + résumé ; le panneau résultat montre la dernière analyse du lot.

## §5-6 Tests + gates — livré
`bulkImport.test.ts` (8, tout par injection) : split (1/3/junk), id stable, 3 attribuables analysées + puzzles sommés, couleur indéterminable ignorée-comptée, dédup, un throw → failed + continue, annulation propre, couleur explicite honorée. **1002 verts** (994 + 8), svelte-check **0/0** (450 fichiers). Gate vague 2 (part bulk) : un PGN de N parties s'importe en une action, file annulable — porté par le test d'annulation + le flux UI.

## §9 Anti-patterns
**AP-BULK-1** : deviner la couleur d'une partie du lot → skip compté + message actionnable. **AP-BULK-2** : un échec avorte le lot → try/catch par partie. **AP-BULK-3** : première-analysée silencieuse → choix explicite. **AP-BULK-4** : deux formules d'id import → `importGameId` unique.

## §10 Rollback
Revert ; aucun schéma. Les imports déjà faits restent (données valides).
