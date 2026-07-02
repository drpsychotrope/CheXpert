# Spec fille — PR-10 `insights-actionable` (roadmap enhance V1, vague 3)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-10 (F14 + F18, cluster acté Q-B=a).

## §0 Contexte
Les leaks routaient vers les trainers mais jamais vers la carte-concept du motif ni vers un sparring ; le readout d'efficacité était un constat sans bouton ; le radar cachait `detail` (chaîne calculée, jamais rendue) et les `n` par motif du coach (stockés, invisibles) — un diagnostic mince se lisait comme une certitude.

## §2 Scope
**IN** (zéro logique neuve, câblage pur) : leak → « Apprendre le pattern » (**gated sur l'existence réelle de la carte** — pas de lien mort) ; leak → « Sparring ciblé » **uniquement** pour les leaks à cible finale (`leakTarget==='endgames'` → scénario rook-up ; le mapping motif tactique→IQP serait sémantiquement faux — routage honnête) ; ligne d'efficacité → « Re-driller ce motif » ; radar : tooltip natif SVG `<title>` avec `detail` + `n=X` par axe (n/a → « pas encore mesuré ») ; Coach : ligne « Échantillons par motif » sous les deux radars (profil sauvé + résultat frais).
**OUT** : nouvelle mesure, réordonnancement auto (REJECT coach-program-v2 E1b respecté), cartes pour dimensions (pas de contenu).

## §4 Phase A — livré
`Insights.svelte` (loadConcepts(locale) + 3 fonctions de lien + gating), `Radar.svelte` (`<title>` sur label + dot), `Coach.svelte` (lignes échantillons ×2 via `motifLabelOrRaw`), i18n 5 clés. Hooks consommés tels quels : `conceptFocusMotif`/`sparringScenarioId` (app.svelte.ts:52-77), `scenarioForFocus` (program.ts:19), `cardForThemes`, champs `DimensionScore.detail`/`MotifScore.n` (stockés depuis C1/C3).

## §5-6 Vérification — livré
Câblage pur sans core nouveau → pas de tests unitaires dédiés (les hooks sont déjà testés) ; gate = typage strict + **1016 verts** inchangés + svelte-check **0/0** (457 fichiers) + build vert + smoke preview (boot Insights propre, 0 erreur console). Gate vague 3 (part Insights) : chaque leak expose ≥1 action supplémentaire quand elle est honnêtement routable.

## §9 Anti-patterns
**AP-ACT-1** : lien mort (carte absente) → gating sur `cardForThemes`. **AP-ACT-2** : sparring sémantiquement faux (fork→IQP) → cible finales uniquement. **AP-ACT-3** : tooltip fabriqué sur axe n/a → « pas encore mesuré ».

## §10 Rollback
Revert ; zéro schéma, zéro core.
