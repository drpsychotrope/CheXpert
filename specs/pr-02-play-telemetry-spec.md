# Spec fille — PR-02 `play-telemetry` (roadmap enhance V1, vague 0)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-02 (F3 + socle F1, Q-A=a, I4, ratifiés 2026-07-02).

## §0 Contexte
Les parties jouées n'enregistraient AUCUN temps par coup (grep `clockMs|clk` dans `src/game` = 0) ni le rating autour du fold (`applyGameResult` calculé puis jeté, `Play.svelte:733`). Les consommateurs existent déjà : `parsePgn` lit `%clk` + `TimeControl` (`analysis/pgn.ts:33-70`) et en dérive `secondsSpent` → dimension temps du radar (`weakness.ts:159-176`). Deux capteurs, un concern : la télémétrie qui s'évapore (Q-A=a).

## §2 Scope
**IN** : (a) trace `%clk` par pli (parties standard chronométrées) écrite dans le PGN persisté + header `TimeControl` (lève le DEFER ADR-0036) ; (b) `ratingBefore`/`ratingAfter` additifs sur `GameRecord` (parties comptées uniquement — pas de fold → pas de snapshot).
**OUT** : affichage (PR-03/PR-04) ; 960/untimed (`clock === null` ; PR-20 hérite via l'accumulateur agnostique — I1) ; `%emt` pour parties sans horloge.

## §4 Phase A — livré
- `src/game/clockTrace.ts` (NEUF, pur) : `msToClk` (clamp défensif I4), `timeControlTag`, `pgnWithClocks` (replay chess.js + `setComment` par pli ; side-mismatch → skip « absent beats wrong » ; throw → caller garde le PGN nu, AP-TELEM-1).
- `Play.svelte` : snapshots aux DEUX press (`commitPlayerMove`, `applyEngineReply`) — lus depuis la machine d'état Clock (deltas `performance.now()`, jamais rAF — I4) ; `splice(-2)` au takeback ; reset dans `newGame` ; annotation best-effort dans `finishGame` ; capture `foldRating` dans les deux branches du fold.
- `db.ts` : champs additifs documentés, PAS de bump.

## §5-6 Tests + gates — livré
`clockTrace.test.ts` (8) : formats + clamp, tag, **round-trip `pgnWithClocks` → `parsePgn`** (clockMs par pli + dérivation `secondsSpent` avec incrément — le gate vague 0), prefix-only, side-mismatch skip, headers préservés, throw sur PGN malformé. `repos.test.ts` (+1) : round-trip additif rating + legacy sans champ.
**977 verts** (968 + 9), svelte-check **0/0** (440 fichiers), build vert.

## §9 Anti-patterns
**AP-TELEM-1** : perdre le GameRecord sur un échec d'annotation → best-effort try/catch, PGN nu en repli. **AP-TELEM-2** : snapshot depuis le tick rAF → uniquement l'état Clock post-press. **AP-TELEM-3** : snapshot de rating sur une partie non comptée → foldRating null hors fold.

## §10 Rollback
Revert du commit ; champs additifs relus `?? undefined` par construction, zéro migration.
