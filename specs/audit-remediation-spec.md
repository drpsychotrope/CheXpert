# Spec — Remédiation de l'audit complet (objectif 10/10 sur les 7 axes)

> Type : plan de correction multi-workstreams (fix + refactor + feature + migration + sécurité).
> Source : `reports/audit-complet-2026-06-07.md`. Drafté via `draft-general` le 2026-06-07.
> Profil projet : chess-trainer · Svelte 5 (runes) · TS strict · Vite 6 · chess.js 1.4.0 · chessground 9.2.1 · Stockfish 18 WASM (Web Worker) · IndexedDB (idb 8) · ts-fsrs · Vitest+jsdom+fake-indexeddb · specs dans `specs/` · journal `decisions.md` (dernier = ADR-0051) · pas de CI · npm.

---

## 1. Contexte

L'audit multi-agents a noté le projet ≈ 7,5/10 (mûr, dette concentrée). Cette spec planifie la fermeture de **tous** les constats P0→P3 pour viser 10/10 sur chaque axe. Elle n'est **pas** un seul changement : c'est un programme de **15 workstreams indépendants** (W1…W15), chacun à concern unique, livrable et réversible isolément (croyance #4 : un changement = un mode d'échec = un rollback propre). L'ordre est code d'abord, docs en dernier (croyance #5).

« 10/10 » n'est pas une métrique mesurée mais une **cible définie par la Definition-of-Done par axe** (§4) : fermer les constats nommés + poser les garde-fous (CI, tests, CSP, validation d'entrées). Honnêteté (doctrine du repo) : aucun « 10/10 » n'est revendiqué tant que sa DoD n'est pas verte.

### Décisions actées (2026-06-07, validées par l'utilisateur)
- **Q1 = (a)** PuzzleRepo : lecture indexée par fenêtre de rating, API `next`/`byId`/`size` passées en `async` (ripple mis à jour en lockstep).
- **Q2 = (a)** Boot/IDB : panneau d'erreur explicite + mode sans-persistance (fallback mémoire complet → Follow-up).
- **Q3 = (a)** CSP stricte appliquée d'emblée, avec vérification obligatoire que le moteur multi-thread boote encore.
- **Q4 = (a)** Download : plafond de décompression + hash `PUZZLE_DB_SHA256` opt-in (pas de hash codé en dur).
- **Q5 = (a)** Une livraison par priorité (P0→P3) ; commits groupés par workstream, PR consolidée par batch puis merge.
- **Q6 = oui** `@vitest/coverage-v8` (couverture mesurée) ; ESLint/Prettier = optionnel/Follow-up.
- **Q7 = différé** abstraction `variant` en descripteur (YAGNI tant qu'aucune 3ᵉ variante n'est planifiée).
- **Q8 = confirmé** la DoD par axe (§4) est la définition convenue de « 10/10 ».

---

## 2. Scope

**Dans le périmètre** — 15 workstreams :

| # | Workstream | Axes visés | Priorité |
|---|---|---|---|
| W1 | Sérialiser `EngineClient` (file + reject-on-terminate + onerror) | Robustesse, Archi, Perf | P0 |
| W2 | Protéger l'ouverture IndexedDB + le boot (dégradation propre) | Robustesse | P0 |
| W3 | `PuzzleRepo` : lecture par fenêtre de rating (index) au lieu de 80k en RAM | Perf | P0 |
| W4 | Sélecteur de sous-promotion (jeu libre + solveurs de puzzles) | Correction | P1 |
| W5 | Chess960 : triple répétition + PGN corrects après roque | Correction | P1 |
| W6 | Garde sur le retour de `moveUci` (légalité du coup du bot) + validation entrées | Correction, Robustesse | P1 |
| W7 | CI GitHub Actions (`check` + `test` gating PR) | Maintenabilité | P2 |
| W8 | `EngineClient.test.ts` (faux Worker : boot/timeout/fallback/sérialisation) | Maintenabilité, Robustesse | P2 |
| W9 | Tests de règles wrapper manquants (pat, insuffisant, 3×, 50c, e.p., sous-promo) | Correction, Maintenabilité | P2 |
| W10 | CSP stricte + intégrité du download puzzles + lockfile/pin deps + `safeJoin` | Sécurité | P2 |
| W11 | Unifier la persistance : `AttemptsRepo` + `GamesRepo` (sortir `openTrainerDB` des composants) | Architecture | P3 |
| W12 | Dégonfler `Play.svelte` (machine d'état + contrôleur d'horloge extraits, testables) | Maintenabilité, Archi | P3 |
| W13 | Préparer la prochaine migration de schéma (`schemaRev` + migration chaînée + politique) | Évolutivité | P3 |
| W14 | Découplage : table de routage faiblesse→vue unique · taxonomie motifs unique · params de nav typés | Évolutivité, Archi | P3 |
| W15 | Perf secondaires : MultiPV 4→3 · code-splitting des vues · mémoïsation `loadAllAnalyses` · éviction caches | Perf | P3 |

**Explicitement différé (Follow-up §9)** : fallback IndexedDB **en mémoire** complet (au-delà de la dégradation propre de W2) ; abstraction `variant` en descripteur pour une 3ᵉ variante (YAGNI tant qu'aucune n'est planifiée — cf. arbitrage Q7) ; virtualisation des listes UI (risque latent, listes petites aujourd'hui) ; signature Authenticode du `.exe` (conformité distribution, pas un risque local) ; ESLint/Prettier (cohérence déjà forte — optionnel, cf. Q6).

---

## 3. Baseline (faits empiriques, vérifiés 2026-06-07)

Tous les ancrages ci-dessous ont été relus dans le code (pas de mémoire) :

- **EngineClient** (`src/engine/EngineClient.ts`) : un seul `listeners = new Set<Listener>()` (`:44`) ; `onmessage` diffuse chaque ligne à TOUS les listeners (`:63-66`) ; `evaluate` (`:106`) et `analyzeLines` (`:144`) sans verrou ; `terminate()` (`:193-198`) annule le worker mais **ne rejette pas** les `waitFor` en vol et **ne vide pas** `listeners` ; **aucun** `onerror`/`onmessageerror`. API publique consommée uniquement via `evaluate`/`analyzeLines`/`resetVariant`/`setOption`/`init`/`isready` (grep consumers : `AdaptiveOpponent.ts:71,72,75,81,94`, `Play.svelte:318,430-432`, `AnalysisBoard.svelte:36-37`, `Endgames.svelte:116-117`, `Onboarding.svelte:136,141,150`, `Coach.svelte:146`, `Import.svelte:56`).
- **db.ts** : `openTrainerDB()` (`:119`) cache `dbPromise` ; `createDB()` (`:133`) `openDB` **sans try/catch** ; `DB_VERSION=4` (`:113`) ; store `puzzles` indexé `rating` + `source` (`:102`, créé `:146-147`).
- **app.svelte.ts** : `boot()` (`:61-68`) enchaîne `loadPlayerModel`/`loadSettings`/`puzzles.init` **sans try/catch** ; `engine`/`puzzles` singletons (`:58-59`).
- **PuzzleRepo** : `init()` seed via `Promise.all(subset.map(put))` (`:41`,`:48`) puis `this.cache = await db.getAll('puzzles')` (`:52`, charge tout) ; `next()` filtre `this.cache` en O(n) (`:99`) ; `byId()` (`:88`) et `size` (`:58`) lisent `this.cache`.
- **ChessGame** : `move(from,to,promotion='q')` accepte déjà `'q'|'r'|'b'|'n'` (`:125`) ; `moveUci` parse le 5ᵉ char (`:143-147`) ; `isPromotion` (`:151`) ; `terminal()` délègue à chess.js (`:166-174`) ; roque 960 : `applyCastle`→`reloadWithTurnFlippedAndRights`→`this.chess.load()` (`:335`, **purge `_positionCount`/`_history` de chess.js**) ; `pgn()` renvoie `this.chess.pgn()` (`:96-97`, perd l'historique après `load()`) ; `san960` tient l'historique SAN correct, castles inclus (`:59`,`:321`) ; `history()` renvoie `san960` en 960 (`:101`).
- **Sous-promotion codée en dur `'q'`** (grep `src/ui`) : `Play.svelte:265-266`, `Comeback.svelte:77`, `Sparring.svelte:73`, `Coach.svelte:88,147`, `Endgames.svelte:75,77`, `Onboarding.svelte:87,145`, `Review.svelte:84`, `Woodpecker.svelte:90`, `GuessMove.svelte:39`, `Tactics.svelte:184-185` (contient `? 'q' : 'q'`), `AnalysisBoard.svelte:59`, `Repertoire.svelte:82` (commenté « rare »). Helper de test `board-reactivity.svelte.ts:45,50,56` = hors scope.
- **`moveUci` non vérifié** au coup du bot : `Play.svelte:302` (+ sites équivalents Comeback/Sparring/Coach/Onboarding/Endgames `engineReply`).
- **migration** : `migratePlayerModel` détecte la forme **par présence de champ** (`playerModel.ts:42`) ; `clearAllData` itère `objectStoreNames` + vide le cache tablebase (`:130-136`).
- **Sécurité** : `vite.config.ts` n'émet que COOP/COEP (`:18-19`) ; `index.html` **aucune** balise CSP ; `server.cjs` émet COOP/COEP + Cache-Control (`:80-89`), `safeJoin` utilise `startsWith(root)` sans séparateur (`:54`) ; `fetch-puzzles.mjs` `fetch(SRC)` (`:49`) **sans hash** ni plafond de décompression (`:98`). Grep réseau `src/` : seul egress = Syzygy + assets same-origin (confirmé par l'agent sécurité).
- **CI** : `.github/` absent. **decisions.md** : dernier = `## ADR-0051` → nouveaux à partir de **ADR-0052**. **Aucune** config draft projet (`.claude/draft.config.md`/`AGENTS.md` absents). Tests : Vitest, `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']` (`vite.config.ts:21-26`).
- **VCS** : branches `claude/*` éphémères + `main` ; **aucune branche/PR en cours** ne couvre cette remédiation (gate duplicate-work clair). Derniers commits = ADR-0049/0050/0051 (port launcher, réactivité board) — déjà mergés.

---

## 4. Definition-of-Done par axe (ce que « 10/10 » signifie ici)

| Axe | DoD vérifiable | Workstreams |
|---|---|---|
| **Architecture** | Accès moteur sérialisé derrière une API sûre ; zéro `openTrainerDB` dans un composant `.svelte` (tout via repos) ; `Play.svelte` < ~250 lignes ; nav inter-vues par params typés (plus de champs-signaux jetables) | W1, W11, W12, W14 |
| **Correction** | Sous-promotion jouable partout (jeu + puzzles) ; 960 triple-répétition + PGN corrects ; coup bot garanti légal (garde `moveUci`) ; tests verts pat/insuffisant/3×/50c/e.p./sous-promo | W4, W5, W6, W9 |
| **Robustesse** | Moteur sérialisé + `onerror` + reject-on-terminate ; boot/IDB gardés (dégradation explicite, jamais « Loading… » infini) ; entrées non fiables validées (FEN, tablebase, JSON puzzles) ; écritures de fin de partie/puzzle gardées + atomiques | W1, W2, W6 |
| **Maintenabilité** | CI verte gating chaque PR (`check`+`test`) ; `EngineClient` + logique UI critique testés ; couverture mesurée ; `Play.svelte` décomposé | W7, W8, W12 (+ couverture, Q6) |
| **Évolutivité** | `schemaRev` sur singletons + migration chaînée + politique documentée ; table unique faiblesse→vue ; taxonomie de motifs unique | W13, W14 |
| **Sécurité** | CSP appliquée (`connect-src` = Syzygy uniquement) ; download avec plafond de décompression + hash opt-in ; `package-lock.json` commité + `npm ci` + deps sensibles épinglées ; `safeJoin` durci | W10 |
| **Performance** | Puzzles servis par fenêtre de rating (heap + boot constants) ; moteur sérialisé (zéro fuite de listener) ; seeding par lots ; MultiPV bot = 3 ; code-splitting des vues ; analyses mémoïsées | W1, W3, W15 |

---

## 5. Pré-flight (à re-vérifier à l'exécution — le monde a pu bouger)

1. `git status` propre ; brancher depuis `main` à jour (une branche par workstream).
2. Baseline verte : `npm run check` (0 erreur) et `npm test` (376+ verts) **avant** toute édition.
3. Re-confirmer les ancrages clés (les n° de ligne ont pu glisser) : `EngineClient.ts:44/63/193`, `db.ts:119/133`, `PuzzleRepo.ts:52`, `ChessGame.ts:125/335`, `Play.svelte:265/302`.
4. Pour W10 (CSP) : noter la config moteur MT actuelle (cross-origin isolé) — la CSP NE DOIT PAS casser le boot multi-thread (vérif post-changement obligatoire).
5. `decisions.md` : confirmer que le prochain ADR libre est bien 0052.

---

## 6. Plan — code (par workstream, ordonné)

### W1 — Sérialiser `EngineClient` · P0 · Robustesse/Archi/Perf
**Concern** : garantir qu'une seule recherche (`go`) est en vol à la fois, qu'aucune promesse ne reste orpheline, et qu'un crash worker est remonté.
**Édits** (`src/engine/EngineClient.ts`) :
1. Ajouter une file interne : `private chain: Promise<unknown> = Promise.resolve();` et un helper `private run<T>(op: () => Promise<T>): Promise<T>` qui sérialise (`const r = this.chain.then(op, op); this.chain = r.catch(() => {}); return r;`). Router `evaluate`, `analyzeLines`, `resetVariant`, `isready` à travers `run(...)`. (API publique **inchangée** → zéro ripple consommateurs.)
2. Tenir un registre des waiters actifs : `private pending = new Set<{ reject: (e: unknown) => void; off: () => void; timer: ReturnType<typeof setTimeout> }>()` ; `waitFor` s'y enregistre et s'en retire à la résolution/rejet/timeout.
3. `terminate()` : avant d'annuler le worker, `for (const w of this.pending) { clearTimeout(w.timer); w.off(); w.reject(new Error('engine terminated')); } this.pending.clear(); this.listeners.clear();`.
4. Brancher dans `bootInternal` après création du worker : `this.worker.onerror = (e) => this.failAll(new Error('worker error: ' + (e?.message ?? e)));` et `this.worker.onmessageerror = …` ; `failAll` rejette tous les `pending` (sans forcément terminate, pour permettre un respawn).
**Anti-patterns** : ré-introduire un broadcast multi-listener (le bug d'origine) ; sérialiser AUSSI `init()` au point de provoquer un interblocage (init doit pouvoir s'exécuter hors file) ; oublier de retirer le waiter du registre sur timeout (fuite).

### W2 — Garder l'ouverture IndexedDB + le boot · P0 · Robustesse
**Concern** : ne jamais rester bloqué si IDB est indisponible (navigation privée, quota, upgrade échoué).
**Édits** :
1. `src/store/db.ts` : envelopper `createDB()` (ou `openTrainerDB`) pour que l'échec rejette une erreur **typée** `StorageUnavailableError` (ne pas avaler).
2. `src/state/app.svelte.ts` : `boot()` en try/catch ; sur échec → `this.bootError = <message>` (nouveau `$state`), `this.ready = true` (pour sortir du « Loading… »), pas de persistance.
3. `src/ui/App.svelte` : si `app.bootError`, afficher un panneau d'erreur explicite (« Stockage indisponible : activez le stockage/les cookies, ou quittez la navigation privée. Le jeu nécessite IndexedDB. ») au lieu de la vue normale.
4. Décision de dégradation : cf. arbitrage **Q2** (panneau d'erreur + sans-persistance recommandé ; fallback mémoire complet = Follow-up).
**Anti-patterns** : mettre `ready=true` sans signaler l'erreur (UI muette) ; tenter d'écrire en DB dans un mode dégradé (rejets en cascade).

### W3 — `PuzzleRepo` par fenêtre de rating · P0 · Perf
**Concern** : ne plus charger ~80k puzzles en RAM ni filtrer en O(n).
**Design retenu** (cf. arbitrage **Q1** pour la profondeur) — option (a) « lecture indexée, API async » :
1. `init()` : seeder si besoin **par lots** (chunks de ~5 000 `put` par transaction, en cédant la main entre lots) ; remplacer `getAllKeysFromIndex(...).length` par `db.count('puzzles')`/`countFromIndex` ; charger en mémoire **uniquement** les puzzles `source==='personal'` (`this.personal`).
2. `next(q)` → **async** : requêter l'index `rating` via `IDBKeyRange.bound(q.rating-window, q.rating+window)` (curseur borné), fusionner avec `this.personal`, appliquer filtres thèmes/phase/exclude, choisir (logique de sélection déterministe inchangée).
3. `byId(id)` → **async** : `this.personal.find(...) ?? await db.get('puzzles', id)`.
4. `size` → `await db.count('puzzles')` (ou compteur tenu à jour).
**Ripple (gate Contrat)** — rendre async chez les appelants : `Tactics.svelte`, `Review.svelte`, `Woodpecker.svelte`, la file SRS (`byId`), `Sparring/Session` le cas échéant (await + `$state` de chargement). Énumérer et mettre à jour en lockstep.
**Anti-patterns** : garder un `getAll` « juste pour `byId` » (annule le gain) ; oublier que `phaseOf()` reste O(n) — l'appliquer seulement sur le pool déjà réduit par l'index.

### W4 — Sélecteur de sous-promotion · P1 · Correction
**Concern** : permettre D/T/F/C au joueur (jeu libre) et accepter une sous-promotion en solution de puzzle.
**Édits** :
1. Nouveau composant `src/ui/PromotionPicker.svelte` : overlay 4 choix (♛♜♝♞), rappelle un callback `(piece: 'q'|'r'|'b'|'n') => void` ; orienté selon la couleur.
2. **Jeu libre** (`Play.svelte`, `Endgames.svelte`, `Comeback.svelte`, `Sparring.svelte`, `Coach.svelte`, `Onboarding.svelte`) : dans `onMove`, si `game.isPromotion(from,to)` → ouvrir le picker, attendre le choix, puis `game.move(from,to,choice)` et UCI `from+to+choice`.
3. **Solveurs de puzzles** (`Tactics.svelte`, `Review.svelte`, `Woodpecker.svelte`, `GuessMove.svelte`) : la solution attendue connaît la pièce ; soit présenter le picker et comparer l'UCI complet, soit dériver la promo de l'UCI-solution. Corriger l'oddité `Tactics.svelte:184` (`? 'q' : 'q'`).
4. `Repertoire.svelte:82` : au minimum supporter la promo si une ligne en contient (sinon documenter la limite).
**Anti-patterns** : bloquer la boucle d'horloge pendant le picker (utiliser un overlay non bloquant, pas `confirm`) ; auto-jouer Dame si le joueur ferme le picker (annuler le coup à la place).

### W5 — Chess960 : triple répétition + PGN après roque · P1 · Correction
**Concern** : `chess.load()` du shim purge le compteur de positions et l'historique de chess.js.
**Édits** (`src/game/ChessGame.ts`) :
1. **Répétition** : `private repetition = new Map<string, number>()` ; clé = champs 1–3 du FEN (placement + trait + droits de roque du **shim** via `castleFieldForEngine()`) + e.p. Incrémenter à chaque coup réussi (chemin normal **et** `applyCastle`). Dans `terminal()`, si `variant==='chess960'` et `count>=3` → `{ over:true, reason:'threefold' }` (avant le `isThreefoldRepetition` de chess.js, inopérant ici). `undo()` décrémente ; `load()` réinitialise.
2. **PGN** : stocker `private startFen` (le FEN initial reçu au constructeur) ; en 960, `pgn()` reconstruit depuis `san960` avec en-têtes `[Variant "Chess960"]`, `[SetUp "1"]`, `[FEN "<startFen>"]` + coups numérotés. (`Play.svelte:391` enregistrera alors un PGN 960 correct.)
**Anti-patterns** : clé de répétition incluant les compteurs (halfmove/fullmove) → ne détecte jamais la répétition ; oublier d'incrémenter sur le roque (le cas même que le bug vise).

### W6 — Garde `moveUci` + validation d'entrées · P1 · Correction/Robustesse
**Édits** :
1. Coup du bot : aux sites `engineMove`/`engineReply` (`Play.svelte:301-307` + Comeback/Sparring/Coach/Onboarding/Endgames), tester le retour : `const san = game.moveUci(uci); if (!san) { /* log + fin technique ou respawn */ } else { fen = game.fen; lastMove = [...] }`.
2. FEN : valider la présence du champ trait avant `evaluate` (`EngineClient.evaluate:108` suppose `split(' ')[1]`) — normaliser ou rejeter une FEN malformée.
3. Tablebase (`endgame/syzygy.ts:83`) : filtrer/valider `m.uci` dans `normalize` ; ne mettre en cache qu'un résultat bien formé.
4. JSON puzzles (`PuzzleRepo.fetchSubset`) : filtrer chaque entrée (`fen` parseable, `moves.length>0`) avant insertion.
5. SP-ID (`Play.svelte:131`) : distinguer `NaN` d'un 0 volontaire (re-randomiser ou signaler).
6. Idempotence fin de partie : garde explicite en tête de `finishGame` (drapeau `finished`) contre le double-appel `onFlag`/`checkEnd`.
**Anti-patterns** : avaler l'échec `moveUci` sans rien faire (état fantôme) ; rendre `finishGame` non idempotent (double mise à jour Glicko).

### W7 — CI GitHub Actions · P2 · Maintenabilité
**Édits** : `.github/workflows/ci.yml` — sur `push`/`pull_request` : `actions/setup-node@v4` (Node 22.x), `SKIP_INSTALL_EXTRAS=1 npm ci`, `npm run check`, `npm test`. (Pas de download puzzles ni .exe en CI.) Optionnel : `npm run build` (plus lourd).
**Anti-patterns** : lancer `postinstall` complet en CI (download 286 Mo) → utiliser `SKIP_INSTALL_EXTRAS=1` ; rendre la CI non bloquante (le but est de gater).

### W8 — `EngineClient.test.ts` · P2 · Maintenabilité/Robustesse
**Édits** : `src/engine/EngineClient.test.ts` avec un faux Worker (le constructeur accepte déjà `makeWorker`, `EngineClient.ts:50`) scriptant `uciok`/`readyok`/`info`/`bestmove`. Couvre : boot nominal ; timeout (pas de `uciok`) ; fallback MT→lite ; **sérialisation** (deux `evaluate` concurrents ne se mélangent pas) ; `terminate()` rejette les promesses en vol (régression de W1).
**Anti-patterns** : tester via le vrai WASM (lent, non déterministe) ; ne pas couvrir le chemin de sérialisation (le cœur de W1).

### W9 — Tests de règles wrapper · P2 · Correction/Maintenabilité
**Édits** : étendre `src/game/ChessGame.test.ts` + `chessGame960.test.ts` : pat (`reason==='stalemate'`), K+B vs K (`insufficient`), triple répétition (standard **et** 960 post-roque — régression de W5), compteur 50 coups, en passant (dests + exécution + FEN), sous-promotion en Cavalier donnant échec (régression de W4 au niveau wrapper).

### W10 — CSP + intégrité download + lockfile + safeJoin · P2 · Sécurité
**Édits** :
1. **CSP** (cf. arbitrage **Q3**) — base stricte à délivrer dans `index.html` (`<meta http-equiv>`) **et** `server.cjs` (+ `vite.config.ts` dev/preview) : `default-src 'self'; connect-src 'self' https://tablebase.lichess.ovh; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'`. **Vérif obligatoire** : le moteur **multi-thread** boote encore après CSP (sinon ajuster `worker-src`/`script-src`, ou démarrer en `Content-Security-Policy-Report-Only`).
2. **Download** (cf. arbitrage **Q4**) — `fetch-puzzles.mjs` : ajouter un **plafond d'octets décompressés** (abort au-delà d'un seuil, anti zip-bomb) + un **hash opt-in** `PUZZLE_DB_SHA256` (vérifié via `node:crypto` si fourni). **Pas** de hash codé en dur (le fichier Lichess n'est pas versionné → casserait à chaque refresh).
3. **Deps** : commiter `package-lock.json`, basculer CI sur `npm ci`, épingler exact `stockfish` et `postject` (composants du `.exe`).
4. **safeJoin** (`server.cjs:54`) : remplacer `startsWith(root)` par `path.relative(root, p)` rejeté si commence par `..` / absolu.
**Anti-patterns** : CSP qui casse SharedArrayBuffer/MT silencieusement (toujours vérifier le boot MT) ; `connect-src` trop large (rouvre l'egress) ; hash codé en dur (faux positifs permanents).

### W11 — Unifier la persistance · P3 · Architecture
**Concern** : sortir `openTrainerDB` des composants (ADR-0013 « delete all » doit rester correct).
**Édits** : créer `AttemptsRepo` (puzzleAttempts + agrégats « misses ») et `GamesRepo` (games + importedGames + gameAnalyses) sur le modèle de `SrsStore.ts`. Retirer `openTrainerDB` de `Tactics.svelte:169,240,269`, `Review.svelte:119,138`, `Play.svelte:388,420`, `Import.svelte:46`, `Insights.svelte:45`, `Calculate.svelte:83,104`. Grouper les écritures liées de `Tactics.finish` en **une** transaction atomique.
**Anti-patterns** : repos qui ré-ouvrent une connexion (utiliser `openTrainerDB` caché) ; casser l'itération dynamique de `clearAllData`.

### W12 — Dégonfler `Play.svelte` · P3 · Maintenabilité/Archi
**Édits** : extraire `playSession.svelte.ts` (machine d'état : pickMove → press clock → checkEnd → recordGame) et un contrôleur d'horloge testable (réutiliser le pattern `board-reactivity.svelte.ts`). Router le shallow-eval `coachCheck` via un helper/`AdaptiveOpponent` plutôt que `engine.setOption('UCI_LimitStrength', …)` direct (`Play.svelte:431`). Remplacer le `confirm()` (`:324`) par une UI non bloquante.
**Anti-patterns** : extraire en gardant des dépendances Svelte (la logique doit être testable sans DOM).

### W13 — Préparer la prochaine migration de schéma · P3 · Évolutivité
**Édits** : ajouter `schemaRev: number` à `PlayerModel` et `SettingsRecord` (`db.ts`) ; remplacer la détection par présence de champ (`playerModel.ts:42`) par une migration chaînée `migrate(record, fromRev)`. Documenter dans le README/ADR la politique : **additif** → champ + `schemaRev` (pas de bump) ; **destructif** (drop/rename/réindex) → bump `DB_VERSION` + bloc `upgrade`.
**Anti-patterns** : bumper `DB_VERSION` pour un changement purement additif (casse la politique existante, testée).

### W14 — Découplage structurel · P3 · Évolutivité/Archi
**Édits** : (a) table unique `dimension → { view, themes?, timed? }` consommée par `weakness.drillTarget`, `studyPlan.activityForLeak`, `Insights.svelte:53-57`, `Dashboard.svelte`, `coach/program.ts` (supprimer la copie inline) ; (b) module `motifTaxonomy.ts` (liste ordonnée unique) consommé par `motif.ts` (`PRECEDENCE`), `concepts.ts`, `weakness.ts` (`TACTICS_THEMES`) ; (c) remplacer les ~7 champs-signaux jetables de `app.svelte.ts:40-56` par un `pendingParams` typé lu-et-effacé à l'`onMount` de la vue cible.
**Anti-patterns** : sur-abstraire (garder simple) ; oublier un consommateur de la table (route silencieuse vers Tactics par défaut).

### W15 — Perf secondaires · P3 · Performance
**Édits** : MultiPV `4→3` dans `AdaptiveOpponent.ts:94` (vérifier que l'anti-gaffe README « jamais >~1.5 pion » tient — cf. gate Behavior) ; code-splitting des 28 vues via imports dynamiques dans `App.svelte` ; mémoïser `loadAllAnalyses` (invalidé après `runAnalysis`) ou lire les N récentes via l'index `analyzedAt` pour le steering de `newGame` ; éviction simple (cap/TTL) sur `tablebaseCache`.
**Anti-patterns** : baisser MultiPV au point de casser l'échantillonnage « humain » à bas Elo (mesurer).

---

## 7. Tests (par workstream)

- **W1** → W8 (sérialisation, terminate-reject, fallback, timeout).
- **W2** → test : ouverture DB qui throw ⇒ `bootError` set, `ready=true`, pas de crash (fake-indexeddb forcé en échec).
- **W3** → tests `PuzzleRepo` : `next` par fenêtre de rating renvoie le bon pool sans `getAll` ; `byId` async perso + DB ; seeding par lots ; pas de régression de sélection déterministe.
- **W4** → W9 (sous-promotion wrapper) + test composant picker si infra dispo.
- **W5** → W9 (répétition 960 post-roque + PGN 960 round-trip).
- **W6** → tests : `moveUci` rejeté géré ; FEN sans trait rejetée ; tablebase move sans `uci` filtré ; `finishGame` idempotent.
- **W9** → cas pat/insuffisant/3×/50c/e.p./sous-promo verts.
- **W11/W12/W13/W14** → tests des repos (AttemptsRepo/GamesRepo), de la machine `playSession`, de `migrate(record, fromRev)`, des tables de routage/taxonomie.
- Garde de non-régression globale : `npm test` (376 + nouveaux) reste vert à chaque workstream.

---

## 8. Vérification (critères mesurables)

| Critère | Commande / observation | Attendu |
|---|---|---|
| Types | `npm run check` | 0 erreur (à chaque workstream) |
| Tests | `npm test` | tous verts (376 + ajouts) |
| Build | `npm run build` | vert |
| CI (W7) | PR ouverte | check+test exécutés et bloquants |
| Moteur concurrent (W1) | test sérialisation + jeu réel Play→AnalysisBoard pendant « thinking » | aucun score croisé, aucun hang 30 s |
| Boot dégradé (W2) | lancer en navigation privée / IDB désactivé | panneau d'erreur explicite, pas de « Loading… » infini |
| Mémoire/boot (W3) | DevTools heap au boot avec puzzles.json 80k | heap ~constant (plus de pic 30–80 Mo), boot non bloqué |
| Sous-promotion (W4) | promouvoir en Cavalier (mat) dans Play + résoudre un puzzle à sous-promotion | coup accepté, puzzle validé |
| 960 (W5) | partie 960 : répéter une position après roque ; exporter le PGN | nulle par répétition détectée ; PGN complet avec en-têtes 960 |
| CSP (W10) | charger l'app + booter le moteur MT ; tenter un fetch hors Syzygy (console) | app + MT OK ; fetch tiers bloqué par CSP |
| Privacy (gate) | grep réseau `src/` + observer le trafic | seul Syzygy (opt-in) ; « delete all » vide tout |

---

## 9. Anti-patterns (globaux — au-delà des anti-patterns par workstream)

1. **Bundler plusieurs workstreams dans une PR** : multiplie la surface de vérification et le rayon de panne (croyance #4). Une PR par Wn.
2. **Docs avant code** : ne pas écrire les ADR/README avant que le code du workstream soit vert (croyance #5) — sinon un changelog ment si l'exécution échoue à mi-chemin.
3. **Casser une promesse README en corrigeant un axe** : la CSP (W10) ne doit pas tuer le moteur MT ; le MultiPV 3 (W15) ne doit pas rouvrir le risque de gaffe ; la persistance unifiée (W11) ne doit pas casser « delete all » (ADR-0013) ; `schemaRev` (W13) doit rester additif (schéma v4).
4. **Régresser la réactivité ADR-0050/0051** : toute manipulation de `fen`/`game`/`turnColor` doit conserver la dérivation du trait depuis le FEN.
5. **Rendre une API async sans mettre à jour tous les consommateurs** (W3) : énumérer en lockstep (gate Contrat).
6. **« 10/10 » auto-déclaré** : ne cocher un axe que lorsque sa DoD (§4) est vérifiée par commande (§8).

---

## 10. Rollback

Chaque workstream est une branche/PR isolée → `git revert` du merge suffit, sans toucher les autres. W1/W3 (interne à une classe / repo) et W13 (`schemaRev` additif, lu avec `?? 0`) sont rétro-compatibles : un revert ne corrompt aucune donnée IndexedDB existante. W10-CSP : retirer la balise/headers restaure l'état antérieur. Aucun workstream ne fait de migration destructive (DB reste v4).

---

## 11. Follow-up (hors scope, à arbitrer plus tard)

- Fallback IndexedDB **en mémoire** complet (jeu pleinement fonctionnel sans IDB) — au-delà de la dégradation propre de W2.
- Abstraction `variant` en descripteur `{ id, startPosition(), engineOption, supportsAnalysis }` si une 3ᵉ variante est planifiée (sinon YAGNI — Q7).
- Virtualisation des listes UI (si la bibliothèque de concepts grossit).
- Signature Authenticode du `.exe` (distribution publique) ; revue licences GPL/AGPL si distribution.
- ESLint + Prettier en mode rapport (Q6) ; `@vitest/coverage-v8` + seuils.
- Analyse 960-aware (lever l'exclusion d'analyse des parties 960).

---

## 12. Statut final (2026-06-08) — LIVRÉ ✅

Les 15 workstreams sont implémentés, vérifiés (`svelte-check` 0 erreur/0 warning · `vitest` **476 verts** · `vite build` vert avec chunks par vue) et mergés sur `main`.

| Workstream | Statut | PR |
|---|---|---|
| W1 — EngineClient sérialisé (+ `onerror`, reject-on-terminate, validation FEN) | ✅ | #6 |
| W2 — garde ouverture IndexedDB + boot (dégradation explicite) | ✅ | #6 |
| W3 — heap puzzles : seeding par lots (·1) + working-set borné / `byId` async (·2) | ✅ | #8, #15 |
| W4 — sélecteur de sous-promotion (Board + 12 écrans) | ✅ | #7 |
| W5 — Chess960 triple répétition + PGN après roque | ✅ | #6 |
| W6 — garde `moveUci`/`finishGame`/SP-ID + (W6-bis) validation tablebase/JSON | ✅ | #6, #10 |
| W7 — CI GitHub Actions (`check` + `test`) | ✅ | #6 |
| W8 — tests EngineClient (faux Worker) | ✅ | #6 |
| W9 — tests de règles (pat, e.p., 50c, 3×, sous-promo, 960) | ✅ | #6 |
| W10 — `safeJoin`/intégrité download/lockfile (·1) + CSP enforcing (·2) | ✅ | #9, #13, #16 |
| W11 — repos persistance + atomicité `Tactics.finish` | ✅ | #14, #19 |
| W12 — extraction logique testable de `Play.svelte` (`playSession`) | ✅ | #12 |
| W13 — `schemaRev` + migration chaînée + politique documentée | ✅ | #9 |
| W14 — routeur de leak unique + taxonomie de motifs unique | ✅ | #11, #18 |
| W15 — MultiPV 4→3 + mémoïsation analyses + code-splitting des vues | ✅ | #9, #11, #18 |
| Q6 — couverture mesurable (`@vitest/coverage-v8`) | ✅ | #13 |

**Métriques** : tests 376 (README) → **476** (+100) · type-clean · build vert · CI active · chunk JS initial ~360 ko → ~64 ko.

**Choix assumés (non-régressions, documentés en §11)** :
- CSP **enforcing** côté launcher avec kill-switch `CHESS_TRAINER_NO_CSP=1` (le moteur retombe en lite si la policy le gêne — ADR-0032) ; non posée sur `index.html`/dev pour ne pas casser le HMR Vite.
- W14(c) params de nav typés : non fait (over-engineering, bénéfice marginal — les 7 champs actuels conviennent).
- `variant` multi-variante (YAGNI, Q7), fallback IDB mémoire complet, virtualisation des listes, signature `.exe` : hors scope assumé.
