# Finance Module

The Finance module is the personal finance tracker at `/finance`. It provides balance overview, monthly income vs expense stats, category spending visualization, and transaction management with local persistence.

## Goals

- Track income and expenses in one place.
- Surface total balance and monthly cash flow at a glance.
- Visualize spending patterns by category.
- Keep data local and offline-friendly.

## Source of Truth

- Route entry: `src/routes/_authenticated/finance/index.tsx`
- Finance store: `src/stores/finance-store.ts`
- Finance utilities: `src/routes/_authenticated/finance/-utils/finance-utils.ts`
- Stat cards: `src/routes/_authenticated/finance/-components/finance-stat-cards.tsx`
- Filters: `src/routes/_authenticated/finance/-components/finance-filters.tsx`
- Category chart: `src/routes/_authenticated/finance/-components/spending-by-category-chart.tsx`
- Transaction table: `src/routes/_authenticated/finance/-components/transactions-table.tsx`
- Add/edit transaction form: `src/routes/_authenticated/finance/-components/transaction-form.tsx`
- Empty state: `src/routes/_authenticated/finance/-components/finance-empty-state.tsx`

## Route and Composition

`createFileRoute('/finance/')` is defined in `src/routes/_authenticated/finance/index.tsx`.

The page composes:

- `FinanceFilters` for month/category filters and add button
- `FinanceStatCards` for balance and monthly income vs expense
- `SpendingByCategoryChart` for expense breakdown (Recharts bar chart)
- `TransactionList` for filtered transaction rows
- `AddTransactionSheet` for creating transactions
- `FinanceEmptyState` when no transactions exist

## Data Model

`Transaction` in `src/stores/finance-store.ts`:

- `id: string`
- `type: 'income' | 'expense'`
- `amount: number`
- `category: FinanceCategory`
- `date: string` — ISO datetime string; time-of-day is optional (local midnight means no explicit time was set, displayed as a bare date via `formatDateTimeLabel` in `#/utils/date`). See [`docs/specs/007-finance-transaction-datetime-and-markdown-note.md`](./specs/007-finance-transaction-datetime-and-markdown-note.md).
- `note: string` — markdown-capable (up to 5000 chars), edited via a live WYSIWYG editor (`MarkdownEditor`, `#/components/markdown/markdown-editor`) in the Add/Edit form. The transactions table's Note column renders the same markdown as a compact preview and opens the same editor in a popover for editing (`MarkdownEditorCell`, `#/components/markdown/markdown-editor-cell`).
- `location: TransactionLocation | null` — optional place attached to the transaction (see [Location Tracking](#location-tracking))

`SEED_TRANSACTIONS` provides starter data across the current and previous month.

## State and Persistence

`useFinanceStore` (Zustand + `persist`, `src/stores/finance-store.ts`) holds only categories and add/edit-sheet state:

- Storage key: `myspace-finance`
- Version: `5`
- Persisted slice: `isBalanceHidden` only
- `categories`, `isAddTransactionOpen`, `editingTransactionId`, `editingTransaction` are in-memory only

Date range, transaction type, selected categories, selected cities, and the active Chart/Table tab live in the URL instead of the store — see [URL Search Params](#url-search-params). See [`docs/specs/011-finance-filters-url-state.md`](./specs/011-finance-filters-url-state.md).

### Store Actions

- `setCategories` / `addCategory` / `updateCategory` / `removeCategory` — category CRUD, kept in sync with the `finance_categories` table
- `setAddTransactionOpen(open)` / `setEditingTransactionId(id)` / `setEditingTransaction(tx)` — control the add/edit transaction sheet
- `setBalanceHidden(hidden)` — toggles balance masking, the only persisted preference

## URL Search Params

Finance filters and the active tab are validated TanStack Router search params on `/_authenticated/finance/` (`src/routes/_authenticated/finance/-utils/finance-search.ts`), read/written through `useFinanceFilters()` (`src/routes/_authenticated/finance/-utils/use-finance-filters.ts`) rather than directly via `useSearch`/`useNavigate`.

| Param  | Type                    | Default   | Meaning                                                            |
| ------ | ----------------------- | --------- | ------------------------------------------------------------------ |
| `view` | `'chart' \| 'table'`    | `'chart'` | Active tab                                                         |
| `from` | `YYYY-MM-DD`            | unset     | Date range start                                                   |
| `to`   | `YYYY-MM-DD`            | unset     | Date range end                                                     |
| `type` | `'income' \| 'expense'` | unset     | Transaction type filter                                            |
| `cat`  | `string[]`              | `[]`      | Selected category ids                                              |
| `city` | `string[]`              | `[]`      | Selected `location_city` values; `''` means "no location recorded" |

Example: `/finance?type=expense&cat=["abc123"]&city=["","Jakarta"]` — expense transactions in category `abc123`, in Jakarta or with no recorded city.

Defaults are stripped from the URL (`stripSearchParams` route middleware), so an unfiltered view has a clean `/finance` URL. Every field degrades to its default on a malformed value instead of throwing (each is `.catch()`-guarded in the zod schema). Each filter change is a browser history entry (Back undoes it), except category/city checkbox toggles, which coalesce into one entry while the selection stays non-empty.

## Core Utilities

Defined in `src/routes/_authenticated/finance/-utils/finance-utils.ts`:

- `formatCurrency(amount)` — USD formatting via `Intl.NumberFormat`
- `toMonthKey(date)` / `getCurrentMonthKey()` — month grouping keys
- `formatMonthLabel(monthKey)` — human-readable month labels
- `formatTransactionDate(date)` — list date formatting
- `getAvailableMonths(transactions)` — month selector options
- `filterTransactions(transactions, month, category)` — list filtering
- `getTotalBalance(transactions)` — all-time net balance
- `getMonthTotals(transactions, monthKey)` — monthly income/expense totals
- `getSpendingByCategory(transactions, monthKey)` — chart data (expenses only)
- `CATEGORY_COLORS` — badge and chart colors per category

## UI Behavior

### Stat Cards

Two cards:

1. **Total balance** — all-time income minus expenses
2. **Income vs Expense** — for the selected month, with net sub-label

### Spending Chart

Three Recharts bar charts — category, location, and daily — share `<ChartCard>` (`-components/chart-card.tsx`). Each shows an empty state when no expenses exist in the selected date range.

Every category/location/day gets a labelled X-axis tick — no Recharts `interval`-based dropping. Ticks are angled at −35° (`AngledCategoryTick`, `-components/chart-axis-tick.tsx`) and truncated with an ellipsis only when they still don't fit; each chart carries a zoom control (`-components/chart-zoom-controls.tsx`) in the top-right of its plot area that widens the bars, revealing more of any truncated label. See [`docs/specs/014-finance-chart-zoom-pan.md`](./specs/014-finance-chart-zoom-pan.md) for the full spec. Summary:

- `-utils/chart-zoom.ts` — pure sizing/geometry helpers (`clampZoom`, `getContentSize`, `getMaxTickChars`, `truncateLabel`, pinch geometry), unit-tested without a DOM.
- `-utils/use-chart-zoom.ts` — the stateful hook: `ResizeObserver`-measured viewport, zoom state, mouse drag-to-pan and two-finger pinch (both anchored so the gesture's centre/midpoint stays in place), and a manually-registered non-passive Ctrl/⌘+wheel listener for zoom (JSX `onWheel` is passive and can't `preventDefault()`).
- `ChartCard`'s `zoomable`/`dataLength` props mount a scrollable viewport sized via `getContentSize` and wrap the chart in `ChartZoomContext` so `AngledCategoryTick`, rendered deep inside the Recharts SVG tree, can read the current truncation budget.
- A pan/pinch gesture that ends over a bar installs a one-shot capture-phase `click` blocker so it doesn't trigger the existing click-to-drilldown behavior; a plain click/tap still opens the drilldown sheet as before.
- Zoom is transient view state (`useState`, not URL-synced, not persisted) — it resets on reload and on switching away from the Chart tab.

### Transaction List

Each row shows:

- Date
- Note/description
- Color-coded category badge
- Amount (green `+` for income, red `-` for expense)
- Delete action

### Add Transaction Sheet

Responsive sheet using `useIsMobile()`:

- Desktop: right-side sheet
- Mobile: bottom sheet

Form fields: type, amount, category, date, note. Validated with `react-hook-form` + `zod`. Category options change based on transaction type.

### Filters

- Month selector (Select)
- Category chips (`All` + all income/expense categories)
- **Add Transaction** button

## Chart Click-to-Drilldown

See [`docs/specs/012-finance-chart-drilldown.md`](./specs/012-finance-chart-drilldown.md) for the full spec. Summary:

- Every bar in all three finance charts (`spending-by-category-chart.tsx`, `spending-by-daily-chart.tsx`, `spending-by-location-chart.tsx`) is clickable — the click payload is converted into a `DrilldownSelection` (`src/routes/_authenticated/finance/-utils/finance-drilldown.ts`) via `selectionFromCategoryBar` / `selectionFromDaySegment` / `selectionFromCityBar` / `selectionFromCountryBar`. `selectionFromDaySegment` returns `null` for a zero-amount segment, so clicking empty space opens nothing.
- `useDrilldown()` (`-utils/use-drilldown.ts`) holds the sheet's ephemeral `{ state, open, close }` — never persisted, never in the URL.
- `<SpendingDrilldownSheet>` (`-components/spending-drilldown-sheet.tsx`), mounted once at the page root, shows the bucket's total, share of period spending, transaction count, and up to 8 recent transactions. "View all N transactions →" calls `toFilterPatch(spec)` and commits it via `useFinanceFilters().setFilters(...)` (spec 11), switching to the Table tab as a single history entry. Disabled for a `country` selection — see `isCommittable()` — since there's no `selectedCountries` URL filter to commit into.
- `toDrilldownSpec()` always replaces rather than merges: it ignores any already-active table filters, because the charts compute a bar's amount from the date range alone.
- `chart-card.tsx` extracts the `Card`/`ResponsiveContainer`/empty-state chrome shared by all three charts and fixes an invalid `hsl(var(--muted))` tooltip cursor (this app's theme variables are `oklch()`, so the wrapped value never rendered) — use `CHART_TOOLTIP_CURSOR` from that module for any new chart.
- `getSpendingByCategory` / `getDailySpendingByCategory` (`finance-utils.ts`) group by `category_id`, not display name, so a deleted category (falling back to "Other") never merges with a category actually named "Other".
- `startOfDayIso()` (`#/utils/date`) is the lower-bound counterpart to `endOfDayIso()` — always use it (not a raw date-key string) when filtering a `date`/timestamp column by a local calendar day, to avoid excluding early-morning local transactions at positive UTC offsets.

## Filtered Transaction Summary

See [`docs/specs/013-finance-filtered-summary.md`](./specs/013-finance-filtered-summary.md) for the full spec. Summary:

- `<FilteredSummaryBar>` (`-components/filtered-summary-bar.tsx`), rendered inside `transactions-table.tsx` between the heading and `<DataTable>`, shows the aggregate money for the Table tab's active type/category/city filters. It's a Table-tab-only element — the shared stat cards above the tabs deliberately stay date-range-only (see spec 12 Non-Goals), and wiring table filters into them would make the cards and this bar disagree.
- Hidden unless at least one type/category/city filter is active (a bare date range is already covered by the stat cards), and hidden entirely while the note-search box is non-empty, since `useFinanceAggregateQuery()`'s rows don't carry `note` and can't reproduce a search-narrowed row set.
- `getFilteredSummary()` (`finance-utils.ts`) derives `{ income, expense, net, count, share, average }` from the same aggregate rows already loaded for the charts/facets — no new network request. A single active `type` renders Total/Share of period/Transactions/Average; no `type` filter renders Income/Expenses/Net/Transactions instead, since summing across signs is meaningless. `share` and `average` are `null` (never `NaN`/`0`) whenever the filtered count is 0.
- Active selections render as removable chips (✕ calls `setSelectedType(null)` / `toggleCategory(id)` / `toggleCity(city)`); the active date range renders as a non-removable context chip since it's owned by `FinanceFilters`'s date picker. "Clear all" calls `clearTransactionFilters()`.
- `StatBlock` (`-components/stat-block.tsx`) is shared between this bar and `spending-drilldown-sheet.tsx`, so a drilldown "View all →" commit lands on numbers that visually continue the sheet's.
- `transaction-filters.tsx`'s desktop-only `Clear filters (N)` toolbar button was removed — the summary bar's "Clear all" now owns that affordance under the same `activeFilterCount > 0` condition. The mobile filter sheet keeps its own in-sheet clear button.

## Location Tracking

See [`docs/specs/006-finance-location-tracking.md`](./specs/006-finance-location-tracking.md) for the full spec. Summary:

- Each transaction can optionally carry a `TransactionLocation` (`placeName`, `address`, `city`, `country`, `mapsUrl`), denormalized directly onto `finance_transactions` as five nullable columns (`location_place_name`, `location_address`, `location_city`, `location_country`, `location_maps_url`) — no separate lookup table, since a place is a one-off fact per transaction rather than a reusable/managed entity like a category.
- `src/routes/_authenticated/finance/-components/location-picker.tsx` — a dialog with an embedded Google Map (`@vis.gl/react-google-maps`) and Places Autocomplete search. Selecting a place auto-fills the location fields; the fields remain editable afterward in `transaction-form.tsx`.
- `src/routes/_authenticated/finance/-utils/location-utils.ts` — `parseGooglePlaceResult()` extracts place name/address/city/country/maps URL from a Google Places result.
- `src/routes/_authenticated/finance/-utils/finance-utils.ts` — `getSpendingByCity()`, `getSpendingByCountry()`, and `hasLocationData()`.
- `src/routes/_authenticated/finance/-components/spending-by-location-chart.tsx` — a bar chart with a City/Country toggle, rendered in `index.tsx` only when `hasLocationData()` is true for the current aggregate rows (progressive disclosure — invisible to users who never attach a location).
- `src/routes/_authenticated/finance/-components/location-map-embed.tsx` — `LocationMapEmbed` renders a read-only, interactive map (Maps Embed API `place` mode, plain `<iframe>`) wherever a saved location is displayed (`transaction-form.tsx`, `transactions-table.tsx`'s `LocationCell`). Built from the location's text fields (`placeName`/`address`/`city`/`country`), not `mapsUrl` — no lat/lng or place_id is stored, so the embed resolves the place via a text query instead.
- Requires `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API + Places API + Maps Embed API enabled), validated in `src/libs/env.ts`.

## Navigation Integration

Finance is enabled in `src/components/AppSidebar.tsx`:

- Label: `Finance`
- Route: `/finance`
- Icon: `Wallet`

## Dependencies

- `recharts` for the category and location spending bar charts
- `@vis.gl/react-google-maps` for the interactive location picker (Maps JavaScript API + Places Autocomplete)
- Shadcn `select`, `sheet`, `dialog`, `card`, `badge`, `input` for UI primitives

## Extending This Module

Recommended next steps:

- Add budgets per category with progress indicators.
- Add recurring transactions.
- Add CSV export/import for backups.
- Add account/wallet separation for multi-account tracking.
