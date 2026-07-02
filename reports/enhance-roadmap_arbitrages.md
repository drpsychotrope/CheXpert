# Arbitrages : enhance-roadmap

## Défauts structurels critiques (arrêts cycle 1)
Aucun nécessitant escalade. (Le seul critique — contradiction §8.2 ↔ store `sessionLog` — était résoluble par la doctrine écrite du projet : bump v5 réservé à la création de store, pattern v1→v4. Patché cycle 1.)

## Décisions demandées

### Q-A : PR-02 — bundle des deux capteurs de télémétrie
**Options**
- (a) **Bundle** : horloge/pli + snapshot rating dans une PR « télémétrie qui s'évapore » — un concern conceptuel, deux petits diffs sur les mêmes fichiers (`gameSession`, fold de fin de partie).
- (b) Split en deux PRs S.
**Recommandation refiner** : (a) — les deux touchent le même point de couture (fin de partie), le split doublerait le harnais de test pour ~40 lignes chacun.

### Q-B : PR-10 — cluster de wire-ups Insights + radar
**Options**
- (a) **Cluster** : 3 liens (leak→concept, leak→sparring, efficacité→re-drill) + badges honnêteté en une PR S (zéro logique neuve, précédent « cluster MINOR » du portfolio #33).
- (b) Split UI-liens / badges.
**Recommandation** : (a).

### Q-C : PR-19 — cartes interactives + SRS des cartes
**Options**
- (a) Bundle (deux DEFER du même ADR-0040 §11, même surface `ConceptCard`).
- (b) **Séquence** : interactif d'abord (S/M), SRS ensuite (S) — le SRS dépend du « jouable » pour grader une révision.
**Recommandation** : (b) — le SRS d'une carte non-jouable n'a pas de signal de grade propre.

### Q-D : PR-12 — budget contenu scénarios (correction : bibliothèque = 7, pas ~100)
Élargir les probes coach = **authorer des FEN** (7 → ~15), chacune testée légalité+solvabilité.
**Options**
- (a) **~8 nouveaux scénarios** (couvre IQP, roques opposés, paire de fous, finale de tours, qualité, forteresse) — L.
- (b) ~3 scénarios ciblés sur les 2 dimensions déjà probées — M.
**Recommandation** : (a) si le budget contenu passe, sinon (b) sans honte — le re-probe (l'autre moitié de la PR) porte l'essentiel du levier.

### Q-E : PR-21 — coût MultiPV pour `secondBestCp`
**Options**
- (a) MultiPV=2 permanent sur la passe batch — simple, ~coût ×1,5–2 sur les ~20 s/partie.
- (b) Passe séparée complète.
- (c) **MultiPV ciblé** : re-passe uniquement les coups déjà classés mistake/blunder (le badge « seul coup » ne concerne qu'eux).
**Recommandation** : (c) — coût marginal minimal, aucune régression du budget d'analyse.

### Q-F : PR-05 — techno son + défaut du toggle
**Options**
- (a) **WebAudio synthétisé, coups ON + célébrations ON par défaut**, tout coupable en un clic Settings.
- (b) WebAudio, tout OFF par défaut.
- (c) Échantillons CC0.
**Recommandation** : (a) — zéro asset, licence propre ; un trainer d'échecs muet paraît cassé ; le respect utilisateur = un kill-switch évident, pas un silence par défaut.

## Patchs auto-appliqués (sans arbitrage)
Cycle 1 : §8.2 réécrit (bump=création de store, v5 pour `sessionLog`) ; hooks vérifiés cités (`db.ts:53-54`, `eco.ts:23/43`) ; pre-flight live obligatoire PR-07 ; accumulateur par pli explicité PR-02 ; 2 chiffres inventés retirés des gates ; Q-E enrichi de l'option (c) ; Q-F étendu au défaut du toggle.
Cycle 2 : règle vague-vs-dépendance unifiée ; exception intra-vague PR-06→PR-07 nommée ; round-trip snapshot rating ajouté ; « Play.svelte 1200+ » vérifié = 1260.

## Statut d'arrêt
- Cycles : **2/3** (cycle 3 skippé : 0 critique, 6 polish ≤ 8 — `cycle_3_skipped.json`)
- Spec finale : [`specs/enhance-roadmap-spec.md`](../specs/enhance-roadmap-spec.md) (**V1**)
- **PR-01 (`data-backup`) est exécutable dès maintenant** — seule PR sans question bloquante ni dépendance.

## Prochaines étapes
1. Lire les 6 questions ci-dessus (≈3 min).
2. Répondre « Q-A : a, Q-B : a, … » (ou vos choix).
3. Le drafter applique les décisions en patch V1 final.
4. Exécution : chaque PR reçoit sa spec fille `/draft` avec scan frais (AP-ROADMAP-1).

---

## RATIFICATION — 2026-07-02
**Tout ratifié suivant les recommandations : Q-A=a · Q-B=a · Q-C=b · Q-D=a · Q-E=c · Q-F=a.** Décisions foldées dans `specs/enhance-roadmap-spec.md` (§0.5 acté, lignes PR-02/05/12/21 annotées, PR-19 scindée 19a→19b → **24 PRs**). Enrichissements I1..I10 ratifiés en même temps (cf. `_improvements.md`).
