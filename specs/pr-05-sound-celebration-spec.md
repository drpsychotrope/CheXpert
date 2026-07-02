# Spec fille — PR-05 `sound-celebration` (roadmap enhance V1, vague 1)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-05 (F6, Q-F=a, I7, ratifiés 2026-07-02).

## §0 Contexte
Zéro audio dans toute l'app (grep `Audio|mp3|ogg|wav|AudioContext` = 0, vérifié /enhance). Un jeu d'échecs muet paraît cassé ; l'audit v2 notait l'UX 5/10.

## §2 Scope
**IN** : sons synthétisés WebAudio (coup, capture, échec, victoire/défaite/nulle, jalon) — zéro asset binaire, licence propre ; **ON par défaut** + kill-switch un clic (Q-F=a) ; branchés aux **couches partagées** (I7) : Board.svelte = LE site unique des sons de coup pour tous les consommateurs ; célébrations sobres : record perso de rating par pool (ligne + cue) et paliers de streak {3,7,14,30,60,100} (cue seul).
**OUT** : mastery de session (PR-09 appellera `playSound('milestone')`) ; sons par-vue ; volumes réglables (§11).

## §4 Phase A — livré
- `src/ui/sound.ts` (NEUF) : `RECIPES` en données (testables sans AudioContext — notes ≤250 ms, cue ≤500 ms, gain ≤0.2 : signal, pas fanfare — AP-ROADMAP-7), `playSound` feature-détecté + try/catch (jamais dans le chemin du jeu), flag module `setSoundEnabled` synchronisé au boot + au toggle, purs `pieceCount`/`moveSoundEvent` (échec > capture > coup ; capture = baisse stricte du compte de pièces, couvre la prise en passant).
- `Board.svelte` : UN `$effect` — son uniquement quand la position change AVEC un `lastMove` non-nul → replays et tous les jeux/drills sonnent gratuitement ; boards statiques (vision, diagrammes) silencieux par construction. Sentinelle null au mount (0 warning svelte-check).
- `Play.svelte` : cue de fin (win/loss/draw, gardé par l'idempotence de `finishGame`) + record perso ("Nouveau record : {rating} !", ≥1 point antérieur requis — un 1ᵉʳ snapshot n'est pas un record) best-effort.
- `Tactics.svelte` : cue jalon au franchissement de palier de streak (site `rollStreak`).
- `db.ts` `soundEnabled?` additif (lu `?? true`) ; `app.svelte.ts` sync au boot ; Settings panneau « Sons » (toggle joue un cue de confirmation à l'activation).

## §5-6 Tests + gates — livré
`sound.test.ts` (4) : sanity des recettes (bornes durée/gain), `pieceCount`/`moveSoundEvent` (échec>capture>coup, e.p. couvert), no-throw sans AudioContext (jsdom), flag. **994 verts** (990 + 4), svelte-check **0/0** (448 fichiers), build vert. **Smoke preview** : boot propre, Settings « Sons » coché par défaut, 0 erreur console.

## §9 Anti-patterns
**AP-SOUND-1** : son dans le chemin critique (un throw audio casse un coup) → try/catch + feature-detect totaux. **AP-SOUND-2** : brancher par vue → Board seul site des coups. **AP-SOUND-3** : fanfare bloquante → cues ≤500 ms, gain ≤0.2, jamais de modale.

## §10 Rollback
Revert ; `soundEnabled` additif.
