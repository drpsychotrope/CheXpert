# Spec — V2-W18 · Chantier UI bilingue FR/EN (i18n + bascule de langue)

> Type : chantier i18n dédié — catalogue **bilingue** (fr+en) + helper `t()` réactif + **bascule de langue runtime** + migration par trafic + couche TS + contenu JSON par locale + politique SAN + tests.
> Programme parent : [`specs/audit-v2-remediation-spec.md`](audit-v2-remediation-spec.md) — rangée **V2-W18** (§2 l.54), DoD P2 i18n (§4 l.81), pré-flight (§5 item 5), enrichissement **F3** (§1 l.15), tracker §13.
> Constats sources : [`reports/audit-v2-2026-06-10.md`](../reports/audit-v2-2026-06-10.md) — volet **C5** (l.95), convergent (l.59), backlog **P2-06/07/08/09/14/18** + P3-42/43/94.
> Décision : [`decisions.md`](../decisions.md) → **ADR-0052** acte la *cible FR* (Q3) et *SAN anglaise* (Q4). **Demande user 2026-06-16 : ajouter une bascule FR↔EN** → ce chantier **supersède ADR-0052 Q3** (mono-locale → **bilingue runtime**) ; **ADR-0053** (à écrire au ship, Phase 6) actera la supersession (append-only + cross-link).
> Bundle `/enrich` foldé : [`reports/audit-v2-w18-french-ui_improvements.md`](../reports/audit-v2-w18-french-ui_improvements.md) (I1/I2/I3 + rider).
> Profil : chess-trainer · Svelte 5 (runes) · TS strict · Vite 6 · IndexedDB (idb) · Vitest+jsdom · npm. Drafté `draft-general` + enrichi `/enrich` le **2026-06-16** ; arbitrages **ratifiés en bloc** + switch FR/EN ajouté (forks N1/N2/N5 tranchés en recommandé).
> Statut : **V1 (raffinée, foldée)** — prête au build.

---

## 1. Contexte

L'UI 100 % anglaise était le constat UX le plus convergent de l'audit v2 (3 agents — rapport l.59) face à la cible FR actée (ADR-0052 Q3). Tous les autres workstreams (P0→P2 : W1–W17, W19) sont **livrés/mergés** (`main`, PRs #22–#29 ; `svelte-check` 0/0, `vitest` 488) ; **W18 est le dernier chantier substantiel** (avec W12-part2). Sorti du run continu car « trop large sans bâcler » → chantier dédié.

**Évolution de scope (2026-06-16).** La cible n'est plus « passer en français » (mono-locale) mais **rendre l'app bilingue FR/EN avec une bascule runtime, défaut FR**. Cela **supersède ADR-0052 Q3** (« catalogue mono-locale, pas de runtime i18n ») : un switch exige **les deux locales complètes** et une **locale courante réactive**. L'anglais existant n'est donc plus laissé inline — il est **capturé dans `en.ts`** au fil de la migration (≈ double des entrées catalogue, mais *capture* de l'existant, pas *rédaction*). La SAN reste anglaise dans **les deux** locales (notation, pas une langue).

L'enrichissement **F3** (spec parente) étend la DoD à trois surfaces hors `src/ui` : maps de libellés, générateurs de phrases TS, contenu JSON — toutes désormais **bilingues**.

Concern unique (croyance #4) : **internationaliser l'UI et son texte généré en FR+EN avec bascule, défaut FR, sans changer le comportement, le schéma DB, ni les clés de stockage/routage.** Hors périmètre : thème clair, refactor god-component, ESLint.

## 2. Scope

**Dans le périmètre :**

1. **Infra bilingue** — module `src/i18n/` : catalogues `fr.ts` + `en.ts` (mêmes clés), helper `t(key, params?)` **réactif à la locale courante**, helper de **pluriel** FR/EN, helpers de **format locale-aware** `formatPercent`/`formatNumber` (I3). **Sans lib runtime i18n** (catalogue maison — Q-W18-1a).
2. **État de locale + bascule** — `SettingsRecord.locale?: 'fr' | 'en'` **additif**, lu `?? 'fr'` (**pas de bump `DB_VERSION`** — précédents `opponentStyle` ADR-0035, `metacogEnabled?` ADR-0037, `conceptSeen?` ADR-0040, `visionStats?` ADR-0043). Locale courante exposée comme **`$state` réactif** (module `.svelte.ts`, cf. `app.svelte.ts`) pour que tout `t()` re-rende au switch. **Toggle dans Settings** (près de `opponentStyle`/`metacogEnabled`). Met à jour `document.documentElement.lang` réactivement.
3. **Migration UI par trafic** (ordre rapport l.59) : choke-points partagés → `App`(nav) → `Home` → `Play` → `Tactics` → `Coach` → `Dashboard`/`Insights` → `Onboarding` → reste. Chaque chaîne remplacée par `t('clé')` avec **entrée FR *et* EN** (l'EN = capture du littéral existant).
4. **Couche TS (F3) — phrases au catalogue (Q-W18-2 révisé).** Les **valeurs** des maps de libellés (`MOTIF_LABELS`, `DIM_LABELS`, `SELF_TAG_LABELS`, `SEVERITY_PHRASE`, `PHASE_PHRASE`, `MOTIF_EXPLANATION`) deviennent des **entrées de catalogue bilingues à clés stables**. Les générateurs purs (`explain`/`positional`/`scenarios`/`program`/`diagnostic`/`metacog`) résolvent leur texte via un **résolveur `t`/locale INJECTÉ** (cores restent purs/testables — discipline ADR-0007/0009). Réécriture **par cas** (jamais de concaténation de fragments). *Conséquence : le doublon de libellés `Radar.svelte` vs `DIM_LABELS` disparaît — une seule source catalogue.*
5. **Contenu JSON/data (F3) — fichiers par locale (Q-W18-5/N5).** `public/concepts/concepts.{fr,en}.json`, `endgame/drills.ts` (tables FR+EN), `eco.json` (noms FR — cf. Q-W18-4). Chargés selon la locale courante (calque `loadConcepts()`). L'anglais actuel préservé.
6. **Politique SAN (ADR-0052 Q4=a)** : **SAN anglaise conservée** (`Nf3`) dans les deux locales ; traduire le copy autour. Noms de pièces hors-SAN (promotion, ColorPicker, vision) traduits par locale.
7. **Coquille HTML** : `index.html` `lang="fr"` par défaut (mis à jour au switch) + `<title>` + `manifest.webmanifest`.
8. **Layout + fidélité de rendu sous texte FR (I2)** : FR ~+15-20 %. **Topbar wrappe déjà** (`flex-wrap`, W13/W16 — §3) → risque flex clos. **Reste les libellés à coordonnées fixes** (Radar, EvalGraph, eval-bar) qui *ne reflowent pas* et **se chevaucheraient** sous FR plus long (I2).
9. **DoD bilingue honnête et mesurable (I1)** : instrument de complétude — `keys(fr) === keys(en)`, aucune chaîne user-facing ne contourne `t()`, **allow-list = exclusions intentionnelles** (SAN, noms propres, code). Cadrage : « bilingue, défaut FR » (pas « zéro caractère anglais »).
10. **Tests** : repointer les ~25-30 assertions verrouillées EN vers les **constantes de catalogue** (pattern `metacog.test.ts`) ; tester complétude bilingue + réactivité du switch.

**Explicitement différé (Follow-up §10) :** une **3ᵉ locale** (l'archi la supporte désormais — ne pas la bâtir) ; mapping FR dans l'ETL `build-eco.mjs` si Q-W18-4≠a ; thème clair (Q5) ; consolidation globale des 3 maps de libellés en un module (refactor séparé) ; messages launcher EN (hors UI app) ; **W12-part2**.

## 3. Baseline (empirique — vérifiée le 2026-06-16 contre le code courant)

> Re-vérifiable par les citations ci-dessous. Surface bougée depuis l'audit (W13–W17 mergés) → re-confirmer à l'extraction (§4).

- **Infra i18n = 0.** `Grep "i18n|locale|messages\.ts|\bt\(['\"\`]|from ['\"].*i18n"` sur `src/` → **0 résultat**. Aucun module `fr`/`en`/`messages`/`locale`. → on **crée** l'infra bilingue.
- **UI 100 % anglaise aujourd'hui.** Diacritiques FR + « français » dans `src/**/*.svelte` → **0**. W13/W14/W15/W17 ont livré en **anglais** → **baseline propre**. *Conséquence pour le switch : l'EN est l'existant à **capturer** dans `en.ts` (pas à rédiger), le FR est à **traduire**.*
- **Aucun setting de locale.** Pas de `SettingsRecord.locale` aujourd'hui → champ **additif** à créer (`?? 'fr'`, sans bump DB — précédents ci-dessus §2.2).
- **Coquille.** [`index.html:2`](../index.html:2) `<html lang="en">` ; `<title>Chess Trainer — progression first</title>` ; manifest `public/manifest.webmanifest`.
- **Volume de chaînes UI.** Ancre audit ≈**316** distinctes (rapport l.69/95) ; balayage 2026-06-16 jusqu'à **~1 130 fragments** (méthode : fragments incl. interpolations/doublons + ajouts récents). **Unité juste = clés de catalogue distinctes**, fixée à l'extraction ; le bilingue **double** les *entrées* (fr+en) à clés constantes. Densité : Play ~95, Tactics ~85, Onboarding ~78, Coach ~72, Calculate ~68 en tête. → vérifier par **complétude `keys(fr)===keys(en)` + grep-bypass** (§7), pas par un N cible.
- **Maps de libellés (clés STABLES → entrées catalogue ; valeurs bilingues) :**
  - `MOTIF_LABELS` [`diagnostic.ts:40`](../src/coach/diagnostic.ts:40) — 7 ; `DIM_LABELS` [`diagnostic.ts:47`](../src/coach/diagnostic.ts:47) — 5.
  - **Doublon** : [`Radar.svelte:15`](../src/ui/Radar.svelte:15) re-déclare les libellés de dimension (abrégés : `'Opening'` vs `'Opening accuracy'`). → résolu par le catalogue unique (§2.4).
  - `SELF_TAG_LABELS` [`metacog.ts:22`](../src/metacog/metacog.ts:22) — 6 ; **clés = taxonomie fermée stockée** (`SELF_TAGS`, ADR-0037 ; commentaire *« Storage uses the stable keys »*) → ne jamais traduire la clé.
  - `SEVERITY_PHRASE`/`PHASE_PHRASE`/`MOTIF_EXPLANATION` [`explain.ts:11`](../src/analysis/explain.ts:11) — 5/3/13.
- **Générateurs (réécriture bilingue par cas, via résolveur injecté) :**
  - [`explain.ts`](../src/analysis/explain.ts) — ~13 templates ; concat **modéré** (« Better was {SAN}. », clauses optionnelles).
  - [`positional.ts:78`](../src/analysis/positional.ts:78) — 3 templates avec `.join()` dans la phrase ; risque **élevé** (ordre/accord FR).
  - [`program.ts:47`](../src/coach/program.ts:47) — ~6 `reason`. **Bug P3-19** : [`program.ts:49`](../src/coach/program.ts:49) injecte la **clé brute** `m.theme` (`'fork'`) → router via libellé + traduire. ⚠️ `activity`/`focus` = **clés de routage** (`focus`→`tacticsFilterThemes`) → ne traduire que `reason`.
  - [`metacog.ts:123`](../src/metacog/metacog.ts) — 1 phrase ; mots de confiance **codés en dur** (`'sure'`/`'unsure'`/`'just guessing'`) → entrées catalogue.
  - [`scenarios.ts`](../src/analysis/scenarios.ts) — 4 `goal` (risque faible) ; [`diagnostic.ts`](../src/coach/diagnostic.ts) — via maps (faible).
- **Contenu JSON/data :**
  - `public/concepts/concepts.json` — **7 cartes** (title/idea/why) ≈ 28-34 phrases → `concepts.{fr,en}.json`.
  - `public/openings/eco.json` — **40 noms** (~12 uniques) ; **seed régénéré par `npm run etl:eco`** ([`build-eco.mjs:47`](../scripts/build-eco.mjs:47), `name` verbatim des TSV EN l.28) → **manuel et hors-CI** (`build` = `svelte-check && vite build`) → écrasement **latent** (Q-W18-4).
  - `src/endgame/drills.ts` — **30 drills** × {name, goal} = **60 chaînes** (rapport disait « 23 finales » → surface bougée : §4 item 5).
  - `public/puzzles/seed-puzzles.json` — **aucune prose**.
- **Tests verrouillés EN (~25-30 assertions) :** [`explain.test.ts:19`](../src/analysis/explain.test.ts:19) (~9, dur), `coach/diagnostic.test.ts` (~2-3), `coach/program.test.ts` (~4). **Pattern correct** : `metacog.test.ts:154` itère `SELF_TAG_LABELS`.
- **Layout topbar = déjà résolu.** [`app.css:91`](../src/app.css:91) `.topbar { display:flex; flex-wrap:wrap; … }` (commentaire « audit v2 W16/H37 ») ; `.topbar .nav { flex:1 1 100%; flex-wrap:wrap }` ; 20 boutons + `aria-current`.
- **Réactivité Svelte 5 (porteur pour le switch).** ADR-0050/0051 : `$state` ne deep-proxy pas les instances ; une dérivée ne recompute que si sa **dépendance réactive** change. → la **locale courante doit être une dépendance réactive** de tout `t()` rendu, sinon le switch ne re-rend pas. Cores purs (générateurs) reçoivent la locale en **param** (non réactif, appelés par l'UI réactive).
- **Exécution verte (à re-confirmer §4) :** `npm run check` 0/0 · `npm test` 488 · `npm run build` vert. Scripts `check`/`test`/`build`/`etl:eco` confirmés `package.json:9-20`.

## 4. Pré-flight (à re-vérifier à l'exécution)

1. `git status` propre ; brancher depuis `main` à jour ; **baseline verte** (`check` 0/0 + `test` ≥488). Rouge → STOP.
2. Re-confirmer **absence d'infra i18n** (grep §3) et **absence de FR** (diacritiques).
3. Re-confirmer les ancres : `index.html:2`, `diagnostic.ts`/`metacog.ts`/`explain.ts` (maps), `program.ts:49`, `Radar.svelte:15`, `app.css:91`. Vérifier `SettingsRecord` (forme actuelle, où ajouter `locale?`).
4. `decisions.md` : prochain ADR libre = **0053** ; il **supersède ADR-0052 Q3** (cross-link, append-only).
5. **Énumérer la surface au moment T** : nombre de `.svelte`, recompter `drills.ts`, état seed/ETL d'`eco.json`. Ne pas se fier au « 316 » / « 23 finales » figés.
6. Aucune PR/branche en vol touchant l'i18n (`gh pr list`).

## 5. Plan — code (ordonné ; code d'abord, docs en dernier — croyance #5)

> Par vague livrable/revertable. Découpage PR = **sous-PRs par vague** sous l'ombrelle W18 (Q-W18-3). Chaque vague garde `check`/`test` verts.

**Phase 0 — Infra bilingue (peu/pas de visuel).**
- `src/i18n/` : `fr.ts` + `en.ts` (mêmes clés), `index.ts` exposant `t(key, params?)`, `plural()`, `formatPercent()`/`formatNumber()` **locale-aware** (FR `78 %`/`1,5`/`1 500` ; EN `78%`/`1.5`/`1,500` — I3), et la **locale courante réactive** (`$state` dans un `.svelte.ts`).
- `SettingsRecord.locale?: 'fr'|'en'` additif (`?? 'fr'`, **pas de bump DB**) ; charge/persiste via le store existant ; **toggle Settings**. Au changement : maj `$state` locale **et** `document.documentElement.lang`.
- **Gardes (rider + I1)** : clé manquante dans la locale courante → fallback autre locale → sinon la clé (jamais blanc/crash) ; **param d'interpolation manquant** → fallback propre (jamais `"{n}"` littéral).
- Tests core : interpolation, pluriel (0/1/2 — `0` et `1` singulier en FR), fallback clé/param, **`keys(fr)===keys(en)`**.

**Phase 1 — Choke-points partagés.** `ConfirmDialog` (+ 4 sites) · `ColorPicker` · `Board` (badge trait, `Promote to`, label clavier, `Cancel promotion`, « not a legal move ») · helper `announce()`/aria-live. Chacun via `t()` avec entrées fr+en.

**Phase 2 — Vues par trafic** : `App`(nav 20 labels + brand + loading/error) → `Home` → `Play` → `Tactics` → `Coach` → `Dashboard`/`Insights` → `Onboarding` → reste (Calculate, Woodpecker, Endgames, Review, Repertoire, Import, Comeback, Sparring, Session, AnalysisResult, AnalysisBoard, WhenToThink, Vision, Settings, Concepts, Explorer, GuessMove). Capturer l'EN dans `en.ts` en remplaçant chaque littéral par `t()`.

**Phase 3 — Couche TS (F3, phrases au catalogue).**
- Migrer les **valeurs** des maps (`MOTIF_LABELS`/`DIM_LABELS`/`SELF_TAG_LABELS`/`SEVERITY_PHRASE`/`PHASE_PHRASE`/`MOTIF_EXPLANATION`) en entrées catalogue bilingues (clés intactes). Faire lire `Radar.svelte` la **même source** (tue le doublon).
- Réécrire les générateurs en **templates FR+EN par cas** via résolveur/locale **injecté** (cores purs) : `explain` (clauses optionnelles), `positional` (phrase complète, pas de `.join`), `metacog` (mots de confiance au catalogue), `program` (router `m.theme` via libellé, traduire `reason` **seul** — pas `activity`/`focus`), `scenarios`, `diagnostic`.

**Phase 4 — Contenu JSON/data (F3, par locale).** `concepts.{fr,en}.json`, `drills.ts` (tables fr+en), `eco.json` (noms FR — Q-W18-4). Chargement selon locale (calque `loadConcepts()`).

**Phase 5 — Tests.**
- Repointer les assertions fragiles vers les **constantes catalogue** (pattern `metacog.test.ts:154`).
- **Complétude bilingue** : `keys(fr)===keys(en)` ; **réactivité du switch** : un test composant (jsdom, hors board) vérifiant que flipper la locale change le texte rendu ; générateurs : assertions FR **et** EN par cas représentatif.

**Phase 6 — Coquille + docs (en dernier).**
- `index.html` `lang="fr"` défaut + `<title>` + manifest (et la maj réactive de `lang` au switch, vérifiée).
- **ADR-0053** : *« W18 — UI bilingue FR/EN avec bascule runtime »*, **supersède ADR-0052 Q3** (mono→bilingue), conserve Q4 (SAN EN) ; documente le mécanisme (catalogue, `t()` réactif, locale additive, défaut FR). Écrit **après** le vert.
- Reconcile spec parente **§13** (W18 → ✅) + README/Settings si une promesse touche la langue.

## 6. Tests

- **Core i18n** : interpolation, pluriel FR/EN, fallback clé/param, format locale-aware, `keys(fr)===keys(en)`.
- **Switch** : flip locale → texte rendu change (composant jsdom) ; `document.documentElement.lang` suit.
- **Maps/générateurs** : assertions via constantes catalogue, FR **et** EN, par cas.
- **Clés stables** : test que `SELF_TAGS`/clés de maps/`focus`/`activity` n'ont **pas** changé (DB + routage en dépendent).
- **Garde globale** : `npm test` vert à chaque phase (≥488 + ajouts).

## 7. Vérification (mesurable)

| Critère | Commande / observation | Attendu |
|---|---|---|
| Types | `npm run check` | 0/0 (chaque phase) |
| Tests | `npm test` | verts (≥488 + ajouts) |
| Build | `npm run build` | vert |
| Bascule | Settings → toggle FR/EN | toute l'UI bascule **live** ; `<html lang>` suit ; persiste au reload |
| Complétude (I1) | test `keys(fr)===keys(en)` | égal (0 clé manquante d'un côté) |
| Bypass (I1) | grep littéraux user-facing hors `t()` dans `src/ui` (allow-list : SAN, noms propres, code) | ≈ 0 (revue confirme) |
| Clés stables | diff clés maps/`SELF_TAGS`/`focus` vs `main` | **inchangées** |
| Radar (I2) | libellés dims rendus Coach/Dashboard/Insights, **les deux locales** | une source, pas de chevauchement SVG |
| Libellés SVG (I2) | Radar/EvalGraph/eval-bar sous FR | lisibles dans le viewBox (pas seulement « 0 débordement page ») |
| Format (I3) | metacog/ratings/win% en FR vs EN | FR `78 %`/virgule · EN `78%`/point |
| SAN | un coup expliqué (`explain`) FR et EN | SAN anglaise (`Nf3`) conservée des deux côtés, frame traduit |
| Layout | preview 1280/375, locale FR | nav wrappe, aucun débordement horizontal |
| ETL ECO (si Q-W18-4=a) | `npm run etl:eco` puis `eco.json` | noms FR **persistent** |

## 8. Anti-patterns (spécifiques W18)

1. **Traduire une clé de stockage/routage/thème.** Clés de maps, valeurs `SELF_TAGS` (ADR-0037), kinds SRS, `conceptSeen`, `activity`/`focus` (`program.ts`). → traduire **valeurs d'affichage uniquement**.
2. **Concaténer des fragments traduits.** `positional.ts` (`.join`), `program.ts`, `explain.ts`, `metacog.ts`. FR : genre/accord/ordre/pluriel → **template complet par cas et par locale**.
3. **Traduire la SAN** (`Nf3`→`Cf3`) — ADR-0052 Q4=a, dans **les deux** locales.
4. **`t()` non réactif à la locale** → la bascule ne re-rend pas. La locale courante DOIT être une dépendance réactive (`$state`) de tout `t()` rendu (leçon ADR-0050/0051) ; les cores purs prennent la locale en **param**.
5. **Laisser l'EN inline** (non capturé dans `en.ts`) → la bascule affiche du vide/clé pour ces chaînes. Tout littéral user-facing passe par `t()` avec entrées fr **et** en.
6. **Clé présente d'un seul côté** (`fr` sans `en` ou l'inverse) → trou au switch. Garde `keys(fr)===keys(en)`.
7. **Coder une langue en dur dans un générateur** → doit résoudre via le catalogue/locale injectée, jamais un littéral EN ou FR figé.
8. **Hand-traduire `eco.json` puis `npm run etl:eco` l'écrase** (seed depuis TSV EN) → patcher l'ETL (Q-W18-4=a) ou documenter/différer.
9. **Traduire `DIM_LABELS` en oubliant `Radar.svelte`** → radar bilingue. Source catalogue unique.
10. **Bug de pluriel FR** : « {n} puzzle(s) » — `0`/`1` singulier en FR ; helper pluriel, pas `+ 's'`.
11. **Format à moitié traduit** (I3) : `78%`/`1.5` en mode FR. `formatPercent`/`formatNumber` locale-aware.
12. **Casser les tests EN** sans repointer vers les constantes (pattern `metacog.test.ts`).
13. **`<html lang>` figé** : doit suivre la locale au switch, pas rester `fr`.
14. **Sur-architecturer multi-locale** (3ᵉ langue, sélecteur générique) → bilingue suffit ; 3ᵉ locale = Follow-up.
15. **Bumper `DB_VERSION`** : `locale?` est additif (`?? 'fr'`). Schéma v4 inchangé.

## 9. Rollback

Sous-PRs par vague → `git revert` granulaire. **Additif** (catalogue + champ `locale?` additif + helpers), sans toucher clés/schéma. Revert d'une vague = retour des chaînes concernées à l'inline EN, sans corruption DB (aucune migration). NB : une fois les deux locales en place, revenir à *mono-FR* n'est pas un simple revert (les deux catalogues coexistent) — c'est un changement délibéré, pas un rollback d'urgence.

## 10. Follow-up (hors périmètre)

- **3ᵉ locale** : l'archi bilingue la supporte ; ne pas la bâtir (YAGNI / anti-pattern #14).
- **Mapping FR dans l'ETL `build-eco.mjs`** si Q-W18-4≠a.
- **Consolidation globale des 3 maps** en un module unique (refactor séparé ; la conso minimale Radar↔catalogue est dans W18).
- **Messages launcher EN** (`server.cjs`) — hors UI app.
- **Thème clair** (Q5) ; **option SAN figurines** (écartée) ; **W12-part2** (god-component).

## 11. Décisions (actées 2026-06-16)

**Arbitrages draft — recos ratifiées en bloc :**
- **Q-W18-1=a** — catalogue maison (`fr.ts`+`en.ts`) + `t()` interpolation + pluriel, **sans lib runtime**.
- **Q-W18-2=a (révisé par le switch)** — phrases des générateurs **au catalogue bilingue**, résolues via résolveur/locale **injecté** (cores purs). *(L'option « templates FR dans les modules » est incompatible avec la bascule.)*
- **Q-W18-3=a** — **sous-PRs par vague** sous l'ombrelle W18.
- **Q-W18-4=a** — traduire le seed `eco.json` aux conventions FR (FFE ; éponymes conservés) **et** patcher `build-eco.mjs`.
- **Q-W18-5=a** — **ADR-0053** au ship (ici : supersède ADR-0052 Q3).

**Enrich FOLD ratifiés :** **I1** (DoD bilingue honnête/mesurable — complétude `keys(fr)===keys(en)` + anti-bypass + allow-list) · **I2** (fidélité libellés à coords fixes sous FR) · **I3** (format typographique locale-aware) · **rider** (`t()` param manquant).

**Switch FR/EN (demande user 2026-06-16) — forks tranchés en recommandé :**
- **N1/N3** — **défaut FR**, `SettingsRecord.locale?` additif (`?? 'fr'`, sans bump DB), **toggle Settings**.
- **N2** — générateurs : **phrases au catalogue** (= Q-W18-2 révisé).
- **N5** — données : **fichiers par locale** (`concepts.{fr,en}.json`, drills fr+en, eco).
- **Supersession** : ce chantier **supersède ADR-0052 Q3** (mono → bilingue runtime) ; **Q4 (SAN EN) conservée**.

**Acté (rappel — pas un arbitrage).** SAN anglaise dans les deux locales (ADR-0052 Q4=a). Variantes SAN française/figurines **écartées**. Pas de lib runtime i18n (catalogue maison). Multi-locale au-delà de FR/EN = Follow-up.

## 12. Statut de livraison (2026-06-16)

**Livré, mergé, vérifié** (`svelte-check` 0/0 · `vitest` **500** · `vite build` vert · runtime : défaut FR + bascule FR↔EN **live** vérifiée au preview, `<html lang>` suit, 0 erreur console) :
- Infra bilingue `src/i18n/` (`translate` pur + `locale.svelte.ts` réactif + catalogue `{fr,en}` par domaine + `t`/`tn`/`fmtPct`/`fmtNum`) ; **garde de complétude `keys(fr)===keys(en)`** (I1) ; ADR-0053.
- `SettingsRecord.locale` additif (`?? 'fr'`, sans bump DB) + **bascule dans Réglages** + `<html lang>`/`lang="fr"` défaut + `<title>` FR.
- **Les 31 vues** traduites (toutes les chaînes UI → `t()`).
- **Couche TS (F3)** : générateurs `explain`/`positional` (explication des coups), `metacog` (calibration), `coach/diagnostic` + `coach/program` (profil/programme), et les maps de libellés (motif/dimension/sévérité/phase/self-tag) — toutes bilingues, source unique catalogue (doublons Radar/Coach/Dashboard/Insights consolidés). Fix **P3-19**.
- Conventions typographiques FR (I3) ; fidélité SVG (I2 : libellés Radar via `dimShort`).

**Résiduel anglais en mode FR — différé (cf. §10, ADR-0053 ; frontière « contenu data / générateurs secondaires », tout additif, n'empêche pas l'usage) :**
- Contenu **JSON data** : `concepts.json` (cartes), `eco.json` (noms d'ouvertures + mapping ETL `build-eco.mjs`), `endgame/drills.ts` (objectifs) — chargés en async, nécessitent un rechargement locale-aware (Q-W18-4/N5 à finir).
- Phrases de **générateurs secondaires** : `studyPlan.ts` (raisons du plan d'étude, rendues dans Insights/Session), `scenarios.ts` (noms/objectifs Sparring), libellés de fuite `leak.motif`/`leak.phase` (Insights), `DimensionScore.detail` (weakness.ts).
- `<title>` statique (fixé au chargement, non réactif au switch).

**Mise à jour (PR de suivi, 2026-06-16) — résiduel CLÔTURÉ :** tous les points ci-dessus sont désormais **livrés** : cartes concepts (`concepts.fr.json` + loader async par locale + rechargement réactif + test de parité fen/keyMove), finales (`nameFr`/`goalFr`), noms d'ouvertures ECO (overlay FR ETL-safe), raisons `studyPlan`/`scenarios`, libellés de fuite Insights (motif + phase), `DimensionScore.detail` (weakness.ts), et `<title>` **réactif**. Vérifié live (preview) : les cartes concepts se rechargent en FR au switch ; le `<title>` suit la locale. `svelte-check` 0/0 · `vitest` **504** · build vert. **W18 est désormais intégralement bilingue FR/EN.**
