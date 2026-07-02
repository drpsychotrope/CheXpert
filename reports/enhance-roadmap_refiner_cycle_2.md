# Refiner cycle 2 — enhance-roadmap (polish + cross-axis)

Date : 2026-07-02 · Spec auditée : V0.1 (post-patchs cycle 1) · Verdict : **0 critique, 6 polish (tous appliqués)** → évaluateur de skip cycle 3 : **SKIP**

## Axes contrôlés

| Axe | Résultat |
|---|---|
| Cohérence inter-sections | 2 accrocs trouvés/corrigés (P1, P2) |
| Cross-références (§4 gates ↔ §6, findings ↔ PRs, dépendances ↔ récap) | mapping 25→23 re-vérifié, arêtes acycliques, gates présents pour les 6 vagues |
| Gates mesurables | 1 chiffre inventé restant trouvé/corrigé (P3) |
| Reproductibilité exécuteur frais | OK moyennant P5 (note « PR-01 débloquée d'office » → portée au bundle d'arbitrages) |

## Polish appliqués

1. **P1** §3(6)↔§8(6) : tension vague-vs-dépendance → règle unifiée : « gate dur = arêtes de dépendance ; vagues = tri par levier recommandé ».
2. **P2** §10 « aucun couplage intra-vague » contredit PR-06→PR-07 (même vague V2) → exception nommée, ordre de merge imposé.
3. **P3** Gate V3 « re-probe <2 min » = chiffre non mesuré → « budget mesuré en spec fille » (même classe que N4 du cycle 1).
4. **P4** AP-ROADMAP-2 « Play.svelte 1200+ lignes » → **vérifié** : 1260 lignes (`wc -l`). Chiffre exact confirmé, pas de patch.
5. **P5** Ordre d'exécution sous arbitrages ouverts : PR-01 est la seule PR sans question bloquante → noté au bundle d'arbitrages (« exécutable dès maintenant »).
6. **P6** §5 round-trips : ajout du round-trip snapshot rating (comptée→point ; unrated→aucun).

## Évaluateur de skip cycle 3

```
skip_cycle_3 = (critiques_cycle_2 == 0) AND (polish_cycle_2 <= 8)
             = (0 == 0) AND (6 <= 8)  → SKIP
```

Rendements décroissants confirmés : cycle 1 = 1 critique + 8 polish ; cycle 2 = 0 critique + 6 polish, tous mineurs (formulations, un chiffre, une exception). Le résiduel est du wording sans risque d'exécution. V0.2 promue **V1**.
