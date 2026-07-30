# Finance Module

The Finance module is the personal finance tracker at `/finance`. It provides balance overview, monthly income vs expense stats, category spending visualization, and transaction management with local persistence.

## Goals

- Track income and expenses in one place.
- Surface total balance and monthly cash flow at a glance.
- Visualize spending patterns by category.
- Keep data local and offline-friendly.

## Source of Truth

- Route entry: `src/routes/finance/index.tsx`
- Finance store: `src/stores/finance-store.ts`
- Finance utilities: `src/routes/finance/-utils/finance-utils.ts`
- Stat cards: `src/routes/finance/-components/finance-stat-cards.tsx`
- Filters: `src/routes/finance/-components/finance-filters.tsx`
- Category chart: `src/routes/finance/-components/spending-by-category-chart.tsx`
- Transaction list: `src/routes/finance/-components/transaction-list.tsx`
- Add transaction sheet: `src/routes/finance/-components/add-transaction-sheet.tsx`
- Empty state: `src/routes/finance/-components/finance-empty-state.tsx`

## Route and Composition

`createFileRoute('/finance/')` is defined in `src/routes/finance/index.tsx`.

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
- `date: string` — ISO datetime string; time-of-day is optional (local midnight means no explicit time was set, displayed as a bare date via `formatDateTimeLabel` in `#/utils/date`). See [`docs/specs/finance-transaction-datetime-and-markdown-note.md`](./specs/finance-transaction-datetime-and-markdown-note.md).
- `note: string` — markdown-capable (up to 5000 chars), edited via a live WYSIWYG editor (`MarkdownEditor`, `#/components/markdown/markdown-editor`) in the Add/Edit form. The transactions table's Note column renders the same markdown as a compact preview and opens the same editor in a popover for editing (`MarkdownEditorCell`, `#/components/markdown/markdown-editor-cell`).
- `location: TransactionLocation | null` — optional place attached to the transaction (see [Location Tracking](#location-tracking))

`SEED_TRANSACTIONS` provides starter data across the current and previous month.

## State and Persistence

State is managed with Zustand + `persist` middleware (`useFinanceStore`).

- Storage key: `myspace-finance`
- Version: `1`
- Persisted slice: `transactions` only
- Rehydrate behavior: re-seeds when persisted list is empty

### Store Actions

- `addTransaction(input)` appends a transaction and closes the add sheet
- `deleteTransaction(id)` removes a transaction
- `setSelectedMonth(monthKey)` updates month filter (`YYYY-MM`)
- `setSelectedCategory(category | null)` updates category filter
- `setAddTransactionOpen(open)` controls add-transaction sheet visibility

UI filter state (`selectedMonth`, `selectedCategory`, `isAddTransactionOpen`) is not persisted and resets on reload.

## Core Utilities

Defined in `src/routes/finance/-utils/finance-utils.ts`:

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

Recharts bar chart showing expense totals grouped by category for the selected month. Empty state when no expenses exist in that month.

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

## Location Tracking

See [`docs/specs/finance-location-tracking.md`](./specs/finance-location-tracking.md) for the full spec. Summary:

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
