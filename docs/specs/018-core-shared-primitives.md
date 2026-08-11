---
id: 18
title: 'Promote Shared Primitives to the Global Layer'
status: done
feature: core
related-features: [finance, notes]
created: 2026-08-11
updated: 2026-08-11
---

# Promote Shared Primitives to the Global Layer

## Problem Statement

The Finance and Notes (Second Brain) slices have each grown to roughly 4,600 lines and were built largely by copy-paste from one another. Auditing both slices surfaced code that is provably domain-free yet duplicated across features, and the duplication has already begun to drift rather than sitting inert: `useFinanceFilters` (`src/routes/_authenticated/finance/-utils/use-finance-filters.ts:40`) and `useNotesFilters` (`src/routes/_authenticated/notes/-utils/use-notes-filters.ts:25`) are the same hook down to near-identical doc comments, except the notes version was later made `useCallback`-stable with a `searchRef` and the finance version was not. The same shape, fixed on one side only.

The concrete duplication: the zod `stringArrayParam` preprocessor has an identical implementation in `finance/-utils/finance-search.ts:17-22` and `notes/-utils/notes-route-search.ts:17-22` (the docblocks differ only in the example param, `?cat=a` vs `?tags=a`). `formatCurrency` (`finance/-utils/finance-utils.ts:46-48`) is a no-op pass-through to `formatNumberWithSeparators` from the already-global `src/utils/currency.ts`, imported at 15 call sites across 7 files. `formatRelativeTime` (`notes/-utils/notes-utils.ts:10`) is pure date formatting with no notes types, sitting in a feature slice while `src/utils/date.ts` already exists and is consumed by four features. And `useRouteContext({ from: '__root__', select: (c) => c.user })` appears **verbatim five times across three features** — `src/components/TopBar.tsx:58`, `finance/-utils/finance-queries.ts:93`, `:292`, `:400`, and `notes/-utils/notes-queries.ts:447` — hardcoding the `'__root__'` magic string five times with no single point of change.

Meanwhile `docs/architecture/feature-slices.md` gates promotion at "used by **3+ features**" and warns "prefer duplicating small helpers over premature sharing." That rule is already being ignored in practice, and not accidentally: `src/components/location/` (4 components), `src/types/location.ts`, and `src/utils/location.ts` were placed in the global layer by spec 006, and `src/components/markdown/` by spec 007 — entire domain-free subsystems, every one of them consumed by **finance only**. The codebase de-facto follows "domain-free ⇒ global"; the doc says something else, so it can be cited to justify either answer and therefore settles nothing.

The same doc has drifted factually. Its folder diagram shows `src/routes/habits/`, `src/routes/finance/`, `src/routes/notes/`, but every feature has lived under `src/routes/_authenticated/<feature>/` since spec 002; the `tasks` feature is absent from all four of its tables; and it warns against a `src/utlis/` typo directory that no longer exists (confirmed via `ls src/` and `find . -name "utlis*"`) — a warning also carried in `CLAUDE.md:51`.

## Goals

- Eliminate the identified cross-feature duplication in Finance and Notes by moving each duplicated unit to the global layer exactly once.
- Amend the promotion rule in `feature-slices.md` so it describes what the codebase actually does, making future promotion decisions mechanical instead of arguable.
- Correct the factual drift in `feature-slices.md` (slice paths, missing `tasks`, the dead `src/utlis/` warning) so the doc can be trusted as a reference.
- Leave every promoted unit under test, since almost none of this code is covered today.
- Record the promotion candidates that were deliberately **not** taken, with the reason, so they are not relitigated from scratch.

## Non-Goals

- Not changing any user-visible behavior or visual output. Every change here must be reviewable as mechanically equivalent; anything that shifts pixels belongs in a separate, labeled commit.
- Not promoting the finance chart kit (`ChartCard`, `useChartZoom`, `chart-zoom.ts`, `ChartZoomControls`, `chart-axis-tick.tsx` — roughly 700 lines with zero finance domain logic). It is a genuine candidate but has one consumer and no second one in sight; deferred to its own spec so this one stays mechanical.
- Not extracting a shared `apply()`/`useSearchApply` from the two filter hooks — see the rationale under Edge Cases; the two hooks stay separate files.
- **Not** removing `searchRef`/`useCallback` from `use-notes-filters.ts`. Its doc comment at lines 19-24 explains why it exists: unstable action identity re-fires consumer effects, each redundant `navigate()` re-runs the route loader, which renders again. `note-list.tsx:86-91` depends on this. Reintroducing that thrash would undo specs 016 and 017.
- **Not** replacing the hand-rolled duration math in `formatRelativeTime` with date-fns `formatDistanceToNowStrict` while moving it — the two produce different strings at the day boundary.
- **Not** fixing the deprecated `navigator.platform` sniff while relocating it. It is wrong under Chrome's UA reduction, but correcting it is a behavior change and belongs elsewhere.
- Not refactoring `habits` or `tasks`. They are cited as evidence where they are a third consumer, but their code is only touched where a promoted symbol's import path changes.
- Not addressing the intra-finance duplication found during the audit (three near-identical chart tooltips; `TransactionFilters` re-implementing `CategoryHeaderFilter` + `LocationHeaderFilter`; `'#71717a'` inlined at six sites despite `NO_LOCATION_FILL` naming it at `finance-utils.ts:299`). All finance-internal, none cross-feature.

## Acceptance Criteria

- [x] Given `docs/architecture/feature-slices.md`, when the promotion rules section is read, then it states the relaxed rule (promote on verbatim duplication in 2+ features, **or** on being provably domain-free) and no longer contradicts the placement of `src/components/location/` and `src/components/markdown/`.
- [x] Given `feature-slices.md` and `CLAUDE.md`, when searched for `utlis`, then there are zero hits.
- [x] Given `feature-slices.md`, when the folder diagram and all four tables are read, then slice paths read `src/routes/_authenticated/<feature>/` and `tasks` appears alongside the other three features.
- [x] Given a repo-wide search for `formatCurrency`, when it completes, then there are zero hits in `src/`, and `feature-slices.md` no longer cites it as an example (it is currently cited in **two** tables).
- [x] Given a repo-wide search for `from: '__root__'`, when it completes, then there is exactly one hit — inside `src/hooks/use-current-user.ts` (a second hit in its own test asserts the same call, via `expect.objectContaining`).
- [x] Given a repo-wide search for `stringArrayParam`, when it completes, then it is defined once in `src/utils/search-params.ts` and imported by both feature search modules.
- [x] Given `src/routes/_authenticated/notes/-utils/notes-utils.ts`, when read, then `formatRelativeTime` is gone and its two consumers import `formatTimeSince` from `#/utils/date`.
- [x] Given `src/routes/_authenticated/notes/-components/`, when listed, then `unsaved-changes-bar.tsx` is absent and `src/components/unsaved-changes-bar.tsx` exists with its test at `src/components/__test__/`.
- [x] Given the boundary-toggle logic, when `use-finance-filters.ts` and `use-notes-filters.ts` are read, then both call `toggleArrayValue` from `#/utils/search-params` and neither hand-rolls the `isBoundary` computation.
- [x] Given `use-notes-filters.ts`, when read after the change, then every returned action is still wrapped in `useCallback` and `searchRef` is still present.
- [x] Given `bun --bun run test`, when it runs, then it passes, including new tests for `search-params`, `formatTimeSince`, `toggleArrayValue`, and `use-current-user` (43 test files, 305 tests, all passing).
- [x] Given `bun --bun run lint` and `bun --bun run check`, when they run, then neither reports a new error or warning (lint: 0 errors, 7 pre-existing warnings in untouched shadcn files; check: clean).

## Data Model Changes

None. No Zustand store shape, no persisted `version`, no TypeScript domain type changes. Every change is a module relocation or an alias deletion.

## UI / UX Notes

No visual change is intended anywhere. `UnsavedChangesBar` moves file but keeps its markup, and `SAVE_SHORTCUT_LABEL`'s value is unchanged.

The audit found three UI extractions that look attractive and are deliberately declined here, because in each case the extraction would silently change what a user sees:

- **A shared `EmptyState`.** Three copies exist — `finance/-components/finance-empty-state.tsx:6`, `notes/-components/notes-empty-state.tsx:12`, and `HabitsEmptyState` at `habits/-components/habit-grid.tsx:7` — but they agree on almost nothing. Habits uses a bespoke 120×120 inline `<svg>` at `size-24 text-muted-foreground/40` with no icon tile and no `bg-primary/10`; notes has no card border, uses `text-xl`, and wraps its body in a `max-w-sm space-y-2` div; finance has a dashed `bg-card/50` card and `text-lg`. That is four variance axes across three call sites with no two agreeing, and whichever skeleton won, two of three screens would shift. Aligning them visually is a design decision that should be made on its own terms; once made, the extraction becomes trivial.
- **A shared `PageHeader`.** Only two `<h1>` elements exist repo-wide (`habits/index.tsx:18`, `finance/index.tsx:72`); notes has none — `note-list.tsx:141` is an `<h2>` inside a bordered sidebar row next to an icon button, a different element for a different purpose. Two four-line sites with no third consumer. `finance/index.tsx:55-57` additionally renders a loading skeleton (`h-7 w-40`, `mt-1.5 h-4 w-72`) hand-tuned to the header's dimensions; a `PageHeader` would not own that skeleton, so extracting would split a tight coupling across a module boundary and make it worse than the duplication.
- **A `ResponsiveSheet`.** The `side={isMobile ? 'bottom' : 'right'}` + `rounded-t-xl` pattern appears at five sites, but the heights disagree — `h-[85dvh]` at `category-manager.tsx:336` and `spending-drilldown-sheet.tsx:216` (which adds `flex flex-col gap-4`), `h-[90dvh]` at `transaction-form.tsx:174`, `new-list-sheet.tsx:128`, `add-task-sheet.tsx:123` — and two further sheets don't follow it at all (`transaction-filters.tsx:176` is unconditionally `side="bottom"` with `max-h-`, and `location-cell.tsx:112` likewise). Whether 85 vs 90 is intent or drift is an open design question. Decisively, two of the five conforming sites are in `tasks`, outside this spec's scope: promoting the component and converting only the finance three would leave a global component beside two surviving hand-rolled copies, which reads worse to the next person than uniform duplication.

## Edge Cases

- **`formatRelativeTime` is misnamed, so it is renamed on the way out.** It returns a bare duration — `"just now"`, `"5 minutes"`, `"1 day"` — not a relative phrase. `note-editor.tsx:390` supplies the surrounding `Last edited … ago`; `note-list-item.tsx:48` renders it bare. Dropped into `src/utils/date.ts` next to `formatDateTimeLabel` under its current name, the next consumer will reasonably assume it already says "ago" and ship a wrong string. It lands as `formatTimeSince`.
- **`DATE_KEY_PATTERN` is not promoted.** It appears exactly once (`finance-search.ts:10`); `notes-route-search.ts` has no equivalent. It fails both halves of the relaxed rule, and it is really the wire format of `DateKey` from `src/utils/date.ts:21` — if it ever moves it belongs beside that type, not in a search-params module. Promoting a single-use regex alongside a genuine duplicate would let a weak item ride in on a strong one's evidence.
- **`UnsavedChangesBar` has exactly one consumer** (`note-editor.tsx:429`). It qualifies only under the domain-free half of the rule; there is no de-duplication win, and the spec should not imply one. It is worth doing because its siblings are already global — `use-unsaved-changes-guard.ts` and `discard-changes-dialog.tsx` were promoted by spec 010 and are used by three features — so leaving the bar behind is an inconsistency in an otherwise complete set.
- **`SAVE_SHORTCUT_LABEL` becomes a function, not a const.** Today it is module-scope and evaluated at import time (`unsaved-changes-bar.tsx:6-9`). Exporting a constant from a UI component file also violates the doc's own "one concern per file" guidance. It lands as a function in a new `src/utils/platform.ts`, which additionally makes it testable without module-cache games.
- **`toggleArrayValue` must return the pair, not apply the patch.** Notes folds `untagged` into the same navigation as the tag toggle (`use-notes-filters.ts:85`), so any helper that also performs the `apply()` cannot serve notes. Signature is `(list, value) => { next, isBoundary }`; callers build their own patch.
- **The boundary heuristic is entirely untested today.** `isBoundary` decides whether a filter change pushes a history entry or replaces one — i.e. what the browser Back button does. Nothing in the repo exercises it, so the extraction is written test-first.
- **Deleting the `formatCurrency` alias touches a doc that this spec is also amending.** `feature-slices.md` cites `formatCurrency` as _the_ canonical feature-local-helper example in two separate tables. If the symbol is deleted without editing both, the architecture doc points at a function that does not exist — in the same file whose credibility this spec is trying to restore.

## Implementation Notes

Land Phase 0 first so every later commit can cite the amended rule. Within Phase 1 the order is free; each item is independently revertable.

**Phase 0 — documentation only, zero risk**

1. **`docs/architecture/feature-slices.md`** — rewrite the "Promotion rules (feature → shared)" table to the relaxed rule: promote when a unit is verbatim/near-verbatim duplicated in **2+ features**, or is **provably domain-free** (no feature types, no feature imports). Keep the "check that the abstraction is stable" caution, and add the counter-caution this audit produced: do not extract when call sites disagree on presentation, because the extraction then silently changes output.
2. **`docs/architecture/feature-slices.md`** — fix the folder diagram to `src/routes/_authenticated/<feature>/`; add `tasks` to the "Current examples", "Shared vs feature-local code", and test-placement tables; delete the `src/utlis/` legacy note; update the "Shareable filter state" section to cite `use-notes-filters.ts` alongside the finance reference implementation, since notes is now a second implementation of the same pattern.
3. **`CLAUDE.md`** — delete the `src/utlis/` legacy line (line 51).
4. **`docs/specs/_index.md`** — the trailing comment's `Feature values: habits | finance | notes | core` omits `tasks`, despite spec 003 using it. Add it.

**Phase 1 — mechanical, grep-verifiable**

5. **`src/routes/_authenticated/finance/-utils/finance-utils.ts`** — delete `formatCurrency` (lines 46-48) and its export. Rewrite all 15 call sites across 7 files to import `formatNumberWithSeparators` from `#/utils/currency`. **In the same commit**, update the two `feature-slices.md` tables that cite `formatCurrency` as an example (replace with `getStreak`, which is genuinely feature-local).
6. **New `src/utils/platform.ts`** — `getSaveShortcutLabel(): string`, moved verbatim from `unsaved-changes-bar.tsx:6-9`. Behavior unchanged, deprecated API and all.
7. **`src/utils/date.ts`** — add `formatTimeSince(iso: string): string`, moved from `notes-utils.ts:10` with the body unchanged. Document in its JSDoc that it returns a bare duration and the caller supplies any "ago" suffix. Update `note-editor.tsx:390` and `note-list-item.tsx:48`; remove the function from `notes-utils.ts`.
8. **New `src/utils/search-params.ts`** — export `stringArrayParam` (the zod preprocessor). Import it in `finance/-utils/finance-search.ts` and `notes/-utils/notes-route-search.ts`, deleting both local copies. Leave `DATE_KEY_PATTERN` where it is.
9. **New `src/hooks/use-current-user.ts`** — `useCurrentUser(): AppUser | null`, wrapping `useRouteContext({ from: '__root__', select: (c) => c.user })`. Replace all five call sites: `src/components/TopBar.tsx:58`, `finance-queries.ts:93`, `:292`, `:400`, `notes-queries.ts:447`. This is the only item that clears even the original 3+ rule.

**Phase 2 — module move, one test relocates**

10. **Move `notes/-components/unsaved-changes-bar.tsx` → `src/components/unsaved-changes-bar.tsx`.** Drop the `SAVE_SHORTCUT_LABEL` const; call `getSaveShortcutLabel()` from step 6 during render. Update the import at `note-editor.tsx:429`. Move its test from `notes/-components/__test__/unsaved-changes-bar.test.tsx` to `src/components/__test__/`, matching where `discard-changes-dialog.test.tsx` already lives.

**Phase 3 — behavior-adjacent, written test-first**

11. **`src/utils/search-params.ts`** — add `toggleArrayValue<T>(list: T[], value: T): { next: T[]; isBoundary: boolean }`. Write `src/utils/__tests__/search-params.test.ts` covering it **before** touching any caller.
12. **`use-finance-filters.ts`** (`toggleCategory` at 81-87, `toggleCity` at 89-95) and **`use-notes-filters.ts`** (`toggleActiveTag` at 77-90) — call `toggleArrayValue` and build their own patches. Notes keeps folding `untagged` into its patch, and keeps its `useCallback` wrapper.

**Follow-ups deliberately left out of this spec** — each needs its own commit, because bundling them destroys this spec's most valuable property, that its diff can be reviewed as mechanically equivalent:

- A real bug: `notes/-components/table-context-menu.tsx:95-99` registers an anonymous `keydown` listener that the cleanup at lines 101-106 never removes (it removes only `contextmenu`, `click`, and `scroll`), leaking one listener per effect re-run. Needs a `fix` commit, a test, and — unlike this spec — a `CHANGELOG.md` entry under `Fixed`.
- Deleting `ThemeToggle.tsx` (zero importers). Note the premise that `TopBar` duplicates it is **wrong**: `TopBar.tsx:33-36,128` is a three-option dropdown calling `setTheme`, while `ThemeToggle` is a single cycling button calling `cycleTheme` — a different interaction. Deleting it also orphans `cycleTheme`/`themeLabels` in `use-theme.ts`. A product decision, not a cleanup.
- The empty `TanstackQueryProvider` no-op at `src/libs/tanstack-query/root-provider.tsx:10` (spec 004 debris), and the fully unreferenced `notes/-utils/tiptap-content.ts` (73 lines; note `notes-queries.ts:23` re-creates its `EMPTY_DOC`, so "should we use it instead" needs answering first).
- Genuinely dead exports: `moveTableRow` (`table-utils.ts:109`), `isEmptyDoc` (`notes-utils.ts:46`), `getCodeBlockLanguageLabel` (`code-block-languages.ts:14`). Note that `getExcerpt` (`notes-utils.ts:37`) and `buildCityFilter` (`finance-queries.ts:216`) are **not** dead despite having no production callers — both have passing tests, so removing them is a judgment call rather than a sweep.
- The finance chart kit, and the duplicated snake_case→camelCase row transformers in `finance-queries.ts` / `notes-queries.ts`.
- Feature-local **type placement**: `feature-slices.md:75` sanctions a `-types/` slice folder that no feature actually has, so 25 slice-local types sit wherever the first consumer happened to be — including `AggregateRow` (`finance-utils.ts:36`), a `snake_case` Supabase wire row filed in the utils module. Every other wire row is `Record<string, unknown>` read through unchecked casts. This spec moves code _out_ of slices to the global layer; that one moves types _within_ a slice into `-types/` and gives the responses real types — the opposite direction, so it gets its own spec: [`019-core-feature-types-folders.md`](./019-core-feature-types-folders.md).

## Test Plan

**Search-and-verify pass** (run before and after; all five should return the stated result):

```
grep -rn "formatCurrency" src/                      # expect: 0 hits
grep -rn "from: '__root__'" src/                    # expect: 1 hit, in use-current-user.ts
grep -rn "stringArrayParam" src/                    # expect: 1 definition + 2 imports
grep -rn "formatRelativeTime" src/                  # expect: 0 hits
grep -rn "utlis" src/ docs/ CLAUDE.md               # expect: 0 hits
```

**Unit tests** (`src/utils/__tests__/`, `src/hooks/__tests__/`) — new, and required by `feature-slices.md`'s own "Adding a global utility" step 4:

- [x] `search-params.test.ts` — `stringArrayParam` coerces a bare scalar to a single-element array, passes arrays through, and falls back to `[]` on a malformed value (the `.catch([])` path).
- [x] `search-params.test.ts` — `toggleArrayValue` adds a missing value, removes a present one, and reports `isBoundary: true` exactly when the list transitions empty→non-empty or non-empty→empty.
- [x] `date.test.ts` — `formatTimeSince` at the "just now", minutes, hours, and days boundaries, asserting the returned string carries **no** "ago" suffix.
- [x] `use-current-user.test.ts` — returns the user from root context, and `null` when unauthenticated.
- [x] `platform.test.ts` (not originally listed, added because `feature-slices.md`'s own "Adding a global utility" rule requires a test for every new global util) — `getSaveShortcutLabel` on macOS, iOS, and Windows/Linux.

**Component tests:**

- [x] `src/components/__test__/unsaved-changes-bar.test.tsx` — the relocated test passes unchanged apart from its import path.

**Existing tests:** exactly one file's import path changes (`notes/-components/__test__/unsaved-changes-bar.test.tsx:4`, moving with its component). Nothing else breaks — no test imports `formatCurrency` or `formatRelativeTime`, and all seven filter-hook consumer tests (`transactions-table.test.tsx:36`, `filtered-summary-bar.test.tsx:17`, `spending-by-daily-chart.test.tsx:16`, `spending-by-location-chart.test.tsx:15`, `note-list.test.tsx:34`, `note-editor.test.tsx:50`, `note-list-item.test.tsx:9`) `vi.mock` the hook module by path, so internal extraction is invisible to them.

**That near-total absence of breakage is the warning, not the reassurance.** This refactor is almost entirely unguarded: `spending-drilldown-sheet.tsx`, `finance-stat-cards.tsx`, and `filtered-summary-bar.tsx` have no tests covering their `formatCurrency` call sites at all, so a typo'd rewrite there ships silently. The 15 call-site rewrite should be verified by grep and by eye, not by the suite.

**Manual verification:**

- [ ] `/finance` — amounts render with thousands separators and two decimals in the stat cards, the table, the filtered-summary bar, and the drilldown sheet. (not manually verified in-browser)
- [ ] `/finance` — toggle a category filter on and off; Back returns to the previous filter state rather than jumping past several intermediate states. (not manually verified in-browser)
- [ ] `/notes` — a note's list row and editor footer both show the correct elapsed time, and the editor still reads "Last edited … ago" with no doubled suffix. (not manually verified in-browser)
- [ ] `/notes` — edit a note, confirm the unsaved-changes bar appears with the correct platform shortcut label (⌘S on macOS), and that Save works. (not manually verified in-browser)
- [ ] `/notes` — toggle a tag filter on and off and confirm Back behaves as before. (not manually verified in-browser)
- [x] `bun --bun run test`, `bun --bun run lint`, `bun --bun run check` all pass.

## Open Questions

- [ ] Should `src/components/location/`, `src/components/markdown/`, and the finance-only `ui/` primitives (`data-table`, `editable-cell`, `currency-input`, `datetime-picker`) be explicitly blessed in `feature-slices.md` as examples of the domain-free rule, or left unmentioned? Blessing them makes the amended rule concrete; it also permanently sanctions single-consumer globals.
- [ ] Is the `h-[85dvh]` vs `h-[90dvh]` split across the five responsive sheets design intent or drift? Answering this unblocks the deferred `ResponsiveSheet`.
- [ ] Do the three empty states get visually aligned (unblocking a shared `EmptyState`), and if so which one is canonical? — a design call, not an engineering one.
- [ ] Should `formatTransactionDate` in `src/utils/date.ts` be renamed? It is finance-flavored naming in a global module, the mirror image of the problem this spec fixes, but renaming it touches finance call sites for cosmetic gain.
