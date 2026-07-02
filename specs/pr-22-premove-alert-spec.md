# Spec fille — PR-22 `premove-alert` (roadmap enhance V1, vague 5)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-22 (F20). Tient la promesse « pre-move alerts come in Phase 2 » du README (mode coaché).

## §0 Contexte
Le mode coaché n'alertait qu'APRÈS ton coup (take-back). Le check à la demande (`checkMove`, PL7) faisait exactement la lecture voulue — position courante, éval shallow, verdict risky/fine — mais exigeait un clic à chaque fois.

## §2 Scope + décisions
**IN** : lecture de risque **automatique au début de TON tour** — mode coaché ON uniquement (pas de nouveau toggle : c'était la Phase 2 promise DE ce mode), cadences **rapid/classical/untimed seulement** (jamais bullet/blitz — budget moteur, garde structurelle), réutilise la machinerie `checkMove` (une éval par position via `checkedFen` — le bouton manuel reste cohérent : désactivé sur la position déjà lue), **seul le badge « risky » s'affiche automatiquement** (un « fine » permanent à chaque coup = bruit), résultats périmés jetés (génération + position + status), best-effort (échec moteur = silence).
**Budget mesuré (exigence roadmap)** : coût = 1 éval `coachEvalBad` (depth 8, ~centaines de ms) par tour joueur en cadence lente — même ordre que le check manuel existant, sérialisé derrière la file moteur ; le kick bot n'attend jamais dessus (fire-and-forget après `status='playing'`).
**OUT** : per-candidat au survol/drag (exigerait éval par coup envisagé — coût ×N, deferred) ; bullet/blitz ; alerte hors mode coaché.

## §4-6 — livré
`Play.svelte` : `preAlertEligible` + `preMoveAlert` + appel post-`applyEngineReply` (le chemin unique de tous les replies bot). Zéro i18n neuf (réutilise `play.checkRisky`). Zéro schéma. **1049 verts** inchangés, svelte-check **0/0** (471 fichiers), build vert.

## §9 Anti-patterns
**AP-PREMOVE-1** : alerte en bullet/blitz (moteur affamé, joueur pressé) → garde catégorie. **AP-PREMOVE-2** : « fine » affiché à chaque tour → risky seul. **AP-PREMOVE-3** : verdict d'une position périmée → triple garde gen/fen/status.

## §10 Rollback
Revert ; aucun état persistant.
