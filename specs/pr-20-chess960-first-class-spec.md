# Spec fille — PR-20 `chess960-first-class` (roadmap enhance V1, vague 5)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-20 (F10 + I1 hérités PR-02/PR-08). Lève ADR-0041 Q-C (horloges) et Q-D (analyse).

## §0 Contexte
Le vrai bloqueur d'analyse 960 n'était pas « la théorie » : c'était **chess.js qui ne rejoue pas le roque 960** (parsePgn). Les modules théorie (ECO, book, déviation répertoire) se désactivent d'eux-mêmes sur des UCI 960 (préfixes non matchés → null) — élégant, zéro flag.

## §2 Scope
**IN** : (a) **analyse 960 end-to-end** — `parse960Pgn` rejoue le movetext via le shim ChessGame (SAN résolus par `resolveMove`, roque roi-sur-tour compris), FENs UI chess.js-safe + **`engineFenBefore/After` additifs** (X-FEN) que l'évaluateur préfère ; `EngineClient.setChess960()` + passe entière en 960 avec **reset en `finally`** (classe d'échec audit C-1) ; le call-site UNIQUE (`analyzeOnePlayedGame`) route bouton + auto-run + backlog ; sélecteur backlog inclut 960 (avec `startFen` — défensif) ; échec de replay = **throw bruyant** (doctrine C-3, jamais une analyse silencieusement fausse). (b) **Puzzles 960** : positions **sans droits de roque** uniquement (le drill tourne en moteur standard), tag additif `variant`. (c) **Horloges 960** (Q-C levé) + `timeControl` persisté sur les recs 960 + **choix de couleur** (restriction 0047 levée — sans théorie ni steering, aucune raison). Hérités gratuits (I1) : replay annoté (générique sur GameAnalysis), débrief (lignes ouverture absentes d'elles-mêmes).
**OUT (§11)** : `%clk` dans le PGN persisté 960 (l'annotateur `pgnWithClocks` est chess.js — writer 960-aware à venir ; la dimension temps 960 attend) ; ECO/steering 960 (sans objet) ; missed-win MultiPV re-check spécificités.

## §4-6 — livré
`variant/chess960.ts` (+`castleFromStartFen`), `EngineClient` (+setChess960), `types.ts` (+engineFen* additifs), `analysis/pgn960.ts` (NEUF) + tests (5 : tokens, replay SP-0 réel + engineFens, SP-518 avec roque, throw bruyant, dérivation castle), `BatchAnalyzer` (seam ??), `runAnalysis` (variant+startFen, finally-reset, filtre puzzles), `analyzeBacklog` (routage variant), `unanalyzedGames` (inclusion 960), `trainer/puzzle.ts` (+variant), `Play.svelte` (auto/bouton/notice/couleur/horloges/tc-rec). **1046 verts** (1041 + 5), svelte-check **0/0** (469 fichiers), build vert. Gate vague 5 : « une partie 960 s'auto-analyse sans tag d'ouverture et génère des puzzles » — parseur testé sur position réelle + pipeline branché au call-site unique.

## §9 Anti-patterns
**AP-960-A1** : moteur laissé en mode 960 après la passe → finally-reset (C-1). **AP-960-A2** : puzzle 960 avec droits de roque servi au moteur standard → filtre champ roque `-`. **AP-960-A3** : replay désynchronisé toléré → throw. **AP-960-A4** : X-FEN dans les FENs UI (casse chessground/chess.js consumers) → champs moteur séparés additifs.

## §10 Rollback
Revert ; champs additifs (`engineFen*`, `Puzzle.variant`) relus `??` ; analyses 960 déjà produites restent valides (shapes standard).
