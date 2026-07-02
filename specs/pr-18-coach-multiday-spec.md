# Spec fille — PR-18 `coach-multiday` (roadmap enhance V1, vague 5)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-18 (F11). Dépend : PR-09 (livré — consomme les champs I8 nés en v5). Lève le DEFER multi-day d'ADR-0045.

## §0 Contexte
Le programme coach était mono-session : 30 minutes puis plus rien. Le « vrai coach personnel » — « jour 2/5, aujourd'hui les fourchettes » — était le DEFER explicite d'ADR-0045, débloqué par le sessionLog (PR-09) et ses champs `programId`/`day` nés additifs (I8, zéro re-migration).

## §2 Scope
**IN** : `coach/multiday.ts` pur — `splitProgramDays` (remplissage glouton par budget quotidien, ordre worst-first intact — le jour 1 prend la pire faiblesse ; un item plus long que le budget garde son jour ; le surplus au plafond va dans le DERNIER jour, jamais supprimé), `programIdOf` (stable sur `assessedAt`), `attemptedDays`/`nextProgramDay` (progrès DÉRIVÉ du sessionLog — une session terminée = jour tenté ; le partiel re-remonte via deprioritizeFocus PR-09) ; sélecteur « Étaler : une session / 3 / 5 jours » à côté du budget ; `coachProfile.programDays` additif ; `startProgramDay` stampe `programId`/`day` sur la session (écrits au log par PR-09) ; « Reprendre le programme » saute au premier jour non tenté ; carte Home « Programme coach : jour X/N → ».
**OUT** : rappels calendaires/notifications (queue roadmap) ; re-split d'un programme en cours ; jour « réussi vs tenté » (exigerait le masteryMet non fabriqué — AP-SLOG-1).

## §4-6 — livré
`coach/multiday.ts` + tests (5 : glouton/ordre, item>budget + spill-jamais-droppé, vide, stamps I8 filtrés + premier trou + complet, id stable). `coach/types.ts` (+`programDays?`), `app.svelte.ts` (+`programId?`/`day?` sur activeSession), `Session.svelte` (stamps au log), `Coach.svelte` (sélecteur + split + resume au jour suivant), `Home.svelte` (carte + lancement), i18n 6 clés. **1041 verts** (1036 + 5), svelte-check **0/0** (467 fichiers), build vert. Gate vague 5 (part multiday) : le programme survit au rechargement au jour 2 — progrès dérivé du store, jamais d'état dupliqué.

## §9 Anti-patterns
**AP-MULTI-1** : dupliquer le progrès sur le profil (désync) → dérivé du sessionLog seul. **AP-MULTI-2** : dropper le surplus au plafond de jours → dernier jour le prend. **AP-MULTI-3** : « jour réussi » sans évaluateur → « tenté » honnête.

## §10 Rollback
Revert ; `programDays` additif ignoré par le code antérieur.
