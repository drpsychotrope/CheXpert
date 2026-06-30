# Améliorations: i18n-label-routing (F1)

/ enrich constructif sur la spec V1 (display-only i18n). Discipline anti-complaisance : axe vide = CLEAN.

## Cycles
- **Cycle 1 sweep** : 4 candidats FOLD provisoires (A1, A3, A4, A5+A6) ; A2/A7/A8 CLEAN.
- **Cycle 2 élagage** : 1 re-classé (I1 raffiné — sweep FOLD, fix de sites non-triviaux DEFER) ; set FOLD 4 → 4 (raffiné, pas grossi). Aucun nouveau FOLD (sain).
- **Cycle 3 RAN** (déclenché : ≥1 reclassification cycle 2) : check interactions FOLD↔FOLD — I4(helper) ⊃ I1(sweep consomme) ⊃ I3(test garde le helper) cohérents, se renforcent. Set FOLD stable à 4. Ship.

## Sweep axes (A1-A8)
| Axe | Finding | Verdict | Raison / précédent repo |
|---|---|---|---|
| A1 Capability | Le PR corrige 3 sites repérés ; d'autres surfaces peuvent fuir pareil (Review, Dashboard, noms de scénarios) | **FOLD** (sweep) | pré-flight grep exhaustif = même concern ("zéro clé brute") ; précédent audit-v2-W18 french-ui (sweep complet) |
| A2 Observabilité | Warning dev quand un label retombe en raw | CLEAN | parity test garde déjà les unions fermées ; fallback open-theme intentionnel — pas de fabrication |
| A3 Fidélité rendu | Les labels FR doivent être le vocabulaire d'échecs FR STANDARD, cohérent avec motif.* existant | **FOLD** | "fourchette/clouage/enfilade", pas du littéral ; cohérence de registre (motif.* FR déjà shippé, ADR-0053) |
| A4 Robustesse | Test de parité doit itérer l'UNION réelle `PlanItem.activity`, pas une liste figée | **FOLD** | une future valeur d'union sans label = nouvelle fuite ; précédent "exhaustiveness gate" (coach-mode-spec §3) |
| A5 Réutilisation | Un seul `labelOrRaw(ns,key,locale)` dans gen.ts (frère de `motifLabelOrRaw`), consommé par Coach + Insights | **FOLD** | 2 consommateurs MAINTENANT → DRY ; CONSOMME le pattern motifLabelOrRaw au lieu d'inline par composant |
| A6 Extensibilité | idem A5 : le helper générique sert les PRs suivants (F2 a11y, noms de scénarios P-stack) | **FOLD** (=I4) | additif, cheap, étape suivante évidente — promeut le §11 follow-up en in-scope |
| A7 Symétrie | dimension labels (dim.*/dimShort.*) déjà traduits ; FR+EN gated | CLEAN | symétrie déjà couverte (radar) + parité déjà exigée |
| A8 Cadrage honnête | "bilingue mais fuit l'anglais" — déjà cadré par AC "aucune clé brute, deux locales" | CLEAN | pas de métrique/edge ; honnêteté déjà dans §8 |

## FOLD — à intégrer (ratification user)

### I1 (A1) — Sweep systématique, pas du whack-a-mole
- **Gates** : G-scope PASS (même concern), G-cost PASS (grep cheap), G-additif PASS.
- **Ajoute** : pré-flight §3 = grep tous les composants pour rendu d'enum brut (`.themes`/`.activity`/`.focus`/`.dimension` interpolé sans resolver). Sites triviaux (même namespace) → FOLD dans ce PR ; sites non-triviaux (nouveau namespace/logique) → **DEFER** liste en §11. Ferme la CLASSE, pas 3 instances.

### I2 (A3) — Fidélité terminologique FR
- **Gates** : G-cost PASS (note + réutilise FR existant), G-scope PASS.
- **Ajoute** : §8 note — labels FR = vocabulaire d'échecs FR standard, registre cohérent avec motif.* ; réutiliser le FR existant là où overlap. Anti-pattern AP-I18N-6 (traduction littérale qui induit en erreur).

### I3 (A4) — Test label union-exhaustif
- **Gates** : G-additif/G-cost PASS.
- **Ajoute** : §5 — le test parité itère l'union `PlanItem.activity` RÉELLE ; ajouter une valeur d'union sans label FR+EN fait échouer le test (future-proof contre la croissance de l'union).

### I4 (A5+A6) — Un helper `labelOrRaw`
- **Gates** : G-scope PASS (label routing), G-cost PASS (3 lignes, cap anti-gold-plating).
- **Ajoute** : §4 — `labelOrRaw(namespace, key, locale)` dans gen.ts (frère de motifLabelOrRaw), consommé par Coach + Insights ; dispo pour F2+. Promeut le §11 follow-up. **Garde-fou AP-ENRICH-7** : pas de système de plugin spéculatif, juste le helper.

## DEFER — bonnes idées, autre PR
- Fixer des sites non-triviaux découverts par le sweep I1 (s'ils exigent un nouveau namespace) → §11 follow-up listé, pas foldé (G-scope).
- Warning dev sur fallback raw (A2) → micro-DX, pas notable maintenant.

## REJECT — écartées
- Normaliser `focus` en namespace de clés dans program.ts → REJECT (AP-I18N-3 / AP-ENRICH-1 : behavior change autre module).
- Vocabulaire Lichess complet → déjà DEFER côté /draft (Q-B), pas re-litigé.

## Verdict
- Axes balayés : 8/8 · Cycles : 3 · Set FOLD stable (4, raffiné jamais grossi → sain).
- **FOLD : 4 · DEFER : 2 · REJECT : 2 · CLEAN : 3.**
- Résultat : 4 enrichissements cheap qui font passer F1 de "patch 3 spots" à "ferme la classe de fuite proprement" — approprié pour un PR FONDATION (son rôle = établir le pattern).

## Next steps
1. Ratifie le set FOLD (I1, I2, I3, I4).
2. Je fold dans specs/i18n-label-routing-spec.md (édits chirurgicaux §3/§4/§5/§8/§9/§11).
3. Build Phase A→Z.
