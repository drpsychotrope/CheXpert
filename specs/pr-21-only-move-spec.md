# Spec fille — PR-21 `only-move` (roadmap enhance V1, vague 5)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-21 (F24, **Q-E=c acté**). Dépend : PR-08 (livré). Lève le DEFER critical-moment §11.

## §0 Contexte
`BatchAnalyzer` est single-PV (vérifié au scan) : « il n'y avait qu'un coup » n'était jamais mesurable. Q-E arbitré en (c) : re-passe MultiPV **ciblée** sur les seuls coups déjà classés mistake/blunder — budget d'analyse intact sur une partie propre.

## §2 Scope
**IN** : `analysis/onlyMove.ts` pur (`onlyMoveGap` POV-mover, seuil `ONLY_MOVE_GAP_CP=120`, `isOnlyMove` — donnée absente → false, jamais de claim, `onlyMoveTargets` = plies joueur mistake/blunder) ; re-passe dans `runAnalysis` post-classification, pré-puzzles, best-effort par pli (échec → champ absent, « absent beats wrong »), 960 couvert via `engineFenBefore` sous le même finally ; champ additif `PlyAnalysis.secondBestCp` (White POV) ; consommateurs : badge « seul coup » dans le détail du replay (PR-08) + ligne mesurée au reveal de WhenToThink (`DrillItem.ply` porte le PlyAnalysis complet).
**OUT (§11)** : tag `onlyMove` sur les puzzles générés (ouvrirait generatePuzzles — consommateur suivant) ; re-analyse rétroactive des anciennes analyses (elles restent sans claim, honnête).

## §4-6 — livré
`onlyMove.ts` + tests (3 : gap POV deux couleurs, seuil + absent→false, cibles joueur-seulement). `types.ts` (+secondBestCp), `runAnalysis` (re-passe ciblée), `AnnotatedReplay` (badge), `WhenToThink` (ligne), i18n 2 clés. **1049 verts** (1046 + 3), svelte-check **0/0** (471 fichiers), build vert.

## §9 Anti-patterns
**AP-OM-1** : claim sans mesure (analyses pré-PR-21) → absent = false. **AP-OM-2** : MultiPV permanent (coût ×2 pour rien) → cibles Q-E=c seules. **AP-OM-3** : gap White-POV brut pour les Noirs → POV mover testé.

## §10 Rollback
Revert ; champ additif.
