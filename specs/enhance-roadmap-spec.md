# Spec — enhance-roadmap : implémentation phasée des 25 findings /enhance

> **V1 FINALE** — refiner 2 cycles (3ᵉ skippé) + /enrich 3 cycles ; arbitrages Q-A..Q-F et enrichissements I1..I10 **ratifiés et foldés le 2026-07-02**. Draft 2026-07-02, HEAD `396b4c5`.
> Source : session /enhance du 2026-07-02 (25 findings vérifiés code-en-main, 4 claims tués en vérification).
> Baseline : [`reports/enhance-roadmap_baseline.json`](../reports/enhance-roadmap_baseline.json) ·
> Ancres : [`reports/enhance-roadmap_target_exists.json`](../reports/enhance-roadmap_target_exists.json) ·
> Collision : [`reports/enhance-roadmap_collision.json`](../reports/enhance-roadmap_collision.json) (0 PR ouverte).

---

## §0. Contexte

L'app est une machine d'entraînement complète et honnête mais **muette** : elle calcule et stocke bien plus qu'elle ne montre (delta de rating jeté à `Play.svelte:733`, `rollingWinRate` jamais rendu, données par-pli sans UI, zéro son), n'enregistre pas deux télémétries clés (horloge par coup, rating par partie), et laisse plusieurs silos non connectés (répertoire ↔ parties réelles, guess ↔ tes parties, métacog ↔ routage). Cette spec ordonne les 25 findings en **24 PRs sur 6 vagues** (PR-19 scindée 19a→19b, Q-C=b), triées par dépendances puis levier. Elle est le **document maître** : chaque PR reçoit son propre `/draft` au moment de l'exécution (scan pré-V0 frais, baseline propre) — cette spec fixe le *quoi*, l'*ordre* et les *gates* ; les specs filles fixent le *comment*.

## §0.5 Arbitrages — ACTÉS (ratifiés 2026-07-02)

- **Q-A = (a)** — PR-02 : bundle des deux capteurs (un concern « télémétrie qui s'évapore », même point de couture).
- **Q-B = (a)** — PR-10 : cluster des wire-ups Insights + badges radar (zéro logique neuve, précédent cluster MINOR #33).
- **Q-C = (b)** — PR-19 **scindée en séquence** : 19a interactif → 19b SRS (le SRS grade une révision jouable).
- **Q-D = (a)** — PR-12 : **~8 nouveaux scénarios** authorés (7 → ~15), chacun testé légalité+solvabilité.
- **Q-E = (c)** — PR-21 : **MultiPV ciblé** — re-passe uniquement sur les coups déjà classés mistake/blunder.
- **Q-F = (a)** — PR-05 : **WebAudio synthétisé, coups ON + célébrations ON par défaut**, kill-switch un clic dans Settings.
- **Enrichissements I1..I10 ratifiés** (bundle [`_improvements.md`](../reports/enhance-roadmap_improvements.md)) — foldés dans les lignes PR concernées ci-dessous + tableau d'avancement (I3).

## §1. Baseline empirique

Voir [`reports/enhance-roadmap_baseline.json`](../reports/enhance-roadmap_baseline.json). Chiffres porteurs :
242 fichiers TS/Svelte · 33 composants UI / 23 vues · 58 ADRs (prochain : **ADR-0059**) · schéma IndexedDB **v4 + champs additifs** (pattern sans bump établi) · i18n FR/EN obligatoire · bibliothèque de scénarios **7** · probes coach **2/7** · cartes-concepts **7 familles** · guess **3 parties** hard-codées · batch **single-PV** · 0 PR ouverte · suite de tests non re-exécutée ici (`node_modules` absent du worktree — gate délégué aux pre-flights).

## §2. Scope

**IN** : le roadmap lui-même — découpage, ordre, dépendances, gates par PR, doctrine transverse. Les 25 findings /enhance, rien d'autre.
**OUT** : la queue basse /enhance (thème clair — bloqué W17 ; low-time warnings ; budget takebacks ; Brier ; cartes générées depuis tes échecs ; calendrier de streak ; blindfold multi-cases ; barre d'éval live — contraire doctrine ; nav/IA Home — territoire audit-v2 W15/W16), Maia (ADR-0019), tout backend, toute refonte visuelle.
**Règle process** : 1 PR = 1 concern = 1 spec fille `/draft` + arbitrages propres. Cette spec ne s'exécute jamais directement.

## §3. Pre-flight gates (par PR, à l'exécution)

1. `git pull` + re-vérifier les **ancres** de la PR (fichier:ligne du tableau §4) — si déplacées, re-scanner avant d'éditer.
2. `gh pr list --state open` — 0 collision sur le scope.
3. `npm test` + `npm run check` verts AVANT édition (baseline locale propre).
4. Les dépendances de vague (§4, colonne "Dép.") sont **mergées**.
5. Chaque nouvelle chaîne UI passe par `t()/tn()` FR+EN ; chaque champ de schéma est **additif** (pas de `DB_VERSION` bump ; migration au chargement).
6. Choix non-évident → entrée **ADR** appendée (jamais d'amendement in-place) ; anti-patterns nommés `AP-<AREA>-<N>`.

## §4. Phase A — le roadmap (6 vagues, 23 PRs)

### Vague 0 — Assurance & socle télémétrie *(à merger d'abord : tout le reste accumule des données ou s'appuie dessus)*

| PR | Findings | Contenu | Hooks | Dép. | Effort |
|---|---|---|---|---|---|
| **PR-01 `data-backup`** | F21 | Export/import JSON de **tous** les stores (games, analyses, attempts, puzzles, playerModel, settings, srsCards, repertoire, woodpeckerSets, importedGames) + version de schéma embarquée + restauration idempotente avec confirmation. UI dans Settings → "Vos données". **I2** : le cache Syzygy (`chess-trainer-tbcache`, DB séparée) est **exclu** — re-fetchable ; le wipe ADR-0013 le couvre déjà. **I5** : garde de version au restore — un backup d'un schéma plus récent que l'app est refusé proprement (message), jamais importé partiellement. | `downloadText` (`src/ui/pgnDownload.ts`), export coach existant `Settings.svelte:74-77`, wipe existant (ADR-0013) comme inverse | — | M |
| **PR-02 `play-telemetry`** | F3 + socle F1 | (a) **Accumulateur par coup** dans `gameSession` — **I4** : temps mesurés par **timestamps au coup** (`performance.now()`), PAS le tick rAF (précédent audit v2 : le dialog coach gèle l'horloge rAF ; onglet en arrière-plan = rAF suspendu) ; valeurs aberrantes clampées + flaguées ; **agnostique variante/cadence** (hérité tel quel par PR-20, I1). Écrire `%clk` dans le PGN persisté (l'export PGN + le header `TimeControl` — DEFER ADR-0036 — tombent gratuits). (b) Snapshot **`ratingAfter`** (+ `ratingBefore`) sur `GameRecord` à chaque partie comptée. Champs additifs. Bundle acté Q-A=a. | Horloge `src/clock/Clock.ts` (affichage) ; consommateurs déjà écrits `src/analysis/pgn.ts:64-68`, `weakness.ts:159-176` ; fold rating `Play.svelte:723-737` | — | M |

**Gate vague 0** : une partie jouée produit un PGN avec `%clk` que `parsePgn` re-consomme (round-trip testé) ; un export→wipe→import restaure un profil identique (deep-equal store à store).

### Vague 1 — Feedback immédiat *(le moment post-partie devient le cœur émotionnel)*

| PR | Findings | Contenu | Hooks | Dép. | Effort |
|---|---|---|---|---|---|
| **PR-03 `postgame-debrief`** | F2 | Carte de débrief à `status==='over'` : delta Elo joueur (`avant→après`), win-rate glissant + explication de la nudge (bande 55 %), nom d'ouverture (namer ECO sur le PGN, sans analyse complète), stats d'horloge (temps/camp, moyenne/coup — lit PR-02). Doctrine : descriptif, pas de grade. | Delta calculé `Play.svelte:723-737` ; `rollingWinRate` `AdaptiveOpponent.ts:35-38` ; namer **vérifié** `nameOpening(uci[])` pur `eco.ts:23` + `loadEco()` `eco.ts:43` ; `adaptLine` existant `Play.svelte:1117-1120` | PR-02 | M |
| **PR-04 `progress-graph`** | F1 | Vue "Progression" dans Insights : courbe de rating par pool (depuis les snapshots PR-02) + courbe puzzle-rating (depuis `puzzleAttempts.ratingAfter`, données déjà persistées) + RD en bande. Honnêteté : n faible affiché, pas de courbe lissée trompeuse. **I9** : note de lecture sur le graphe — le rating vs bot est une **échelle interne auto-référentielle** (système fermé à 2 joueurs) ; comparable à soi-même dans le temps, PAS à FIDE/Lichess. | `GameRecord{playedAt,result,botElo}` `db.ts:21-45` ; puzzle-rating : **historique déjà persisté** `puzzleAttempts.ratingBefore/After` `db.ts:53-54` (vérifié) ; sparklines SVG d'Insights (`weaknessTrend` pattern) | PR-02 | M |
| **PR-05 `sound-celebration`** | F6 | Sons synthétisés WebAudio (coup, capture, échec, promotion, fin de partie, milestone) — **Q-F=a acté : coups ON + célébrations ON par défaut**, kill-switch un clic dans Settings. Célébrations sobres : record de rating, palier de streak, mastery de session. Zéro asset binaire. **I7** : branché aux **couches partagées** (`Board.svelte` / `gameSession`), pas par vue — couvre d'office tous les trainers. | Aucun (grep Audio = 0 — c'est le point) ; couches partagées : `Board.svelte`, `gameSession` | — | M |

**Gate vague 1** : après une partie comptée, delta + win-rate + ouverture + temps visibles sans clic ; le graphe affiche ≥2 points après 2 parties **comptées** (les unrated ne snapshotent pas) ; un coup joué produit un son quand le toggle est actif (et aucun sinon).

### Vague 2 — Données massives *(la boucle personnalisée se nourrit dès la première heure)*

| PR | Findings | Contenu | Hooks | Dép. | Effort |
|---|---|---|---|---|---|
| **PR-06 `bulk-import`** | F4 | Import multi-parties : le split existant alimente une file séquentielle annulable avec progression (« 12/50 analysées ») + dédup par contenu + reprise. Fichier `.pgn` uploadable en plus du collage. | Split `Import.svelte:156-160` ; runner backlog `Play.svelte:1156-1162` (`analyzeBacklogNow`) ; ids contenu-adressés | — | M |
| **PR-07 `lichess-fetch`** | F19 | « Récupérer mes N dernières parties Lichess » — API export publique, derrière le **même pattern de consentement + cache** que Syzygy (ADR-0012) ; pseudo stocké en Settings ; réutilise la file PR-06. Chess.com en §11. **Pre-flight d'exécution obligatoire** : l'endpoint/format Lichess est une hypothèse externe invérifiable offline — le vérifier en live avant de drafter la spec fille. | `src/endgame/syzygy.ts` (consent-gate) ; file PR-06 | PR-06 | M |
| **PR-08 `annotated-replay`** | F7 | Replay coup-par-coup dans AnalysisResult : liste SAN annotée (?!/?/??), éval + `cpLoss` + explication + `secondsSpent` par coup, navigation clavier, saut depuis la courbe. | Per-pli stocké `src/analysis/types.ts` ; `EvalGraph.svelte` ; `explainPly` (`explain.ts`) ; board existant | (PR-02 enrichit) | L |

**Gate vague 2** : un PGN Lichess de 50 parties s'importe en une action, s'analyse en file avec annulation propre ; le replay navigue les 40 coups d'une partie analysée avec annotation par coup.

### Vague 3 — Boucle fermée *(les résultats retournent dans le système)*

| PR | Findings | Contenu | Hooks | Dép. | Effort |
|---|---|---|---|---|---|
| **PR-09 `session-log`** | F5 | **Nouveau store** `sessionLog` (→ bump **v5**, pattern v1→v4) : plan, complétion par step, mastery atteinte o/n, réflexion optionnelle persistée — supersède le display-only ADR-0039 Q-B via nouvel ADR. **I8** : le store naît avec les champs additifs **`programId?` / `day?`** (consommés par PR-18 sans re-migration). + carte de fin de session (récap : steps faits, mastery, streak) — **I6** : réutilise la primitive carte de récap de PR-03 (défaut ; divergence justifiable en spec fille) — + le plan suivant lit les complétions. | `Session.svelte` (state en mémoire existant), précédent récap Woodpecker (`Woodpecker.svelte:143`), carte PR-03 | — | M |
| **PR-10 `insights-actionable`** | F14 + F18 | Wire-ups : leak → « Apprendre le pattern » (carte-concept) ; leak → « Sparring ciblé » (`scenarioForFocus`) ; ligne d'efficacité → « Re-driller » ; + badges d'honnêteté : `n` par motif, `detail` de dimension au survol du radar. Zéro logique neuve. | Signaux `app.svelte.ts:52-77` (`conceptFocusMotif`, `sparringScenarioId`) ; `scenarioForFocus` `program.ts:19` ; champs `CoachProfile` stockés `coach/types.ts` | — | S |
| **PR-11 `metacog-routing`** | F8 | Nudges de routage doux (suggestion, jamais grade — AP-META-1 respecté) : selfTag « rushed » dominant → tactiques chronométrées ; « unfamiliar-pattern » → carte-concept d'abord ; surconfiance → ligne coach. Seuils d'échantillon planchers. | Verdicts `metacog.ts:104-115` ; impulsivité `impulsivity.ts` ; readout Insights existant | — | S |
| **PR-12 `coach-probes-v3`** | F9 | Élargir `IMBALANCE_LIBRARY` (**Q-D=a acté : ~8 nouveaux scénarios**, 7 → ~15 : IQP, roques opposés, paire de fous, finale de tours, qualité, forteresse…) — **contenu FEN authoré + testé** (légalité+solvabilité, comme MASTER_GAMES) — brancher les nouvelles probes coach + bouton « Re-vérifier ce motif » depuis l'efficacité (re-probe ciblé, DEFER coach-program-v2 D2). **I10** : une re-probe précoce (juste après drill) est labellisée **« mesure à chaud »** — récence ≠ acquisition ; label descriptif, jamais un blocage. | `probes.ts:32-46` ; `IMBALANCE_LIBRARY` (`analysis/scenarios.ts`, 7 entrées) ; `programEfficacy` (`coachLoop.ts`) | — | L (contenu) |

**Gate vague 3** : une session terminée écrit un enregistrement `sessionLog` relu par le plan suivant ; chaque leak d'Insights expose 2 actions cliquables ; un selfTag dominant déclenche exactement un nudge (jamais empilés) ; une re-probe motif met à jour le trend coach (budget de durée mesuré en spec fille).

### Vague 4 — Trainers personnalisés *(chaque silo rejoint TES parties)*

| PR | Findings | Contenu | Hooks | Dép. | Effort |
|---|---|---|---|---|---|
| **PR-13 `repertoire-deviation`** | F12 | Post-analyse : croiser les plies avec **tes lignes de répertoire** ; sur déviation (toi ou hors-répertoire adverse), proposer « revoir cette carte » / « étendre la ligne ». | Store `repertoire/` ; SAN par pli des analyses ; ajout-ligne existant (README Openings) | — | M |
| **PR-14 `guess-own-games`** | F13 | Provider guess depuis tes parties analysées (`GameRecord.pgn` + `playerColor`) ; comparaison à `bestUci` stocké (« tu as rejoué ta partie à 74 % ») ; sélecteur de partie. | Driver `guess/guess.ts` (pgn+guessColor) ; analyses persistées | — | M |
| **PR-15 `explorer-own-stats`** | F15 | Agrégat par ECO **calculé** depuis les parties analysées (l'ECO n'est PAS stocké — calcul à l'agrégation) : score, n, ACPL d'ouverture ; affiché dans Explorer + Répertoire. | Namer ECO ; PGNs persistés ; `Explorer.svelte` | — | M |
| **PR-16 `endgame-from-games`** | F17 | Extraire la position d'entrée de finale des parties où la conversion a échoué → drill sparring exact avec feedback Syzygy (≤7 pièces, consentement existant). | Bornes `byPhase` `types.ts:76` ; runner sparring ; client Syzygy | — | M |
| **PR-17 `puzzle-playout`** | F22 | « Jouer la position » post-puzzle : continuer la position finale contre le bot adaptatif (non compté). | Runner sparring-from-FEN ; `SolutionReveal` | — | S |

**Gate vague 4** : une partie analysée avec déviation de répertoire produit exactement une proposition ; guess perso tourne sur ≥1 partie analysée ; l'explorer affiche tes stats sur ≥3 ECO après import en masse ; une finale ratée devient un drill jouable en 1 clic.

### Vague 5 — Profondeur *(les gros morceaux, une fois le socle rentabilisé)*

| PR | Findings | Contenu | Hooks | Dép. | Effort |
|---|---|---|---|---|---|
| **PR-18 `coach-multiday`** | F11 | Programme coach étalé (champ additif `coachProfile` : curseur jour/étape) ; Home : « Ton programme : jour 2/5 → » ; complétion lue depuis `sessionLog`. Lève le DEFER ADR-0045. | `program.ts:169` ; `sessionLog` (PR-09) ; carte rough-patch Home (funnel C8) | PR-09 | M |
| **PR-19a `concept-cards-interactive`** | F16 | Exemple jouable « à toi de jouer » sur chaque carte (lève le 1ᵉʳ DEFER ADR-0040 §11). **Q-C=b acté : séquence 19a → 19b** — le SRS a besoin du jouable pour grader. | `ConceptCard.svelte` + `SolutionReveal` | — | M |
| **PR-19b `concept-cards-srs`** | F23 | Carte SRS par concept, gradée sur l'exemple jouable de 19a (précédent per-square ADR-0043 ; `srsCards.kind` gagne le littéral additif `'concept'` — pas de bump). Lève le 2ᵈ DEFER ADR-0040 §11. | module `srs/` ; 19a | PR-19a | S |
| **PR-20 `chess960-first-class`** | F10 | Analyse 960 (modules opening/ECO **désactivés**, gaffes/motifs/puzzles actifs — lève ADR-0041 Q-D), horloges 960 (Q-C), choix de couleur. Puzzles perso 960 taggés variante. **I1** : hérite des acquis transverses tels quels — accumulateur `%clk` de PR-02 (agnostique variante) + replay annoté de PR-08 pour les parties 960 — sinon 960 re-shippe sans horloge dans le PGN ni replay. | Exclusions `Play.svelte:774`, `:251-252`, `:321-326` ; pipeline batch ; acquis PR-02/PR-08 | PR-02, PR-08 (hérités) | L |
| **PR-21 `only-move`** | F24 | Persister `secondBestCp` — **Q-E=c acté : MultiPV ciblé**, re-passe uniquement les coups déjà classés mistake/blunder (coût marginal minimal, budget d'analyse intact) ; consommateurs : badge « seul coup » dans replay (PR-08) + WhenToThink (« il n'y avait qu'un coup ») + tag puzzle only-move. | `BatchAnalyzer.ts` (single-PV aujourd'hui) ; DEFER critical-moment §11 | PR-08 | M |
| **PR-22 `premove-alert`** | F20 | Alerte pré-coup opt-in (éval shallow du candidat avant commit, badge non-bloquant) — tient la promesse Phase 2 du README. Garde-fous : jamais en bullet/blitz (budget moteur), cooldown. | `checkMove` `Play.svelte:1143-1145` ; seuils `opponentAgency.ts:82-85` | — | M |
| **PR-23 `board-line-reeval`** | F25 | Re-éval MultiPV des lignes explorées sur l'analysis board (lève DEFER Q-B) — dernier par coût/levier. | `engine.analyzeLines` (utilisé par `pickHumanMove`) ; `AnalysisBoard.svelte` | — | M |

**Gate vague 5** : une partie 960 s'auto-analyse sans tag d'ouverture et génère des puzzles ; le programme coach survit à un rechargement au jour 2 ; une carte-concept se joue et se re-planifie via FSRS ; l'alerte pré-coup ne se déclenche jamais en bullet/blitz ; son budget de latence en rapid/classical est **fixé par mesure** dans la spec fille (pas de chiffre inventé ici).

### Récapitulatif dépendances

```
PR-01 ──────────────────────────────► (aucun dépendant — assurance)
PR-02 ──► PR-03, PR-04, PR-20 (hérité), (enrichit PR-08)
PR-06 ──► PR-07
PR-08 ──► PR-20 (hérité), PR-21
PR-09 ──► PR-18
PR-19a ──► PR-19b
Tout le reste : parallélisable dans sa vague.
```

### Tableau d'avancement (I3 — tenu à jour à chaque merge)

| PR | Spec fille | Statut | Merge |
|---|---|---|---|
| PR-01 `data-backup` | [`pr-01-data-backup-spec.md`](pr-01-data-backup-spec.md) | **livré** (ADR-0059) | 2026-07-02 |
| PR-02 `play-telemetry` | [`pr-02-play-telemetry-spec.md`](pr-02-play-telemetry-spec.md) | **livré** (ADR-0060) | 2026-07-02 |
| PR-03 `postgame-debrief` | [`pr-03-postgame-debrief-spec.md`](pr-03-postgame-debrief-spec.md) | **livré** (ADR-0061) | 2026-07-02 |
| PR-04 `progress-graph` | [`pr-04-progress-graph-spec.md`](pr-04-progress-graph-spec.md) | **livré** (ADR-0062) | 2026-07-02 |
| PR-05 `sound-celebration` | [`pr-05-sound-celebration-spec.md`](pr-05-sound-celebration-spec.md) | **livré** (ADR-0063) | 2026-07-02 |
| PR-06 `bulk-import` | [`pr-06-bulk-import-spec.md`](pr-06-bulk-import-spec.md) | **livré** (ADR-0064) | 2026-07-02 |
| PR-07 `lichess-fetch` | [`pr-07-lichess-fetch-spec.md`](pr-07-lichess-fetch-spec.md) | **livré** (ADR-0065) | 2026-07-02 |
| PR-08 `annotated-replay` | [`pr-08-annotated-replay-spec.md`](pr-08-annotated-replay-spec.md) | **livré** (ADR-0066) | 2026-07-02 |
| PR-09 `session-log` | [`pr-09-session-log-spec.md`](pr-09-session-log-spec.md) | **livré** (ADR-0067, v5) | 2026-07-02 |
| PR-10 `insights-actionable` | [`pr-10-insights-actionable-spec.md`](pr-10-insights-actionable-spec.md) | **livré** (ADR-0068) | 2026-07-02 |
| PR-11 `metacog-routing` | [`pr-11-metacog-routing-spec.md`](pr-11-metacog-routing-spec.md) | **livré** (ADR-0069) | 2026-07-02 |
| PR-12 `coach-probes-v3` | [`pr-12-coach-probes-v3-spec.md`](pr-12-coach-probes-v3-spec.md) | **livré** (ADR-0070) | 2026-07-02 |
| PR-13 `repertoire-deviation` | [`pr-13-repertoire-deviation-spec.md`](pr-13-repertoire-deviation-spec.md) | **livré** (ADR-0071) | 2026-07-02 |
| PR-14 `guess-own-games` | [`pr-14-guess-own-games-spec.md`](pr-14-guess-own-games-spec.md) | **livré** (ADR-0072) | 2026-07-02 |
| PR-15 `explorer-own-stats` | [`pr-15-explorer-own-stats-spec.md`](pr-15-explorer-own-stats-spec.md) | **livré** (ADR-0073) | 2026-07-02 |
| PR-16 `endgame-from-games` | — | à drafter | — |
| PR-17 `puzzle-playout` | — | à drafter | — |
| PR-18 `coach-multiday` | — | à drafter | — |
| PR-19a `concept-cards-interactive` | — | à drafter | — |
| PR-19b `concept-cards-srs` | — | à drafter | — |
| PR-20 `chess960-first-class` | — | à drafter | — |
| PR-21 `only-move` | — | à drafter | — |
| PR-22 `premove-alert` | — | à drafter | — |
| PR-23 `board-line-reeval` | — | à drafter | — |

## §5. Phase B — doctrine de tests (transverse ; détail par spec fille)

- **Cores purs d'abord** : chaque logique nouvelle (agrégat rating, stats horloge, croisement répertoire, provider guess, seuils de nudge) naît **pure + unit-testée**, la vue ne fait que brancher (pattern F6/gameSession).
- **Round-trips obligatoires** : PGN+%clk (écrit→relu), backup (export→wipe→import→deep-equal), sessionLog (écrit→relu par le plan), snapshot rating (partie comptée → point ; unrated → aucun point).
- **fake-indexeddb** pour tout store additif ; migration au chargement testée sur enregistrement legacy (champ absent).
- **i18n** : test de complétude FR/EN pour chaque namespace nouveau.
- **Perf** : PR-21 mesure le temps batch avant/après MultiPV sur une partie de 40 coups (gate chiffré dans la spec fille).

## §6. Phase C — vérification (gates mesurables par vague, cf. §4)

Chaque PR : `npm test` + `npm run check` + `npm run build` verts, plus le **gate de vague** (§4). Vérification manuelle scriptée dans la spec fille (parcours utilisateur en 5 étapes max). Une PR ne merge pas si le gate de sa vague régresse.

## §7. Phase Z — docs (dernière, par PR)

- **ADR** appendé par choix non-évident (prochain : ADR-0059). Supersédences cross-linkées (ex. PR-09 supersède le display-only d'ADR-0039 Q-B ; PR-20 lève ADR-0041 Q-C/Q-D ; PR-19 lève ADR-0040 §11 partiellement).
- **README** : sections Features mises à jour **après** merge du code (jamais avant), y compris la levée des mentions « Phase 2 » (pré-coup) et « not yet auto-analysed » (960).
- Wrap-up de session (skill session-wrapup) à chaque merge significatif.

## §8. Critères d'acceptation globaux du roadmap

1. Les 25 findings tracent chacun vers exactement une PR (§4) — aucune orpheline, aucune dupliquée.
2. Schéma : bump de `DB_VERSION` **uniquement** pour créer un store (pattern v1→v4 ; PR-09 → **v5** pour `sessionLog`) ; toute autre évolution = champ additif relu `?? défaut`. Un bump pour un autre motif = STOP + ADR dédié.
3. Doctrine d'honnêteté intacte : aucun grade, aucun claim causal, planchers d'échantillon partout où un chiffre s'affiche.
4. Posture réseau : PR-07 est le **seul** nouvel egress, consent-gated, caché, documenté dans Privacy.
5. FR/EN complets à chaque PR ; `svelte-check` 0 erreur maintenu.
6. Le gate **dur** = les arêtes de dépendance (§4 récap) ; l'ordre des vagues est le tri par levier **recommandé** — une PR sans dépendance peut avancer même si sa vague n'est pas ouverte, jamais l'inverse.

## §9. Anti-patterns nommés

- **AP-ROADMAP-1** — Exécuter cette spec directement sans spec fille `/draft` par PR (pas de scan frais = premisse périmée).
- **AP-ROADMAP-2** — Bundler deux concerns dans une PR parce que « c'est le même fichier » (Play.svelte est déjà à 1200+ lignes ; le débrief PR-03 N'ABSORBE PAS la télémétrie PR-02).
- **AP-ROADMAP-3** — Afficher un chiffre sans plancher d'échantillon (viole la doctrine ; cf. badges `n` PR-10).
- **AP-ROADMAP-4** — Bump de `DB_VERSION` par confort (le pattern additif est établi ; un bump casse la promesse « migrations additives »).
- **AP-ROADMAP-5** — Docs avant code (README annonçant une feature non mergée).
- **AP-ROADMAP-6** — Nouvel egress réseau hors du pattern consentement+cache ADR-0012 (PR-07 uniquement, jamais silencieux).
- **AP-ROADMAP-7** — Célébration bruyante/bloquante (PR-05 : sobre, dismissible, off par défaut si l'arbitrage le décide ; jamais de modale forcée — doctrine audit v2).
- **AP-ROADMAP-8** — Étendre `IMBALANCE_LIBRARY` avec des FEN non testées (chaque scénario nouveau = test de légalité + solvabilité, comme les MASTER_GAMES).

## §10. Rollback

- Granularité = la PR (revert propre par merge commit ; aucune PR ne laisse un store à moitié migré — les champs additifs absents se relisent `?? défaut`).
- PR-01 (backup) est le filet du roadmap entier : mergée en premier, elle permet à tout testeur de snapshotter avant chaque vague.
- PR-21 (MultiPV) : flag interne pour retomber en single-PV si le budget explose.
- Une vague peut s'arrêter après n'importe quelle PR sans état incohérent (deux couplages intra-vague : **PR-06→PR-07** en V2 et **PR-19a→PR-19b** en V5, à merger dans ces ordres).

## §11. Follow-ups (hors roadmap, re-triés depuis /enhance)

Thème clair (post-W17) · low-time warnings · budget takebacks · Brier · cartes générées depuis tes échecs · calendrier/décroissance de streak · blindfold multi-cases · vrai blindfold calc · fetch chess.com · transpositions d'ouverture · localisation des noms ECO · Maia (ADR-0019, backend requis).
