---
id: 19
title: 'Feature `-types/` Folders and Real API Response Types'
status: done
feature: core
related-features: [finance, notes]
created: 2026-08-11
updated: 2026-08-11
---

# Feature `-types/` Folders and Real API Response Types

## Problem Statement

`docs/architecture/feature-slices.md:75` lists `-types/` — "Types used only inside this feature" — as one of the six sanctioned vertical-slice folders. **No feature has one.** `ls src/routes/_authenticated/{habits,finance,notes,tasks}/` returns `-components`, `-utils`, `index.tsx` and nothing else. The folder is documented, never used, so 25 slice-local exported types live wherever the function that first needed them happened to be, and `finance-utils.ts` is now a 380-line file holding seven `export interface` declarations interleaved with the pure formatters that consume them.

The placement is not merely untidy, it is wrong in a way that misleads. `AggregateRow` (`finance/-utils/finance-utils.ts:36`) is a **snake_case Supabase wire row** — `category_id`, `location_city`, `location_country` — describing the response of `.select('amount, type, date, category_id, location_city, location_country')` at `finance-queries.ts:148`. It sits in the utils module, not the queries module, so the file that owns the query does not own the shape of what the query returns, and a reader of `finance-utils.ts` finds a database row wedged between `formatDateRangeLabel` and `DEFAULT_CATEGORY_CONFIGS`.

`AggregateRow` is also the **only** wire row that has a type at all. Every other Supabase response in the app is typed `Record<string, unknown>` and read through unchecked casts:

```ts
// finance-queries.ts:37
function transformCategory(row: Record<string, unknown>): FinanceCategory {
  return { id: row.id as string, isSystem: row.is_system as boolean /* … */ }
}
```

There are six such transformers (`transformCategory`, `transformTransactionLocation`, `transformTransaction` at `finance-queries.ts:37,49,69`; `transformNoteSummary`, `transformNote` at `notes-queries.ts:117,130`) plus four `as Record<string, unknown>` re-casts at the call sites (`finance-queries.ts:261,426,459`, `notes-queries.ts:261`), and roughly forty individual `as string` / `as boolean` / `as string[]` field casts between them. `row.is_system` and `row.isSystem` typecheck identically today: both are `unknown`, both cast without complaint, and the second one silently yields `undefined` at runtime. Renaming a column in Postgres produces zero TypeScript errors. The transformers are the single most drift-prone code in the app and they are the least type-checked.

## Goals

- Create `-types/` in the two slices that have enough type volume to justify it (`finance`, `notes`), and move the slice-local data types there so the folder documented at `feature-slices.md:75` is finally real.
- Give every Supabase response a named snake_case row type, so the six transformers are checked against the actual `.select()` column lists instead of casting from `unknown`.
- Establish a stated, mechanical rule for what belongs in `-types/` versus what stays beside the module it describes, and record it in `feature-slices.md` — so this does not become a folder that swallows every `interface` in the slice.
- Keep the diff reviewable as behavior-preserving: no runtime validation is added, no domain type changes shape.

## Non-Goals

- **Not** moving domain entity types out of `src/stores/`. `Transaction`, `FinanceCategory`, `DateRange` (`finance-store.ts:19,10,32`), `Note`, `NoteSummary` (`notes-store.ts:17,5`), `Habit` (`habits-store.ts:7`), and `Task`/`TaskList`/`Subtask` (`tasks-store.ts:12,27,4`) stay exactly where they are. There is a real argument that a store should own its state shape and not the domain entities, but the blast radius is 54 import sites across 22 files for finance alone, and mixing it in would destroy this spec's mechanical-equivalence property. If it happens, it happens in its own spec.
- **Not** adding `-types/` to `habits` or `tasks`. Between them they export exactly two types, and both stay put under the rule below: `HabitColor` (`habit-utils.ts:24`) is `(typeof HABIT_COLORS)[number]`, derived from a const in that file, and `DeadlineColorState` (`tasks-utils.ts:158`) is the return type of a function in that file. Creating two folders to hold nothing is worse than not creating them. (`tasks` is additionally still `in-progress` under spec 003.)
- **Not** moving component `Props`, `Ref`, or Tiptap extension-`Options` interfaces. That is ~30 declarations (`NoteEditorProps`, `TaskRowProps`, `NoteLinkMenuRef`, `SlashCommandExtensionOptions`, …) and every one of them is the public API of the module it lives in, not data crossing a boundary.
- **Not** adding runtime validation. Typing a Supabase row is an _assertion_, not a check — see Edge Cases. Zod-parsing responses would make a column rename throw at runtime instead of yielding `undefined`, which is a behavior change and belongs in its own spec.
- **Not** touching `chart-zoom.ts` / `use-chart-zoom.ts`. Spec 018's Non-Goals earmark the whole chart kit for promotion to the global layer in a dedicated spec; moving `ChartContentSize`, `ChartZoomState`, `PinchPoint` (`chart-zoom.ts:29,34,93`) and `UseChartZoomResult` (`use-chart-zoom.ts:95`) into a _finance-local_ `-types/` folder now would mean moving them twice and would make that promotion strictly harder.
- **Not** adding a `-types/index.ts` barrel. See Edge Cases.
- **Not** renaming any type. `AggregateRow` keeps its name even though `TransactionAggregateRow` would read better beside the new `TransactionRow`; cosmetic renames go in a separate commit.

## Acceptance Criteria

- [x] Given `ls src/routes/_authenticated/finance/ src/routes/_authenticated/notes/`, when it runs, then both list a `-types/` directory, and `habits/` and `tasks/` do not.
- [x] Given `grep -rn "Record<string, unknown>" src/routes/`, when it runs, then the only remaining hits are the three test-helper `overrides` params (`note-list.test.tsx:38`, `transactions-table.test.tsx:48`, `filtered-summary-bar.test.tsx:45`) and the update-payload builder at `notes-queries.ts:530` — zero hits in any `transform*` signature or call site.
- [x] Given `src/routes/_authenticated/finance/-utils/finance-utils.ts`, when read, then it declares no `export interface` — all seven have moved — and the file is shorter by those declarations only.
- [x] Given `finance-queries.ts:37`, when read, then `transformCategory` accepts `FinanceCategoryRow` and its body contains no `as` casts on field access.
- [x] Given the new row types, when a field name in a `transform*` body is misspelled (e.g. `row.isSystem` for `row.is_system`), then `bunx tsc --noEmit` reports an error. This is the whole point of the change and should be verified by deliberately breaking one field and confirming the failure before reverting. (Verified for both `finance-queries.ts` and `notes-queries.ts`, then reverted.)
- [x] Given each new row type, when compared against the `.select()` list it describes, then every selected column is present and no unselected column is: `finance-queries.ts:148` (6 columns → `AggregateRow`), `:103`/`:231` (`'*'` → `TransactionRow`, `FinanceCategoryRow`), `notes-queries.ts:207`/`:310` (8 columns → `NoteSummaryRow`), `:256` (`'*'` → `NoteRow`), `:493` (4 columns → a `Pick`).
- [x] Given `docs/architecture/feature-slices.md`, when the slice-folder and "Shared vs feature-local code" sections are read, then `-types/` has a row in both, the goes-in/stays-out rule is stated, and finance/notes are cited as the reference implementation.
- [x] Given `docs/architecture/feature-slices.md`'s test-placement table, when read, then it states that `-types/` needs no `__test__/` folder because type-only modules have no runtime.
- [x] Given `vitest.config.ts`, when read, then `coverage.exclude` covers `src/**/-types/**` and `src/types/**`.
- [x] Given `bunx tsc --noEmit`, `bun --bun run test`, `bun --bun run lint`, and `bun --bun run check`, when they run, then all pass and the suite still reports 43 files / 305 tests.

## Data Model Changes

**No domain type changes shape.** `Transaction`, `FinanceCategory`, `Note`, `NoteSummary` keep every field and every field's type; no store, no persisted `version`, no `migrate`.

What is added is a second, parallel vocabulary: the **wire layer**. The app currently has one representation of a transaction (camelCase `Transaction`) and an implicit one (`Record<string, unknown>`). After this spec it has two named ones, with the transformers as the explicit boundary between them:

```
Supabase row (snake_case)          transform*()          domain (camelCase)
─────────────────────────          ────────────          ──────────────────
FinanceCategoryRow          ──▶  transformCategory  ──▶  FinanceCategory
TransactionRow              ──▶  transformTransaction ──▶ Transaction
AggregateRow                       (consumed raw by charts)
NoteRow                     ──▶  transformNote      ──▶  Note
NoteSummaryRow              ──▶  transformNoteSummary ──▶ NoteSummary
```

`AggregateRow` is the exception that already existed: the charts consume it un-transformed, which is why it is the one wire row that was always typed.

### Target layout

```
src/routes/_authenticated/finance/-types/
├── finance-api.ts        FinanceCategoryRow (new), TransactionRow (new),
│                         AggregateRow (moved from -utils/finance-utils.ts:36)
├── finance-query.ts      TransactionQueryParams, TransactionPage, CityFilter,
│                         FinanceFiltersPatch
└── finance-chart.ts      FilteredSummary, CategorySpending, DailyCategorySeries,
                          DailySpendingPoint, LocationSpending, FacetOption,
                          DrilldownSelection, DrilldownSpec

src/routes/_authenticated/notes/-types/
├── notes-api.ts          NoteRow (new), NoteSummaryRow (new)
├── notes-query.ts        NotesListParams, NotesTagFilter, NotesOrder,
│                         NotesListQueryDescriptor, NotesListPage, NoteTagCount
└── notes-table.ts        TableAlign
```

`FinanceFiltersPatch` (`use-finance-filters.ts:13`) lands in `finance-query.ts` rather than a file of its own: it is the input side of the same query surface whose output side is `TransactionQueryParams`, and the two are read together.

### The placement rule

A type moves to `-types/` when it describes **data that crosses module boundaries inside the slice**. It stays put when it is the **API of the module it lives in**, or is **derived from a value in that module**.

| Stays put                                    | Because                                                                    | Examples                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Component `Props` / `Ref`                    | the module's own signature                                                 | `NoteEditorProps`, `TaskRowProps`, `NoteLinkMenuRef`, `SlashCommandMenuRef`            |
| Tiptap extension `Options`                   | the config surface of one extension                                        | `NoteLinkExtensionOptions`, `SlashCommandExtensionOptions`, `EditorExtensionOptions`   |
| `z.infer<typeof schema>` aliases             | moving it inverts the dependency — a types file importing a runtime schema | `FinanceSearch` (`finance-search.ts:25`), `NotesSearch` (`notes-route-search.ts:29`)   |
| `(typeof CONST)[number]` aliases             | same inversion                                                             | `HabitColor` (`habit-utils.ts:24`), `CodeBlockLanguage` (`code-block-languages.ts:12`) |
| A function's return type, declared beside it | the module's own signature                                                 | `DeadlineColorState` (`tasks-utils.ts:158`), `UseChartZoomResult`                      |

The route-search modules keep their types **as a set**. `FinanceSearch`/`NotesSearch` cannot move, and `FinanceView` (`finance-search.ts:8`), `TagFilterMode` and `NotesSortBy` (`notes-route-search.ts:7,8`) are the unions the schema is built from — splitting three of five out to `-types/` and leaving two behind is worse than leaving all five with the schema they validate.

## UI / UX Notes

None. Nothing in this spec reaches a rendered pixel. Every change is a `.d`-shaped declaration moving between files, an import line, or a cast being replaced by a checked field access.

## Edge Cases

- **A row type is an assertion, not a validation.** `data as TransactionRow[]` compiles regardless of what Postgres actually returned; if a column is renamed server-side, the field is `undefined` at runtime exactly as it is today. What this spec buys is that the _transformer_ can no longer disagree with the _declared_ column list without a compile error — the mistake moves from invisible to caught, but only for mistakes made in TypeScript. Do not let the spec, the commit message, or `docs/finance.md` imply the wire is now validated.
- **Nullability must mirror the database, and the fix goes in the transformer.** `transformTransactionLocation` (`finance-queries.ts:49-65`) already reads five columns as `string | null` and coalesces with `?? ''`; `transformTransaction:76` does `note: (row.note as string | null) ?? ''`. Once rows are typed, any column declared nullable will force a null check at sites that currently do a bare `as string`. The correct resolution is to coalesce in the transformer, matching what those two already do — **not** to widen the domain type to `string | null`, which would push nullability into every consumer and change rendering.
- **`'*'` and narrow selects need different types, via `Pick`.** `notes-queries.ts:256` selects `'*'` and feeds `transformNote`; `:207` and `:310` select eight named columns and feed `transformNoteSummary`; `:493` selects only `'id, title, excerpt, updated_at'`. One `NoteRow` cannot describe all three. Declare the full table row once as `NoteRow`, then `NoteSummaryRow = Pick<NoteRow, 'id' | 'title' | 'excerpt' | 'tags' | 'is_favorite' | 'is_read_only' | 'created_at' | 'updated_at'>`, and type the `:493` result inline as a `Pick`. `transformNoteSummary` must accept `NoteSummaryRow` (the narrow type), so the `'*'` row still satisfies it structurally — typing it as `NoteRow` would reject the eight-column callers.
- **`NoteRow` must be the real table row, not the union of what is selected.** `'*'` also returns `user_id`, `plain_text` (written at `notes-queries.ts:~530`), and whatever else the table has. Confirm the column set against the insert at `notes-queries.ts:453` and the update builder at `:530` before declaring it; guessing here produces a type that is wrong in the one place it is load-bearing.
- **Four of the moved types have no external consumer today.** `FilteredSummary`, `FacetOption`, `TransactionPage`, and `NoteTagCount` are each referenced only inside their own file (verified by `grep -rln`). They still belong in `-types/` — they are the declared shape of a query/aggregate result, and consumers get them by inference rather than by name — but the move adds an import to a file that gains nothing from it. Expect that and do not "optimize" it by leaving them behind, which would split the query-result types across two locations.
- **`AggregateRow` has five consumers, three of them tests.** `finance-utils.ts`, `finance-queries.ts`, plus `finance-utils.test.ts`, `spending-by-location-chart.test.tsx`, `spending-by-daily-chart.test.tsx`, `filtered-summary-bar.test.tsx` build fixtures against it. Its import path changes in all six. It is the single widest-reaching move in this spec.
- **No barrel file.** A `-types/index.ts` re-exporting everything would shorten imports to `from '../-types'` and simultaneously destroy the ability to answer "which module owns this type?" with a grep — which is the problem this spec exists to fix. The repo has no barrels today; it should not gain its first one here.
- **Type-only modules and istanbul coverage.** `vitest.config.ts:16` sets `coverage.include: ['src/**/*.{ts,tsx}']` with no `all: false`, so Vitest instruments every matching file whether or not a test touches it. A module that emits no JavaScript lands in the report with 0/0 statements and drags the summary in a way that reads as a regression. Add `src/**/-types/**` to `coverage.exclude` — and `src/types/**`, which has the same problem today with `src/types/location.ts`.
- **No import cycles, and none possible.** `-types/finance-query.ts` will `import type { Transaction } from '#/stores/finance-store'`, and no store imports from a finance or notes slice (only `habits-store.ts:4` imports across, for `HabitColor`, and habits gets no `-types/`). Even if a cycle appeared, `import type` is erased at build time, so it could not become a runtime cycle — but it would still trip `import/no-cycle` if that rule is on, so keep the direction one-way: `-types/` may import from `#/stores/` and `#/types/`, never from `-utils/` or `-components/`.
- **`verbatimModuleSyntax`.** Every new cross-module type reference must use `import type` / `export type`, as the existing code already does (`finance-queries.ts:14`). `bun --bun run format` will not add the keyword for you; a plain `import` of a type-only module leaves a dead runtime import of a file that emits nothing.

## Implementation Notes

Phase 0 is documentation and can land alone. Phase 1 is a pure move and is grep-verifiable. Phase 2 is the only phase that changes what the compiler checks, and it should be a separate commit per slice so a bad row type can be reverted without losing the relocation.

**Phase 0 — documentation and config**

1. **`docs/architecture/feature-slices.md`** — in the folder-layout diagram (lines 14-52) add `-types/` under `finance/` and `notes/`. In the vertical-slice table (line 75) expand the `-types/` purpose beyond "Types used only inside this feature" to carry the goes-in/stays-out rule. Add a `Feature types | src/routes/<feature>/-types/` row to "Shared vs feature-local code" (lines 116-123). Add a line to the test-placement table (lines 169-175) stating `-types/` gets no `__test__/`.
2. **`vitest.config.ts`** — add `'src/**/-types/**'` and `'src/types/**'` to `coverage.exclude` (line 17).
3. **`docs/specs/_index.md`** — add the row for this spec at the top of the table.

**Phase 1 — relocate existing types (no signature changes)**

4. **`finance/-types/finance-chart.ts`** — move `FilteredSummary` (`finance-utils.ts:96`), `CategorySpending` (`:155`), `DailyCategorySeries` (`:199`), `DailySpendingPoint` (`:206`), `LocationSpending` (`:296`), `FacetOption` (`:364`), and `DrilldownSelection`/`DrilldownSpec` (`finance-drilldown.ts:13,41`). Update consumers: `finance-utils.ts`, `finance-drilldown.ts`, `use-drilldown.ts`, `spending-by-category-chart.tsx`, `spending-by-daily-chart.tsx`, `spending-by-location-chart.tsx`, `spending-drilldown-sheet.tsx`, `finance-drilldown.test.ts`.
5. **`finance/-types/finance-query.ts`** — move `TransactionQueryParams` (`finance-queries.ts:163`), `TransactionPage` (`:178`), `CityFilter` (`:187`), `FinanceFiltersPatch` (`use-finance-filters.ts:13`). Keep every doc comment verbatim — the three on `TransactionQueryParams` explain the empty-array and `''` sentinels and are the only documentation of that contract.
6. **`notes/-types/notes-query.ts`** — move `NotesListParams` (`notes-queries.ts:96`), `NotesTagFilter` (`:141`), `NotesOrder` (`:147`), `NotesListQueryDescriptor` (`:152`), `NotesListPage` (`:189`), `NoteTagCount` (`:272`). Update `notes-queries.ts` and `note-editor.tsx:33`.
7. **`notes/-types/notes-table.ts`** — move `TableAlign` (`table-utils.ts:6`); update `table-utils.ts`, `table-context-menu.tsx:5`, `table-bubble-menu.tsx:24`.
8. **`finance/-types/finance-api.ts`** — move `AggregateRow` (`finance-utils.ts:36`), keeping its `// Lightweight row used by aggregate query` comment. Update all six consumers listed in Edge Cases.

**Phase 2 — new API row types (one commit per slice)**

9. **`finance/-types/finance-api.ts`** — add `FinanceCategoryRow` and `TransactionRow`, each mirroring its table's real columns (derive from the `'*'` selects at `finance-queries.ts:103,231`, the insert at `:110-116`, and the existing transformer bodies at `:37-83`, which enumerate every column the app reads). Then retype `transformCategory(row: FinanceCategoryRow)`, `transformTransactionLocation(row: TransactionRow)`, `transformTransaction(row: TransactionRow, categories)`, and delete the `as Record<string, unknown>` casts at `:261,426,459`, replacing them with the row type. Remove every now-redundant field cast; coalesce nullable columns in the transformer per Edge Cases.
10. **`notes/-types/notes-api.ts`** — add `NoteRow` and `NoteSummaryRow = Pick<NoteRow, …>` per Edge Cases. Retype `transformNoteSummary(row: NoteSummaryRow)` and `transformNote(row: NoteRow)`; drop the cast at `notes-queries.ts:261` and type the narrow `:493` select as a `Pick`.
11. **Verify the guard actually works** before committing: break one field name in each slice's transformer, confirm `bunx tsc --noEmit` fails, revert.

**Phase 3 — feature docs**

12. **`docs/finance.md`, `docs/second-brain.md`** — add the `-types/` folder to whatever file-layout section each has, and describe the wire-vs-domain boundary. Do **not** claim responses are validated.

## Test Plan

**This spec adds no tests, and that is a deliberate claim that needs stating.** Type-only modules have no runtime, so there is nothing to unit test; the compiler _is_ the test. The verification gate is therefore `bunx tsc --noEmit`, not `bun --bun run test` — and note that `bun --bun run build` is `vite build`, which does **not** typecheck, so a green build proves nothing here.

**Grep-verifiable pass** (run before and after):

```
ls src/routes/_authenticated/*/-types/                      # before: no such dir. after: finance/, notes/
grep -rn "Record<string, unknown>" src/routes/              # after: 4 hits, all listed in Acceptance Criteria
grep -rcn "as string\|as boolean\|as string\[\]" \
  src/routes/_authenticated/{finance,notes}/-utils/*queries.ts   # after: sharply down; no hits inside transform*
grep -rn "^export \(type\|interface\)" \
  src/routes/_authenticated/{finance,notes}/-utils/          # after: only the documented stays-put set
grep -rn "from '\.\./-types/" src/routes/                    # after: every consumer, all relative
```

**Existing tests — expect churn in import lines only.** Six files reference `AggregateRow` (four of them tests: `finance-utils.test.ts`, `spending-by-location-chart.test.tsx`, `spending-by-daily-chart.test.tsx`, `filtered-summary-bar.test.tsx`) and `finance-drilldown.test.ts` references `LocationSpending`/`DrilldownSelection`. Their fixtures do not change value, only where the type is imported from. Total should stay 43 files / 305 tests.

**The absence of test breakage is not reassurance.** Phase 2 rewrites six transformer bodies, and the transformers are barely covered — no test exercises `transformTransaction` or `transformNote` directly (they are module-private). A wrong column name introduced during the rewrite now _does_ fail `tsc`, which is the improvement; a wrong _nullability_ decision does not, and would surface as `''` where a value should be, or a crash on `.toFixed()`. Review Phase 2 by reading each transformer against the `.select()` above it.

**Manual verification** (Phase 2 only — Phase 1 cannot change runtime behavior):

- [ ] `/finance` — the stat cards, category chart, daily chart, and location chart all render populated (they consume `AggregateRow` raw); the transactions table lists rows with category name, amount, date, and note intact. (not manually verified in-browser)
- [ ] `/finance` — a transaction with a location shows its place name; one saved with no location shows the no-location treatment rather than an empty string artifact or a crash. (not manually verified in-browser)
- [ ] `/finance` — create a category and edit a transaction, confirming the `:426`/`:459` single-row transform paths still return a usable object. (not manually verified in-browser)
- [ ] `/notes` — the list pane shows title, excerpt, tags, and favorite state (`NoteSummaryRow` path); opening a note loads its body (`NoteRow` path); saving a title updates the list row (the narrow `:493` `Pick` path). (not manually verified in-browser)
- [x] `bunx tsc --noEmit`, `bun --bun run test`, `bun --bun run lint`, `bun --bun run check` all pass.

## Amendments

- **Two more sites needed the "inline instead of importing `-utils/`" resolution than Edge Cases anticipated.** The Edge Cases section stated the one-way-dependency rule (`-types/` → `#/stores/`/`#/types/` only) but didn't enumerate every field it would bite. In practice: `FinanceFiltersPatch.view` (`finance-query.ts`) inlines `'chart' | 'table'` instead of importing `FinanceView` from `finance-search.ts`, and `NotesListParams.tagFilterMode`/`sortBy` (`notes-query.ts`) inline `'AND' | 'OR'` and the four sort-key literals instead of importing `TagFilterMode`/`NotesSortBy` from `notes-route-search.ts`. Both are commented in place explaining why. This is the same duplication trade-off the rule already accepted, just realized at two call sites instead of stated in the abstract.

## Open Questions

- [ ] Should the row types be hand-written, or generated by `supabase gen types typescript`? Generated types would stay correct across migrations for free and would delete the "confirm the column set by hand" risk in Edge Cases — but they add a CLI dependency, a checked-in generated file, and a step someone must remember to re-run. Hand-written is chosen here because it is the smaller commitment; generation deserves its own spec, and if it happens the `-types/` folders become thin re-export/`Pick` layers over the generated `Database` type rather than being deleted.
- [ ] Do the domain entity types eventually move out of `src/stores/` into `-types/` (Non-Goals)? Leaving them means `-types/` holds only wire and query shapes while the entities they map to live in the store, which is a defensible boundary but not an obvious one — a reader looking for `Transaction` will check `finance/-types/` first and not find it. Worth deciding before more slices are added, not after.
- [ ] Does `src/types/` (currently just `location.ts`) stay the home for _global_ types, given the promotion table at `feature-slices.md:133` points there? If so it should be said out loud in the same section, so `src/types/` and `<feature>/-types/` read as a deliberate pair rather than two folders with the same name.
