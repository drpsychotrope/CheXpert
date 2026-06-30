# Arbitrages — teach-explain-surfacing (F4)

`/draft-general` discipline: 4 refiner cycles over the V0 draft. Recommended defaults are what the V1 spec is written against. Ratify (or override) before build.

---

## Decisions bundle (ratify)

| # | Question | Options | **Recommended default** | Why |
|---|---|---|---|---|
| **Q-A** | New shared component vs extend Calculate vs helper-only | (a) new `SolutionReveal.svelte`; (b) extend Calculate in place; (c) pure helper only | **(a)** new component, Calculate refactored to consume it | The reveal is a *rendering* concern (view-only board + animated fen + SAN line), not pure logic → (c) can't carry it. (b) leaves it trapped in Calculate (the very problem). (a) removes duplication and gives Trainer + (later) Coach one surface. |
| **Q-B** | Depth of "why" | (a) theme line; (b) +concept card; (c) +EvalGraph | **per-consumer**: trainer→theme line; Coach→EvalGraph+turning points [C6]; concept card stays behind existing `showLearn` | Grounded in a **type constraint** found in the scan: `explainPly` needs a `PlyAnalysis` the trainer-miss doesn't have. Theme-derived line is the only *honest* trainer option without an engine call. Coach already has `GameAnalysis` → richer surface there. |
| **Q-C** | Wire consumers now or component only | (a) component only; (b) +Trainer; (c) +Trainer +Coach | **(b+)** component + **both** trainer-miss consumers (Tactics & Review); Coach **deferred to C6** | A foundation PR needs a proof consumer or it's untested abstraction. Tactics+Review are the same one-liner (zero extra design). Coach game-review is a feature (C6 owns it per the DAG) — wiring it now would bloat F4 past single-concern. |
| **Q-D** | Trainer reveal trigger | (a) auto-reveal on miss; (b) "Show solution" toggle | **(b)** opt-in toggle | Trainer has **Retry**; auto-reveal would spoil it (AP-TEACH-4). Calculate keeps auto-reveal (no Retry there). |
| **Q-E** | New ADR? | yes/no | **no** (allocate ADR-0054 at build only if judged decision-worthy) | Reuse under ADR-0040/0044/0021/0052/0053. Don't pre-spend a number. |
| **Q-F** | New i18n key names | — | `reveal.showSolution/hideSolution/why/themeWhy` (FR+EN, in `tactics.ts`); **reuse** `calc.solution` | Keys free (collision report). Reusing `calc.solution` avoids a duplicate SAN-line string. |
| **Q-G** | Theme→idiom source | (a) reuse `motifExpl.*`/`motif.*`; (b) new table | **(a)** reuse existing catalogue via `cardForThemes`/`CARD_PRECEDENCE` family resolution | No new prose; bilingual already; keeps honesty (only families with real idioms render). |

---

## Refiner cycle log (honest diminishing-returns notes)

### Cycle 1 — structural defects (the load-bearing pass)
- **D1 (critical, fixed in V0→draft):** `explainPly` cannot serve the trainer-miss — it requires a `PlyAnalysis` (engine eval) that a pre-verified puzzle line never has. Without catching this, the spec would have specified an impossible reuse. → Trainer "why" becomes **theme-derived** (`missWhy`); `explainPly` reassigned to the Coach path (C6). Drove **Q-B**.
- **D2 (correctness):** `uciToSan` is **private** in `explain.ts`; the brief listed it as a hook. → SAN derived via `ChessGame.moveUci`+`formatSanLine` (Calculate's existing path); export surface not widened. Drove a §0.5 correction.
- **D3 (scope):** Two trainer-miss consumers (Tactics **and** Review), not one. → both wired (Q-C); confirms the abstraction earns its keep.
- *Verdict:* 3 substantive defects; no STOP (premise holds, hooks real). Highest-value cycle.

### Cycle 2 — scope & doctrine tightening
- **D4:** Pin the Calculate refactor as **byte-equivalent** (same SAN line + 350 ms cadence) so the extraction is provably behavior-preserving → enables safe partial rollback (§10).
- **D5:** Make trainer reveal **opt-in** (Q-D) after noticing Tactics' Retry would be spoiled by auto-reveal → AP-TEACH-4.
- **D6:** Explicit OUT list (T1/C6 boundaries; no `DB_VERSION`, no selection/SRS) to hold single-concern.
- *Verdict:* 0 critical; 3 polish/guard items. ~60% of cycle-1 value.

### Cycle 3 — honesty & test surface
- **D7:** `missWhy` must return `null` (no asserted reason) when no high-precedence family resolves → AP-TEACH-2/3, mirrors `explain.ts` fallback. Added matching unit test (FR+EN + null case).
- **D8:** Name the byte-identity anchors to verify (Insights AP-COACH-1, `explainPly` pins, EvalGraph untouched) in §6.
- *Verdict:* 0 critical; 2 items, both refinements of existing decisions. ~30% of cycle-1 value — **clear diminishing returns**.

### Cycle 4 — polish (low yield, ran to honor the 4-cycle method)
- **D9:** Helper home decision (`concepts.ts` vs new `teachLine.ts`) left as a build-time default (`concepts.ts`, reusing `familyKey`) rather than over-specifying.
- **D10:** Noted forward-compat: `SolutionReveal.moves`/`fen` are already arbitrary, so C6's non-puzzle game-review line needs no further prop work (§11).
- *Verdict:* 0 critical; 2 cosmetic/forward-looking notes. **<15% delta vs cycle 3 — stop; cycle 4 added no structural value.** Recommend not extending beyond 4.

**Diminishing-returns summary:** value concentrated in cycle 1 (the type-constraint catch reshaped the whole "why" design). Cycles 2–3 hardened scope/honesty; cycle 4 was near-empty. The method's 4-cycle cap was the right ceiling here.
