---
id: 6
title: 'Location-Based Expense Tracking'
status: in-progress
feature: finance
created: 2026-07-26
updated: 2026-07-26
---

# Location-Based Expense Tracking

## Problem Statement

The user has lived in two different cities and has no way to see how much they've spent in each. Transactions currently carry no notion of place, so there is no way to break down spending by city or country — only by category and date range.

## Goals

- Let the user optionally attach a real-world place to a transaction (place name, address, city, country, Google Maps link) by picking it on an interactive Google Maps picker in the transaction form.
- Auto-fill the place fields from the picked location so the user doesn't type them manually, while still allowing manual edits.
- Surface a "Spending by City" / "Spending by Country" chart that reads location data straight from the transactions table — no Google Maps API calls at chart-render time.
- Keep the feature fully optional: a user who never attaches a location sees no extra UI clutter (no empty location chart taking up space).

## Non-Goals

- Not introducing a `finance_locations` (or similar) lookup/reuse table — location data is denormalized directly onto `finance_transactions`.
- Not storing separate `lat`/`lng` columns — the Google Maps link itself preserves the exact point if the user needs to reopen it.
- Not building a location management/CRUD UI (no renaming, merging, or deduping places — unlike categories, places aren't a reusable/managed entity here).
- Not restricting locations to a fixed list of cities — any place the user picks on the map is valid.
- Not adding server-side reverse geocoding — geocoding happens client-side via the Google Maps JS/Places SDK at the moment the user picks a place.

## Acceptance Criteria

- [x] Given the transaction form, when the user opens the location picker and selects a place via Places Autocomplete search, then Place Name, Address, City, Country, and Google Maps Link fields are auto-filled.
- [x] Given auto-filled location fields, when the user edits any field manually before saving, then the edited value (not the raw Maps value) is what gets persisted.
- [x] Given a transaction with no location set, when it is saved, then all five location columns are `null` and no error occurs.
- [x] Given at least one transaction has `location_city` or `location_country` set, when the user views the finance charts, then a "Spending by Location" chart is shown, grouped by city or country (toggle).
- [x] Given no transactions have any location data, when the user views the finance charts, then the "Spending by Location" chart does not appear at all (not merely an empty state).
- [x] Given a transaction has `location_place_name` but a blank `location_city` (user cleared it manually), when aggregating by city, then that transaction is excluded from the by-city breakdown without throwing.
- [x] Given the Google Maps script fails to load or the API errors, when the user is filling out the transaction form, then they can still save the transaction without a location (graceful degradation by construction — the picker is a separate dialog decoupled from form submission; there is no explicit inline "Maps failed to load" message, see Open Questions).

## Data Model Changes

**Store:** `src/stores/finance-store.ts`

```ts
export interface TransactionLocation {
  placeName: string
  address: string
  city: string
  country: string
  mapsUrl: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string
  note: string
  categoryId: string
  category?: FinanceCategory
  location: TransactionLocation | null
  createdAt: string
  updatedAt: string
}
```

**Migration:** `supabase/migrations/20260726000001_add_location_to_finance_transactions.sql` adds five nullable `text` columns to `finance_transactions`: `location_place_name`, `location_address`, `location_city`, `location_country`, `location_maps_url` (plus indexes on `location_city`/`location_country` for the chart's `GROUP BY`). No Zustand `persist` version bump needed — this data lives in Supabase, not client-persisted store state. `transformTransactionLocation()` in `finance-queries.ts` maps the five DB columns to `TransactionLocation | null` (null when all five are empty).

## UI / UX Notes

- `transaction-form.tsx` has a "Location" section below Note: an "Add location" outline button opens `LocationPickerDialog` (a shadcn `Dialog`, not a nested sheet) containing an embedded Google Map (`@vis.gl/react-google-maps`) with a Places Autocomplete search input above it. The map pans/zooms to the searched place and drops a marker for visual confirmation; there is no draggable-pin/reverse-geocode flow — search selection is the only input method (see Open Questions).
- On confirming a place, the dialog closes and four editable shadcn `Input` fields appear inline in the form (Place Name, Address, City, Country) plus a "View on Google Maps" link and a "Remove location" (X) button.
- Removing the location clears all fields back to `null`.
- `spending-by-location-chart.tsx` (mirrors `spending-by-category-chart.tsx`) renders as a second card stacked below `SpendingByCategoryChart` inside the existing "Chart" tab (not a separate top-level tab) — only when `hasLocationData(aggregateRows)` is true. It has a City/Country `Select` toggle in its `CardAction`.

## Edge Cases

- **Empty state:** if zero transactions carry location data, the "Spending by Location" tab/entry point is hidden entirely, not shown with an empty-state placeholder — the feature should be invisible to users who don't use it.
- **Persistence boundary:** location fields are ordinary Supabase columns on `finance_transactions`, so they persist and reload exactly like `note` or `amount` — no client-only state involved.
- **Partial data:** a transaction may have some location fields set and others blank (e.g. user cleared `city` but kept `placeName`) — aggregation must tolerate nulls per-field rather than requiring all-or-nothing.
- **Maps API failure:** if the Google Maps script fails to load (network issue, ad blocker, missing/invalid API key), the location picker shows an inline error and the rest of the transaction form remains fully usable.

## Implementation Notes

1. `supabase/migrations/20260726000001_add_location_to_finance_transactions.sql` — five nullable text columns + two indexes. Done.
2. `src/libs/env.ts` / `.env.example` — added and validated `VITE_GOOGLE_MAPS_API_KEY` (required, like the Supabase vars). Done.
3. `src/stores/finance-store.ts` — added `TransactionLocation` and `Transaction.location`. Done.
4. `src/routes/_authenticated/finance/-utils/location-utils.ts` (new) — `parseGooglePlaceResult()`, pure and unit-tested. Done.
5. `src/routes/_authenticated/finance/-components/location-picker.tsx` (new) — `LocationPickerDialog`: `APIProvider` + `Map` + Places Autocomplete search input, emits a `TransactionLocation` via `onConfirm`. Done.
6. `src/routes/_authenticated/finance/-components/transaction-form.tsx` — integrated the picker + editable Input fields + Remove action; `location` tracked as local component state (not part of the `react-hook-form`/zod-validated fields, since it's optional metadata) and included explicitly in both create/update mutation inputs. Done.
7. `src/routes/_authenticated/finance/-utils/finance-utils.ts` — `getSpendingByCity`, `getSpendingByCountry` (sharing a private `getSpendingByLocationField` helper), and `hasLocationData`. Done.
8. `src/routes/_authenticated/finance/-utils/finance-queries.ts` — `aggregate` query now selects `location_city, location_country`; `transformTransaction`/`transformTransactionLocation` build `Transaction.location`; `locationToColumns()` maps it back to the five DB columns for both mutations. Done.
9. `src/routes/_authenticated/finance/-components/spending-by-location-chart.tsx` (new). Done.
10. `src/routes/_authenticated/finance/index.tsx` — renders `SpendingByLocationChart` under the "Chart" tab, gated on `hasLocationData(aggregateRows)`. Done.
11. `docs/finance.md` — updated with a Location Tracking section. Done.

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/`):

- [x] `getSpendingByCity` groups and sums correctly across transactions with mixed null/non-null `location_city` (`finance-utils.test.ts`).
- [x] `getSpendingByCountry` groups and sums correctly across transactions with mixed null/non-null `location_country` (`finance-utils.test.ts`).
- [x] Aggregators exclude transactions with no location data without throwing; `hasLocationData` covered for both city-only and country-only cases (`finance-utils.test.ts`).
- [x] `parseGooglePlaceResult` extracts place name/address/city/country/maps URL, prefers `locality` over broader admin levels, falls back to a `place_id`-based maps URL, and handles an empty result (`location-utils.test.ts`).

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [x] `spending-by-location-chart` shows the empty state when no transaction has location data, and renders the card (no empty state) when city data exists (`spending-by-location-chart.test.tsx`, mocking `useFinanceAggregateQuery`/`useFinanceStore` and stubbing `ResizeObserver` for `recharts`).
- [ ] `transaction-form` / `location-picker` interaction tests were not added — they'd require mocking the Google Maps JS SDK (`APIProvider`/`useMapsLibrary`/`Autocomplete`) end-to-end, which has no precedent in this repo yet. Covered instead by manual verification below.

**Manual verification:**

- [ ] Open `/finance`, add a transaction, pick a real place (e.g. "Burger Dans, South Jakarta") via the map picker, verify all fields auto-fill.
- [ ] Edit one auto-filled field manually, save, verify the edited value (not the original Maps value) persists.
- [ ] Verify the "Spending by location" card appears under the Chart tab only after at least one transaction has location data.
- [ ] Reload the page, verify location fields persist (read back from Supabase, not local state).

## Open Questions — resolved during implementation

- [x] **Editable vs. locked fields:** kept freely editable after auto-fill (matches the rest of the form's editable-input pattern; typo risk accepted for v1).
- [x] **Which Google Maps APIs:** Maps JavaScript API + Places Autocomplete only. Dropped the draggable-marker/reverse-Geocoding-API idea from the original discussion for v1 — search-based selection alone covers the stated use case and keeps the picker and API surface simpler. Revisit if manual pin-dropping is later requested.
- [x] **Follow-up — embedded read-only map:** added later via `LocationMapEmbed` (`location-map-embed.tsx`), replacing the plain "View on Google Maps" link in `transaction-form.tsx` and `transactions-table.tsx` with an interactive `<iframe>` using the **Maps Embed API** (`place` mode), built from a text query since no lat/lng or place_id is stored. Requires Maps Embed API to be separately enabled for `VITE_GOOGLE_MAPS_API_KEY` in Google Cloud Console (a setup step, not covered by code).
- [ ] **Address precision/privacy:** not addressed — the full `formatted_address` Google returns is stored as-is (or as edited). No truncation/redaction was added; left open for a future pass if it matters for this data.
- [ ] **Maps load-failure UX:** no explicit inline error message was built for a failed Maps script load; the form remains submittable regardless because the location picker is a fully decoupled dialog. A dedicated error state (e.g. via `useApiIsLoaded`) could be added later if this matters in practice.
