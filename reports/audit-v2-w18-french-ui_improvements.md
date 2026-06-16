# Améliorations : audit-v2-w18-french-ui

> Source : [`specs/audit-v2-w18-french-ui-spec.md`](../specs/audit-v2-w18-french-ui-spec.md) (V0 draftée le 2026-06-16).
> Sweep `/enrich` 8 axes + élagage adversarial. Précédents cohérents : doctrine d'honnêteté ADR-0007/0009/0027, garde-test via constantes (`metacog.test.ts`), réactivité fen-dérivée ADR-0050/0051, seed→ETL ADR-0028.

## Cycles
- **Cycle 1 (sweep)** : 4 candidats FOLD provisoires (A1, A2, A3, A8) + 2 DEFER (A5, A7) + 2 REJECT documentés.
- **Cycle 2 (élagage)** : A2 + A8 **fusionnés** en un seul FOLD (instrument + cadrage = un même « DoD FR honnête et mesurable »). Set FOLD **4 → 3** (rétréci, jamais grossi — invariant respecté). A4 (garde `t()`) rétrogradé en rider de Q-W18-1, pas un I autonome (anti AP-ENRICH-6).
- **Cycle 3 (conditionnel — RUN car cycle 2 a re-classé)** : vérifié l'interaction **I1↔I3** — l'allow-list du scanner de fuites (I1) doit être exactement la liste des exclusions intentionnelles (SAN, noms propres) que I3 ne traduit pas. Baké dans I1. Aucun nouveau FOLD. Set stable à 3 → ship.

## Sweep axes (A1-A8)
| Axe | Finding | Verdict | Raison (gates + précédent) |
|---|---|---|---|
| **A1** Capability | Conventions typographiques/numériques FR non couvertes (`78%`→`78 %` NBSP, virgule décimale, espace fine des milliers) — un « 100 % FR » qui affiche `78%`/`1.5` est à moitié traduit | **FOLD** (I3) | G-scope ✓ (partie de « passer au FR »), additif, cheap, ancré (phrase metacog `78%`, ratings, win%) |
| **A2** Observabilité | La DoD parente « 0 chaîne EN user-facing » est **asserée par revue + grep heuristique** (la spec le concède §7) — pas d'instrument prouvant la complétude | **FOLD** (→ fusion I1) | report-all descriptif (pas un sélecteur — G-report-all ✓) ; **upgrade direct de la ligne de vérif la plus faible** ; doctrine ADR-0007/0027 (« ne pas auto-déclarer une note non prouvée ») |
| **A3** Fidélité rendu | Libellés à **coordonnées fixes** (Radar.svelte:15 — déjà abrégés `'Opening'` faute de place ; EvalGraph caption ; eval-bar) : le FR plus long **se chevauche/déborde dans le SVG** — non couvert par « flex-wrap topbar » (le SVG ne reflowe pas) | **FOLD** (I2) | distinct de la vérif layout existante (flex/overflow page ≠ chevauchement intra-SVG) ; précédent « viz qui mentirait » (neckline plate) ; cheap |
| **A4** Robustesse | `t()` doit gérer un **param d'interpolation manquant** (`t('x',{})` ne doit pas rendre `"{n}"` littéral), en plus de la clé manquante déjà spécifiée | **FOLD-rider** (Q-W18-1) | additif, cheap ; rattaché au core i18n, pas un I autonome |
| **A5** Réutilisation | Consolider **toutes** les maps de libellés (MOTIF_LABELS/DIM_LABELS/SELF_TAG_LABELS, dispersées dans diagnostic.ts/metacog.ts/explain.ts) dans un module unique | **DEFER** | refactor déplaçant des exports (contrat quasi-gelé) = son propre PR cleanup (précédent « consommer ≠ modifier ») ; **la consolidation minimale Radar↔DIM_LABELS reste foldée** dans la spec (anti-pattern #5) |
| **A6** Extensibilité | Forward-compat multi-locale | **CLEAN** | Q-W18-1(a) (externaliser les chaînes) **donne déjà** l'interface locale-agnostique gratuitement ; bâtir un switcher = gold-plating (AP-ENRICH-7), la spec le diffère correctement |
| **A7** Symétrie | Messages du launcher (`server.cjs`) en EN | **DEFER** | texte dev/ops hors « UI français » de l'app ; son propre suivi |
| **A8** Cadrage honnête | « UI 100 % FR » se **lit comme tout-FR** alors que SAN/noms propres (« Ruy López ») restent EN **par décision** (ADR-0052 Q4=a) — risque de mésinterprétation du tracker §13 | **FOLD** (→ fusion I1) | report-all + note de lecture ; précédent AP-HS-8 (un chiffre qui se lit comme un edge mais est un artefact → cadrer, pas interpréter) |

## FOLD — à intégrer (ratification user)

### I1 — DoD FR **honnête et mesurable** (fusion A2 + A8) — *keystone*
- **Axe** : A2 (observabilité) + A8 (cadrage) · **Gates** : tous PASS (re-vérifiés C2/C3) · **Coût** : cheap, dev/test-only, report-all.
- **Ce que ça ajoute** :
  1. Un **instrument de fuite** : test/script qui scanne `src/ui/*.svelte` (+ générateurs) pour du texte EN user-facing résiduel et **rapporte un compte** — transforme la ligne de vérif §7 « ≈0 par revue » (que la spec concède non-gatée) en **nombre mesuré**. En dev, `t()` peut logger une clé manquante.
  2. Une **allow-list explicite = la liste des exclusions intentionnelles** : SAN anglaise (ADR-0052 Q4=a), noms propres (« Ruy López », « Gambit du Roi »), `eco.json` si Q-W18-4=c (différé), identifiants de code/clés. Le scanner ne signale pas ces exclusions (interaction I1↔I3 bakée).
  3. **Cadrage du tracker §13** : « UI 100 % FR » signifie *0 chaîne EN traduisible résiduelle* — **pas** « zéro caractère anglais » (SAN + noms propres restent EN par doctrine). Note de lecture explicite pour ne pas auto-déclarer une note non prouvée (ADR-0007/0027).
- **Où** : spec §6 (Tests, garde-fou), §7 (remplace la ligne grep heuristique par le compte instrumenté + allow-list), §8 (ancre l'anti-pattern #7), §5 Phase 5.
- **Reco** : **FOLD**.

### I2 — Fidélité des libellés à coordonnées fixes sous texte FR (A3)
- **Axe** : A3 (fidélité rendu) · **Gates** : tous PASS · **Coût** : cheap (vérif + éventuel raccourci de libellé / largeur SVG).
- **Ce que ça ajoute** : une vérif **distincte** de la topbar flex — les textes positionnés par coordonnée ne reflowent pas, ils **se chevauchent**. Cibles : `Radar.svelte` (libellés de dimension en polaire, déjà abrégés faute de place → « Conversion finale »/« Gestion du temps » FR risquent de déborder/chevaucher le polygone), `EvalGraph` (figcaption + labels de coups), eval-bar. Acceptance : rendu lisible des libellés FR dans le viewBox (raccourcir le libellé FR ou élargir le SVG si besoin), pas seulement « 0 débordement horizontal de page ».
- **Où** : spec §2 item (7), §5 Phase 3 (consolidation Radar), §7 (nouvelle ligne de vérif « libellés SVG sous FR »), §8 (anti-pattern « traduire un libellé de dimension qui déborde la viz à coords fixes »).
- **Reco** : **FOLD**.

### I3 — Conventions typographiques/numériques FR (A1)
- **Axe** : A1 (capability) · **Gates** : tous PASS · **Coût** : cheap, helper minimal + note ; **scope minimal** (pas de moteur ICU).
- **Ce que ça ajoute** : un petit `formatPercent`/`formatNumber` FR (espace insécable avant `%`, virgule décimale, espace fine des milliers) appliqué aux **spots à forte visibilité** : phrase metacog (`78 %`), ratings, win-prob, ACPL, horloge. Évite le « à moitié traduit » (`78%`, `1.5`). Pur, testable. **Garde-fou anti gold-plating** : ne couvrir que les spots visibles, pas une i18n de format exhaustive.
- **Où** : spec §2 item ajout, §5 Phase 0 (helper à côté de `t()`/pluriel) + Phase 3 (générateurs), §7 (ligne de vérif `78 %`/virgule).
- **Reco** : **FOLD**.

### Rider sur Q-W18-1 (A4)
- `t(key, params?)` doit rendre un fallback propre si un **param d'interpolation manque** (ne jamais afficher `"{n}"` littéral), en plus de « clé manquante → renvoie la clé ». Test dédié. Folder dans la description du core i18n (§5 Phase 0), pas un I autonome.

## DEFER — bonnes idées, autre PR / prématuré
- **Consolidation globale des 3 maps de libellés** dans un module unique (A5) → PR cleanup séparé (déplace des exports d'un contrat quasi-gelé). La consolidation **minimale** Radar↔DIM_LABELS reste dans W18 (anti-pattern #5). Noté spec §10.
- **Messages launcher EN** (`server.cjs`, A7) → hors « UI app français » ; suivi ops séparé. Noté spec §10.

## REJECT — écartées (documentées pour ne pas ressurgir)
- **Bâtir une machinerie multi-locale / sélecteur de langue maintenant** → gold-plating (AP-ENRICH-7) ; ADR-0052 Q3=a = mono-locale. Le catalogue (Q-W18-1a) garde la porte ouverte sans coût — c'est suffisant.
- **Traduire la SAN (`Cf3`) ou figurines** → ré-ouvre une décision actée (ADR-0052 Q4=a). Déjà anti-pattern #3.

## Verdict
- Axes balayés : **8/8** · Cycles : **3** (sweep → élagage → interaction I1↔I3).
- **FOLD : 3** (I1, I2, I3) + 1 rider · **DEFER : 2** · **REJECT : 2** · **CLEAN : 1** (A6).
- Set FOLD : 4 → 3 (fusion A2+A8), stable en C3. Aucune fabrication (A6 reporté CLEAN, pas rembourré).

## Next steps
1. Lis I1 (keystone), I2, I3 + le rider Q-W18-1.
2. Ratifie (ex. « I1 ok, I2 ok, I3 ok, rider ok »).
3. Je folde les FOLD ratifiés dans `specs/audit-v2-w18-french-ui-spec.md` (édits chirurgicaux §2/§5/§7/§8/§10) + DEFER en §10.
4. Puis build (cf. Q-W18-3 : sous-PRs par vague).
