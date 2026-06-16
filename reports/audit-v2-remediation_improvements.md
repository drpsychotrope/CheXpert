# Améliorations : audit-v2-remediation

> `/enrich` sur [`specs/audit-v2-remediation-spec.md`](../specs/audit-v2-remediation-spec.md). Jumeau constructif de `draft-general` : cherche ce qui MANQUE de notable à AJOUTER, sous discipline FOLD/DEFER/REJECT + anti-complaisance.
> Base empirique : le backlog de [`reports/audit-v2-2026-06-10.md`](audit-v2-2026-06-10.md) (143 constats). Gate « causal » adapté chess-trainer = **doctrine-safety** (pas de backend/télémétrie ADR-0002/0003 ; réactivité ADR-0050/0051 ; schéma additif).

## Cycles
- **Cycle 1 — sweep A1–A8** : 7 candidats FOLD provisoires, 3 DEFER (déjà actés), 1 REJECT documenté.
- **Cycle 2 — élagage adversarial des gates** : 7/7 FOLD re-vérifiés, **0 dégradé, 0 promu** → set FOLD **stable à 7**.
- **Cycle 3** : **SKIP** (set FOLD stable, aucune interaction FOLD↔FOLD non gérée). Invariant respecté : le set n'a pas grossi.

## Sweep axes (A1–A8)

| Axe | Finding | Verdict | Raison |
|---|---|---|---|
| A1 Capability | **P1-03 (`{#await}` sans `:catch` → écran blanc) n'est mappé à AUCUN workstream** | **FOLD** | Trou de couverture objectif : un 🟠 du backlog tombe entre les mailles (cf. §2 : W5–W12 sautent P1-03) |
| A1 Capability | **Aucun workstream ne ferme les reconcile docs (P1-15 coaching « avant » + L3 « 376 tests »)** | **FOLD** | Dérives d'honnêteté README sans foyer ; AP-9.7 « axe fermé auto-déclaré » |
| A2 Observabilité | — | CLEAN | DoD/§8 déjà mesurables ; aucune dimension descriptive cheap manquante (pas de fabrication) |
| A3 Fidélité | **DoD FR (§8) ne grep que `src/ui` → « FR fait » alors qu'`explain.ts`/`positional.ts`/`scenarios.ts` + JSON restent EN** | **FOLD** | Le plan W18 les liste, mais la *vérif* ne les couvre pas → faux « done » (mensonge de verdict) |
| A4 Robustesse | **W1 « 4 sites » rate la couture calibration ; préférer une force EXPLICITE par appel** | **FOLD** | Empirique : `Onboarding.svelte:141,150` (eval depth-10) tourne aussi après `applyStrength` → seed rating bridé ; l'audit recommandait déjà l'approche explicite |
| A5 Réutilisation | **Une SEULE primitive de dialogue accessible, consommée par ConfirmDialog (W14) + picker promo (L53) + take-back coach (W12)** | **FOLD** | Évite 2-3 focus-traps parallèles ; consolidation dans le scope existant |
| A6 Extensibilité | **Pas de table de suivi workstream→PR→preuve-DoD (comme §12 de la remédiation v1)** | **FOLD** (léger) | L'audit a justement détecté W12 coché ✅ à tort via la table v1 → le scaffold combat AP-9.7 |
| A7 Symétrie | **W12 remplace `confirm()` mais omet l'asymétrie d'horloge** (la délibération coach est facturée à l'adversaire car `press()` bascule l'horloge AVANT le prompt) | **FOLD** | Bug d'équité réel (H39/L6) que le libellé actuel de W12 (« ne gèle pas ») ne couvre pas |
| A8 Cadrage | README « 376 tests » → formulation **non-datée** (anti-re-drift) | FOLD *(dans le WS docs ci-dessus)* | Re-figer un chiffre re-dérivera ; intégré au reconcile docs (A1) |

## FOLD — à intégrer (ratification user)

### F1 — Mapper P1-03 (`{#await}` sans `:catch`) à un workstream *(A1)*
- **Gates** : G-scope ✅ (backlog item) · G-additif ✅ · G-cost ✅ (S) · G-empirical ✅ (vérifié H7/P1-03) · doctrine ✅
- **Ajout** : étendre **V2-W5** de « coutures moteur » à « coutures moteur **& résilience de la coquille** » et y inclure le `{:catch err}` sur `{#await viewLoader()}` ([`App.svelte:85`](../src/ui/App.svelte:85)) + (option) 404 réel pour `*.js/*.wasm` dans `server.cjs`. **Reco : FOLD.**

### F2 — Workstream docs-reconcile (V2-W19) *(A1 + A8)*
- **Gates** : tous ✅ · doctrine ✅ (docs-last, croyance #5)
- **Ajout** : nouveau **V2-W19** (docs, dernier) fermant **P1-15** (reformuler README + `Settings.svelte:54` : « signale une gaffe juste après le coup et propose un retour ») et **L3** (remplacer « 376 tests » ×2 par une formulation **non-datée**), + **ADR-0052** actant la décision « UI française » au moment du ship de W18. **Reco : FOLD.**

### F3 — Élargir la DoD FR au-delà de `src/ui` *(A3)*
- **Gates** : tous ✅ · cheap (édition de §8)
- **Ajout** : dans la DoD de **V2-W18** et la ligne « FR » de §8, le critère devient « 0 chaîne EN user-facing dans `src/ui` **ET** dans les générateurs TS (`explain.ts`, `positional.ts`, `scenarios.ts`, `coach/*`, `metacog.ts`) **ET** le contenu JSON (concepts/ECO/finales) ». Sinon le chantier « paraît fini » avec une analyse encore anglaise. **Reco : FOLD.**

### F4 — W1 : force d'analyse EXPLICITE par appel (pas « 4 sites ») *(A4)*
- **Gates** : tous ✅ · additif (param `opts` défaut) · doctrine ✅
- **Ajout** : reformuler **V2-W1** : au lieu d'ajouter `setFullStrength()` à 4 endroits (whack-a-mole), rendre la force **explicite par appel** d'`evaluate`/`analyzeLines` (un flag `fullStrength`/`elo?`), pour tuer toute la classe — **y compris la couture calibration** (`Onboarding` eval depth-10 après `applyStrength` → seed rating bridé, site que les 4 ratent). C'est le « Better » que l'audit recommandait. **Reco : FOLD.**

### F5 — Une seule primitive de dialogue accessible *(A5)*
- **Gates** : tous ✅ · réutilisation · doctrine ✅
- **Ajout** : séquencer **V2-W14** en premier pour livrer **un** composant `<Dialog>` accessible (natif `<dialog>`, focus-trap, Esc, thème, FR) ; **ConfirmDialog**, le **picker de promotion** (L53, qui manque focus-trap/Esc) et le **take-back coach** de **V2-W12** le **consomment** au lieu de trois overlays parallèles. Note de dépendance W14 → {W12, picker}. **Reco : FOLD.**

### F6 — W12 : corriger l'asymétrie d'horloge du coach *(A7)*
- **Gates** : tous ✅ · backlog L6 · doctrine ✅
- **Ajout** : la DoD de **V2-W12** inclut explicitement : le retour-coup coaché ne doit **ni geler l'horloge rAF ni facturer la délibération à l'adversaire** (ne pas presser l'horloge adverse avant la décision ; recréditer si retour). Aujourd'hui `press()` bascule avant le `confirm()`. **Reco : FOLD.**

### F7 — Table de suivi workstream→PR→preuve-DoD *(A6, léger)*
- **Gates** : G-cost limite mais défendable (le drift W12 de v1 a été pris *grâce* à la table v1) · tous autres ✅
- **Ajout** : un **§13 « Statut de livraison »** vide (workstream · PR · DoD vérifiée par quelle commande), à remplir au fil des merges — rend le « n/n livré » reproductible et combat AP-9.7. **Reco : FOLD (léger ; DEFER acceptable si tu préfères une spec lean).**

## DEFER — bonnes idées, autre PR / prématuré (déjà correctement actées dans la spec)
- **Thème clair** (`prefers-color-scheme`) — DEFER (dépend des tokens W17 ; déjà §11 + Q5). Confirmé DEFER, pas un manque.
- **Navigation flèches-sur-cases** complète — DEFER (W4 livre SAN/UCI d'abord ; §11 + Q6). Confirmé.
- **Opponent `pickHumanMove` en Comeback/Sparring** (L88) — DEFER (changement de comportement de drill, son propre PR). Confirmé §11.

## REJECT — écartées (documentées pour ne pas ressurgir)
- **Télémétrie/analytics pour « mesurer quels correctifs aident »** — REJECT : viole la doctrine local-only / no-telemetry (ADR-0002/0003, promesse README #1). La mesure d'efficacité reste manuelle/locale. (Personne ne l'a proposé ; documenté par prudence pour que l'idée ne ressurgisse pas sous couvert d'« observabilité ».)

## Verdict
- **Axes balayés : 8/8 · Cycles : 2** (cycle 3 SKIP, set FOLD stable).
- **FOLD : 7 · DEFER : 3 (confirmés) · REJECT : 1 · CLEAN : 1 (A2).**
- Les deux FOLD les plus importants (F1, F2) sont des **trous de couverture de la spec** : sans eux, la remédiation **laisserait tomber 2 constats majeurs** (P1-03, P1-15) — exactement le mode d'échec que l'audit a reproché à v1 (workstream coché ✅ à DoD non verte).

## Next steps
1. Lis F1–F7.
2. Ratifie (ex. « F1–F6 ok, F7 defer »).
3. Je folde les FOLD ratifiés dans la spec (édits chirurgicaux : §2 table, §6 plans, §8 vérif, +§13 si F7) et passe les DEFER en §11.
4. La spec est alors prête à exécuter (P0 d'abord).
