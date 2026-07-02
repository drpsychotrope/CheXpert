# Spec fille — PR-12 `coach-probes-v3` (roadmap enhance V1, vague 3)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-12 (F9, Q-D=a, I10).

## §0 Contexte + correction de baseline
`IMBALANCE_LIBRARY` comptait **5** scénarios curatés (la baseline « 7 » comptait le template weakness — corrigée ici) ; le coach n'en sondait que 2. La re-probe d'un motif après drill = DEFER explicite (coach-program-v2 D2). Aucune garde contre une mesure « à chaud » (récence ≠ acquisition).

## §2 Scope + décisions
**IN** : (a) **+8 scénarios authorés** (5→13, Q-D=a) : bon cavalier/mauvais fou, dame vs 2 tours, majorité extérieure, qualité d'avance, fous opposés-attaque, avantage d'espace, 2 mineures vs tour, attaque de minorité — FR+EN, chaque FEN validé par le test auto-itérant (légalité + trait = camp entraîné) ; Sparring les liste automatiquement (bibliothèque-driven). (b) **Re-probe ciblé** (lève D2) : bouton « ↻ Re-vérifier {motif} » sur la carte profil pour chaque motif FAIBLE (delta<0) → `singleMotifPlan(theme)` via le wizard, puis **fusion chirurgicale** : seul ce `MotifScore` bouge (baseline = celle du profil pour garder les deltas comparables), l'ancien profil complet devient `coachProfilePrev` (la tendance montre ancien→nouveau pour CE motif) ; dimensions/`assessedAt`/libellés forces-faiblesses **délibérément intouchés** (rafraîchis à la prochaine évaluation complète — dit dans l'UI). Garde anti-resume : `saveAssessment` no-op pendant une re-probe (un run mono-motif parké ne doit jamais commiter en profil complet). (c) **I10** : `isHotMeasure` pur (attempts non-probe du motif < 6 h) → label descriptif « mesure à chaud », jamais bloquant.
**Placement assumé** (déviation documentée vs la ligne roadmap « depuis l'efficacité ») : le bouton vit sur la **carte profil** — le moment réel du besoin (revenir après avoir drillé) ; les lignes d'efficacité du résultat restent descriptives.
**OUT** : nouvelles probes de dimension coach (C3 en a 2, suffisant) ; re-probe multi-motifs ; auto-re-probe (resterait un choix utilisateur).

## §4-6 — livré
`analysis/scenarios.ts` (+8, validés premier coup), `coach/probePlan.ts` (`singleMotifPlan`), `coach/hotMeasure.ts` + tests (3 : fenêtre/thème/probe-exclue + shape du plan), `ui/Coach.svelte` (startReprobe/commitReprobe/afterLadders branch/garde saveAssessment/chips UI/notes), i18n 4 clés. **1025 verts** (1022 + 3), svelte-check **0/0** (461 fichiers), build vert.

## §9 Anti-patterns
**AP-PROBE-1** : re-probe qui REMPLACE le profil → fusion mono-motif uniquement. **AP-PROBE-2** : baselines mélangées (deltas incomparables) → baseline du profil conservée. **AP-PROBE-3** : run scoped parké repris en full → garde saveAssessment. **AP-PROBE-4** : FEN non testé dans la bibliothèque → test auto-itérant obligatoire. **AP-PROBE-5** : « à chaud » qui bloque → label descriptif seul.

## §10 Rollback
Revert ; zéro schéma (profil fusionné reste valide — mêmes shapes).
