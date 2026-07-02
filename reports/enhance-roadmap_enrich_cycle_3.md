# Enrich cycle 3 — FORCÉ (interactions FOLD↔FOLD + cohérence) — enhance-roadmap

Date : 2026-07-02 · Déclencheur : demande utilisateur explicite (« 3 cycles ») = `--force-cycle-3` ; le déclencheur organique (re-classification ≥1) était absent · **Set FOLD : 10 → 10 (aucun nouveau FOLD produit ✓ — AP-ENRICH-6 respecté)**

## Interactions FOLD↔FOLD examinées

| Paire | Interaction | Résolution |
|---|---|---|
| I4 ↔ I1 | L'accumulateur de temps (I4, PR-02) doit être **agnostique à la variante** pour que PR-20 en hérite (I1) sans adaptation | Une seule formulation couvre les deux : « accumulateur par coup, agnostique variante/cadence » — fold combiné dans PR-02 + renvoi dans PR-20 |
| I8 ↔ I3 | Le tableau d'avancement (I3) et les champs `programId?/day?` (I8) référencent tous deux PR-18 | Aucun conflit — cohérents |
| I2 ↔ §2 OUT | Exclure le cache Syzygy du backup ≠ le « droppper » (doctrine migrations additives intacte) | Formulation : « exclu car re-fetchable ; le wipe ADR-0013 le couvre déjà » |
| I9 ↔ PR-03 | La note « échelle interne » vaut-elle aussi pour le delta du débrief ? | **Non-extension délibérée** : le delta (mouvement relatif) ne prête pas à la mésinterprétation d'échelle ; la note reste scoped au GRAPHE (tendance longue). Étendre = bruit |
| I3 ↔ AP-ROADMAP-1 | Le tableau d'avancement doit tracer la **spec fille** par PR (colonne), sinon il ne prouve pas que AP-ROADMAP-1 est respecté | Colonne « spec fille » ajoutée à I3 |

## Vérifications de cohérence finales

- Aucun FOLD ne re-litige un arbitrage ratifiable (Q-A..Q-F) — les 10 sont orthogonaux aux 6 questions ✓
- Aucun FOLD ne touche un REJECT documenté du repo (ex. auto-reorder par efficacité, REJETÉ coach-program-v2 E1b — I10 reste descriptif, ne réordonne rien) ✓
- Aucun FOLD n'ajoute d'egress réseau, de grade, ou de bump non-store ✓

## Statut

Set FOLD final : **10** (I1-I10, contenus I6/I10 adoucis cycle 2, I3/I4 précisés cycle 3). Prêt pour ratification user-side. Aucun fold appliqué à la spec avant ratification (memory-20 : les décisions appartiennent à l'utilisateur).
