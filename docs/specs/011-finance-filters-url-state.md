---
id: 11
title: 'Finance Filters as URL Search Params'
status: in-progress
feature: finance
created: 2026-08-01
updated: 2026-08-01
---

# Finance Filters as URL Search Params

## Problem Statement

Finance filter state (date range, transaction type, selected categories, selected cities, and the active Chart/Table tab) lives entirely in an unpersisted Zustand store. A user cannot share a filtered view with anyone, cannot bookmark it, and the browser Back button does nothing to undo a filter change — it navigates away from `/finance` entirely. This also blocks a chart-click-to-drilldown feature (spec 12): committing a drilldown bucket overwrites the user's active filters, and the only acceptable undo for that is Back — which requires the filters to live in browser history in the first place.

## Goals

- Move `dateRange`, `selectedType`, `selectedCategories`, `selectedCities`, and `activeView` out of `useFinanceStore` and into validated TanStack Router search params on `/_authenticated/finance/`.
- Keep every existing consumer's read/write shape unchanged behind one new hook, so migrating a component is a one-line destructure swap, not a rewrite.
- Make a filtered finance view a copyable, shareable, bookmarkable URL.
- Make the browser Back button undo the most recent filter change.
- Fix the existing `FinanceView` type mismatch (`'chart' | 'transactions'` declared vs `'table'` used in JSX) as part of the migration.

## Non-Goals

- Not moving the table's debounced note-search text or its `pageIndex`/`pageSize` into the URL — a shared link reproduces filters and tab, not search text or page number. This is a deliberate v1 scope cut, not an oversight.
- Not changing what the filters filter (no new filter dimensions here — country filtering is out of scope, see spec 12 §Non-Goals).
- Not adding `validateSearch` to any other route — this establishes the app's first real search-param pattern, to be copied by future features, not generalized into a shared abstraction now.
- Not bumping the Zustand store's `persist` `version` — see Data Model Changes.

## Acceptance Criteria

- [ ] Given a user sets a date range, a type, categories, or cities, when they view the URL, then the search params reflect exactly those selections (e.g. `?type=expense&cat=["id1"]`).
- [ ] Given no filters are active, when viewing the URL, then no filter params appear (clean URL) — defaults are stripped, not written.
- [ ] Given a user has applied filters and clicks Back, when the previous state was a different filter combination, then that combination is restored (one filter change = one history entry, except category/city checkbox toggles which coalesce while non-empty — see Design).
- [ ] Given a URL like `?view=table&type=expense&cat=["abc"]&city=["","Jakarta"]`, when a user opens it fresh, then the Table tab is active, the type/category/city filters are applied, and the `""` entry is understood as the "no location recorded" bucket.
- [ ] Given a hand-edited or malformed URL (e.g. `?type=bogus&from=20260701`), when the page loads, then it degrades to defaults for the invalid fields instead of throwing.
- [ ] Given the user narrows `selectedType`, when a previously selected category no longer matches that type, then it is pruned from `cat` in the same navigation (no intermediate zero-row render).
- [ ] Given the user clicks a filter checkbox, when the app reacts, then there is no scroll-position jump (`resetScroll: false`).
- [ ] Given the app reloads, then `isBalanceHidden` still persists correctly (unaffected by this migration).

## Data Model Changes

**Store:** `src/stores/finance-store.ts`

Removed from `FinanceState`: `dateRange`, `selectedType`, `selectedCategories`, `selectedCities`, `activeView`, the `FinanceView` type export, and the actions `setDateRange`, `setSelectedType`, `toggleCategory`, `toggleCity`, `clearTransactionFilters`, `setActiveView`.

Kept: `categories` (+ CRUD), `isAddTransactionOpen`, `editingTransactionId`, `editingTransaction`, `isBalanceHidden`. Kept type exports `DateRange`, `TransactionType`, `FinanceCategory`, `Transaction` (unused by filter logic itself, but re-exported to avoid churn in `finance-utils.ts` / `finance-queries.ts`).

```ts
// partialize before
partialize: (state) => ({
  isBalanceHidden: state.isBalanceHidden,
  activeView: state.activeView,
})

// partialize after
partialize: (state) => ({
  isBalanceHidden: state.isBalanceHidden,
})
```

**New:** `src/routes/_authenticated/finance/-utils/finance-search.ts` — a zod schema (`financeSearchSchema`) validating `view` (`'chart' | 'table'`, default `'chart'`), `from`/`to` (`YYYY-MM-DD`, optional), `type` (`'income' | 'expense'`, optional), `cat` (`string[]`, default `[]`), `city` (`string[]`, default `[]`, where `''` means "no location recorded"). `FinanceView` is redefined here as `'chart' | 'table'` — the type mismatch bug described above cannot recur once the union only has the values the UI actually uses.

**Migration:** `version` **stays at 5**; do not bump it. Zustand's `persist` middleware, when a version mismatch occurs without a `migrate` function, logs an error and hydrates `undefined` for the whole persisted slice — which would silently reset `isBalanceHidden` for every existing user. Leaving `version: 5` with a smaller `partialize` is safe: old persisted blobs missing keys simply merge with the store's defaults, and the stray `activeView` key is dropped from storage on the next write.

## UI / UX Notes

No visual change. This is a state-plumbing migration — every screen looks and behaves identically except that:

- The URL bar updates as filters change (e.g. `/finance?type=expense&cat=["abc123"]`).
- The browser Back/Forward buttons now step through filter history.
- A copied/shared/bookmarked finance URL reproduces the filtered view.

New hook: `src/routes/_authenticated/finance/-utils/use-finance-filters.ts` (`useFinanceFilters()`), wrapping `useSearch`/`useNavigate`, exposing the exact same field and method names the store used to (`dateRange`, `selectedType`, `selectedCategories`, `selectedCities`, `activeView`, `setDateRange`, `setSelectedType`, `toggleCategory`, `toggleCity`, `clearTransactionFilters`, `setActiveView`), plus two additions: `activeFilterCount` (replaces ad-hoc recomputation in `transaction-filters.tsx`) and `setFilters(patch)` — a single batched multi-field write, used by spec 12's drilldown commit so one bucket-commit is exactly one history entry.

Consumers migrated (one hook destructure replaces several store selectors each): `finance-filters.tsx`, `finance-stat-cards.tsx`, `spending-by-category-chart.tsx`, `spending-by-daily-chart.tsx`, `spending-by-location-chart.tsx`, `transaction-header-filters.tsx`, `transaction-filters.tsx`, `transactions-table.tsx`, and the tab controls in `index.tsx`. `category-manager.tsx` is unaffected (categories only, no filters). The location chart's local City/Country `grouping` toggle stays a local `useState` — it isn't a filter.

## Edge Cases

- **Empty state:** no filters set → no filter params in the URL at all, via a `stripSearchParams` middleware on the route (mandatory, not cosmetic — `navigate()` re-validates and re-injects every zod `.default()` on every call, so without stripping, every click would write `?view=chart&cat=[]&city=[]`).
- **The `''` city sentinel:** must be encoded inside the JSON array (`?city=[""]`), never as a bare scalar — the router's query-string decoder coerces bare scalars (`''`→`''`, `'true'`→boolean, digit strings→number), but nothing inside a JSON-encoded array value is coerced.
- **`null` vs `undefined` in search state:** clearing `from`/`to`/`type` must set `undefined`, never `null` — the encoder drops `undefined` keys but stringifies `null` to the literal text `"null"`.
- **Malformed URL:** every schema field uses `.catch()` so a hand-edited or stale URL degrades field-by-field to its default rather than throwing a route error.
- **Persistence boundary:** only `isBalanceHidden` survives a reload via `localStorage`; all filters and the active tab live in the URL and survive a reload only if the URL still has them (e.g. a bookmark or shared link), consistent with today's non-persisted filter behavior.
- **No-op commits:** the date-range popover currently calls its setter on close even when the range is unchanged. As a navigation this must not create a spurious history entry — guarded by an equality check before calling `navigate`, and TanStack Router itself no-ops on a same-URL `navigate` regardless.

## Implementation Notes

1. `src/routes/_authenticated/finance/-utils/finance-search.ts` (new) — zod schema, `FinanceView`, `FINANCE_SEARCH_DEFAULTS`, `FINANCE_ROUTE_ID` constant.
2. `src/routes/_authenticated/finance/index.tsx` — add `validateSearch: financeSearchSchema` and `search: { middlewares: [stripSearchParams(FINANCE_SEARCH_DEFAULTS)] }` to the route definition.
3. `src/routes/_authenticated/finance/-utils/use-finance-filters.ts` (new) — the hook described above; type-pruning logic (dropping now-invalid `cat` entries when `selectedType` narrows) lives in its `setSelectedType`.
4. Migrate consumers in order of blast radius: the 3 charts → `finance-stat-cards.tsx` → `finance-filters.tsx` → `transaction-header-filters.tsx` → `transaction-filters.tsx` → `transactions-table.tsx` → the tab controls in `index.tsx`.
5. `src/stores/finance-store.ts` — remove the filter fields/actions and `FinanceView` export; shrink `partialize`; leave `version: 5`.
6. `docs/finance.md` — update the store-shape section and document the URL contract (param names, an example URL, the `''` city sentinel encoding).
7. `docs/architecture/feature-slices.md` — add a one-line pointer to this pattern so the next feature needing shareable filters copies it instead of reinventing it.

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/`):

- [ ] `finance-search.test.ts` — round-trips each field through `stringify → parse → validate`; `?cat=["a","b"]` → `['a','b']`; `?city=[""]` → `['']`; `?cat=a` (bare scalar) → `['a']`; `?type=bogus` → `undefined`; `?from=20260701` → `undefined`; `?view=transactions` → `'chart'`; missing keys → documented defaults.
- [ ] `use-finance-filters.test.tsx` (via a code-based route test harness with `createMemoryHistory`) — toggling a filter produces the expected `searchStr` with no default values present; `setSelectedType('income')` prunes now-invalid categories in one navigation; `clearTransactionFilters` leaves `from`/`to`/`view` untouched; `setFilters` produces exactly one history entry for a multi-field patch; the push/replace table in the design doc is reflected in `history.length` after a sequence of actions.

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [ ] Existing chart tests (`spending-by-daily-chart.test.tsx`, `spending-by-location-chart.test.tsx`) pass after swapping their `useFinanceStore` mock for a `useFinanceFilters` mock.
- [ ] `transactions-table.test.tsx` passes with filter-related keys removed from its `useFinanceStore.setState` fixture.
- [ ] Existing tests that don't touch filters (`finance-utils.test.ts`, `finance-queries.test.ts`, `data-table.test.tsx`, `category-manager.test.tsx`, `transaction-form.test.tsx`) require no changes.

**Manual verification:**

- [ ] Open `/finance`, apply a type + two categories + a city filter, confirm the URL reflects them and no extra default params appear.
- [ ] Click Back after a sequence of filter changes and confirm each step is restored.
- [ ] Copy a filtered URL into a new tab and confirm the same filtered view loads.
- [ ] Load `?type=nonsense&from=20260701` directly and confirm the page loads with defaults instead of erroring.
- [ ] Click category/city checkboxes in the table header filters and confirm the page does not scroll.
- [ ] Reload the app and confirm `isBalanceHidden` still persists as before.

## Open Questions

None.
