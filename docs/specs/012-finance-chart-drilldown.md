---
id: 12
title: 'Chart Click-to-Drilldown'
status: in-progress
feature: finance
created: 2026-08-01
updated: 2026-08-01
---

# Chart Click-to-Drilldown

## Problem Statement

The finance charts (spending by category, by day, by location) are read-only pictures. A user who sees a tall "Food & Beverage" bar has no way to ask "which transactions made up that bar?" — they must switch to the Table tab and manually reconstruct the same filter (find the category, match the date range) to see the underlying rows. The charts and the transaction table are effectively two disconnected views over the same data, and reproducing a chart's implicit filter by hand is tedious and error-prone.

## Goals

- Make every bar in all three finance charts clickable.
- Clicking a bar opens a sheet showing that bucket's detail: total amount, share of period spending, transaction count, and its most recent transactions (read-only).
- The sheet has a "View all N transactions →" action that commits the bucket as real table filters and switches to the Table tab, so the user lands exactly where the bar's numbers came from.
- Fix a pre-existing bug where category aggregation groups by category **name** instead of **id**, which would otherwise make click-to-filter target the wrong category when names collide or a category is renamed.

## Non-Goals

- **No third "grouped transactions" tab.** A tab is a destination the user deliberately chooses and returns to; a drilldown is a response to a click. A grouped-list tab would be meaningless when opened without a preceding click, and would duplicate the existing Table tab. The charts themselves already serve as the group-by control (category bars group by category, the stacked chart groups by day×category, the location chart groups by city) — no separate group-by UI is needed.
- **No group-by control added to the existing Table tab.** Same reasoning — the charts already provide grouping.
- **No new chart library.** `recharts@3.8.1` already supports `onClick` on `<Bar>`; this is a handler and cursor style, not a library swap.
- **No shared `selectedCountries` filter.** The location chart's Country mode produces a real, correctly-computed sheet (see Edge Cases), but "View all" is disabled for a country bucket, because committing it would require a URL param, a facet UI section, and inclusion in the clear/count logic that spec 11 does not build. Landing the user on a table with an invisible, unclearable filter is worse than no shortcut at all.
- **No harmonization between chart filters and table filters.** The three charts have always computed their bars from `dateRange` alone, ignoring `selectedType`/`selectedCategories`/`selectedCities` — this drilldown surfaces that pre-existing divergence for the first time (a bar's number was never affected by the active table filters) but does not attempt to fix it. Charts remain date-range-only.
- **No URL persistence of the open drilldown sheet.** The sheet's open/selected state is ephemeral local state. Only the _committed_ result (via "View all") becomes part of the URL-backed filters from spec 11.
- **No inline editing inside the sheet.** Rows shown are read-only; editing still happens only in the Table tab.
- **No keyboard/focus support for individual bar clicks.** Recharts renders bars as non-focusable SVG paths with no keyboard API for item-level clicks in this version. The keyboard/assistive-tech path to the same data remains the existing accessible filter facets in the Table tab.

## Acceptance Criteria

- [ ] Given the category chart, when a user clicks a bar, then a sheet opens showing that category's total, share of period spending, transaction count, and up to 8 recent transactions.
- [ ] Given the daily stacked chart, when a user clicks a segment, then the sheet scopes to that specific day × category combination, not the whole day or whole category.
- [ ] Given the daily chart, when a user clicks a zero-height (empty) segment, then no sheet opens.
- [ ] Given the location chart in City mode, when a user clicks a city bar, then the sheet is correctly scoped to that city, including the "no location recorded" bucket if applicable.
- [ ] Given the location chart in Country mode, when a user clicks a country bar, then the sheet shows correct totals/count/list for that country, but the "View all" action is disabled with an explanation that country isn't a table filter yet.
- [ ] Given an open sheet, when the user clicks "View all N transactions →", then the app switches to the Table tab with exactly the bucket's filters applied (date range, type=expense, category or city as applicable), and this is a single browser-history entry.
- [ ] Given a "View all" commit that narrowed the date range to a single day, when the user presses Back, then the previous (broader) date range and previously active tab are both restored.
- [ ] Given two categories that happen to share a display name (one deleted, mapped to "Other", one real), when a user clicks either bar, then the sheet and its "View all" commit reference the correct underlying category id, not a name-based guess.
- [ ] Given the sheet is open and no interaction has committed it, then no global filter state changes — other charts on the page do not reshape while the sheet is open.
- [ ] Given a bucket with more than 8 matching transactions, then the sheet shows "Showing 8 of N" and the list is capped at 8 rows.
- [ ] Given a bucket with zero matching transactions (a rare race with in-flight mutations), then the sheet shows an empty-state message and hides the "View all" footer.
- [ ] Given the sheet is loading or its query errors, then it shows a loading skeleton or an error message with a retry action, respectively.
- [ ] Given a mobile viewport, then the sheet enters from the bottom as a sheet (not a right-side panel or modal dialog).

## Data Model Changes

**Store:** None. This spec does not touch `src/stores/finance-store.ts` beyond what spec 11 already does.

```ts
// src/routes/_authenticated/finance/-utils/finance-drilldown.ts (new, no persisted state)
export type DrilldownSelection =
  | {
      kind: 'category'
      label: string
      color: string
      amount: number
      categoryId: string
      categoryName: string
    }
  | {
      kind: 'day-category'
      label: string
      color: string
      amount: number
      categoryId: string
      categoryName: string
      day: DateKey
      dayLabel: string
    }
  | { kind: 'city'; label: string; color: string; amount: number; city: string }
  | {
      kind: 'country'
      label: string
      color: string
      amount: number
      country: string
    }

export interface DrilldownSpec {
  dateFrom: string | null
  dateTo: string | null
  type: 'expense'
  categoryIds: string[]
  cities: string[]
  countries: string[]
}
```

Also changed: `CategorySpending` (in `finance-utils.ts`) gains a `categoryId` field, and `DailyCategorySeries.key` switches from category **name** to category **id** (with `name` retained separately for display) — see Implementation Notes item 2. `TransactionQueryParams` (in `finance-queries.ts`) gains a `countries: string[]` field.

**Migration:** N/A — none of this is persisted.

## UI / UX Notes

New sheet component `src/routes/_authenticated/finance/-components/spending-drilldown-sheet.tsx`, mounted once at the finance page root (alongside the existing `<TransactionFormSheet />`), following the existing sheet patterns already in the codebase (`transaction-form.tsx` for the right-side desktop sheet, `transaction-filters.tsx` for the bottom sheet on mobile).

```
┌─────────────── Finance ───────────────┬── Sheet ───┐
│  ▓▓▓░░░  Spending by category          │ Food & Bev │
│   ▲ click "Food & Bev"                 │ Rp 4.2M    │
│                                        │ 32 txns    │
│  chart stays visible, unfiltered       │ ─────────  │
│                                        │ top 8 txns │
│                                        │ • Kopi 45k │
│                                        │ • ...      │
│                                        │[View all →]│
└────────────────────────────────────────┴────────────┘
```

Layout inside the sheet: header (color swatch + bucket label, description = the effective date range) → a 3-up stat row (Total / Share of spending / Transaction count) → a scrollable list of up to 8 read-only rows (date, note, amount) → a footer with the full-width "View all N transactions →" button (disabled + explanatory line for the country case).

Each chart adds `cursor="pointer"` and `activeBar` styling on hover to signal clickability, plus a line in its card description ("Click a bar to see transactions").

## Edge Cases

- **Category name collision:** the category chart currently groups by display name, so a deleted category (falling back to "Other") and a category actually named "Other" would merge. Fixed by grouping by `category_id` in the aggregation utilities (`getSpendingByCategory`, `getDailySpendingByCategory`) while keeping the same display name for the axis/legend — no visual change, but the click target is now unambiguous.
- **Country has no table filter:** see Non-Goals. The sheet still computes correct numbers for a country bucket (via a new `buildLocationFilter` generalizing the existing `buildCityFilter`), but "View all" is disabled for it.
- **Replace, not merge, semantics:** committing a bucket replaces the date range and the relevant dimension (category/city/country) and clears the others, rather than merging into whatever filters were already active. This is required for correctness, not just simplicity — the charts compute a bar's amount from `dateRange` alone, ignoring any active type/category/city filter, so merging active filters into the commit could make the resulting table total disagree with the bar the user clicked.
- **Day-drilldown clobbers the broader date range:** clicking a stacked-chart segment sets the committed range to that single day, discarding whatever broader range was active. This is accepted because the commit is a single, reversible (via Back, per spec 11) history entry, and the narrowed range is visibly shown as a chip in the existing date-range filter UI — never a silent, hidden narrowing.
- **Empty state:** zero matching transactions (e.g. a mutation raced the click) shows an empty message and hides the "View all" footer rather than showing a broken "View all 0 transactions" button.
- **Stale data across two quick clicks:** the transactions query used by the sheet uses `keepPreviousData`, so without remounting on selection change, a second bar's sheet could flash the first bar's rows. The sheet body remounts (via a `key` derived from the selection) whenever the selection changes.
- **Persistence boundary:** none — the sheet's open/selected state is local React state and does not survive a reload; the same-session in-flight bucket is lost, but a committed ("View all") result is durable via the spec-11 URL state.

## Implementation Notes

1. `src/routes/_authenticated/finance/-components/chart-card.tsx` (new) — extract the chart chrome duplicated identically across all three charts (`Card`/`CardHeader`/`CardContent`, `ResponsiveContainer`, margins, empty-state branch, axis tick formatter) into one component, and fix a pre-existing bug where the tooltip cursor uses `hsl(var(--muted))`, which is invalid under this app's `oklch()`-based CSS variables (replace with `var(--muted)`). No behavior change; done first so the click-handling diffs in the next steps stay small.
2. `src/routes/_authenticated/finance/-utils/finance-utils.ts` — change `getSpendingByCategory` and `getDailySpendingByCategory` to group by `category_id` instead of category name (adds `categoryId` to `CategorySpending`; `DailyCategorySeries.key` becomes the id). Update and extend `finance-utils.test.ts`, including new coverage for `getSpendingByCategory` (currently untested) and a regression test for two rows whose category is missing from the category list.
3. `src/routes/_authenticated/finance/-utils/finance-drilldown.ts` (new) — the selection model, spec/param/patch converters, and the pure click-handler factories described in Data Model Changes, fully unit-testable without a DOM.
4. `src/routes/_authenticated/finance/-utils/finance-queries.ts` — add `countries` to `TransactionQueryParams`, generalize `buildCityFilter` into `buildLocationFilter(column, values)` (keeping `buildCityFilter` as a thin wrapper so its existing tests are unaffected).
5. `src/routes/_authenticated/finance/-components/spending-drilldown-sheet.tsx` (new) and `src/routes/_authenticated/finance/-utils/use-drilldown.ts` (new, holds `{ state, open, close }`) — the sheet itself and its local-state hook.
6. The three `spending-by-*-chart.tsx` components — add an optional `onSelect` prop, `onClick` handlers on `<Bar>` (not `<Cell>`, which is deprecated), `cursor`/`activeBar` styling, and a zero-amount guard on the stacked chart's per-segment handler.
7. `src/routes/_authenticated/finance/index.tsx` — instantiate `useDrilldown()`, wire `onSelect` into each chart, mount one `<SpendingDrilldownSheet>` at the page root, and wire its "View all" action to `useFinanceFilters().setFilters(...)` (from spec 11).
8. A pre-existing, previously-latent timezone bug surfaced by single-day drilldowns: the transactions query's lower date bound is compared in UTC while the upper bound and the charts' day-bucketing are local-time, so a single-day filter can silently miss early-morning local transactions at positive UTC offsets. Fixed in its own commit (`src/utils/date.ts` gains `startOfDayIso`; `finance-queries.ts` and `finance-utils.ts`'s `isInDateRange` updated to compare consistently) since it changes existing query results, not just adds new behavior.
9. `docs/finance.md` — document the drilldown sheet and the click-to-filter contract as part of the current-state reference once this ships.

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/`):

- [ ] `finance-drilldown.test.ts` — all four selection kinds convert to the correct `DrilldownSpec` (always `type: 'expense'`; day-category pins `dateFrom === dateTo === day`; unrelated dimensions are empty, proving replace-not-merge semantics); the query-params converter's key set is locked so the sheet and table can never structurally diverge; the filter-patch converter always includes the tab switch to `'table'`; `isCommittable` is false only for the country kind; the day-category handler factory returns `null` for a zero-amount day.
- [ ] `finance-utils.test.ts` — `getSpendingByCategory` gains coverage (currently has none) including two rows whose category is absent from the category list, asserting each retains its own `categoryId` while both display as "Other".
- [ ] `finance-queries.test.ts` — `buildLocationFilter` produces the same shapes for `location_country` as `buildCityFilter` does for `location_city`, including the "no value" `or` case.

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [ ] `spending-drilldown-sheet.test.tsx` (new) — null selection renders nothing; a category selection renders the correct total/share/count/rows/footer; loading/error/empty states render correctly; a country selection disables the footer with an explanation; clicking "View all" calls the commit function exactly once with the exact expected patch and then closes the sheet.
- [ ] `spending-by-category-chart.test.tsx` (new) — this chart currently has no test file; add the same empty-state/renders-with-data coverage the other two charts have, plus a case confirming the chart renders correctly when `onSelect` is omitted.
- [ ] Existing chart tests (`spending-by-daily-chart.test.tsx`, `spending-by-location-chart.test.tsx`) continue passing unmodified by this spec's changes (only spec 11 touches their mocks).

**Manual verification:**

- [ ] Click a category bar; confirm the sheet's total matches the bar's height; click "View all"; confirm the Table tab shows that category filtered and pressing Back restores the previous range and tab.
- [ ] Click a stacked daily segment; confirm the sheet is scoped to that specific day and category, and that a transaction timestamped near local midnight appears consistently in both the bar and the sheet.
- [ ] Click a zero-height daily segment; confirm nothing opens.
- [ ] Toggle the location chart to Country mode and click a bar; confirm the sheet populates correctly but "View all" is disabled with an explanation.
- [ ] Click two different bars in quick succession; confirm the second sheet never briefly shows the first bar's rows.
- [ ] Resize to a mobile viewport; confirm the sheet enters from the bottom and the footer stays reachable while the list scrolls.
- [ ] Check dark mode; confirm the tooltip hover cursor is now visible (previously silently broken).

## Open Questions

None.
