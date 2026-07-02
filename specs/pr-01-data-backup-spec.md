# Spec fille — PR-01 `data-backup` (roadmap enhance V1, vague 0)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) PR-01 (F21 + I2 + I5, ratifiés 2026-07-02).
> Pre-flight exécuté : 0 PR ouverte · HEAD `396b4c5` · `npm install` (extras skippés) OK · baseline tests lancée avant édition.

## §0 Contexte
Settings n'exporte que le profil coach (`Settings.svelte:74-77`). App locale, IndexedDB keyée origine (ADR-0049) : un vidage de navigateur détruit tout sans recours. PR-01 = filet de sécurité du roadmap entier, mergée en premier.

## §2 Scope
**IN** : export JSON de tous les stores du DB principal + restauration remplace-tout avec confirmation + garde de version (I5) + UI Settings « Vos données » + i18n FR/EN + tests round-trip.
**OUT** : cache Syzygy `chess-trainer-tbcache` (I2 — re-fetchable, couvert par le wipe ADR-0013) ; sauvegarde automatique/planifiée (§11) ; import partiel/fusion (remplace-tout uniquement).

## §4 Phase A — code
1. `src/store/backup.ts` (nouveau) :
   - `BACKUP_MARKER`, `BackupFile { marker, schema, exportedAt, stores }`.
   - `validateBackup(raw, currentSchema)` **pur** → `{ok, backup}` | `{ok:false, error: 'not-a-backup'|'newer-schema'|'malformed'}`. Garde I5 : `schema > currentSchema` → `newer-schema`.
   - `backupFilename(now)` pur → `chess-trainer-backup-YYYY-MM-DD.json`.
   - `exportAll(now)` : itère `db.objectStoreNames` dynamiquement (précédent `clearAllData`) ; **filtre le store `puzzles` à `source==='personal'`** — les ~80k curated sont un asset re-seedé au boot (`PuzzleRepo.init` re-seed quand `curatedCount===0`) et gonfleraient le fichier de ~15-20 Mo.
   - `importAll(backup)` : remplace-tout — clear de chaque store live, put des enregistrements du backup (stores inconnus → `skipped[]`), `invalidateAnalysesCache()` (miroir du wipe). Le caller recharge l'app (`location.reload()`, comme le wipe).
2. `Settings.svelte` : boutons Exporter / Restaurer (input fichier caché), `ConfirmDialog` kind `'import'`, messages d'erreur par taxonomie.
3. i18n `settings.ts` : ~9 clés FR/EN.

## §5 Phase B — tests (`src/store/backup.test.ts`, fake-indexeddb + resetDb)
- `validateBackup` : not-a-backup (non-objet, mauvais marker) · newer-schema · malformed (stores non-tableaux) · ok.
- **Round-trip** : seed représentatif sur les 10 stores (dont 1 puzzle curated + 1 personal) → `exportAll` → wipe → `importAll` → deep-equal par store ; le curated est ABSENT (design), le personal présent.
- `importAll` skippe un store inconnu (`stores.foo`) et le reporte.

## §6 Phase C — vérification
`npm test` + `npm run check` + `npm run build` verts. Gate vague 0 (part backup) : export→wipe→import → profil identique (deep-equal), prouvé par le test round-trip.

## §7 Phase Z — docs
ADR-0059 appendé (decisions.md) ; README §Privacy une ligne backup/restore ; tableau d'avancement du roadmap : PR-01 → livré.

## §9 Anti-patterns
- **AP-BACKUP-1** : liste de stores en dur (un store futur serait silencieusement absent) → itérer `objectStoreNames`.
- **AP-BACKUP-2** : import fusion/partiel (état hybride indéterminé) → remplace-tout, déterministe.
- **AP-BACKUP-3** : importer un schéma plus récent « au mieux » → refus propre (I5).
- **AP-BACKUP-4** : exporter les ~80k curated (fichier obèse, asset re-seedable) → filtre personal-only.
- **AP-BACKUP-5** : `Date.now()` dans le core → `now` injecté au boundary (convention repo).

## §10 Rollback
Revert du commit. Aucun changement de schéma (DB_VERSION intact, zéro champ nouveau).

## §11 Follow-up
Rappel périodique de sauvegarde (staleness) ; export auto avant migration v5 (PR-09).
