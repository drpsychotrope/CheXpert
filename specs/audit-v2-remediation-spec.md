# Spec — Remédiation de l'audit v2 (fermeture du backlog P0→P3)

> Type : programme de correction multi-workstreams (fix + refactor + robustesse + a11y + i18n + UX).
> Source : [`reports/audit-v2-2026-06-10.md`](../reports/audit-v2-2026-06-10.md) (backlog 143 constats : 4 🔴 / 37 🟠 / 64 🟡 / 38 🔵). Drafté via `draft-general` le 2026-06-10.
> Profil : chess-trainer · Svelte 5 (runes) · TS strict · Vite 6 · chess.js 1.4.0 · chessground 9.2.1 · Stockfish 18 WASM (Web Worker) · IndexedDB (idb 8) · ts-fsrs · Vitest+jsdom+fake-indexeddb · specs dans `specs/` · journal `decisions.md` (dernier = **ADR-0051** → nouveaux à partir de **ADR-0052**) · CI active · npm.
> Statut : **V1 (raffinée)** — arbitrages Q1–Q6 + enrichissements `/enrich` F1–F7 actés le 2026-06-10 (toutes recos acceptées en bloc). **Exécution P0 en cours.**

### Décisions actées (2026-06-10)

**Arbitrages (recommandations retenues) :** Q1=(a) une PR par workstream, merge par batch de priorité · Q2=(a) folder les 🟡/🔵 triviaux dans le WS de leur axe, différer le reste · Q3=(a) catalogue de messages FR + `t()`, sans lib runtime · Q4=(a) conserver la SAN anglaise (convention), traduire le copy autour · Q5=(a) thème clair différé (tokens d'abord, W17) · Q6=(a) saisie SAN/UCI d'abord (W4), flèches-sur-cases en Follow-up.

**Enrichissements `/enrich` foldés** (bundle : [`reports/audit-v2-remediation_improvements.md`](../reports/audit-v2-remediation_improvements.md)) :
- **F1** *(A1)* — **V2-W5 élargi** « coutures moteur **& résilience de la coquille** » : ferme **P1-03** (`{:catch err}` sur `{#await viewLoader()}` à [`App.svelte:85`](../src/ui/App.svelte:85) + option 404 réel pour `*.js/*.wasm`).
- **F2** *(A1+A8)* — nouveau **V2-W19** (docs, dernier) : ferme **P1-15** (reformuler README + `Settings.svelte:54` coaching « après + retour ») et **L3** (« 376 tests » → formulation **non-datée**) + **ADR-0052** actant la décision UI française.
- **F3** *(A3)* — **V2-W18** : la DoD FR couvre `src/ui` **ET** les générateurs TS (`explain.ts`/`positional.ts`/`scenarios.ts`/`coach/*`/`metacog.ts`) **ET** le JSON (concepts/ECO/finales), pas seulement `src/ui`.
- **F4** *(A4)* — **V2-W1 reformulé** : force d'analyse **explicite par appel** d'`evaluate`/`analyzeLines` (flag `fullStrength`), tuant toute la classe — **y compris la couture calibration** (`Onboarding` eval depth-10) que les « 4 sites » rataient.
- **F5** *(A5)* — **V2-W14 livre UNE primitive `<Dialog>` accessible** (natif `<dialog>`, focus-trap, Esc, thème, FR) consommée par ConfirmDialog, le picker de promotion (L53) et le take-back coach de **V2-W12** (dépendance W14 → {W12, picker}).
- **F6** *(A7)* — **V2-W12** : la DoD inclut la correction de l'**asymétrie d'horloge** du coach (ne pas geler le rAF *ni* facturer la délibération à l'adversaire ; ne pas presser l'horloge adverse avant la décision).
- **F7** *(A6)* — **§13 « Statut de livraison »** (workstream · PR · preuve-DoD), rempli au fil des merges (combat AP-9.7).

---

## 1. Contexte

L'audit v2 a fermé le cycle « v1 audit → remédiation » et ouvert deux territoires neufs (correction fine du jeu *vécue en jouant*, et UX/UI jamais auditée). Il laisse un backlog priorisé et **vérifié adversarialement** (chaque 🔴/🟠 relu par un sceptique, 4 réfutés écartés). Cette spec planifie sa fermeture.

Comme la remédiation v1 ([`specs/audit-remediation-spec.md`](audit-remediation-spec.md), 15/15 livrés), ce **n'est pas un seul changement** : c'est un programme de **18 workstreams** (V2-W1…V2-W18), chacun à concern unique, livrable et réversible isolément (croyance #4). Ordre : code d'abord, docs en dernier (croyance #5). Chaque workstream **référence les IDs du backlog** qu'il ferme — le détail par constat (évidence `fichier:ligne`, proposition, effort) vit dans le rapport, pas dupliqué ici.

**Périmètre exact emprunté au rapport** : les 4 🔴 (P0) et 37 🟠 (P1+P2) sont **dans le périmètre** ; les 102 🟡/🔵 (P3) sont **foldés quand triviaux** dans le workstream de leur axe, le reste **différé** (cf. arbitrage Q2 et §11).

## 2. Scope

**Dans le périmètre — 18 workstreams :**

| # | Workstream | Ferme (IDs backlog) | Axe(s) | Prio | Effort |
|---|---|---|---|---|---|
| V2-W1 | Moteur : force d'analyse **explicite par appel** (flag `fullStrength`), couvre toutes les coutures dont calibration (F4) | P0-01 | Correction/Perf | **P0** | S |
| V2-W2 | Import : détection de couleur sur les deux en-têtes + refus de deviner | P0-02 | Correction | **P0** | S |
| V2-W3 | Chess960 : `undo()` castle-aware (pile de snapshots) + tests | P0-03 | Correction | **P0** | M |
| V2-W4 | Échiquier : chemin de coup au clavier (saisie SAN/UCI partagée) | P0-04 | a11y | **P0** | M/L |
| V2-W5 | Moteur — coutures **& résilience coquille** : `interrupt()` à la nav + debounce analysis-board + reprise sur crash + `setOption` enqueué + `{:catch}` view-loader (F1) | P1-03,04,05,06 ; L8 | Robustesse | P1 | M |
| V2-W6 | Règles : garde `moveUci` aux 5 modes + coup roi 960 case libérée + label `fiftyMove` | P1-16,17 ; L11,L12 | Correction | P1 | M |
| V2-W7 | Import/répertoire : ids anti-collision + PGN multi-parties + garde zéro-coup | P1-10,11,12 ; L21,L23,L24 | Robustesse | P1 | M |
| V2-W8 | Coach/Insights — honnêteté : polygone radar n/a + rating réel dans la tendance + caption 2/motif | P1-08,09 ; L17,L18,L19,L86 | Correction | P1 | M |
| V2-W9 | Drills : gardes anti-double-comptage Vision + résignation pendant « réfléchit » (Comeback/Sparring) | P1-13,14 ; L25,L26,L29 | Correction | P1 | S |
| V2-W10 | Boucle : badge de cartes dues + nettoyage `weaknessCounters` (état mort) + « re-analyse » compte réel + thème missed-win | P1-07 ; L13,L14,L15 | Évol./Boucle | P1 | M |
| V2-W11 | W3 aligné Q1=a : `next()` async par fenêtre d'index (ripple appelants en lockstep) | P1-02 ; L65,L69 | Perf/Correction | P1 | M |
| V2-W12 | Finir W12 : extraire la machine d'état + horloge de `Play.svelte` ; remplacer le `confirm()` coach | P1-01 ; L6,L10 | Archi/Maint. | P1 | L |
| V2-W13 | a11y baseline : contraste boutons + `:focus-visible` + zoom + `prefers-reduced-motion` + `<nav>`/`aria-current` + `aria-live` | P2-01..05 (a11y) ; L48,L49,L50,L51,L54,L55,L98 | a11y | P2 | M |
| V2-W14 | Modèle d'interaction : clic-pour-jouer + `ConfirmDialog` partagé + clavier du picker promo | P2 (interactions) ; L52,L53,L63,L64 | UX | P2 | M |
| V2-W15 | Parcours : sortie onboarding + P2 découvrable + feedback calibration + historique de nav + canal d'erreur moteur | P2 (ux-journey) ; L34..L45,L93..L97 | UX | P2 | M |
| V2-W16 | Nav topbar : `flex-wrap`/scroll + vue active + regroupement (prépare le FR plus long) | P2 (H37) ; L46 | UX/Layout | P2 | M |
| V2-W17 | Système visuel : tokens espacement/rayon/typo + promotion `button.ghost`/`.link`/`.card` + `--on-accent` | P2 (visual) ; L56..L60,L99,L101 | Visuel/Maint. | P2 | L |
| V2-W18 | **Chantier UI en français** (infra messages + migration par trafic + maps + JSON + politique SAN + tests ; DoD couvre aussi générateurs TS, F3) | P2 (i18n) ; L61,L62,L102 | i18n | P2 | L |
| V2-W19 | **Docs reconcile** (F2) : README coaching « après+retour » + « 376 tests » non-daté + ADR-0052 (décision FR) | P1-15 ; L3 | Docs/Honnêteté | P2(docs) | S |

**Explicitement différé (Follow-up §11)** : le **reste du P3** non foldé (notes de polish pur, dette de tests étendue, `importedGames` mort, opponent Comeback/Sparring `pickHumanMove`, types non-exhaustifs L91/L92) ; **thème clair** via `prefers-color-scheme` (dépend des tokens W17 — cf. Q5) ; navigation flèches-sur-cases complète (W4 livre d'abord la saisie SAN/UCI — cf. Q6) ; abstraction `variant` (YAGNI, acquis v1) ; fallback IndexedDB mémoire complet (acquis v1) ; virtualisation listes ; signature `.exe`.

## 3. Baseline (empirique — héritée de l'audit v2, re-vérifiable)

Tous les ancrages sont dans le rapport (`fichier:ligne`, vérifiés adversarialement le 2026-06-10). Faits porteurs :

- **Exécution** : `npm test` → **478 verts** ; `npm run check` → **0 erreur/warning** (367 fichiers) ; `npm run build` → vert, chunk initial **63,96 ko**. CI verte.
- **C-1** : `AdaptiveOpponent.ts:71` met `UCI_LimitStrength=true` ; reset unique `Play.svelte:427` ; `resetVariant` ne clear que `UCI_Chess960` ; options re-émises à chaque (re)boot (`EngineClient.ts:114`).
- **C-2** : `ChessGame.ts:213-226` `undo()` ; `applyCastle`→`chess.load()` purge la pile chess.js ; atteignable `Play.svelte:329`.
- **C-3** : `pgn.ts:90-95` n'inspecte que Black, défaut `'w'` ; `Import.svelte:37` passe `playerName||'You'`.
- **C-4** : `Board.svelte` hôte sans `tabindex`/`role`/`keydown` ; aucun chemin clavier.
- **Layout** : `.topbar` (`app.css:52`) `display:flex` **sans** `flex-wrap`/`overflow-x` ; 20 boutons (`App.svelte:48-67`) → largeur fixe 1855 px (mesuré : débordement +590 px @1280, +1480 px @375).
- **i18n** : 0 infra (`grep t()/i18n/locale` = 0) ; `index.html:2` `lang="en"` ; ~316 chaînes UI + maps coach/metacog + JSON (concepts/ECO/finales).
- **README** : « 376 tests » ×2 (réel 478) ; promesse coaching « avant » contredite par `Settings.svelte:57`.

## 4. Definition-of-Done par priorité

| Prio | DoD vérifiable | Workstreams |
|---|---|---|
| **P0** | Analyse jamais bridée (test : evaluate après une partie tourne à pleine force) ; import couleur correcte ou refus explicite ; undo-roque-960 restaure plateau+trait+san+répétition (test vert) ; au moins un chemin de coup clavier sur Play/Tactics | W1–W4 |
| **P1 correction** | Les 5 modes bot halt sur `moveUci` null ; coup roi 960 case libérée jouable ; ids import/répertoire anti-collision (test) ; radar n'affiche jamais un n/a comme mesuré ; Vision/résignation ne double-comptent plus | W5–W9, W11 |
| **P1 boucle/archi** | Badge de cartes dues visible sur Home+nav ; `next()` async par index (ripple appelants à jour) ; `Play.svelte` < ~300 l. + `confirm()` coach remplacé par UI non bloquante | W10, W11, W12 |
| **P2 a11y** | Contraste boutons ≥ 4,5:1 ; `:focus-visible` global ; zoom autorisé ; `prefers-reduced-motion` respecté ; `<nav aria-label>` + `aria-current` ; état dynamique annoncé (`aria-live`) | W13 |
| **P2 UX** | Clic-pour-jouer marche partout ; `ConfirmDialog` partagé (zéro `confirm()` natif) ; onboarding a une sortie ; Session/Insights accessibles depuis Home ; topbar ne déborde plus, vue active marquée | W14–W16 |
| **P2 visuel/i18n** | Tokens espacement/rayon/typo en place + composants promus ; **UI 100 % FR** (0 chaîne EN user-facing, `lang="fr"`, tests à jour) | W17, W18 |

## 5. Pré-flight (à re-vérifier à l'exécution)

1. `git status` propre ; brancher depuis `main` à jour ; **baseline verte** : `npm run check` (0) + `npm test` (≥478) avant toute édition. Rouge → STOP.
2. Re-confirmer les ancres porteuses (les n° de ligne ont pu glisser depuis le 2026-06-10) : `AdaptiveOpponent.ts:71`, `Play.svelte:427/329`, `ChessGame.ts:213`, `pgn.ts:90`, `Board.svelte` (hôte), `app.css:52`. Le rapport est la source des ancres complètes.
3. `decisions.md` : prochain ADR libre = **0052** (sinon réindexer les ADR de cette spec).
4. Aucune PR/branche en vol couvrant un de ces workstreams (`gh pr list`).
5. Pour W11 (async ripple) et W18 (i18n) : énumérer les appelants/chaînes **au moment T** (la surface a pu bouger).

## 6. Plan — code (par workstream, ordonné P0→P2)

> Le **« quoi »** par constat (édit précis + ancre) est dans le rapport sous l'ID listé en §2. Ci-dessous : le **concern**, les **édits-clés**, et les **anti-patterns spécifiques**.

### P0

**V2-W1 — Pleine force d'analyse.** `setFullStrength()` (enqueué) dans `EngineClient` ; appelé en tête de `AnalysisBoard.analyze`, du repli moteur `Endgames`, de `Import.analyze`, et `Coach.finishGame`. AP : ne pas le mettre seulement dans `resetVariant` si un appelant ne passe pas par là (Coach) → vérifier les 4 sites.

**V2-W2 — Couleur d'import.** `inferPlayerColor` inspecte White **et** Black ; si aucun match → renvoyer `null`/`'unknown'` et l'UI **bloque** l'analyse en demandant la couleur. AP : ne plus substituer `'You'` comme nom réel.

**V2-W3 — Undo 960.** Pile de snapshots `{fen, rights, san}` par coup dans `ChessGame` ; `undo()` restaure depuis le snapshot (au moins pour les roques, idéalement toujours pour uniformité). Tests : roque puis undo restaure plateau+trait+droits+history+répétition ; + take-back coaché sur roque 960. AP : clé de snapshot incluant les compteurs (casse la répétition).

**V2-W4 — Coup clavier.** Saisie SAN/UCI sous l'échiquier (réutilise le parser `ChessGame.move`/`moveUci`), branchée au même `onMove`, partagée via `Board.svelte` (au moins Play/Tactics/Review). Navigation flèches-sur-cases = Follow-up (Q6). AP : input qui contourne la validation de légalité.

### P1

**V2-W5 — Coutures moteur.** `interrupt()` câblé : `onDestroy` des vues moteur (ou hook central App) + debounce ~150 ms avant `analyzeLines` dans AnalysisBoard ; reprise explicite sur crash/timeout (`engineMove` → état « Réessayer » au lieu d'un plateau figé) ; `applyStrength` routé via `enqueue`. AP : interbloquer `init()` dans la chaîne ; oublier un site moteur.

**V2-W6 — Gardes règles.** Porter la garde W6 (`const san=moveUci(uci); if(!san){halt}`) aux 5 modes ; `castleSideFor` n'intercepte un coup que si le droit/la tour est vivant (sinon fall-through chess.js) ; produire `reason:'fiftyMove'` + label FR. Helper partagé (`playSession.ts`) pour la garde. Tests : les 5 cas + roi-960-case-libérée + 50 coups.

**V2-W7 — Robustesse import.** ids anti-collision (hash de contenu / timestamp) pour `gameId` et lignes de répertoire ; détecter PGN multi-parties (split sur `\n\s*\n(?=\[)`) → analyser la 1ʳᵉ avec avis clair ; garde `plies.length===0`. AP : id dérivé du nom libre seul.

**V2-W8 — Honnêteté coach.** Exclure les axes `sampleSize===0` du polygone de valeur du radar (sommet replié/pointillé) ; passer le rating réel à `weaknessTrend` ; caption « two puzzles per motif » (ou dérivée de `profile.motifs`) ; libellés via `MOTIF_LABELS` partagé. AP : laisser une 2ᵉ source de libellé.

**V2-W9 — Gardes drills.** `if (feedback) return;` en tête de `answerKnight`/`answerFindAll` ; `if (status==='over') return;` après l'`await pickMove` de Comeback/Sparring ; nettoyer les timers Vision à la sortie. Tests composant si infra dispo.

**V2-W10 — Closers de boucle.** Badge `dueCount('puzzle')+('repertoire')` calculé au boot, rendu sur Home + arm nav « Review (N) », rafraîchi après chaque grade ; supprimer `weaknessCounters` (3 sites d'écriture + champ, lecture tolère l'absence) — ou le réhabiliter ; « re-analyse » lit `puzzlesGenerated` ; missed-win passe par `detectMotif` pour un thème drillable. AP : retirer un champ DB sans vérifier que les lectures tolèrent l'absence.

**V2-W11 — `next()` async par index (ripple — gate Contrat).** `next()`/`byId`/`size` → **async** ; requête `IDBKeyRange.bound(rating-fenêtre, rating+fenêtre)` sur l'index `rating`, fusionnée avec `personal`. **Lockstep** : passer en `await` tous les appelants (`Tactics`, `Calculate`, `Woodpecker`, `Vision`, file SRS). AP : garder un `getAll` « juste pour byId » ; oublier un appelant (gate Contrat).

**V2-W12 — Finir W12.** Extraire la machine d'état (pickMove→press→checkEnd→recordGame) + le contrôleur d'horloge de `Play.svelte` en `.svelte.ts` testables (cible < ~300 l.) ; remplacer le `confirm()` coach par un overlay non bloquant qui ne gèle pas l'horloge rAF ; router `setOption` via helper. AP : extraire en gardant des dépendances Svelte (non testable).

### P2

**V2-W13 — a11y baseline.** Dans `app.css` : assombrir `--accent` (≥4,5:1 blanc) ou texte foncé ; règle globale `:focus-visible` ; `@media (prefers-reduced-motion: reduce)` neutralisant transitions + `Board` `animation:{enabled:false}` ; `index.html` retirer `user-scalable=no`/`maximum-scale`. Dans `App.svelte` : `<nav aria-label>` + `aria-current="page"` + skip-link ; région `aria-live` polie globale (`announce()`) pour thinking/résultat/progress ; `role="timer"` horloge ; `aria-label` sur SVG radar/sparklines et boutons glyphes. AP : casser le rendu sombre en changeant `--accent` sans re-mesurer les autres usages.

**V2-W14 — Interaction.** `Board.svelte:118` `selectable:{enabled:true}` (indépendant de `onSelect`) → clic-pour-jouer partout ; `ConfirmDialog.svelte` (natif `<dialog>`, focus-trap, Esc, thème, variante `danger`, **copie FR**) remplaçant les 5 `confirm()` ; clavier du picker promo (autofocus Dame, q/r/b/n, Esc). AP : régresser le drill Vision (board vide, `dests` vide → pas de coup parasite).

**V2-W15 — Parcours.** Boutons « Passer l'évaluation »/« Abandonner » aux étapes ladder+game de l'onboarding ; bouton primaire « Session du jour » + « Insights » sur Home ; `gameThinking`/message « Évaluation… » couvrant la fenêtre d'éval calibration ; mini-pile `goBack()` (ou `returnTo`) pour « Explore »/« Drill » ; séparer `gameResult` de `errorMsg` (ne jamais router une erreur dans `result` vert). AP : `ready=true` sans signaler une erreur.

**V2-W16 — Nav.** `.topbar` `flex-wrap:wrap` (ou `overflow-x:auto`) ; `class:active`/`aria-current` sur la vue courante ; regrouper (Jouer / S'entraîner / Analyser / Réglages) ou menu « Plus ». Coordonné avec W13 (landmark) et W18 (libellés FR plus longs). AP : casser l'accès aux 7 vues atteignables uniquement par la nav.

**V2-W17 — Tokens visuels.** `:root` += échelle `--space-*`, `--radius-*`, `--fs-*`, `--on-accent` ; promouvoir `button.ghost`/`button.link`/`.card` dans `app.css`, supprimer les ~25 copies scopées ; tokeniser l'eval-bar. Prépare (sans le faire) le thème clair (Q5). AP : sur-abstraire ; introduire de nouveaux styles inline.

**V2-W18 — UI en français (chantier).** (1) Infra messages FR minimale (catalogue clé→FR, mono-locale, pas de runtime i18n vu la doctrine — cf. Q3) ; (2) migration par trafic : App(nav)→Home→Play→Tactics→Coach→Dashboard→Insights→reste ; (3) maps de libellés coach/metacog (valeurs seules, **clés DB stables**) ; (4) contenu JSON (concepts/finales/ECO→noms FR conventionnels) ; (5) **politique SAN** (cf. Q4) ; (6) `lang="fr"` + `<title>` + manifest ; (7) **layout sous texte FR** (coordonné W16) ; (8) mettre à jour les tests verrouillés sur des chaînes EN. AP : concaténer naïvement des fragments traduits (pluriel/genre FR) ; traduire une clé de stockage.

## 7. Tests

- **P0** : W1 (analyse pleine force après partie), W2 (couleur des deux côtés + refus), W3 (suite undo standard + 960 normal + 960 castle), W4 (saisie SAN→coup appliqué).
- **P1** : W5 (interrupt rejette + reprise crash), W6 (5 modes halt + roi-960 + 50c label), W7 (ids uniques + multi-PGN + zéro-coup), W8 (radar n/a non tracé + trend rating réel), W9 (pas de double-comptage + résignation tenue), W10 (badge due count), W11 (`next` async par fenêtre + ripple), W12 (machine d'état + horloge testables).
- **P2** : W13 (contraste/focus/reduced-motion en assertions ou revue), W14 (clic-pour-jouer, ConfirmDialog), W18 (tests pointant les constantes de libellé, pas les chaînes en dur).
- Garde globale : `npm test` reste vert à chaque workstream (≥478 + ajouts).

## 8. Vérification (mesurable)

| Critère | Commande / observation | Attendu |
|---|---|---|
| Types | `npm run check` | 0 erreur (chaque workstream) |
| Tests | `npm test` | tous verts (≥478 + ajouts) |
| Build | `npm run build` | vert |
| C-1 (W1) | evaluate après une partie jouée | éval à pleine force (pas l'Elo bot) |
| C-2 (W3) | roque 960 puis undo | plateau+trait+répétition restaurés |
| C-3 (W2) | importer un PGN joué en Noir | analysé côté Noirs (ou couleur demandée) |
| C-4 (W4) | jouer un coup au clavier (Play) | coup appliqué sans souris |
| Layout (W16) | preview 1280 px + 375 px | pas de débordement horizontal |
| Contraste (W13) | mesure blanc-sur-accent | ≥ 4,5:1 |
| FR (W18) | grep chaînes EN user-facing dans `src/ui` ; `lang` | 0 ; `fr` |
| Non-régression | promesses README re-confrontées | les 15 tenues le restent |

## 9. Anti-patterns (globaux)

1. **Bundler plusieurs workstreams dans une PR** (croyance #4) → une PR par Wn, batch par priorité (cf. Q1).
2. **Docs avant code** (croyance #5) → ADR/README après le vert du workstream.
3. **Casser une promesse README en corrigeant** → W1 ne doit pas laisser une analyse bridée ; W13 (`--accent`) ne doit pas casser le rendu sombre ; W18 ne doit pas traduire une clé de stockage ; W11 ne doit pas servir des puzzles hors-fenêtre.
4. **Régresser la réactivité ADR-0050/0051** → toute manip de `fen`/`game`/`turnColor` conserve la dérivation du trait depuis le FEN.
5. **API async sans lockstep** (W11) → énumérer tous les consommateurs (gate Contrat).
6. **Retirer un champ DB sans vérifier la tolérance des lectures** (W10, `weaknessCounters`).
7. **« axe fermé » auto-déclaré** → ne cocher la DoD que sur preuve (§8).

## 10. Rollback

Chaque workstream = une branche/PR isolée → `git revert` du merge suffit. W1/W2/W6/W8/W9/W13 sont des fixes locaux rétro-compatibles. W3 (snapshots) et W11 (async) sont internes à une classe/repo (revert sans corruption DB). W18 est additif (catalogue) — revert = retour à l'EN. Aucun workstream ne fait de migration DB destructive (schéma v4 inchangé ; W10 retire un champ *additif* lu avec `?? `).

## 11. Follow-up (hors périmètre)

- Reste du **P3** non foldé (polish pur, dette de tests étendue L70, `importedGames` mort L87, opponent `pickHumanMove` L88, types exhaustifs L91/L92).
- **Thème clair** via `prefers-color-scheme` (après les tokens W17 — Q5).
- **Navigation flèches-sur-cases** complète (W4 livre d'abord SAN/UCI — Q6).
- Acquis v1 toujours ouverts (abstraction `variant`, fallback IDB mémoire, virtualisation, signature `.exe`, analyse 960-aware) — réévaluer si un constat futur les rend actuels.
- ESLint/Prettier (Q6 v1, optionnel).

## 12. Décisions à arbitrer (avant exécution)

- **Q1 — Stratégie PR/batch.** (a) Une PR par workstream, regroupées par batch de priorité (P0, puis P1, puis P2), merge par batch — *recommandé* (pattern v1 éprouvé). (b) Une PR par priorité entière.
- **Q2 — Long-tail P3.** (a) Folder les 🟡/🔵 triviaux (S) dans le workstream de leur axe, différer le reste en Follow-up — *recommandé*. (b) Tout traiter. (c) Tout différer.
- **Q3 — Mécanisme i18n.** (a) Catalogue de messages FR (clé→valeur) + helper `t()`, sans lib runtime — *recommandé* (gère pluriel/genre proprement). (b) Traduction inline (plus rapide, dette si multi-locale un jour).
- **Q4 — Politique SAN.** (a) Conserver la SAN anglaise (`Nf3`) comme convention internationale, traduire le copy autour — *recommandé* (audit). (b) SAN française (`Cf3`). (c) Figurines (♘f3).
- **Q5 — Thème clair.** (a) Différer (poser les tokens en W17, thème clair plus tard) — *recommandé*. (b) Inclure dans W17.
- **Q6 — Coup clavier (W4).** (a) Saisie SAN/UCI d'abord (ferme WCAG vite, M), flèches-sur-cases en Follow-up — *recommandé*. (b) Navigation flèches complète d'emblée (L).

> **Résolu (2026-06-10) :** toutes recos (a) acceptées en bloc — cf. « Décisions actées » §1.

## 13. Statut de livraison *(F7 — rempli au fil des merges)*

| Workstream | Statut | Preuve DoD (commande) | PR |
|---|---|---|---|
| V2-W1 — force d'analyse explicite (flag `fullStrength`, 6 sites) | ✅ livré | `check` 0 · `test` 487 | `a2abf9b` (P0) |
| V2-W2 — couleur d'import (2 en-têtes + refus de deviner) | ✅ livré | regression C-3 ✓ | `a2abf9b` (P0) |
| V2-W3 — undo 960 castle-aware (pile de snapshots) | ✅ livré | suite undo 960 ✓ | `a2abf9b` (P0) |
| V2-W4 — coup clavier (`resolveMove` + input Board) | ✅ livré + preview | `resolveMove` tests + live | `a2abf9b` (P0) |
| V2-W6 — gardes règles (moveUci ×5 modes, roi-960 case libérée) | ✅ livré | test P1-16 ✓ | `9172f11` (P1a) |
| V2-W9 — gardes drills (Vision double-comptage, résignation) | ✅ livré | `test` 487 ✓ | `9172f11` (P1a) |
| V2-W8 — honnêteté coach/insights (radar n/a, caption 2/motif, trend rating) | ✅ livré | `check` 0 · `test` 487 | `c3c5687` (P1b) |
| V2-W5 — coutures moteur & résilience coquille (P1-03/04/06 + L8 ; P1-05 différé) | ✅ livré | `check` 0 · nav smoke | `e9f1...` (W5) |
| V2-W7 — ids anti-collision import/répertoire + PGN multi-parties | ✅ livré | `check` 0 · `test` 487 | (W7) |
| V2-W10 — closers de boucle (badge cartes dues P1-07) | ✅ livré | boot smoke · `test` 487 | (W10) |
| V2-W11 — `next()` async par index (ripple 8 appelants en lockstep) | ✅ livré | `test` 488 · Tactics live · guard P1-02 | (W11, PR séparée) |
| V2-W12 — confirm coach non bloquant + asymétrie horloge (F5/F6) ✓ ; **décomposition (DoD lignes) → part 2** | 🟡 partiel | `check` 0/0 · `test` 488 · coached live | (W12 part 1, PR séparée) |
| V2-P1-05 — reprise crash moteur (Play : Retry au lieu de figer) | ✅ livré | `check` 0 · build vert | #28 |
| V2-W13 — a11y baseline + nav overflow/active (absorbe W16) | ✅ livré | overflow 0px @1280/375 live · `check` 0/0 | #25 |
| V2-W14 — clic-pour-jouer + ConfirmDialog (les 5 `confirm()` supprimés) | ✅ livré | dialog live · `test` 488 | #26 |
| V2-W15 — parcours (Home découvrable, sortie onboarding, feedback calibration) | ✅ livré | Home live · `test` 488 | #27 |
| V2-W17 — tokens design + composants partagés promus (partiel) | ✅ livré | `check` 0/0 · build | #29 |
| V2-W19 — reconcile docs (README tests/coaching, ADR-0052) | ✅ livré | ce commit | (W19) |
| V2-W12 part 2 — décomposition `Play.svelte` (DoD < 300 l.) | ◻️ reste (structurel) | — | — |
| V2-W18 — **UI bilingue FR/EN + bascule de langue** (infra i18n + 31 vues + générateurs/maps TS + données JSON + ADR-0053) | ✅ livré (FR/EN complet) | `check` 0/0 · `test` 504 · build · switch + cartes concepts FR vérifiés live | (W18 + suivi) |

> **Avancement final (2026-06-16, run autonome)** : **P0 4/4 + tout P1 + P2 W13/W14/W15/W17 + W19** livrés, commités et **mergés sur `main`** (PRs #22–#29) ; `svelte-check` **0/0**, `vitest` **488 verts**, `vite build` vert. **Restent** (cf. ADR-0052) : **W18** (conversion FR complète — chantier dédié, trop large pour un run continu sans bâcler) et **W12 part 2** (extraction du god-component) ; plus suivis mécaniques (suppression des copies scoppées `button.ghost`/`.link`, siblings reprise-crash Sparring/Comeback/Endgames, polish parcours / `aria-live`).
