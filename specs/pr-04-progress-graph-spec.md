# Spec fille — PR-04 `progress-graph` (roadmap enhance V1, vague 1)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-04 (F1, I9). Dépend : PR-02 (livré).

## §0 Contexte
Promesse ligne 1 du README : « make you stronger per hour ». Aucune courbe « tu deviens plus fort » nulle part — seuls des sparklines de dimensions sur fenêtres de 5 parties. Les données existent : snapshots PR-02 (parties) + `puzzleAttempts.ratingBefore/After` (persistés depuis toujours, vérifié `db.ts:53-54`).

## §2 Scope
**IN** : section « Classement dans le temps » dans Insights — courbe de partie par pool (chips quand >1 pool a ≥2 points), courbe problèmes (dernier point par jour local, probes coach exclues), ±RD au dernier point, note d'échelle interne (I9), points visibles sur séries clairsemées (pas de mensonge de continuité).
**OUT** : lissage/régression ; corrélations ; per-pool history complet ADR-0036 au-delà de ces courbes.

## §4 Phase A — livré
- `src/analysis/progress.ts` (NEUF, pur) : `poolOfGame` (960→chess960, catégorie→pool, untimed/legacy→classical), `gameRatingSeries` (parties à snapshot uniquement, triées), `availablePools` (≥2 points), `puzzleRatingSeries` (bucket jour local via `localDayKey` réutilisé, `coachProbe` exclu — AP-COACH-8), `toPolyline` (géométrie 100×100 testable, élargissement des séries plates).
- `src/ui/ProgressChart.svelte` (NEUF) : polyline + points réels (≤60), min/max, dernier rating ±RD, n.
- `db.ts` + `Play.svelte` : champ additif **`ratingRdAfter`** stampé au fold (déviation assumée : le RD n'était pas dans PR-02 ; ajouté ici car la bande d'incertitude est le consommateur — documenté ADR-0062).
- `Insights.svelte` : section avant la progression par dimension ; gate d'état vide élargi (un joueur avec parties comptées mais zéro analyse voit ses courbes).

## §5-6 Tests + gates — livré
`progress.test.ts` (6) : mapping pool (dont legacy), série filtrée/triée/rd, pools disponibles, bucket-jour + exclusion probes, géométrie (min bas / max haut), élargissement série plate. **990 verts** (984 + 6), svelte-check **0/0** (446 fichiers). Gate vague 1 : ≥2 points après 2 parties comptées — `gameRatingSeries` ne lit que les snapshots, posés par le fold uniquement (AP-TELEM-3).

## §9 Anti-patterns
**AP-PROGRESS-1** : tracer les parties non comptées (elles n'ont pas bougé le rating) → filtre `ratingAfter != null`. **AP-PROGRESS-2** : ligne continue sur série clairsemée sans points → dots ≤60 points. **AP-PROGRESS-3** : laisser lire l'échelle comme FIDE → note I9 obligatoire sous les courbes.

## §10 Rollback
Revert ; `ratingRdAfter` additif relu `?? undefined`.
