---
id: 8
title: 'Daily Spending Chart'
status: in-progress
feature: finance
created: 2026-07-30
updated: 2026-07-30
---

# Daily Spending Chart

## Problem Statement

The finance page shows total spending per category over the selected period, but gives no sense of _when_ that spending happened day to day — a user cannot tell whether a category's spend was one large purchase or many small ones spread across the month.

## Goals

- Show a stacked bar chart of expenses per day, broken down by category, for the currently selected date range.
- Cap the shared date-range filter to a maximum of 31 days so this (and other) charts stay readable and performant.

## Non-Goals

- Not adding an independent date-range control for this chart — it reuses the existing shared `dateRange` filter (`finance-filters.tsx` / `useFinanceStore`).
- Not adding an implicit default range when none is selected — the chart shows a prompt to pick a range instead of silently defaulting to "last 31 days".
- The 31-day clamp applies to the _shared_ filter (affecting the table and the existing category/location charts too), not scoped to this chart alone.

## Acceptance Criteria

- [x] Given a selected date range with expenses, when viewing the finance chart tab, then a stacked bar chart shows one bar per day with one stacked segment per category.
- [x] Given a day with no expenses in the selected range, when viewing the chart, then that day still appears on the axis with a zero-height bar (no gaps).
- [x] Given no date range is selected, when viewing the chart, then it shows a prompt to pick a range instead of an empty or misleading chart.
- [x] Given a selected range with no expenses at all, when viewing the chart, then it shows an empty-state message.
- [x] Given the date-range filter, when the user tries to select a range longer than 31 days, then dates beyond the 31-day limit are disabled in the picker.
- [x] Given a transaction whose category was deleted, when viewing the chart, then its amount is grouped under "Other", consistent with the existing category chart.

## Data Model Changes

None — no store or schema changes. Reuses the existing `AggregateRow` shape and `dateRange` from `useFinanceStore`.

## UI / UX Notes

- New component `spending-by-daily-chart.tsx`, modeled on the existing `spending-by-category-chart.tsx` (same `Card` shell, `ResponsiveContainer`, y-axis k-formatter, empty-state copy style). Rendered in the finance page's chart tab, between `SpendingByCategoryChart` and the conditional `SpendingByLocationChart`.
- Each category renders as a `<Bar>` with a shared `stackId`, colored by the category's existing color. The tooltip lists each category's amount for that day plus a bold day total; the legend lists category names.
- The date-range picker (`finance-filters.tsx`) gets `max={31}` on the range `Calendar`, which disables any date that would make the selected range exceed 31 days — no extra UI copy needed, the picker's existing disabled/greyed-out styling communicates the limit.

## Edge Cases

- **Empty state:** no expenses in the selected range shows "No expenses recorded for this period."; no range selected shows a prompt to pick one.
- **Zero-fill:** days with no transactions still appear on the X-axis with a zero-height bar, so the chart's day axis stays continuous across the range.
- **Persistence boundary:** none — chart data derives entirely from the already-loaded aggregate query and the shared `dateRange`, no new client-only state.

## Implementation Notes

1. `src/utils/date.ts` — add `toDayKey` (truncate an ISO datetime to its local calendar day) and `getDaysInRange` (inclusive day-key list for zero-filling). Done.
2. `src/routes/_authenticated/finance/-utils/finance-utils.ts` — add `getDailySpendingByCategory`, bucketing `AggregateRow[]` by day × category into Recharts' wide stacked format. Done.
3. `src/routes/_authenticated/finance/-components/spending-by-daily-chart.tsx` (new) — stacked `BarChart` component. Done.
4. `src/routes/_authenticated/finance/index.tsx` — render the new chart in the chart tab. Done.
5. `src/routes/_authenticated/finance/-components/finance-filters.tsx` — add `max={31}` to the range `Calendar`. Done.

## Test Plan

**Unit tests** (`src/utils/__tests__/date.test.ts`, `src/routes/_authenticated/finance/-utils/__test__/finance-utils.test.ts`):

- [x] `toDayKey` truncates ISO datetimes (UTC and locally-constructed) to the correct local calendar day.
- [x] `getDaysInRange` returns every day between two date keys, inclusive, oldest first.
- [x] `getDailySpendingByCategory` zero-fills days with no transactions, stacks multiple categories on the same day, falls back a deleted category to "Other", ignores income rows, and returns empty data/series for an unbounded range.

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/spending-by-daily-chart.test.tsx`):

- [x] Prompts to pick a date range when none is selected.
- [x] Shows an empty state when no expenses fall in the selected range.
- [x] Renders the chart card when expenses fall in the selected range.

**Manual verification:**

- [ ] Open `/finance`, select a range longer than 31 days in the picker, and confirm dates beyond the limit are disabled.
- [ ] Select a ≤31-day range with expenses across multiple categories and days, and confirm the stacked chart renders correct per-day/per-category totals and tooltip.
- [ ] Confirm the existing category/location charts and table still work correctly under the now-clamped shared filter.

## Open Questions

None.
