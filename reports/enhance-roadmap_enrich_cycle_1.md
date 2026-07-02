# Enrich cycle 1 — sweep A1-A8 (largeur) — enhance-roadmap

Date : 2026-07-02 · Objet : `specs/enhance-roadmap-spec.md` V1 (roadmap 23 PRs) · Candidats : **10 FOLD provisoires, 0 DEFER, 0 REJECT, axes restants CLEAN**

| Axe | Finding | Verdict provisoire |
|---|---|---|
| A1 capability | **I1** PR-20 (960) doit hériter des acquis transverses antérieurs : %clk (PR-02) + replay annoté (PR-08) — sinon les parties 960 re-shippent sans horloge dans le PGN ni replay | FOLD |
| A1 capability | **I2** PR-01 « tous les stores » est imprécis : le cache Syzygy vit dans une **DB séparée** (`chess-trainer-tbcache`, README) — posture explicite requise (exclure : re-fetchable ; le wipe ADR-0013 le couvre, le backup doit se positionner) | FOLD |
| A2 observabilité | **I3** Roadmap multi-semaines sans état d'exécution : ajouter un **tableau d'avancement** (PR · spec fille · statut · date merge) dans la spec | FOLD |
| A3 fidélité | (couvert par I1 — le replay 960 est le volet rendu) ; PR-04 porte déjà « pas de courbe lissée trompeuse » | CLEAN |
| A4 robustesse | **I4** PR-02 : capture des temps par **timestamps au coup** (`performance.now()`), PAS le tick rAF — précédent empirique CE repo : audit v2, le dialog coach **gèle l'horloge rAF** ; onglet en arrière-plan = rAF suspendu → temps aberrants. Clamp + flag des valeurs aberrantes | FOLD |
| A4 robustesse | **I5** PR-01 : garde de **version au restore** — un backup d'un schéma plus récent que l'app est refusé proprement (message), jamais importé partiellement | FOLD |
| A5 réutilisation | **I6** PR-09 réutilise la **primitive « carte de récap »** de PR-03 (défaut : réutiliser ; la spec fille peut justifier une divergence) — évite deux implémentations du même pattern | FOLD |
| A5/A7 placement | **I7** PR-05 : brancher les sons au niveau des **couches partagées** (`Board.svelte` / `gameSession`), pas par vue — couvre d'office tous les trainers (symétrie gratuite) | FOLD |
| A6 extensibilité | **I8** `sessionLog` (PR-09, store v5) naît avec les champs additifs **`programId?` / `day?`** — PR-18 (multi-jours) les consommera sans re-migration. Précédent : champs additifs anticipés (pattern pools ADR-0036) | FOLD |
| A7 symétrie | PR-13 couvre déjà les deux côtés (ta déviation / hors-répertoire adverse) ; courbe « mastery vision » écartée = hors intention (pas une paire naturelle du rating) | CLEAN |
| A8 cadrage | **I9** PR-04 : **note de lecture** sur le graphe — le rating Glicko vs bot est une **échelle interne auto-référentielle** (système fermé à 2 joueurs) ; comparable à soi-même, pas à FIDE/Lichess. Doctrine honnêteté (ADR-0009 famille) | FOLD |
| A8 cadrage | **I10** PR-12 : la re-probe juste après drill mesure la **récence, pas l'acquisition** — label descriptif « mesure à chaud » sous un seuil de délai (jamais un blocage) | FOLD |

Axes vides reportés CLEAN sans fabrication : A3 (hors I1), A7 (hors I7).
