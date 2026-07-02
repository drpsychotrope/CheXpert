# Enrich cycle 2 — élagage adversarial des gates — enhance-roadmap

Date : 2026-07-02 · Set FOLD entrant : 10 · **Set sortant : 10 (stable — 0 dégradé, 2 adoucis)** · Le set n'a PAS grossi ✓

## Attaque par les gates (§3), finding par finding

| # | G-scope | G-causal* | G-report-all* | G-additif | G-cost | G-empirical | Verdict |
|---|---|---|---|---|---|---|---|
| I1 | cohérence inter-PR = concern du roadmap | n/a | n/a | oui | 1 ligne | gap structurel certain (PR-20 drafté sans, il re-shippe le trou) | **FOLD** |
| I2 | définition de PR-01 | n/a | n/a | oui | 1 ligne | DB séparée vérifiée (README, ADR-0012) | **FOLD** |
| I3 | méta-process — attaqué comme scope-creep : REJETÉ l'attaque, un roadmap 23 PRs multi-sessions SANS état d'exécution perd son fil (le portfolio #33 = 21 PRs a eu ce besoin) | n/a | n/a | oui | table simple | précédent portfolio | **FOLD** (tier faible assumé) |
| I4 | contenu PR-02 | n/a | n/a | oui | garde cheap | **fort** : gel rAF documenté par l'audit v2 de CE repo | **FOLD** |
| I5 | contenu PR-01 | n/a | n/a | oui | garde cheap | mode d'échec réel (backup v6 → app v5) | **FOLD** |
| I6 | attaqué : couplage prématuré entre specs filles ? → **adouci** : « défaut = réutiliser, divergence justifiable en spec fille » — guidance, pas contrainte | n/a | n/a | oui | 1 ligne | risque doublon réel (2 cartes de récap) | **FOLD** (adouci) |
| I7 | placement A5 classique | n/a | n/a | oui | 1 ligne | 33 composants, sites partagés existants | **FOLD** |
| I8 | schéma PR-09 | n/a | n/a | **oui — champs optionnels** | 2 champs | PR-18 est DANS le roadmap (pas un futur spéculatif — AP-ENRICH-7 écarté) | **FOLD** |
| I9 | doctrine honnêteté = concern transverse §8.3 | équiv. : pas de claim au-delà de la mesure ✓ | descriptif pur | oui | 1 note | artefact de lecture certain (échelle fermée à 2 joueurs) | **FOLD** |
| I10 | attaqué : « délai minimal » = bouton de tuning déguisé ? → **adouci** : LABEL descriptif uniquement (« mesure à chaud »), jamais un blocage ni un délai imposé — G-report-all-équivalent respecté (AP-META-1/AP-COACH-2 famille) | ✓ | **descriptif, pas sélecteur** ✓ | oui | 1 label | contamination par récence = réelle en SRS (doctrine FSRS du repo) | **FOLD** (adouci) |

\* G-causal / G-report-all traduits pour CE repo : honnêteté (pas de grade, pas de claim causal, descriptif ≠ sélecteur), local-only, mesure non contaminée par l'affichage (AP-COACH-2).

## Résultat

- Re-classifications FOLD→DEFER/REJECT : **0** · Adoucissements de contenu : 2 (I6, I10)
- Fabrication suspecte (set qui grossit) : non — 10→10
- Règle d'arrêt du skill : set stable → cycle 3 SKIP par défaut ; **RUN forcé** (demande utilisateur explicite « 3 cycles » = `--force-cycle-3`)
