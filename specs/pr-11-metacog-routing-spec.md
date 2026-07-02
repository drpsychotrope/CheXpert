# Spec fille — PR-11 `metacog-routing` (roadmap enhance V1, vague 3)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-11 (F8).

## §0 Contexte
Confiance, self-tags et impulsivité : collectés, calculés, affichés — puis rien. « Tu tagges "précipité" sur 42 % de tes ratés » ne proposait jamais les tactiques chronométrées qui existent à un clic.

## §2 Scope + doctrine
**IN** : `metacog/nudges.ts` pur — **AU PLUS UN** nudge (gate vague 3 : jamais empilés), priorité au plus actionnable : cause dominante (≥30 %) `rushed` → tactiques chronométrées ; `unfamiliar-pattern` → bibliothèque de concepts ; sinon verdict `overconfident` → phrase d'habitude **sans bouton** (aucune route honnête n'existe — le dire vaut mieux qu'en inventer une). Sous le plancher de calibration (readout null) → rien d'asserté. UI : une boîte sous la calibration, disclaimer explicite (« jamais une note, rien ne change sans votre clic »).
**Doctrine** : AP-META-1 intact (suggestion, pas de grade) ; le REJECT C5 (pas de biais de mesure) intact — le nudge route l'ENTRAÎNEMENT, jamais la mesure ; une cause sans route (`miscalculated`, `wrong-plan`…) ne fabrique pas de nudge.
**OUT** : auto-activation d'un mode ; nudge multiple ; seuils nouveaux (réutilise le readout existant + un seul plancher de dominance).

## §4-6 — livré
`metacog/nudges.ts` + `nudges.test.ts` (6 : plancher-calibration null-safe, rushed/unfamiliar dominants, plancher de dominance, cause sans route → fallthrough verdict, jamais-empilés). `Insights.svelte` (boîte + `nudgeTimedTactics`). i18n 6 clés. **1022 verts** (1016 + 6), svelte-check **0/0** (459 fichiers), build vert.

## §9 Anti-patterns
**AP-NUDGE-1** : empiler les nudges → un seul, priorité fixe testée. **AP-NUDGE-2** : nudger sous le plancher → readout null = silence. **AP-NUDGE-3** : inventer une route pour la surconfiance → phrase d'habitude, pas de bouton.

## §10 Rollback
Revert ; zéro schéma.
