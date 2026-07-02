# Améliorations : enhance-roadmap

## Cycles
- Cycle 1 sweep : 12 candidats (10 FOLD provisoires / 0 DEFER / 0 REJECT / 2 CLEAN)
- Cycle 2 élagage : 0 re-classé, 2 adoucis (I6 guidance-pas-contrainte, I10 label-pas-délai) — set FOLD 10 → 10
- Cycle 3 : **RUN (forcé par demande utilisateur)** — 5 interactions résolues, 0 nouveau FOLD ✓

## Sweep axes (A1-A8)
| Axe | Finding | Verdict | Raison |
|---|---|---|---|
| A1 | I1 héritage transverse PR-20 (%clk + replay 960) | FOLD | gap structurel certain, 1 ligne |
| A1 | I2 posture cache Syzygy dans PR-01 | FOLD | « tous les stores » imprécis — DB séparée vérifiée |
| A2 | I3 tableau d'avancement (PR · spec fille · statut · merge) | FOLD | roadmap multi-sessions sans état = fil perdu |
| A3 | — (couvert par I1 ; PR-04 déjà honnête) | CLEAN | pas de fabrication |
| A4 | I4 temps par timestamps au coup, pas rAF + clamp/flag | FOLD | précédent CE repo : audit v2, dialog coach gèle l'horloge rAF |
| A4 | I5 garde de version au restore (backup plus récent → refus propre) | FOLD | mode d'échec réel, garde cheap |
| A5 | I6 PR-09 réutilise la carte de récap de PR-03 (défaut) | FOLD (adouci) | évite le doublon ; divergence justifiable en spec fille |
| A5/A7 | I7 sons branchés aux couches partagées (Board/gameSession) | FOLD | symétrie tous-trainers gratuite |
| A6 | I8 `sessionLog` naît avec `programId?`/`day?` additifs | FOLD | PR-18 est dans le roadmap — pas spéculatif ; précédent pools ADR-0036 |
| A7 | — (PR-13 couvre déjà les deux côtés) | CLEAN | pas de fabrication |
| A8 | I9 note « échelle interne auto-référentielle » sur le graphe PR-04 | FOLD | artefact de lecture certain ; doctrine ADR-0009 |
| A8 | I10 label « mesure à chaud » sur re-probe précoce PR-12 | FOLD (adouci) | récence ≠ acquisition ; descriptif, jamais bloquant |

## FOLD — à intégrer (ratification user) — I1..I10 ci-dessus
Tous : gates PASS (re-vérifiés cycle 2), coût = 1-2 lignes de spec chacun, zéro egress/grade/bump non-store.

## DEFER — aucun nouveau (le §11 de la spec porte déjà la queue /enhance)

## REJECT — aucun (2 attaques d'élagage rejetées avec justification, cycle 2 : I3 scope-creep, I10 tuning)

## Verdict
- Axes balayés : 8/8 · Cycles : 3 (le 3ᵉ forcé)
- FOLD : **10** · DEFER : 0 · REJECT : 0 · CLEAN : 2

## Next steps
1. Ratifier I1..I10 (« I1 : ok, … » ou en bloc)
2. Le drafter fold les ratifiés dans `specs/enhance-roadmap-spec.md` (édits chirurgicaux : lignes PR-01/02/04/05/09/12/20, §4 tableau, §8)
3. Répondre aussi aux arbitrages /draft Q-A..Q-F (`reports/enhance-roadmap_arbitrages.md`)
4. Build : specs filles `/draft` par PR, en commençant par PR-01 (débloquée d'office)

---

## RATIFICATION — 2026-07-02
**I1..I10 ratifiés en bloc.** Foldés dans la spec : I2+I5 → PR-01 · I4 → PR-02 · I9 → PR-04 · I7 → PR-05 · I6+I8 → PR-09 · I10 → PR-12 · I1 → PR-20 (+ arêtes héritées PR-02/PR-08) · I3 → tableau d'avancement (§4). Arbitrages Q-A..Q-F actés au même moment (Q-C=b → split PR-19a/19b).
