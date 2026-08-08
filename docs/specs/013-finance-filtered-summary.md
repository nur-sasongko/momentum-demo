---
id: 13
title: 'Filtered Transaction Summary'
status: done
feature: finance
created: 2026-08-02
updated: 2026-08-02
---

# Filtered Transaction Summary

## Problem Statement

When a user narrows the Table tab — say `/finance?from=2026-07-25&to=2026-08-25&view=table&city=["Bandung"]&type=expense` — the page tells them how many rows matched (`52 records` in the pagination bar) and that two filters are active (`Clear filters (2)`), but never how much money that represents. The Income/Expense stat cards above the tabs are computed from the date range alone and deliberately ignore `type`/`selectedCategories`/`selectedCities` (spec 12 §Non-Goals), so with a city filter active they report a number for a wholly different set of transactions than the table below is showing. The user has to eyeball a paginated list and add it up. This is most visible immediately after a chart drilldown commit: the drilldown sheet shows a total, a share of period spending, and a count, then "View all N transactions →" lands the user on a table where all three disappear. Separately, once filters are applied there is no on-screen indication of _what_ is filtered — the selections live inside two popovers behind a count badge.

## Goals

- Show the aggregate money for the currently filtered transaction set: total, share of period, count, and average per transaction.
- Make the active filters visible and individually removable without opening a popover.
- Preserve the drilldown sheet's numbers across a "View all N transactions →" commit, so the figures that motivated the click are still on screen after landing.
- Add zero new network requests in the common case — the existing aggregate query already holds every field the summary needs.

## Non-Goals

- **Not making the shared stat cards filter-aware.** The tempting zero-new-UI option is to have `finance-stat-cards.tsx` respond to the table filters, but those cards sit above the tabs and are shared with the Chart tab, where charts are date-range-only by design. Wiring table filters into them recreates exactly the "the card and the bar disagree" divergence spec 12 refused to introduce. This spec adds a new element scoped to the Table tab and leaves the stat cards untouched.
- **No period-over-period comparison.** A "↑ 12% vs Jun 25 – Jul 25" line is high value but needs a second aggregation pass, a definition of "equivalent previous period" for arbitrary ranges, and its own empty/partial-period handling. Deferred.
- **No breakdown inside the summary** (by category, by location, per-day sparkline). The Chart tab already serves grouping; duplicating it here would make the bar a second, worse chart.
- **No export of the filtered set.** Natural adjacency, separate feature.
- **No new URL params.** The summary is derived entirely from spec 11's existing search params — nothing about it is separately addressable or shareable.
- **No server-side aggregate.** See Edge Cases → note search; the chosen resolution avoids needing one.
- **Not showing for a date range alone.** See Acceptance Criteria — a bare date range is exactly what the existing stat cards already report.

## Acceptance Criteria

- [x] Given a user has a type, category, or city filter active on the Table tab, when the table renders, then a summary bar appears above it showing the filtered Total, Share of period, transaction Count, and Average per transaction.
- [x] Given only a date range is set (no type/category/city), when the table renders, then no summary bar appears — the Income/Expense stat cards already report that number.
- [x] Given no filters at all, when the table renders, then no summary bar appears and the layout is unchanged from today.
- [x] Given filters are active, when the summary bar renders, then each active type/category/city selection appears as a chip that removes only that selection when its ✕ is clicked, and the active date range appears as a non-removable context chip.
- [x] Given a `''` city selection is active, when its chip renders, then it reads "No location" rather than an empty chip.
- [x] Given a `type` filter of `expense` is active, when the summary renders, then Share is that filtered total as a percentage of all expenses in the same date range.
- [x] Given no `type` filter is active (so the filtered set mixes income and expense), when the summary renders, then it shows Income / Expenses / Net / Count instead of Total / Share / Count / Average — a single "total" over mixed signs is meaningless.
- [x] Given the note-search box is non-empty, when the table renders, then the summary bar is hidden entirely (see Edge Cases).
- [x] Given the active filters match zero transactions, when the summary renders, then it shows an explanatory message instead of `Rp 0` / `0%` / a `NaN` average.
- [x] Given the summary bar is visible, when the user clicks its "Clear all" action, then every type/category/city filter clears in one navigation (one history entry) and the bar disappears; the date range is untouched.
- [x] Given a mobile viewport, when the summary renders, then chips wrap and the stat blocks reflow to a 2×2 grid without horizontal overflow.
- [x] Given a drilldown "View all N transactions →" commit, when the user lands on the Table tab, then the summary bar's Total and Count match the figures the drilldown sheet displayed for that bucket.

## Data Model Changes

**Store:** None. No Zustand state, no persisted state, no new URL params — the summary is derived from spec 11's existing search params plus the already-loaded aggregate rows.

```ts
// src/routes/_authenticated/finance/-utils/finance-utils.ts (new export)

export interface FilteredSummary {
  /** Expense total within the filtered set. */
  expense: number
  /** Income total within the filtered set. */
  income: number
  /** `income - expense`. */
  net: number
  count: number
  /**
   * Filtered total as a fraction of the same date range's total for that
   * type. `null` when no single `type` is active or the denominator is 0 —
   * never a silent 0 or NaN.
   */
  share: number | null
  /** Mean amount per matching transaction. `null` when `count === 0`. */
  average: number | null
}

export function getFilteredSummary(
  rows: AggregateRow[],
  dateRange: DateRange,
  type: TransactionType | null,
  categoryIds: string[],
  cities: string[],
): FilteredSummary
```

**Migration:** N/A — nothing is persisted.

## UI / UX Notes

New component `src/routes/_authenticated/finance/-components/filtered-summary-bar.tsx`, rendered inside `transactions-table.tsx` between the `Transactions` heading and `<DataTable>`.

```
Transactions
┌────────────────────────────────────────────────┐
│  Expense ✕   Bandung ✕   Jul 25 – Aug 25       │
│                                                │
│  Rp 4,250,000    38%        52       Rp 82k    │
│  Total           of period  txns     avg       │
│                                    Clear all   │
└────────────────────────────────────────────────┘
│ Aug 24   Kopi Kenangan   Bandung   Rp 45,000   │
│ Aug 23   Grab            Bandung   Rp 32,000   │
```

Layout: a bordered/muted panel with two rows — a wrapping chip row on top, a stat row beneath.

- **Chips** — one per active selection, using the existing `Badge` primitive with a trailing ✕ button. Type chip → `setSelectedType(null)`. Category chip (labelled with the category's name and color dot, matching the facet list's `renderLabel`) → `toggleCategory(id)`. City chip → `toggleCity(city)`, with `''` rendered as "No location". The date range renders as a **non-removable** context chip (no ✕): it is shown so the numbers are interpretable, but it is owned by the `FinanceFilters` date picker above and clearing it from here would be a second, competing control for the same state.
- **Stat blocks** — reuse the visual treatment of `StatBlock` in `spending-drilldown-sheet.tsx` (label above, tabular-nums value below) so a drilldown commit lands on numbers that look like the ones the sheet just showed. Promote that component out of the sheet file into the new shared one, or into `chart-card.tsx`'s neighbour — see Implementation Notes.
- **Single-type set** (a `type` filter is active): `Total` · `Share of period` · `Transactions` · `Avg`.
- **Mixed set** (no `type` filter): `Income` · `Expenses` · `Net` · `Transactions`. No Share, no Avg.
- **Clear all** — a ghost button in the bar. `transaction-filters.tsx` currently renders a desktop-only `Clear filters (N)` ghost button in the table toolbar; that button is **removed** as part of this change, since the summary bar now owns the affordance and appears under exactly the same condition (`activeFilterCount > 0`). The mobile filter sheet keeps its own in-sheet "Clear filters" button.
- Mobile: chips wrap; stat blocks go from a 4-up row to a 2×2 grid.

## Edge Cases

- **Note search is active:** `useFinanceAggregateQuery` selects `amount, type, date, category_id, location_city, location_country` — it does **not** carry `note`. So when the debounced note-search box narrows the table further, no client-side computation can reproduce the visible row set, and a summary derived from the URL filters alone would silently overstate. Resolution: **hide the summary bar entirely while `debouncedSearch` is non-empty.** A missing number is honest; a confidently wrong one is not. This is why the spec needs no server-side aggregate.
- **Mixed income and expense:** covered above — the shape of the summary changes rather than summing across signs.
- **Zero matches:** render a single "No transactions match these filters." line in place of the stat blocks, keeping the chips and Clear all visible so the user can back out. Guards the `share`/`average` divisions.
- **Zero denominator:** a filtered set whose date range contains no spending of that type yields `share: null`, and the Share block is omitted rather than showing `0%` or `NaN%`.
- **Count vs. the pagination bar:** the summary's count is derived from the aggregate rows; the pagination bar's `N records` comes from the paginated server query's `count`. They agree at rest, but can differ for one render while the aggregate query is refetching after a mutation. Accepted — both converge, and deriving every summary figure from one source keeps the four numbers internally consistent with each other, which matters more than transient agreement with a separate element.
- **Category deleted while filtered:** a `cat` id with no matching category still filters correctly; its chip falls back to "Other" with the neutral `#71717a` dot, consistent with how the facet lists already render unknown ids.
- **Empty state:** when the user has no transactions at all, `FinanceEmptyState` renders instead of the Tabs, so the summary bar is unreachable — no special handling.
- **Persistence boundary:** nothing. The bar is pure derived state; a reload reproduces it only because spec 11 put the filters in the URL.

## Implementation Notes

1. `src/routes/_authenticated/finance/-utils/finance-utils.ts` — add `getFilteredSummary()` and the `FilteredSummary` type. Reuses the existing module-private `isInDateRange` and mirrors the filter semantics of `useTransactionsQuery` (type equality, `categoryIds` membership, `cities` membership where `''` matches a null/empty `location_city`).
2. `src/routes/_authenticated/finance/-components/filtered-summary-bar.tsx` (new) — the component described above. Reads `useFinanceFilters()` for the filter values and the chip removal actions, `useFinanceStore((s) => s.categories)` for chip labels, and `useFinanceAggregateQuery()` for the rows. Takes an `isSearchActive: boolean` prop and renders `null` when it or `activeFilterCount === 0` is true.
3. Extract `StatBlock` from `spending-drilldown-sheet.tsx` into a shared location so the sheet and the bar cannot drift apart visually — the continuity between them is the point of AC #11. `-components/stat-block.tsx` is the smallest home; update the sheet's import.
4. `src/routes/_authenticated/finance/-components/transactions-table.tsx` — render `<FilteredSummaryBar isSearchActive={Boolean(debouncedSearch)} />` between the heading and `<DataTable>`.
5. `src/routes/_authenticated/finance/-components/transaction-filters.tsx` — remove the desktop-only `Clear filters (N)` ghost button (the trailing `activeCount > 0 &&` block); the mobile sheet's in-sheet clear button stays.
6. `docs/finance.md` — document the summary bar and its trigger conditions once this ships.

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/`):

- [x] `finance-utils.test.ts` — `getFilteredSummary` respects each filter dimension independently and in combination; the `''` city selection matches rows with a null `location_city`; a mixed-type set returns correct `income`/`expense`/`net` with `share: null`; a single-type set returns a `share` relative to the same range's total for that type; `count: 0` yields `average: null` and `share: null`; a zero denominator yields `share: null` rather than `NaN`.

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [x] `filtered-summary-bar.test.tsx` (new) — renders nothing when no type/category/city filter is active, and nothing when `isSearchActive` is true even with filters active; renders Total/Share/Count/Avg for a single-type set and Income/Expenses/Net/Count for a mixed set; renders one chip per active selection; clicking a category chip's ✕ calls `toggleCategory` with that id only; the `''` city chip reads "No location"; the date-range chip has no ✕; zero matches renders the empty message and no stat blocks; "Clear all" calls `clearTransactionFilters` exactly once.
- [x] `transactions-table.test.tsx` — the bar appears with filters set and disappears once a search value is entered.

**Manual verification:**

- [x] Open `/finance?from=2026-07-25&to=2026-08-25&view=table&city=["Bandung"]&type=expense` and confirm the bar shows a Bandung chip, an Expense chip, a date-range context chip, and four numbers. _(Verified by code/test, not a live click-through: `filtered-summary-bar.test.tsx`'s "renders one chip per active selection" and "renders Total/Share/Transactions/Average" cases cover this exact chip/stat combination.)_
- [ ] Remove the Expense chip and confirm the summary reshapes to Income / Expenses / Net / Count in one navigation, and Back restores it. _(Chip removal → `setSelectedType(null)` → single `apply()` call → mixed-set reshape is covered by tests/code reading; the browser-history "Back restores it" half is unverified — needs a live check.)_
- [x] Type into the note-search box and confirm the bar disappears; clear the box and confirm it returns. _(`transactions-table.test.tsx`: "appears with filters set and disappears once a search value is entered" + "reappears once the search value is cleared".)_
- [x] Click a category bar in the Chart tab, note the sheet's total and count, click "View all →", and confirm the bar reports the same two figures. _(`finance-utils.test.ts`: "matches getSpendingByCategory's total for the same category and date range" proves the total is identical by construction — same aggregate rows, same date range, same category filter, in both code paths. Count is derived from separate queries — server paginated count vs. client aggregate count — that agree at rest per the Edge Cases note.)_
- [x] Apply a filter combination matching zero transactions and confirm the empty message renders with no `NaN`/`0%`. _(`filtered-summary-bar.test.tsx`: "renders the empty message and no stat blocks when zero transactions match"; `finance-utils.test.ts` count:0/zero-denominator cases.)_
- [ ] Check a mobile viewport for chip wrapping and the 2×2 stat grid. _(Implemented via `flex flex-wrap` and `grid-cols-2 sm:grid-cols-4`, but jsdom doesn't lay out real responsive breakpoints — needs an actual look.)_
- [x] Confirm the desktop toolbar no longer shows a second "Clear filters (N)" button. _(Confirmed by reading `transaction-filters.tsx` — the block was deleted.)_

## Open Questions

None.
