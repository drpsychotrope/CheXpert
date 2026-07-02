# Spec fille — PR-19a `concept-cards-interactive` + PR-19b `concept-cards-srs` (vague 5)

> Parent : [`enhance-roadmap-spec.md`](enhance-roadmap-spec.md) (F16 + F23, **Q-C=b : séquence 19a → 19b** — 19b grade le jouable de 19a). Lève les deux DEFER d'ADR-0040 §11.

## §0 Contexte
Les cartes-concepts étaient les seuls contenus PASSIFS d'une app dont la doctrine est l'active recall ; vues une fois = oubliées (`conceptSeen` un-shot).

## §2 Scope
**19a IN** : le PREMIER exemple devient « À vous de jouer » — coup du motif masqué, board vif, exact-match sur `keyMove` (même contrat honnête qu'ADR-0017), raté → position tenue + « Montrer le coup », résolu/révélé → l'exemple redevient annoté ; hook `onTryResult(solved)` tiré UNE fois (le consommateur de 19b) ; les exemples suivants restent des exemples résolus (teach) — teach-THEN-try.
**19b IN** : `SrsItemKind` += `'concept'` (valeur d'union additive, pas de bump ; id `concept:fork`) ; grading au hook : résolu → Good, révélé → Again (`reviewItem` existant tel quel) aux DEUX surfaces (modale Tactics + bibliothèque) ; re-surfaçage dans la **bibliothèque** (« À revoir aujourd'hui : … » cliquable) — délibérément PAS dans le badge Review (il compte puzzle+repertoire explicitement ; un refresh de concept est un moment de bibliothèque).
**OUT** : Hard/Easy (un binaire honnête suffit pour un exemple unique) ; cartes multi-essais notées ; concepts dans la file Review.

## §4-6 — livré
`ConceptCard.svelte` (try-state machine + reset par carte + hook), `srs/types.ts` (+'concept' documenté), `Concepts.svelte` (due-strip + grading), `Tactics.svelte` (grading modale), i18n 5 clés. Câblage sur `ensureCard`/`reviewItem`/`dueCards` **déjà testés** — **1041 verts** inchangés, svelte-check **0/0** (467 fichiers), build vert. Gate vague 5 (part concepts) : une carte se joue et se re-planifie via FSRS — le chemin grade → due → strip → carte est composé de primitives testées.

## §9 Anti-patterns
**AP-CONC-1** : try noté sur autre chose que l'exact-match (crédit partiel non calculé) → contrat ADR-0017. **AP-CONC-2** : double grading d'une vue → hook one-shot par résolution d'état. **AP-CONC-3** : concepts dans le badge Review (dilution du signal) → bibliothèque seule.

## §10 Rollback
Revert ; cartes `concept:*` orphelines inoffensives (kind filtré partout).
