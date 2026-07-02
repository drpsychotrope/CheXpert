# Refiner cycle 1 — enhance-roadmap (détection de défauts critiques)

Date : 2026-07-02 · Spec auditée : `specs/enhance-roadmap-spec.md` V0 · Verdict : **1 critique interne (patché, doctrine non-ambiguë — pas d'escalade), prémisses validées, 8 polish → cycle 2**

## Critiques

### C1-1 — Contradiction interne §8.2 ↔ PR-09 (classe : schema/structure) — PATCHÉ
§8.2 exigeait « aucun `DB_VERSION` bump sur tout le roadmap », mais PR-09 crée un **nouveau store** `sessionLog`. La doctrine réelle du projet (README « Data model », v1→v4) : un bump est **le pattern normal pour ajouter un store** (jamais pour en modifier un) ; le pattern « sans bump » ne couvre que les champs additifs sur stores existants. Résolution sans user (doctrine écrite, non-ambiguë) : §8.2 réécrit — « bump uniquement pour créer un store (→ v5 pour `sessionLog`), champs additifs sinon » ; ligne PR-09 annotée. PR-19 vérifié au passage : `srsCards.kind` gagne un littéral `'concept'` = additif, pas de bump.

## Vérifications de prémisse (toutes PASS)

| Prémisse | Méthode | Verdict |
|---|---|---|
| PR-04 : courbe puzzle-rating possible depuis les données existantes | grep `db.ts` | **PASS** — `puzzleAttempts.ratingBefore/ratingAfter` persistés (db.ts:53-54), l'historique existe déjà |
| PR-03 : nommer l'ouverture sans analyse complète | grep `src/opening` | **PASS** — `nameOpening(uci[], table)` pur (eco.ts:23) + `loadEco()` (eco.ts:43) |
| Périmètre non-obsolète / collision | `gh pr list` | **PASS** — 0 PR ouverte (artefact collision.json) |
| Ancres des 25 findings | session /enhance + re-greps | **PASS** — cf. target_exists.json (2 corrections déjà intégrées : bibliothèque=7, batch single-PV) |

## Non-critiques (propagés en patchs cycle 2)

1. **N1** PR-04 : citer le hook vérifié `db.ts:53-54`.
2. **N2** PR-03 : citer `eco.ts:23` + `loadEco`.
3. **N3** PR-07 : l'endpoint Lichess (export public, format PGN/NDJSON) est une **hypothèse externe invérifiable offline** → pre-flight d'exécution obligatoire ajouté à la ligne PR-07.
4. **N4** PR-22 : gate « plus vite que 300 ms » = chiffre non mesuré → reformuler en « budget fixé par mesure dans la spec fille ».
5. **N5** Q-F : l'arbitrage son doit couvrir aussi l'**état par défaut** (on/off), pas seulement la techno.
6. **N6** Q-E : ajouter une 3ᵉ option moins chère — MultiPV **ciblé** (re-passe uniquement sur les coups déjà classés mistake/blunder).
7. **N7** PR-02 : expliciter l'**accumulateur par pli** dans `gameSession` (le PGN se construit à la fin ; les temps se capturent pendant).
8. **N8** Gate vague 1 : « ≥2 points après 2 parties » → préciser « parties **comptées** » (les unrated ne snapshotent pas).

## Comptages

- 25 findings → 23 PRs : mapping complet vérifié (PR-10 couvre F14+F18 ; PR-19 couvre F16+F23 ; PR-02 porte F3 + le socle de F1). Aucun orphelin, aucun doublon.
- Dépendances : 4 arêtes (02→03/04, 06→07, 09→18, 08→21) — acycliques.

## Statut

Cycle 1 : **1 critique patché, 0 escalade, 8 polish**. → Cycle 2.
