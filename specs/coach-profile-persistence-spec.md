# Spec — coach-profile-persistence (C1)

**Type**: feature · **Spec version**: V1 (arbitrages applied) · **Drafted**: 2026-06-30
**Portfolio**: `specs/enhancements-architecture-spec.md` §3 Coach stack (C1) · **ADR**: none (extends ADR-0045)
**Folds**: CF2, CO2, CF5, CO19 (+ enrich FOLD-1 phantom-view, FOLD-2 low-data marker) · **Pipeline**: `/draft-general` ×4 → `/enrich` ×3 → build

---

## §0 Problem & context

The coach computes a `CoachProfile` and a program, persists `coachProfile`/`coachProfilePrev`/`assessedAt`
to `PlayerModel` (Coach.svelte:181-195, ADR-0045) — and then **never reads any of it back**. `grep coachProfile`
returns only the write site and the type declaration; `assessedAt` is stored and tested but read by nothing.
Consequences observed in the real code:

1. **CF2 — write-only profile.** Re-entering the coach (intro, Coach.svelte:207-210) shows only "Start the
   assessment". The saved read is invisible; the user must re-run the full ~14-puzzle assessment to see anything.
2. **CO2 — no trend.** `coachProfilePrev` exists precisely to show movement, but nothing surfaces prev→current.
3. **CF5 — deltas aren't comparable across runs.** `MotifScore.delta = rating − baseline` is recomputed vs the
   *current* `puzzleRating` each run (diagnostic.ts:61). `puzzleRating` drifts, so a stored prev `delta` and a
   fresh `delta` are measured against different baselines — comparing them is meaningless. The **absolute**
   `MotifScore.rating` (the themed Glicko, types.ts:11) is the cross-run-stable quantity.
4. **CO19 — staleness ignored.** `assessedAt` is stored but never used to tell the user a read is old.
5. **"Plus tard" discards the program.** The button is `app.go('home')` (Coach.svelte:265). The generated
   `programPreview` lives only in `app.activeSession`, which is set **only** by `startCoaching` (line 199), never
   on the "Later" path — so leaving loses the program. `activeSession` is in-memory by design (app.svelte.ts:57;
   Session.svelte rebuilds from it or from history, AP-COACH-7).

**Goal (single concern): stop the coach from discarding its own output** — surface the saved profile on intro,
let the user resume the program by rebuilding it from the saved profile, show a directional prev→current trend on
a comparable basis, and nudge (softly) when the read is stale.

---

## §0.5 Pre-V0 scan results (verified this session)

| Premise | Verified | Evidence |
|---|---|---|
| `coachProfile`/`coachProfilePrev` write-only | ✅ | reads only at Coach.svelte:189 (the write) + db.ts:67-68 (decl); no surfacing read anywhere |
| `assessedAt` stored, never read for display | ✅ | types.ts:25, diagnostic.ts:96, tests; no UI/logic read |
| `delta` vs current baseline each run | ✅ | diagnostic.ts:61 `delta: Math.round(p.rating - puzzleRating)` |
| `MotifScore.rating` is absolute & stable | ✅ | types.ts:11 (themed Glicko, not baseline-relative) |
| `buildCoachProgram` pure, rebuilds w/o re-probe | ✅ | program.ts:42 `(profile, minutes, locale) -> PlanItem[]`, no engine/ladder import |
| "Later" discards program | ✅ | Coach.svelte:265 `go('home')`; activeSession set only at :199 |
| `activeSession` in-memory only | ✅ | app.svelte.ts:57 `$state<…|null>`; Session.svelte RESUME-or-rebuild |
| `buildSession` pure wrapper | ✅ | session.ts:41 `(PlanItem[], opts) -> SessionPlan` |
| `Radar` reusable | ✅ | Radar.svelte props `dimensions: DimensionScore[]` |
| Baseline | ✅ | **504 tests / 69 files green · svelte-check 383 files 0/0 · DB_VERSION 4** |
| `AP-CPROF-` prefix free | ✅ | 0 matches repo-wide |

No false premise → **no STOP**. (Only correction: brief paths were repo-root-relative; real root is the worktree.)

---

## §1 Scope

**IN.** (a) Intro summary card surfacing a saved `coachProfile` — the card itself **is** the "view" (always-on
radar + strengths/weaknesses + trend), with two buttons: `Start program` / `Re-assess` (enrich FOLD-1: no
separate `View profile` button — that would be a dead control since the card is already the view).
(b) Resume = rebuild the program from the saved profile via `buildCoachProgram` (reload-safe, no new persisted
state). (c) A pure `coachTrend.ts` core computing a directional prev→current trend on **absolute** themed ratings
(inner-joined on `theme`) + the tactics-rating direction, and a staleness flag from `assessedAt` + injected `now`.
(d) Trend rendered on the result screen and the intro card; staleness nudge on the intro card; low-sample trend
rows flagged low-confidence (enrich FOLD-2).

**OUT.** Re-probing / changing the assessment itself (C2). Blending played history (C4). New rating pools.
Persisting `activeSession`. Any `buildStudyPlan`/`buildSession` *logic* change (reused as-is). Multi-day calendar
scheduling (portfolio §7). Profile export (C8). Adaptive probe depth, à-la-carte scope (C2).

---

## §2 Single-concern statement

> **Surface and reuse the coach's already-persisted output — never silently discard it.**
> One concern: read what ADR-0045 already writes (`coachProfile`/`coachProfilePrev`/`assessedAt`) and put it in
> front of the user (resume + trend + staleness). No new data is captured; no probe logic changes.

---

## §3 Reuse hooks (verified — do NOT re-implement)

| Hook | Location | Use |
|---|---|---|
| `coachProfile?` / `coachProfilePrev?` | `db.ts:67-68` (persisted) | read on intro & result; already shifted on each assessment |
| `assessedAt` | `CoachProfile.assessedAt` (types.ts:25) | staleness basis + "last assessed" label |
| `MotifScore.rating` | `types.ts:11` | absolute themed rating — the cross-run-comparable quantity (CF5) |
| `buildCoachProgram` | `program.ts:42` (pure) | rebuild program from saved profile, NO re-probe (resume) |
| `buildSession` | `session.ts:41` (pure) | wrap rebuilt `PlanItem[]` → `SessionPlan` for `activeSession` (reused as-is) |
| `Radar` | `Radar.svelte` | render saved profile's `dimensions` on the intro card |
| `getLocale` / `t` | `i18n` | bilingual strings + locale for `buildCoachProgram` |
| load path | `playerModel.ts` | objects read as `undefined` when absent — read sites guard (no backfill) |

---

## §4 Implementation — CODE FIRST

### 4.1 New pure core — `src/coach/coachTrend.ts` (PURE: no Date, no Math.random, no Svelte/app)

```ts
import type { CoachProfile, MotifScore } from './types';

/** Direction of an absolute themed-rating change. Directional, never a grade (AP-CPROF-2). */
export type TrendDir = 'up' | 'down' | 'flat';

export interface MotifTrend {
  theme: string;       // joined on both runs
  prev: number;        // absolute MotifScore.rating, previous run
  current: number;     // absolute MotifScore.rating, current run
  delta: number;       // current - prev (absolute rating points — comparable; CF5)
  dir: TrendDir;
  nPrev: number;       // sample sizes carried so the UI can label honesty
  nCurrent: number;
  lowData: boolean;    // both runs minimally sampled (n<=LOW_DATA_N) → swing is likely noise (enrich FOLD-2)
}

export interface CoachTrend {
  motifs: MotifTrend[];        // per-theme, inner-joined; empty when no prior or no overlap
  tacticsDelta: number | null; // current.tactics.score - prev.tactics.score (dimension score), or null
  tacticsDir: TrendDir | null;
}

const FLAT_BAND = 15; // |rating delta| <= 15 reads as "≈": within themed-ladder noise, not a real move.
const LOW_DATA_N = 2; // both runs at the COACH_LADDER min (2 puzzles) → flag the row low-confidence (FOLD-2).

export function trendDir(delta: number, band = FLAT_BAND): TrendDir {
  if (delta > band) return 'up';
  if (delta < -band) return 'down';
  return 'flat';
}

/** Inner-join prev & current motifs on `theme` (a theme dropped for n=0 in either run is skipped),
 *  compare ABSOLUTE ratings (CF5 — deltas drift with the baseline so are NOT comparable). Pure. */
export function buildCoachTrend(current: CoachProfile, prev: CoachProfile | undefined): CoachTrend {
  if (!prev) return { motifs: [], tacticsDelta: null, tacticsDir: null };

  const prevByTheme = new Map<string, MotifScore>(prev.motifs.map((m) => [m.theme, m]));
  const motifs: MotifTrend[] = [];
  for (const cur of current.motifs) {
    const p = prevByTheme.get(cur.theme);
    if (!p) continue; // measured in only one run → not comparable, omit
    const delta = Math.round(cur.rating - p.rating);
    motifs.push({ theme: cur.theme, prev: p.rating, current: cur.rating, delta, dir: trendDir(delta), nPrev: p.n, nCurrent: cur.n, lowData: p.n <= LOW_DATA_N && cur.n <= LOW_DATA_N });
  }
  motifs.sort((a, b) => a.delta - b.delta); // biggest regressions first (worst-first, matches program order)

  const curTac = current.dimensions.find((d) => d.dimension === 'tactics' && d.sampleSize > 0);
  const prevTac = prev.dimensions.find((d) => d.dimension === 'tactics' && d.sampleSize > 0);
  const tacticsDelta = curTac && prevTac ? Math.round(curTac.score - prevTac.score) : null;

  return { motifs, tacticsDelta, tacticsDir: tacticsDelta === null ? null : trendDir(tacticsDelta) };
}

/** Days between two epoch-ms instants, floored. Pure (now injected at the UI boundary). */
export const COACH_STALE_DAYS = 21; // ~one training cycle; soft nudge only (AP-CPROF-3). Tune here.

export function profileAgeDays(assessedAt: number | undefined, now: number): number | null {
  if (typeof assessedAt !== 'number' || !(assessedAt > 0)) return null; // legacy/missing → unknown, no nudge
  return Math.floor((now - assessedAt) / 86_400_000);
}

export function isStale(assessedAt: number | undefined, now: number, staleDays = COACH_STALE_DAYS): boolean {
  const age = profileAgeDays(assessedAt, now);
  return age !== null && age > staleDays;
}
```

### 4.2 `Coach.svelte` — intro surfacing + resume (the wiring)

Add a `saved` read and a small derived state; render a summary card on the `intro` step when a saved profile exists.

```ts
// near the other state
const saved = $derived<CoachProfile | undefined>(app.model?.coachProfile);
const savedPrev = $derived<CoachProfile | undefined>(app.model?.coachProfilePrev);
let nowMs = $state(0);                  // UI-stamped once on mount (boundary for staleness)
// onMount: nowMs = Date.now();
const savedTrend = $derived(saved ? buildCoachTrend(saved, savedPrev) : null);
const savedAgeDays = $derived(saved ? profileAgeDays(saved.assessedAt, nowMs) : null);
const savedStale = $derived(saved ? isStale(saved.assessedAt, nowMs) : false);

/** Resume WITHOUT re-probing: rebuild the program from the saved profile (reload-safe, no persisted session). */
function resumeProgram() {
  if (!saved) return;
  const plan = buildCoachProgram(saved, 30, getLocale());
  app.activeSession = { plan: buildSession(plan), current: 0, startedAt: Date.now(), reflection: '' };
  app.go('session');
}
```

Intro template (`{#if step === 'intro'}`), additive — the existing Start button stays as the `Re-assess` action:

```svelte
{#if saved}
  <div class="panel col center" style="gap:0.5rem;width:100%">
    <h3>{t('coach.savedTitle')}</h3>
    <p class="muted" style="font-size:0.82rem">
      {t('coach.lastAssessed', { date: new Date(saved.assessedAt).toLocaleDateString(getLocale()) })}
      {#if savedAgeDays !== null}{t('coach.ageSuffix', { days: savedAgeDays })}{/if}
    </p>
    {#if savedStale}<p class="feedback">{t('coach.staleNudge', { days: COACH_STALE_DAYS })}</p>{/if}
    <Radar dimensions={saved.dimensions} />
    <div class="row" style="gap:1.5rem;align-items:flex-start">
      <div class="col"><b>{t('coach.strengths')}</b>{#each saved.strengths as s}<span>✔ {s}</span>{:else}<span class="muted">—</span>{/each}</div>
      <div class="col"><b>{t('coach.focusOn')}</b>{#each saved.weaknesses as w}<span>△ {w}</span>{:else}<span class="muted">—</span>{/each}</div>
    </div>
    {#if savedTrend && savedTrend.motifs.length}
      <TrendList trend={savedTrend} />   <!-- §4.3 -->
    {/if}
    <div class="row center">
      <button onclick={resumeProgram}>{t('coach.startProgram')}</button>
      <button style="background:transparent;border:1px solid var(--border)" onclick={startLadders}>{t('coach.reassess')}</button>
    </div>
  </div>
{:else}
  <p class="muted">{t('coach.intro')}</p>
  <button onclick={startLadders} disabled={app.puzzles.size === 0}>{t('coach.startAssessment')}</button>
  {#if app.puzzles.size === 0}<p class="muted">{t('coach.loadingPuzzles')}</p>{/if}
{/if}
```

Result step: after the program list, render the SAME trend (current vs `coachProfilePrev`) so the just-finished
run shows movement. Compute from the freshly committed `profile` + `app.model.coachProfilePrev`:

```svelte
{#if resultTrend && resultTrend.motifs.length}
  <TrendList trend={resultTrend} />
{/if}
```
```ts
const resultTrend = $derived(profile ? buildCoachTrend(profile, app.model?.coachProfilePrev) : null);
```
(Note: `commit()` shifts `coachProfile → coachProfilePrev` *before* this renders, so on the result screen
`coachProfilePrev` is the run-before-this; `profile` is the new one. Correct prev→current.)

### 4.3 `TrendList` — render fragment (inline in Coach.svelte, or `src/ui/TrendList.svelte` if reused)

Directional only — arrow + absolute rating delta + both sample sizes; **no grade, no aggregate score**.

```svelte
<script lang="ts">
  import type { CoachTrend } from '../coach/coachTrend';
  import { t } from '../i18n';
  let { trend }: { trend: CoachTrend } = $props();
  const ARROW = { up: '↑', down: '↓', flat: '≈' } as const;
</script>
<div class="col" style="width:100%">
  <b>{t('coach.trendTitle')}</b>
  {#if trend.tacticsDir}
    <span class="muted" style="font-size:0.82rem">{t('coach.trendTactics', { arrow: ARROW[trend.tacticsDir], delta: trend.tacticsDelta })}</span>
  {/if}
  {#each trend.motifs as m}
    <span style="font-size:0.85rem">{ARROW[m.dir]} {t('motif.' + m.theme)} <span class="muted">{t('coach.trendMotif', { delta: (m.delta >= 0 ? '+' : '') + m.delta, nPrev: m.nPrev, nCurrent: m.nCurrent })}{#if m.lowData}{t('dashboard.lowData')}{/if}</span></span>
  {/each}
  <span class="muted" style="font-size:0.75rem">{t('coach.trendDisclaimer')}</span>
</div>
```

### 4.4 i18n — `src/i18n/messages/coach.ts` (append, FR + EN parity)

```ts
'coach.savedTitle':   { fr: 'Votre dernière évaluation', en: 'Your last assessment' },
'coach.lastAssessed': { fr: 'Évalué le {date}', en: 'Assessed on {date}' },
'coach.ageSuffix':    { fr: ' · il y a {days} j', en: ' · {days}d ago' },
'coach.staleNudge':   { fr: "Cette lecture date de plus de {days} jours — une nouvelle évaluation pourrait être utile.", en: 'This read is over {days} days old — a fresh assessment may help.' },
'coach.startProgram': { fr: '▶ Reprendre le programme', en: '▶ Start program' },
'coach.reassess':     { fr: 'Réévaluer', en: 'Re-assess' },
'coach.trendTitle':   { fr: 'Évolution depuis la dernière fois', en: 'Change since last time' },
'coach.trendTactics': { fr: 'Tactique {arrow} ({delta} pts)', en: 'Tactics {arrow} ({delta} pts)' },
'coach.trendMotif':   { fr: '({delta} pts · {nPrev}→{nCurrent} essais)', en: '({delta} pts · {nPrev}→{nCurrent} tries)' },
'coach.trendDisclaimer': { fr: 'Directionnel — ratings absolus par motif, petits échantillons. Pas une note.', en: 'Directional — absolute per-motif ratings, small samples. Not a grade.' },
```

### 4.5 What is NOT touched
`diagnostic.ts`, `program.ts`, `session.ts`, `studyPlan.ts`, `db.ts`, `playerModel.ts` (no schema/logic change).
The "Plus tard" button stays `go('home')` — recovery is the intro's `Start program` on next entry (Q-D).

---

## §5 Data & persistence

- **No new persisted field.** Reads `coachProfile`/`coachProfilePrev`/`assessedAt` (already persisted, ADR-0045).
- **No `DB_VERSION` bump, no `schemaRev` bump, no migration.** `COACH_STALE_DAYS`/`FLAT_BAND` are code constants.
- Read sites **guard `undefined`** (legacy model with no profile; legacy profile object missing `assessedAt`).
- `activeSession` stays in-memory (set on resume, exactly like `startCoaching`); not persisted.

---

## §6 Acceptance gates

1. `npm test` ≥ **504** green (new `coachTrend.test.ts` adds tests; none removed). No prior test changed.
2. `svelte-check` **0 errors / 0 warnings** (still 383+ files).
3. `DB_VERSION` still **4**; `metacog-schema.test.ts` (asserts `===4`) green.
4. **CF2** — with a saved `coachProfile`, the intro shows the summary card (radar + strengths/weaknesses + last-assessed) and a `Start program` action; with none, the original intro renders. (manual/preview + static wiring-presence.)
5. **Resume (Q-D)** — `Start program` sets `app.activeSession` (rebuilt via `buildCoachProgram`→`buildSession`) and routes to `session`; resume survives a reload because it's rebuilt from the persisted profile, not from in-memory `programPreview`. (manual + unit test on the rebuild path producing the same plan as a fresh `buildCoachProgram`.)
6. **CO2/CF5** — `buildCoachTrend` compares ABSOLUTE `MotifScore.rating`, inner-joined on `theme`; a theme present in only one run is omitted; with no `coachProfilePrev` the trend is empty (section hidden). (unit.)
7. **CO19** — `isStale`/`profileAgeDays` use injected `now`; stale (> `COACH_STALE_DAYS`) → nudge shown; nudge never blocks `Start program`/`View`; absent/`0` `assessedAt` → no nudge. (unit + manual.)
8. **Honesty (AP-CPROF-2)** — trend renders only arrows + rating deltas + sample sizes; no single grade/score. (review.)
9. **i18n parity** — every new key has FR **and** EN. (review + existing i18n parity test if present.)
10. **Insights byte-identity (AP-COACH-1)** — `buildStudyPlan` output unchanged (C1 doesn't import/alter it). (existing snapshot.)

---

## §7 Documentation (LAST)

- `decisions.md`: append a short C1 entry under the coach line — "surfaces the write-only `coachProfile`/`Prev`/
  `assessedAt`; resume rebuilds via `buildCoachProgram` (no persisted session); trend on absolute themed ratings
  (CF5); soft staleness nudge; **no DB_VERSION/ADR**." Note it extends ADR-0045.
- Update `specs/enhancements-architecture-spec.md` §3 C1 row → V1/shipped when merged.
- No new ADR (flag ≥0059 only if an override forces an architectural change).
- Docs are written **after** code + tests are green.

---

## §8 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Comparing motif sets that differ run-to-run | inner-join on `theme`; omit one-run-only themes (§4.1) |
| Legacy profile lacks `assessedAt` | `profileAgeDays`/`isStale` return null/false → no nudge, no crash (§4.1 guard) |
| Resume drifts from saved profile | rebuild via the pure `buildCoachProgram` → deterministic, reload-safe (Q-D) |
| `Date` creeping into a core | all time is injected (`now`); `coachTrend.ts` is pure; UI stamps `nowMs`/`Date.now()` (AP-CPROF-1) |
| Trend implies a grade | render arrows + deltas + sample sizes only; explicit disclaimer (AP-CPROF-2) |
| Insights output shifts | C1 never touches `buildStudyPlan`/`buildSession` logic; snapshot gate (§6.10) |
| Re-render not firing on profile change | `saved`/`savedTrend` are `$derived` off `app.model` (Svelte 5 reactivity; ADR-0051 lesson) |

---

## §9 Anti-patterns (AP-CPROF-)

- **AP-CPROF-1 — `Date`/`Math.random` in a core.** `coachTrend.ts` must stay pure; `now` is injected, time is
  stamped only in `Coach.svelte` (mirrors AP-COACH-3).
- **AP-CPROF-2 — a single grade/score for the trend.** Trend is directional only (arrows + absolute rating
  deltas + sample sizes). No aggregate "coach score", no letter/number grade (mirrors AP-COACH-2).
- **AP-CPROF-3 — coercive staleness.** Staleness is a soft, ignorable nudge; it must never gate `Start program`,
  `View`, or `Re-assess`.
- **AP-CPROF-4 — comparing drifting deltas.** Cross-run comparison uses absolute `MotifScore.rating`, NOT
  `delta` (which is baseline-relative and drifts). This is the CF5 fix; reintroducing delta-comparison is the bug.
- **AP-CPROF-5 — persisting `activeSession` / bumping the schema.** Resume rebuilds from the saved profile; do
  not add a persisted session field or bump `DB_VERSION`/`schemaRev`.
- **AP-CPROF-6 — re-probing on resume.** `Start program` must call `buildCoachProgram` on the saved profile, not
  re-run the ladders (that's `Re-assess`).
- **AP-CPROF-7 — i18n leak.** No raw English/French literal in the template; every user-facing string via `t()`
  with FR+EN entries. (FOLD-2 reuses the existing `dashboard.lowData` key — do not mint a duplicate.)
- **AP-CPROF-8 — dead control.** No `View profile` button: the always-on card IS the view (enrich FOLD-1).
  Only `Start program` and `Re-assess` are buttons.

---

## §10 Test plan

**Pure-core unit — `src/coach/coachTrend.test.ts` (new):**
- `buildCoachTrend` with `prev=undefined` → `{motifs:[], tacticsDelta:null, tacticsDir:null}`.
- inner-join: theme in current only / prev only → omitted; theme in both → one `MotifTrend` with `delta =
  current.rating − prev.rating` (absolute), correct `dir`, carried `nPrev`/`nCurrent`.
- `delta` uses ABSOLUTE rating, NOT baseline-relative delta — fixture where baselines differ between runs but
  absolute ratings are equal → `delta === 0`, `dir==='flat'` (the CF5 guard).
- `trendDir` band: `+16→'up'`, `−16→'down'`, `±15→'flat'`.
- `lowData` (FOLD-2): both runs `n≤2` → `lowData===true`; either run `n>2` → `false`.
- `tacticsDelta`/`tacticsDir`: present only when both runs have a measured tactics dimension; else null.
- sort: biggest regression (most negative delta) first.
- `profileAgeDays`: `undefined`/`0`/negative → null; `now−assessedAt = 21d` → 21.
- `isStale`: `22d > 21` → true; `21d` → false (strict `>`); null age → false.
- resume-equivalence: `buildSession(buildCoachProgram(saved,30,locale))` equals a fresh build from the same
  profile (determinism — proves rebuild-not-replay yields the stable program).

**Static wiring-presence (grep-style assertions, per portfolio §8 — NO component harness):**
- `Coach.svelte` imports `buildCoachTrend`/`isStale`/`profileAgeDays` and `buildCoachProgram`.
- intro block references `saved`, `resumeProgram`, `coach.startProgram`, `coach.reassess`.
- `resumeProgram` sets `app.activeSession` then `app.go('session')`.

**Manual / preview:** seed a model with `coachProfile` (+ `coachProfilePrev`) via the existing assessment, reload
→ intro card shows; `Start program` → session resumes (and again after a hard reload); flip locale → strings swap;
backdate `assessedAt` > 21d → nudge appears; first-ever run → no trend section.

---

## §11 Rollback

Pure-additive and read-only over existing persisted data. Revert removes the `coachTrend.ts` core, the intro
card, the trend fragment, and the new i18n keys. **No data migration ran** (no `DB_VERSION`/`schemaRev` bump), so
stored `coachProfile`/`coachProfilePrev`/`assessedAt` are simply unread again by reverted code — no persisted-data
rollback, no orphaned schema. Tests/`svelte-check` return to the 504/0-0 baseline.
