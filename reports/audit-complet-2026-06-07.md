# Audit complet — chess-trainer

> Analyse multi-agents du bon fonctionnement de l'intégralité du jeu.
> Date : 2026-06-07 · Méthode : 7 agents spécialisés, lecture seule, constats ancrés `fichier:ligne`.
> Périmètre : `src/` (62 modules TS + 28 composants Svelte), `launcher/`, `scripts/`, config.

---

## 1. Synthèse exécutive

**Verdict global : projet mûr et soigné (≈ 7,5/10), avec une dette technique concentrée et identifiable.**
Le code est discipliné (TypeScript strict réel, 0 `any`/`TODO` en prod, doc/ADR synchronisés), la séparation logique/UI/worker est exemplaire, et la promesse « tout reste local » est réellement tenue. Les faiblesses ne sont pas diffuses : elles se concentrent sur **trois points systémiques** (le client moteur, le boot/stockage, le chargement des puzzles) et **quelques écarts de règles d'échecs** bien circonscrits.

| Axe | Santé | Score | En une phrase |
|---|---|---|---|
| Architecture & conception | Solide ✅ | 8/10 | Découplage logique/UI/worker exemplaire ; réserves sur la couche de stockage à deux vitesses et le client moteur partagé. |
| **Correction fonctionnelle du jeu** | Correct ⚠️ | 7,5/10 | Jouable et correct (Blancs/Noirs, standard/960) ; mais sous-promotion humaine impossible et trous Chess960 post-roque. |
| Robustesse & erreurs | Correct ⚠️ | 6,5/10 | Codage défensif réel, mais moteur sans sérialisation, worker sans gestion de crash, ouverture IndexedDB non protégée. |
| Maintenabilité & qualité | Solide ✅ | 8,5/10 | Discipline TS et doc hors normes ; seule vraie faiblesse = pas de CI + zones critiques non testées. |
| Évolutivité & extensibilité | Correct ⚠️ | 7/10 | Contenu data-driven ; mais routage faiblesse→vue dupliqué et aucun plan pour un vrai changement de schéma. |
| Sécurité & confidentialité | Solide ✅ | 8,5/10 | Local-only tenu, 0 surface XSS, 0 télémétrie ; réserves : pas de CSP, download sans hash, deps en `^`. |
| Performance | Correct ⚠️ | 6,5/10 | Worker/IDB sains ; mais 80k puzzles en RAM au boot et moteur partagé non sérialisé. |

### Le jeu fonctionne-t-il ?

**Oui, de bout en bout.** Une partie standard se déroule correctement du début à l'échec et mat / nulle / drapeau, pour les Blancs **et** les Noirs, en standard **comme** en Chess960. Les bugs récents ADR-0050/0051 (les coups des Noirs n'étaient pas appliqués) sont **réellement corrigés à la source** (le plateau dérive le trait du FEN). Glicko-2 est exact (reproduit l'exemple canonique de Glickman 2013), l'horloge Fischer + la règle FIDE 6.9 sont conformes et testées, la génération Chess960 est valide sur les 960 positions.

**Réserves de correction (cas limites, pas des blocages de partie) :**
- ❌ **Le joueur humain ne peut jamais sous-promouvoir** (toujours Dame, codé en dur) — pénalisant en finale.
- ❌ **Chess960 après un roque** : la triple répétition n'est plus détectée et le PGN enregistré est tronqué.

---

## 2. Constats critiques & convergents (à lire en premier)

Ces points ont été signalés **indépendamment par plusieurs agents** — c'est le signal le plus fort de l'audit.

### 🔴 C-1 — `EngineClient` n'a aucune sérialisation des requêtes concurrentes
*Signalé par Robustesse (🔴), Performance (🔴), Architecture (🟠).*
**Emplacement :** `src/engine/EngineClient.ts:44` (un seul `Set<Listener>` partagé), `:63-66` (diffusion à *tous* les listeners), `:106`/`:144` (aucun verrou), `:188-198` (`terminate()` ne rejette pas les attentes).
**Problème :** il y a **un** worker et **un** Set de listeners global. Si deux flux appellent le moteur en même temps (ex. `coachCheck` pendant le coup du bot, ou Play → AnalysisBoard pendant que le bot « réfléchit »), les commandes `position/go` s'entrelacent sur le même worker et le **premier `bestmove` résout les deux promesses** → scores attribués à la mauvaise position, coup potentiellement illégal, `MultiPV` réinitialisé pendant un autre calcul. De plus `terminate()` laisse les `waitFor` en vol **orphelins** (hang jusqu'au timeout 30 s) et **fuite les listeners**. Aucun `onerror`/`onmessageerror` : un crash du worker gèle l'UI 30 s.
**C'est aujourd'hui « masqué »** parce que le flux nominal est séquentiel et que les vues d'analyse utilisent un jeton `seq` — mais ce jeton *ignore* le résultat, il ne *sérialise* pas le worker. L'invariant « un appel à la fois » n'est ni encodé ni documenté.
**Correctif :** file FIFO interne (un seul `go` actif), listener scoppé par requête, `terminate()` qui rejette les attentes et vide le Set, branchement `onerror`/`onmessageerror`.

### 🔴 C-2 — Ouverture d'IndexedDB jamais protégée → boot bloqué en navigation privée / quota
*Signalé par Robustesse (🔴).*
**Emplacement :** `src/store/db.ts:119` (`openTrainerDB`), appelé sans garde depuis `src/state/app.svelte.ts:62` (`boot`) et `src/ui/App.svelte:31` (`onMount`).
**Problème :** si IndexedDB est indisponible (mode privé historique, politique, échec d'upgrade, quota), `openDB` rejette, `booted` ne passe jamais à `true`, l'app reste **bloquée indéfiniment sur « Loading… »** avec un rejet non capturé. Aucune voie de dégradation.
**Correctif :** try/catch autour de l'ouverture + fallback (mémoire ou message d'erreur explicite) ; garde dans `App.onMount`.

### 🔴 C-3 — Les ~80 000 puzzles sont chargés intégralement en RAM au démarrage
*Signalé par Performance (🔴).*
**Emplacement :** `src/trainer/PuzzleRepo.ts:52` (`this.cache = await db.getAll('puzzles')`), dans le chemin de boot bloquant (`app.svelte.ts:65`).
**Problème :** au boot, `init()` charge **80k objets `Puzzle` en un seul tableau JS** (≈ 30–80 Mo de heap retenus toute la session) après un seeding de 80k `put` en une transaction (gel de plusieurs secondes au 1ᵉʳ run). `next()` re-filtre ce tableau en O(n) à **chaque** « Next puzzle ». L'infrastructure pour mieux faire existe déjà : l'index `rating` est défini (`db.ts:102`) mais inutilisé.
**Correctif :** requêter par bande de rating via l'index au moment du `next()` ; ne cacher que les puzzles personnels + un petit pool ; seeding par lots + `countFromIndex`.

### 🟠 Dette transverse récurrente
- **`Play.svelte` (611 lignes) = god component** *(Architecture 🟡, Maintenabilité 🟡)* : concentre horloge RAF, moteur, rating Glicko, persistance, analyse post-partie, variant 960. Seul composant à toucher des détails moteur bas niveau (`engine.setOption('UCI_LimitStrength', …)`).
- **Absence de CI** *(Maintenabilité 🟠, Évolutivité)* : les « 376 tests / type-clean » ne sont garantis que quand un humain lance les commandes — alors que le dépôt a un historique de merges.
- **`EngineClient` non testé** *(Maintenabilité 🟠)* : la logique la plus délicate (fallback MT→lite, terminate+respawn, timeouts) n'a aucun test, **alors que le point d'injection `makeWorker` est déjà prévu pour ça**.

---

## 3. Rapports détaillés par axe

### 3.1 Architecture & conception — 8/10 ✅

**Constats :**
- 🟠 **Couche d'accès IndexedDB incohérente.** `srsCards`/`repertoire`/`playerModel`/`puzzles` passent par un repo ; mais `puzzleAttempts`/`games`/`importedGames`/`gameAnalyses` sont écrits **ad hoc** depuis 6 composants Svelte (`Tactics.svelte:169,240,269`, `Review.svelte:119,138`, `Play.svelte:388,419`, `Import.svelte:46`, `Insights.svelte:45`, `Calculate.svelte:83,104`). Logique d'`attemptId`/`weaknessCounters` dupliquée dans le markup, non testable. → Extraire `AttemptsRepo` + `GamesRepo`.
- 🟠 **`EngineClient` singleton à listeners partagés sans verrou** → cf. C-1.
- 🟡 **`terminate()`/`interrupt()` ne rejette pas les `waitFor` en vol** (`EngineClient.ts:188-198`) → promesse orpheline + listener orphelin sur le nouveau worker.
- 🟡 **`app.svelte.ts` mêle ~7 canaux de message « un-coup » inter-vues à l'état applicatif** (`:40-56` : `tacticsFilterThemes`, `analysisFen`, `sparringScenarioId`…). Couplage vue→vue caché via l'état global. → passer par un `nav(view, params)`.
- 🟡 **`Play.svelte` (611 l.)** concentre orchestration moteur/horloge/rating/persistance/analyse.
- 🔵 `db.ts` agrège les types de 8 domaines (hub de couplage, inévitable mono-DB) ; routeur `App.svelte` = cascade `{:else if}` de 23 vues (3 éditions synchronisées par ajout).

**Points forts :** découplage logique/UI total (aucun module hors `ui/` n'importe Svelte) ; frontière moteur propre (UCI confiné, parseurs purs) ; **cohérence ADR remarquable** (ADR-0050 dans `Board.svelte:65-67`, ADR-0051 dans `AnalysisBoard.svelte:55`, ADR-0041 dans le shim `ChessGame.ts:61-74`) ; migrations additives disciplinées ; découpage par feature lisible.

### 3.2 Correction fonctionnelle du jeu — 7,5/10 ⚠️

**Constats :**
- 🟠 **Sous-promotion humaine impossible (toujours Dame) dans TOUS les modes.** `Play.svelte:265-266` + identique dans Comeback/Sparring/Coach/Onboarding/Endgames/AnalysisBoard : l'UCI est construit avec `… ? 'q' : ''`, aucun sélecteur de pièce. Le wrapper supporte pourtant `'r'|'b'|'n'` et **le bot, lui, peut sous-promouvoir** → asymétrie joueur/bot, bloquant en finale (sous-promo Cavalier pour un mat, Tour pour éviter le pat).
- 🟠 **Chess960 — triple répétition cassée après un roque.** `ChessGame.ts:335` : le roque 960 est appliqué à la main puis `chess.load()`, or chess.js 1.4.0 purge `_positionCount` à chaque `load()` → la répétition n'est plus détectable à travers un roque. (La règle des 50 coups survit, portée par le FEN.)
- 🟠 **Chess960 — `pgn()` tronqué après un roque.** `ChessGame.ts:96-98` renvoie `chess.pgn()` qui a perdu tout l'historique d'avant le dernier `load()`. Le `GameRecord` 960 est donc faux (impact limité aujourd'hui car 960 non ré-analysé, mais piégera tout futur replay). L'historique correct existe pourtant dans `san960`.
- 🟡 **Coup du bot appliqué sans vérifier le retour de `moveUci`** (`Play.svelte:301-307` + 5 autres modes) → si le moteur renvoyait un UCI non jouable, dernier-coup fantôme + tour « sauté ». La promesse « le bot joue toujours un coup légal » repose entièrement sur le moteur, sans filet.
- 🟡 **Trou de tests au niveau wrapper** (`ChessGame.test.ts` : 5 cas ; `chessGame960.test.ts` : roque seul). Non testés : pat, matériel insuffisant, triple répétition, 50 coups, en passant, sous-promotion.
- 🟡 Précision du drapeau : lecture seulement dans la boucle rAF (~16 ms, throttlé en arrière-plan) → le drapeau peut tomber jusqu'à ~1 frame trop tard.
- 🔵 Plancher de budget bullet (40 ms) probablement trop bas pour une éval utile (anti-gaffe moins garantie).

**Couverture des règles :**

| Règle | Implémentée | Testée | Verdict |
|---|---|---|---|
| Coups légaux / échec / mat / pat | Oui | Mat oui ; **pat non** | ⚠️ |
| Promotion + sous-promotion | Dame oui ; **sous-promo humaine non** ; bot oui | Dame oui | ❌ |
| En passant | Oui (chess.js) | **Non** | ⚠️ |
| Roque (droits + exécution) | Standard + shim 960 | Std partiel ; 960 exhaustif | ✅ |
| Nulle 50 coups | Oui | Non | ⚠️ |
| Triple répétition | Std oui ; **960 cassée post-roque** | Non | ❌ |
| Matériel insuffisant | Oui (+ helper 6.9) | Helper oui | ✅ |
| Horloge Fischer + 6.9 | Oui | Oui (complet) | ✅ |
| Glicko-2 + pools | Oui | Oui (canon Glickman) | ✅ |
| Chess960 (génération + roque) | Oui | Exhaustif | ✅ (rés. répétition/PGN) |
| Adversaire : légalité + anti-gaffe | Oui (filtre 150 cp + nudge 55 %) | Cœurs testés | ✅ (rés. filet `moveUci`) |

**Points forts :** bug ADR-0050/0051 corrigé à la source (non-réintroduisible) ; Glicko-2 exact ; horloge pure Date-free + FIDE 6.9 exhaustivement testée ; Chess960 générateur Scharnagl validé sur 960 positions, pas de fuite `UCI_Chess960` entre modes.

### 3.3 Robustesse & gestion des erreurs — 6,5/10 ⚠️

**Constats :** C-1 (🔴 moteur non sérialisé) ; C-2 (🔴 ouverture IDB non protégée) ;
- 🟠 **Aucune gestion de crash worker** (`EngineClient.ts:63`, pas de `onerror`) → hang 30 s + « Bot is thinking… » figé.
- 🟠 **`terminate()` laisse les `waitFor` orphelins** (`:188-198`).
- 🟠 **Réponse tablebase malformée non validée** (`syzygy.ts:83` fait confiance à `m.uci`) → `game.moveUci(undefined)` → TypeError avalé par `catch{}`, le bot ne joue pas, et le résultat malformé est **mis en cache** (pollution durable).
- 🟠 **Quota/transaction non gérés sur les écritures de fin de partie** (`Play.svelte:408` appelé en `void`, `Tactics.svelte:241-261` enchaîne 4 écritures sans atomicité) → perte de partie/rating silencieuse, états partiels.
- 🟡 `evaluate` suppose une FEN bien formée (`EngineClient.ts:108`, `split(' ')[1]`) ; JSON puzzles externes acceptés sans validation de forme (`PuzzleRepo.ts:62-75`) → un puzzle malformé fait planter `loadNext()` ; SP-ID `Number(x) | 0` transforme une saisie invalide en position 0 ; course `onFlag`/`checkEnd` → `finishGame` potentiellement appelé deux fois.
- 🔵 `confirm()` bloquant dans `coachCheck` (gèle l'horloge) ; `clockToMs("")` renvoie 0 au lieu de `undefined`.

**Points forts :** snapshots `$state.snapshot()` avant `db.put` (proxies Svelte 5) ; dégradation hors-ligne propre du drill endgame (cache-first, consentement vs échec réseau distingués) ; fallback MT→lite robuste ; migrations additives testées ; états vides bien gérés.

### 3.4 Maintenabilité & qualité — 8,5/10 ✅

**Constats :**
- 🟠 **Absence de CI** (`.github` absent) — qualité espérée, pas garantie.
- 🟠 **`EngineClient` non testé** malgré l'injection `makeWorker` prévue (`:50`).
- 🟠 **Couche UI Svelte quasi non testée** (28/30 composants jamais montés ; stratégie « extraire la logique en `.svelte.ts` » intelligente mais ne couvre que l'extrait).
- 🟡 `Play.svelte` (611 l., ~25 états réactifs) point chaud de complexité ; `new Chess(...)` dupliqué dans ~12 modules hors wrapper (casts de frontière éparpillés).
- 🔵 Couverture non mesurée (pas de `@vitest/coverage`) ; pas de linter/formateur.

**Mesures quantitatives :** **0** `as any`, **0** `TODO/FIXME/HACK`, **0** type `:any` en prod ; **1** seul `!` non-null en prod ; **2** `@ts-ignore` (tests, justifiés). `tsconfig` réellement strict (`noUnusedLocals/Parameters`, `noImplicitReturns`).
**Points forts :** discipline TS exemplaire ; tests de logique qui vérifient un vrai comportement (Glicko-2 vs valeur canonique, migration v1→v4 réelle, contrat N+1 de `BatchAnalyzer`) ; architecture testable par injection ; doc riche et synchronisée (51 ADR, 26 specs) avec citations dans le code ; 0 dette de désordre.

### 3.5 Évolutivité & extensibilité — 7/10 ⚠️

**Constats :**
- 🟠 **Aucun chemin de migration pour un vrai changement de schéma.** La stratégie « champs additifs migrés dans le load path » marche tant que tout est additif ; le jour d'un drop/rename/réindex il faudra bumper `DB_VERSION` et coexister avec la migration `PlayerModel` qui vit *hors* du mécanisme `upgrade()` et détecte la version **par présence de champ** (`playerModel.ts:42`, ambigu à la 3ᵉ forme). 6 champs `?` accumulés sur `PlayerModel`.
- 🟠 **Routage faiblesse→drill/vue ré-implémenté dans 4-5 endroits** (`weakness.ts:34-48`, `studyPlan.ts:16-21`, copie inline `Insights.svelte:53-57`, `coach/program.ts`) → ajouter une dimension = éditer l'union + 5 sites désynchronisables (oubli = route silencieuse vers Tactics).
- 🟠 **Ajouter une variante = chirurgie dans ~10 fichiers** car `variant` est traité en booléen/ternaire dispersé (`AdaptiveOpponent` reçoit `chess960 = false`, `Play.svelte` truffé de `variant === 'chess960' ? …`).
- 🟡 Ajouter un drill+vue = ~5 points de synchronisation manuelle (`View`/routeur/nav/`SessionStepKind`/`TRAINER_VIEW`) ; `RatingPool` mélange cadence et variante ; taxonomie de motifs dupliquée dans 3 listes parallèles (`motif.ts` / `concepts.ts` / `weakness.ts`).
- 🔵 Coutures `EngineClient`/`PuzzleRepo`/`LineEvaluator`/`SrsStore` propres (à préserver) ; opening book en dur dans le code (incohérent avec le pattern JSON d'ECO).

**Points forts :** contenu pédagogique majoritairement data-driven (puzzles/ECO/concepts en JSON tolérants aux pannes, drills endgame validés par script) ; cœurs purs + dérivations immuables en aval (extensible *en lecture*) ; migration additive déjà pratiquée et testée.

### 3.6 Sécurité & confidentialité — 8,5/10 ✅

**Promesse « local-only / pas de télémétrie » : TENUE ✅.** Preuve grep : seuls `fetch` = Syzygy (consent-gated, `syzygy.ts:99`) + 3 chargeurs d'assets same-origin. **Zéro** `XMLHttpRequest`/`WebSocket`/`sendBeacon`, **zéro** SDK analytics, **zéro** `{@html}`/`innerHTML` dans tout le dépôt.

**Constats :**
- 🟠 **Download de ~286 Mo sans vérification d'intégrité** (`fetch-puzzles.mjs:31,49-78`), exécuté auto à `npm install` (postinstall). Pas de RCE (l'ETL ne fait que split/parse), mais data-poisoning possible + risque zip-bomb Zstd (pas de plafond d'octets décompressés).
- 🟠 **Aucune CSP** (ni `index.html`, ni `vite.config.ts`, ni `server.cjs`) — défense-en-profondeur manquante ; une CSP `connect-src 'self' https://tablebase.lichess.ovh` rendrait la promesse local-only **applicable par le navigateur**.
- 🟡 Garde anti-traversée `startsWith(root)` sans séparateur final (`server.cjs:51-56`) — **non exploitable ici** (bind 127.0.0.1, `dist/` sans frère sensible) mais à resserrer (`path.relative`). Deps en `^` (dont `stockfish`/`postject` qui produisent le `.exe`) → committer `package-lock.json` + `npm ci`. Wipe efface tout le contenu mais laisse les coquilles IDB vides. Stockage en clair (= sécurité du compte OS).
- 🔵 `.exe` SEA non signé (SmartScreen « éditeur inconnu ») ; gate réseau correctement placé au niveau client (à préserver) ; licences copyleft GPL/AGPL à traiter si distribution publique.

**Points forts :** un seul egress (FEN seul, HTTPS, cache-first) ; 0 surface XSS ; parsing d'entrées non fiables robuste (chess.js lève + try/catch) ; wipe exhaustif (tous stores + cache tablebase) ; lanceur bien cadré (127.0.0.1 only, COOP/COEP, gestion `EADDRINUSE`) ; build hermétique.

### 3.7 Performance — 6,5/10 ⚠️

**Constats :** C-3 (🔴 80k puzzles en RAM) ; C-1 (🔴 moteur partagé non sérialisé) ;
- 🟠 **Seeding IDB = 80k `put` via `Promise.all` en une transaction** (`PuzzleRepo.ts:40-42`) → gel de plusieurs secondes au 1ᵉʳ run ; `getAllKeysFromIndex(...).length` charge toutes les clés pour compter (utiliser `countFromIndex`).
- 🟠 **`pickHumanMove` lance un MultiPV=4 à chaque coup du bot** (mode par défaut, `AdaptiveOpponent.ts:91-108`) → surcoût récurrent sur le chemin le plus fréquent (réduire à 3, ou seulement à basse Elo).
- 🟠 **Re-vérification MultiPV du générateur de puzzles** (`generatePuzzles.ts:77`) ré-analyse des positions déjà évaluées par le batch → plusieurs secondes en plus sur le budget « ~20 s » (faire le batch en MultiPV=2 d'un coup).
- 🟡 Pas de code-splitting (28 vues dans le chunk initial) ; `loadAllAnalyses()` (`getAll` complet) rappelé à chaque montage de vue + `newGame` (croît sans borne) ; `coachCheck` ajoute un `evaluate(depth 8)` par coup en mode coaché ; listes non virtualisées (risque latent seulement, listes petites).
- 🔵 `tablebaseCache`/`gameAnalyses` sans éviction ; `phaseOf()` regex en O(n) dans `next()`.

**Points forts :** worker réutilisé (pas de re-spawn) ; batch optimisé à N+1 évals (exploite `fenAfter[i] == fenBefore[i+1]`) ; fallback MT→lite ; connexion IDB cachée + index pertinents définis (juste pas exploités par `PuzzleRepo`) ; jeton `seq` anti-résultats-périmés ; snapshots `$state` avant `put`.

---

## 4. Plan d'action priorisé (consolidé & dédupliqué)

### P0 — Systémique (impact maximal, à traiter d'abord)
1. **Sérialiser `EngineClient`** : file FIFO (un seul `go` actif), listener par requête, `terminate()` qui rejette les attentes + vide le Set, brancher `onerror`/`onmessageerror`. → corrige C-1 (corruption d'évals, fuites, hangs 30 s). *(3 agents convergents)*
2. **Protéger l'ouverture IndexedDB + le boot** (try/catch + voie dégradée dans `db.ts`/`app.svelte.ts`/`App.svelte`). → C-2.
3. **Ne plus charger 80k puzzles en RAM** : requêtes par bande de rating sur l'index existant ; cache = perso + petit pool ; seeding par lots + `countFromIndex`. → C-3.

### P1 — Correction du jeu (l'axe central)
4. **Sélecteur de sous-promotion** (D/T/F/C) dans l'UI (au moins Play + Endgames).
5. **Réparer Chess960 post-roque** (triple répétition + PGN) via un compteur de positions et `san960` propres au shim.
6. **Vérifier le retour de `moveUci`** pour le coup du bot (filet de légalité).

### P2 — Garde-fous (rendre la qualité *garantie*)
7. **CI GitHub Actions** : `npm ci && npm run check && npm test` sur PR/push (coût quasi nul, scripts existants).
8. **`EngineClient.test.ts`** avec faux Worker (point d'injection déjà prévu) : boot, timeout, fallback MT→lite.
9. **Tests de règles wrapper manquants** : pat, matériel insuffisant, triple répétition, 50 coups, en passant, sous-promotion.
10. **Intégrité du download** (SHA-256 + plafond anti zip-bomb) ; **`package-lock.json` + `npm ci`** + épingler `stockfish`/`postject`.

### P3 — Durcissement & dette structurelle (moyen terme)
11. **CSP stricte** (`connect-src` limité à Syzygy) — rend la promesse local-only applicable par le navigateur.
12. **Unifier la persistance** (`AttemptsRepo`/`GamesRepo`) + **dégonfler `Play.svelte`** (machine d'état + contrôleur d'horloge extraits en `.svelte.ts`).
13. **Préparer la prochaine migration de schéma** (`schemaRev` sur les singletons + migration chaînable).
14. **Unifier le routage faiblesse→vue** (table unique) + **taxonomie de motifs unique** (consommée par `motif.ts`/`concepts.ts`/`weakness.ts`).
15. **Perf secondaires** : MultiPV bot 4→3, code-splitting des vues, mémoïser `loadAllAnalyses`, éviction des caches.

---

## 5. Méthode

7 agents en lecture seule, un par axe, constats ancrés `fichier:ligne`, format de rapport commun. Les scores sont qualitatifs (santé d'axe), pas une métrique automatisée. Aucune modification du code n'a été faite. Aucun build/test n'a été lancé (tests lus, pas exécutés) — les « 376 tests passants » sont la revendication du README, non re-vérifiée ici.
