# Spec fille — PR-07 `lichess-fetch` (roadmap enhance V1, vague 2)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-07 (F19). Dépend : PR-06 (livré, même vague, ordre respecté).

## §0 Contexte + pre-flight
Même avec l'import en masse, il fallait exporter un fichier à la main. **Pre-flight live exécuté (exigence N3, 2026-07-02)** : `GET lichess.org/api/games/user/{u}?max=2&clocks=true` → 200, `application/x-chess-pgn`, PGN multi-parties avec headers standard + commentaires `{ [%clk 0:10:00] }` — consommé tel quel par `splitPgnGames`/`parsePgn`. API publique, zéro auth.

## §2 Scope
**IN** : bouton « Récupérer depuis Lichess » sur Import — gated sur le **même switch de consentement** que Syzygy (`allowNetwork`, ADR-0012) ; pseudo persisté (`lichessUsername` additif) ; N ∈ {20,50,100} ; `clocks=true` (les parties importées nourrissent le radar temps) ; erreurs typées actionnables ; le résultat alimente le chemin PR-06 (choix tout/1ʳᵉ, dédup, couleur par partie via le pseudo). Copies Privacy (Settings + README) mises à jour : **deux** fonctions réseau désormais, honnêtement listées.
**OUT** : chess.com (§11 roadmap) ; auth/token ; pagination au-delà de 300 ; auto-sync périodique.

## §4 Phase A — livré
`src/analysis/lichessFetch.ts` (NEUF) : `isValidLichessUsername` + `lichessExportUrl` purs (encodage, clamp 1-300), `fetchLichessGames` à `fetchFn` injectable → erreurs typées `invalid-username | not-found | rate-limited | network | empty` (un pseudo invalide ne déclenche AUCUN appel). `Import.svelte` : panneau gated (réseau off → explication + lien Réglages), fetch → `pgn` + `playerName=pseudo` + persistance du pseudo + `analyze()` (détection PR-06). `db.ts` : `lichessUsername?` additif.

## §5-6 Tests + gates — livré
`lichessFetch.test.ts` (6) : URL (encodage/clamp/params), validation pseudo, mapping 200/404/429/500/throw/vide, zéro-appel sur pseudo invalide. **1008 verts** (1002 + 6), svelte-check **0/0** (452 fichiers). Gate vague 2 : « un PGN Lichess de 50 parties s'importe en une action » — fetch → file PR-06, prouvé par le pre-flight live + les tests des deux maillons.

## §9 Anti-patterns
**AP-LICHESS-1** : egress hors du switch ADR-0012 → gate `allowNetwork` strict, UI explicite quand off. **AP-LICHESS-2** : erreur réseau brute → taxonomie typée + messages actionnables. **AP-LICHESS-3** : envoyer plus que le pseudo → URL construite par une pure testée, aucun header d'identité.

## §10 Rollback
Revert ; `lichessUsername` additif.
