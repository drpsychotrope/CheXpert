# Spec : audit-v2 — vérification fonctionnelle post-remédiation + audit UX/UI

> Scope : **audit** (lecture seule sur le code ; seuls `reports/` et le statut de cette spec sont écrits).
> Cible : programme entier — `src/` (143 fichiers .ts dont 67 .test.ts + 30 composants .svelte, 23 vues), `launcher/`, `scripts/`, `public/`, config — **plus** la surface UX/UI (jamais auditée).
> Drafté : 2026-06-10 via `draft-general` · Statut : **Exécutée (2026-06-10)** — rapport : [`reports/audit-v2-2026-06-10.md`](../reports/audit-v2-2026-06-10.md). 16 agents + vérification adversariale + exécution réelle ; 143 constats retenus (4 🔴 / 37 🟠 / 64 🟡 / 38 🔵), 4 réfutés. Décisions Q1–Q4 actées.
> Sources : `reports/audit-complet-2026-06-07.md` (audit v1) · `specs/audit-remediation-spec.md` (remédiation, §12 LIVRÉ 15/15) · `decisions.md` (ADR-0001…0051) · `README.md` (promesses produit).

---

## 1. Contexte

Demande utilisateur (2026-06-10) : « un correctif pour rechercher l'ensemble des problèmes de fonctionnalité (architecture, structure, gameplay, etc) ; ainsi qu'une amélioration de l'UX et de l'UI (cherche et propose de manière proactive tout ce qui peut améliorer l'ensemble du programme) ».

L'audit v1 (2026-06-07, 7 axes, verdict ≈ 7,5/10) et sa remédiation (15/15 workstreams mergés le 2026-06-08, PRs #6–#19, 476 tests verts, CI active) couvrent déjà le volet technique **en statique**. Ce que v2 apporte — et que rien n'a encore couvert :

1. **L'UX/UI n'a jamais été auditée.** Les 7 axes de v1 sont tous techniques ; aucun référentiel design n'existe dans `specs/` (vérifié : `vision-refonte-spec.md` concerne les drills de vision échiquéenne, pas le design). La baseline mesurée le confirme : 11 attributs ARIA sur 30 composants, 0 media query dans tout `src/`, 6 gestionnaires clavier sur 3 composants, zoom utilisateur bloqué.
2. **Rien n'a jamais été vérifié en dynamique.** v1 l'assume (§5 : « Aucun build/test n'a été lancé ») ; v2 exécute la suite ET l'application (parcours réels, captures à l'appui).
3. **Le drift post-remédiation est déjà démontré** par deux faits vérifiés au drafting : le `confirm()` bloquant du mode coach survit dans `Play.svelte:327` alors que W12 planifiait son remplacement (§6 W12 de la spec remédiation), et `README.md:157` annonce encore « 376 tests » contre 476 réels (§12). Si deux dérives sont trouvables en une heure de scan, un audit complet en trouvera d'autres.

Livrable : un rapport `reports/audit-v2-<date-exécution>.md` (structure héritée de v1) + un **backlog priorisé P0→P3** avec proposition et effort par constat — prêt à seeder la spec « remédiation v2 » (pattern audit→remédiation déjà éprouvé par le projet).

### Décisions actées (2026-06-10, validées par l'utilisateur)

- **Q1 = (a)** — Audit seul maintenant ; la remédiation v2 sera draftée séparément depuis le backlog P0→P3 (pattern audit→remédiation reconduit). L'audit reste strictement lecture seule.
- **Q2 = (a)** — Volet UX/UI = constats + backlog avec proposition concrète et effort par constat ; pas d'ébauche de design system dans l'audit (reste un candidat Follow-up, §11).
- **Q3 = français intégral** — **L'UI cible est 100 % francophone.** Conséquences : le volet C5 ne compare plus des options, il **dimensionne le chantier de conversion** (inventaire exhaustif + chiffrage = entrée majeure du backlog) ; le copy anglais devient une non-conformité **agrégée** (un macro-constat d'inventaire, pas un constat par chaîne) ; `lang="en"` (B15) devient un constat mécanique.
- **Q4 = (a)** — Le desktop (usage réel launcher/.exe, ADR-0049) est la seule surface **notée** ; une passe descriptive en largeur mobile qualifie ce que `manifest.webmanifest` laisse espérer, sans noter.

## 2. Périmètre

**Dans le périmètre :**
- **Volet A — Vérification post-remédiation (dynamique).** Les 11 critères du §8 de la spec remédiation re-testés en exécutant réellement l'app, + revue de drift « plan vs livré » des 15 workstreams.
- **Volet B — Chasse fonctionnelle fraîche.** Gameplay vécu (parties complètes, drills), boucle pédagogique de bout en bout, promesses README confrontées au comportement observé, modules peu scrutés par v1, invariants transverses.
- **Volet C — Audit UX/UI (axe inédit).** Heuristiques par parcours, accessibilité, système visuel, layout, langue/copy, interactions — chaque constat assorti d'une **proposition concrète d'amélioration** chiffrée en effort (la partie « propose de manière proactive » de la demande).
- Le backlog priorisé consolidé (fonctionnel + UX/UI).

**Hors périmètre (différé — §11) :**
- **Implémenter les correctifs et améliorations** → spec « remédiation v2 » séparée, seedée par le backlog (croyance : un audit qui corrige en auditant n'est ni vérifiable ni réversible).
- Re-litiger les trade-offs actés (§11/§12 remédiation : CSP launcher-only, W14(c) non fait, YAGNI variant, fallback IDB mémoire, virtualisation, signature .exe, ESLint). Une remise en cause reste possible mais va dans une **section « Remises en cause » séparée**, avec l'évidence nouvelle qui la justifie — jamais présentée comme une découverte.
- **Implémenter** le passage de l'UI au français (décision actée Q3) : l'audit l'inventorie et le chiffre (volet C5) ; la conversion elle-même est un chantier de la remédiation v2.
- Features nouvelles lourdes contraires à la doctrine : pas de backend (ADR-0003), pas de Maia (ADR-0019), pas de télémétrie/cloud (ADR-0002, README « No backend. No account. No telemetry. »).

## 3. Baseline (empirique — tout mesuré le 2026-06-10 dans ce worktree, sauf mention)

| # | Fait | Mesure / source |
|---|---|---|
| B1 | 143 .ts (dont 67 .test.ts) + 30 .svelte sous `src/` | `(Get-ChildItem src -Recurse -File -Filter *.ts).Count` etc. |
| B2 | 23 vues code-splittées | `(Select-String -Path src/ui/App.svelte -Pattern 'import\(').Count` → 23 |
| B3 | Tests : **476 verts** au 2026-06-08 | `specs/audit-remediation-spec.md` §12 ; CI verte depuis (B4) |
| B4 | CI verte sur `main` (5 derniers runs success, ~1 min 15) | `gh run list --limit 5` |
| B5 | 0 PR ouverte ; dernier merge = PR #21 (2026-06-08, fix radar coach) | `gh pr list --state open` (vide) |
| B6 | Dernier ADR = **0051** → prochain libre 0052 | `Select-String '^## ADR-' decisions.md \| Select -Last 1` |
| B7 | Audit v1 : 7 axes techniques, ≈ 7,5/10, **statique** (« Aucun build/test n'a été lancé ») | `reports/audit-complet-2026-06-07.md` §1, §5 |
| B8 | Remédiation : 15/15 livrés (PRs #6–#19), trade-offs assumés documentés | `specs/audit-remediation-spec.md` §11, §12 |
| B9 | **Seed finding 1** : `confirm()` coach bloquant toujours présent | `Play.svelte:327` (grep `confirm\(` 2026-06-10) ; W12 §6 planifiait son remplacement |
| B10 | **Seed finding 2** : README annonce « 376 tests » vs 476 réels | `README.md:157` vs spec remédiation §12 |
| B11 | 5 `confirm()` natifs au total dans l'UI | `Play.svelte:327`, `Repertoire.svelte:55`, `Woodpecker.svelte:125`, `Settings.svelte:23,38` |
| B12 | A11y : **11** occurrences `aria-`/`role=` sur **5/30** composants (App 1, Board 3, Calculate 2, EvalGraph 3, Tactics 2) | grep `aria-\|role=` dans `src/ui`, mode count |
| B13 | Clavier : **6** occurrences `keydown/keyup/tabindex` sur **3/30** composants (App 1, EvalGraph 2, Vision 3) | grep dans `src/ui` |
| B14 | Responsive : **0** `@media` dans tout `src/` | grep `@media` dans `src` → 0 |
| B15 | `index.html` : `lang="en"` ; viewport `maximum-scale=1.0, user-scalable=no` (zoom bloqué) ; thème sombre **unique** (`--bg:#1f1f23` seul fond défini ; aucun toggle de thème) | lecture `index.html` ; `app.css:5` ; grep `theme\|dark\|light` dans `Settings.svelte` → 0 |
| B16 | CSS global : `src/app.css` = 126 lignes (+ styles scoped par composant) | `(Get-Content src/app.css \| Measure-Object -Line).Lines` |
| B17 | UI anglophone ; docs/audits du projet en français | B15 + lecture composants (`'Coach: that move looks like…'`) vs `reports/*.md` |
| B18 | Install léger sans le download 286 Mo : `SKIP_INSTALL_EXTRAS=1 npm ci` vendorise quand même le moteur ; la CI utilise `npm ci --ignore-scripts` | `scripts/postinstall.mjs:13,27` ; `.github/workflows/ci.yml:21` |
| B19 | `node_modules` absent de ce worktree | `Test-Path node_modules` → False |
| B20 | Carte d'architecture disponible : 164 fichiers, 1050 nœuds, 61 communautés ; god nodes = `store/db` (42 arêtes), `analysis/types` (35), `openTrainerDB` (35), `ChessGame` (29) | `graphify-out/GRAPH_REPORT.md` (2026-06-07) |

**Promesses README = oracles du volet B3** (plancher vérifié au drafting ; l'exécuteur ré-énumère depuis `README.md` au moment T) :

1. Local-only : « Nothing leaves your device by default » / « No backend. No account. No telemetry. » (`README.md:30,144`) ; seul egress = Syzygy opt-in (`:115-117`).
2. La boucle fermée play→analyse→diagnostic→puzzles persos→SRS→adversaire ciblé est *intégrée* (`:9-28`).
3. Style Human-like : « never a catastrophic blunder (nothing >~1.5 pawns below best) » (`:44-46`).
4. Adversaire nudgé ±50–100 Elo vers ~55 % de win-rate (`:41-42`).
5. Horloge Fischer, perte au drapeau **sauf** matériel insuffisant adverse = nulle (FIDE 6.9) (`:47-50`).
6. Rating de jeu **par cadence** — un résultat bullet ne bouge pas le classique (`:50-52`).
7. Mode coaché : avertit avant une gaffe évidente (`:53`).
8. Chess960 : SP-ID 0–959, roque en glissant le roi sur sa tour, non chronométré, non auto-analysé (`:54-56`).
9. Analyse locale ~20 s pour 40 coups ; classification par perte de probabilité de gain ; pas de note unique (`:61-65`).
10. Les erreurs significatives de MES parties deviennent des puzzles (re-check MultiPV) ; les « missed wins » comptent (`:66-69`).
11. Radar 5 dimensions, **chaque** dimension one-click drillable vers le bon entraînement (`:70-73`).
12. Insights : leaks récurrents classés par impact + plan d'étude déterministe + tendance (`:74-76`).
13. Explications rule-based honnêtes : « when it can't name a specific tactical pattern, it says so » (`:80-83`).
14. Tactics = active recall, « the solution is never auto-played » (`:88`).
15. Calculation : l'échiquier reste gelé pendant la saisie de la ligne (`:94-95`).
16. Launcher .exe : port fixe 7424 = profil persistant (ADR-0049) (`:196-203`).

## 4. Pré-flight (à re-vérifier à l'exécution — le monde a pu bouger)

1. [ ] `git status` propre ; partir de `main` à jour ; CI verte — `gh run list --limit 3` → success.
2. [ ] Aucune PR/branche en vol couvrant un audit ou de l'UX — `gh pr list --state open` → vide (sinon STOP : coordonner).
3. [ ] Installer **léger** : `SKIP_INSTALL_EXTRAS=1 npm ci` (vendorise le moteur, PAS le download 286 Mo — `scripts/postinstall.mjs:13`). Puis baseline verte : `npm run check` → 0 erreur ; `npm test` → **≥ 476** verts. Si rouge → **STOP** : l'audit suppose une base verte ; corriger d'abord.
4. [ ] Re-confirmer les ancres volatiles : `Play.svelte:327` (confirm coach), `README.md:157` (« 376 tests »), 23 imports dynamiques dans `App.svelte`, `index.html` (`user-scalable=no`). Les numéros de ligne ont pu glisser.
5. [ ] `decisions.md` : dernier ADR toujours 0051 (sinon, mettre à jour les références de cette spec avant d'exécuter).

## 5. Plan — protocole d'audit (3 volets, code d'abord : tout le protocole s'exécute avant toute écriture de doc)

### Volet A — Vérification post-remédiation (les « 15/15, DoD 10/10 » tiennent-ils en vrai ?)

1. **Re-jouer les 11 critères du §8 de `specs/audit-remediation-spec.md`** — cette fois en exécutant (commande ou parcours app via preview, preuve citée dans le rapport) : types, tests, build, CI bloquante, moteur concurrent (Play→AnalysisBoard pendant « thinking »), boot dégradé (IDB indisponible), heap puzzles au boot, sous-promotion (jeu + puzzle), 960 (répétition post-roque + PGN exporté), CSP (app + moteur MT + fetch tiers bloqué), privacy (grep réseau + trafic observé + « delete all »).
2. **Revue de drift plan→livré** : pour chacun des 15 workstreams, comparer les édits planifiés (§6) au code mergé ; tout écart non documenté en §12 « choix assumés » = constat (les seeds B9/B10 sont les deux premiers ; les confirmer et chercher les suivants).
3. **Régressions de la remédiation** : les 15 chantiers ont touché moteur, store, boot, 12 écrans (sous-promo), CSP — c'est le code le plus jeune du dépôt. Revue ciblée des diffs PRs #6–#19 sous l'angle « qu'est-ce que ce changement a pu casser à côté ? ».

### Volet B — Chasse fonctionnelle fraîche (ce que v1 n'a pas regardé)

1. **Gameplay vécu** : parties complètes standard et 960 jusqu'à mat / pat / nulle (répétition, 50 coups, matériel) / drapeau ; sous-promotion via le picker ; tablebase en finale ; toutes cadences (dont No clock) ; styles Human-like et Engine ; abandon/navigation en cours de partie.
2. **Boucle pédagogique de bout en bout** (la promesse centrale, jamais testée en chaîne) : jouer → analyser → leak détecté → puzzle personnel généré → servi dans Tactics → carte FSRS en Review → session du jour → radar/insights mis à jour → drill routé depuis la dimension faible. Un seul scénario continu, état vérifié à chaque maillon.
3. **Oracles README** : chaque promesse (≥ les 16 de §3) testée → verdict **tenue / partielle / cassée** + preuve.
4. **Modules peu scrutés par v1** (v1 s'est concentré sur moteur/store/Play) : coach (diagnostic, programme), session builder, studyPlan, agrégations Insights, import PGN (cas tordus : annotations, variantes, headers exotiques), explorer/ECO, répertoire (drill FSRS), metacognition, vision (ADR-0043), calculation, woodpecker, comeback/sparring, GuessMove, WhenToThink, pools de rating par cadence. Revue statique de la logique + exercice dynamique de chaque module.
5. **Invariants transverses** : taxonomie de motifs unique (W14 — zéro divergence résiduelle entre `motif.ts`/`concepts.ts`/`weakness.ts`), routage faiblesse→vue unique, `schemaRev`/migrations, kinds SRS, cohérence des 7 champs-signaux de navigation restants (`app.svelte.ts`, W14(c) non fait — acquis, ne pas re-signaler, mais vérifier qu'ils ne créent pas de bug de navigation réel).

### Volet C — Audit UX/UI (axe inédit ; chaque constat = heuristique violée + preuve + **proposition concrète** + effort S/M/L)

1. **Parcours & heuristiques** (Nielsen 10) sur 5 parcours : (P1) premier lancement → onboarding → calibration → premier dashboard ; (P2) session quotidienne depuis Home/Session ; (P3) jouer une cadence → fin → analyse → moments critiques → puzzle généré ; (P4) radar → dimension faible → drill routé → retour ; (P5) maintenance : Settings (recalibration, wipe), Import, Explorer/Repertoire. Par vue : états vide/chargement/erreur, feedback des actions, réversibilité, visibilité de l'état système, cohérence inter-vues.
2. **Accessibilité** (baseline B12-B15 ; référentiel WCAG 2.1 AA pragmatique — app locale desktop, calibrer sans dogme) : opérabilité clavier de chaque vue (aujourd'hui 3/30 composants en ont), focus visible, ARIA/sémantique (11 attributs au total — landmarks, headings, labels de formulaires), contrastes mesurés sur la palette réelle, `user-scalable=no` à requalifier (anti-pattern a11y), `prefers-reduced-motion`.
3. **Système visuel** : un embryon de tokens existe (`:root` de `app.css` définit `--bg/--panel/--accent/--text/--muted/--border/--light-sq`) — mesurer leur usage réel vs valeurs en dur dans les styles scoped des 23 vues ; cohérence boutons/cartes/listes/tableaux inter-vues ; hiérarchie typographique ; thème sombre unique (B15) — un thème clair via `prefers-color-scheme` est-il une proposition rentable ?
4. **Layout** : 0 media query (B14) — la surface notée est le **desktop** (launcher/.exe = usage réel, ADR-0049) ; une passe descriptive en largeur réduite qualifie ce que `manifest.webmanifest` laisse espérer (décision actée Q4).
5. **Langue & copy** — **décision actée : UI 100 % française (Q3)**. L'audit dimensionne le chantier, il ne traduit rien :
   - **Inventaire exhaustif des chaînes utilisateur** : total + répartition par vue/fichier (libellés, boutons, messages d'erreur, états vides/chargement, `confirm()`, `aria-label`/`title`, titres de vues).
   - **Contraintes spécifiques recensées** : notation des coups (SAN anglaise `Nf3` produite par chess.js vs française `Cf3` — proposer une politique : traduire, figurines, ou conserver la SAN anglaise comme convention) ; contenus data-driven anglophones (`public/concepts/concepts.json`, ECO, drills d'endgame — champs textuels à inventorier) ; `lang="en"` (B15) ; formats dates/nombres.
   - **Risques chiffrés** : chaînes concaténées/interpolées, largeurs de layout (le français est ~15-20 % plus long), chaînes dans les tests.
   - Sortie : **un macro-constat « passage au français »** avec effort, découpage proposé et ordre — entrée majeure du backlog (pas un constat par chaîne).
   - Le fond reste audité indépendamment de la langue : ton, clarté des messages d'erreur, cohérence terminologique — en proposant au passage la terminologie FR cible (leak→fuite, weakness→faiblesse, …).
6. **Interactions** : les 5 `confirm()` natifs (B11) vs dialogues intégrés (celui de `Play.svelte:327` gèle l'horloge en mode coach — doublement pénalisant) ; cohérence du PromotionPicker partout ; raccourcis clavier (navigation entre coups en analyse, ↑↓ dans les listes) ; drag vs clic sur l'échiquier ; annulation/retour systématiques.

### Méthode & format (tous volets)

- **Ancrage obligatoire** : chaque constat cite `fichier:ligne`, OU une capture (`preview_screenshot`), OU un extrait console/sortie de commande. Pas d'ancrage → pas de constat.
- **Sévérité** : échelle v1 conservée (🔴 critique : corruption/blocage/promesse cassée · 🟠 majeur · 🟡 mineur · 🔵 note/opportunité) ; pour l'UX : 🔴 bloque un parcours, 🟠 friction majeure récurrente, 🟡 friction locale, 🔵 opportunité d'amélioration.
- **Registre des acquis consulté AVANT publication** : tout constat est confronté à §11/§12 de la remédiation + `decisions.md` ; s'il recoupe un trade-off acté → section « Remises en cause » avec l'évidence nouvelle, pas un constat neuf.
- **Matrice de couverture 23 vues × {fonctionnel, heuristiques, a11y, layout, copy}** : chaque cellule = constat(s), « RAS », ou « N/A » motivé. Le silence est interdit (une vue non visitée se voit, et se lit).
- **Convergence** : comme v1, un constat signalé par plusieurs angles indépendants est marqué convergent (signal fort).
- **Exécution suggérée** : multi-agents par volet/axe (pattern v1 : 7 agents) — via un workflow multi-agents si l'utilisateur l'active, sinon séquentiellement ; le protocole ci-dessus ne dépend pas du mode d'exécution.

### Livrables

1. `reports/audit-v2-<date-exécution>.md` — structure héritée de v1 : synthèse exécutive avec scores par axe (comparables à v1 là où l'axe existait), constats convergents, détail par volet, matrice de couverture, table des promesses README, section « Remises en cause » (si non vide).
2. **Backlog priorisé P0→P3** (section finale du rapport) : `id · volet/axe · sévérité · fichiers · constat (1 ligne) · proposition (1-3 lignes) · effort S/M/L` — importable tel quel comme entrée d'une spec « remédiation v2 » via `draft-general`.

## 6. Tests

L'audit n'ajoute aucun test : il **exécute** la suite et l'application. `npm run check`, `npm test`, `npm run build` font partie du protocole (volet A.1) et leurs sorties sont citées dans le rapport — c'est précisément la limite assumée de v1 (§5) que v2 lève.

## 7. Vérification (acceptation de l'audit lui-même — mesurable)

- [ ] **Couverture** : matrice 23/23 vues remplie, zéro cellule vide (N = 23 re-compté au pré-flight 4) — relire la matrice du rapport.
- [ ] **Volet A** : les 11 critères du §8 remédiation ont chacun un verdict ✓/✗ + preuve d'exécution (commande citée ou capture).
- [ ] **Oracles** : ≥ 16 promesses README testées, chacune marquée tenue/partielle/cassée + preuve.
- [ ] **Dynamique réelle** : `npm run check` + `npm test` + `npm run build` exécutés pendant l'audit, sorties citées dans le rapport (delta vs « 476 » expliqué le cas échéant).
- [ ] **Ancrage** : échantillonner 10 constats au hasard → 10/10 ancrés (`fichier:ligne`/capture/console).
- [ ] **Actionnabilité** : 100 % des 🔴/🟠 (et 100 % des constats UX toutes sévérités) portent une proposition + un effort S/M/L ; le backlog P0→P3 est présent et auto-suffisant.
- [ ] **Inventaire FR (Q3)** : le macro-constat « passage au français » est livré avec total de chaînes, répartition par vue, contraintes (SAN, données JSON, layout) et découpage proposé — relire la section C5 du rapport.
- [ ] **Lecture seule respectée** : `git status` ne montre que `reports/` + le statut de cette spec — aucun fichier de `src/`, `launcher/`, `scripts/`, `public/` modifié.
- [ ] **Acquis respectés** : zéro trade-off §11/§12 présenté comme découverte (vérifier que la section « Remises en cause » est la seule à les mentionner en négatif).

## 8. Docs (en dernier)

1. Mettre à jour le statut de cette spec : `V1 (raffinée)` → `Exécutée — rapport : reports/audit-v2-<date>.md`.
2. **Pas de nouvel ADR écrit par l'audit** : un audit en lecture seule n'acte rien dans le code. Les décisions déjà actées ici (notamment **Q3 : UI cible française**) seront enregistrées en ADR (prochain libre : 0052) par la **remédiation v2** au moment où le chantier correspondant ship — docs en dernier, jamais avant le code. Les dérives doc constatées (ex. B10, README « 376 tests ») sont **rapportées**, pas corrigées.

## 9. Anti-patterns (les pièges spécifiques de CET audit)

- **AP-1 Re-découverte des acquis** : re-signaler comme « problème » un trade-off documenté (§11/§12 remédiation, ADRs — ex. CSP launcher-only, W14(c) non fait, 960 non analysé ADR-0041). → Registre des acquis consulté avant publication ; section « Remises en cause » dédiée.
- **AP-2 Audit statique déguisé** : conclure sur le gameplay ou l'UX en lisant le code sans lancer l'app — la limite explicite de v1. → Tout constat gameplay/UX exige une preuve d'exécution (capture, console, parcours).
- **AP-3 Proposition contre-doctrine** : suggérer télémétrie, cloud, backend, comptes, catalogue de variantes — contraire à ADR-0002/0003/0041 et au README. → Chaque proposition UX cite la doctrine qu'elle respecte.
- **AP-4 Constat UX « vibes »** : « ce serait plus joli si… » sans heuristique, preuve, ni proposition actionnable. → Format obligatoire : heuristique + preuve + proposition + effort.
- **AP-5 Inflation de sévérité** : tout marquer 🔴 rend le backlog inutilisable. → Échelle v1 calibrée ; 🔴 = parcours bloqué ou promesse README cassée, rien d'autre.
- **AP-6 Corriger en auditant** : « fixer vite fait » un bug trouvé casse la lecture seule, la vérifiabilité et le rollback. → Le constat va au backlog ; zéro édit hors `reports/` + statut de spec.
- **AP-7 Couverture silencieusement partielle** : sauter des vues/modules sans le dire — le rapport paraîtrait exhaustif sans l'être. → Matrice 23 vues obligatoire, cellules « RAS »/« N/A » explicites.
- **AP-8 Vocabulaire incompatible v1** : inventer une nouvelle échelle ou renommer les axes casse la comparabilité v1→v2. → Réutiliser sévérités et noms d'axes v1 partout où l'axe existait.

## 10. Rollback

Trivial : l'audit n'ajoute que des fichiers sous `reports/` (+ une ligne de statut dans cette spec). Annuler = supprimer ces fichiers / revert du commit de rapport. Aucun état applicatif ni donnée IndexedDB touchés.

## 11. Follow-up (hors périmètre, candidats de specs suivantes)

- **Remédiation v2** : `draft-general` sur le backlog P0→P3 du rapport (le livrable principal en aval de cet audit).
- **Chantier « UI en français »** (décision actée Q3) : à exécuter en remédiation v2, dimensionné et découpé par l'inventaire du volet C5 ; ADR-0052 candidat à ce moment-là.
- **Design system léger** : si le volet C3 révèle une dispersion de tokens, une spec dédiée (palette, espacement, composants partagés) — ne pas l'improviser dans la remédiation (écarté de l'audit par Q2).
- **Posture mobile/PWA** : qualifier ou retirer `manifest.webmanifest` selon les constats de la passe mobile descriptive (Q4 actée).
- **Différés §11 remédiation toujours ouverts** (fallback IDB mémoire complet, virtualisation des listes, signature Authenticode, ESLint/Prettier, analyse 960-aware) : réévaluer avec les données v2, ne re-spécifier que si un constat v2 les rend actuels.
