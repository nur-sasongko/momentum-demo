---
id: 27
title: 'Export Finance Transactions as a Real Excel Workbook'
status: done
feature: finance
created: 2026-08-24
updated: 2026-08-24
---

# Export Finance Transactions as a Real Excel Workbook

## Problem Statement

Finance data can only be read inside Momentum. There is no way to hand a month of
spending to an accountant, reconcile against a bank statement in a spreadsheet,
build a pivot table the app does not offer, or keep a backup that survives losing
access to the account. The `/finance` table shows one server-paginated page at a
time (`TransactionQueryParams.page/pageSize` in
[`-types/finance-query.ts`](../../src/routes/_authenticated/finance/-types/finance-query.ts)),
so even copy-paste only escapes with 25 rows at a time — and it drops the category
name, the location, and the sign of the amount, which are all rendered rather than
stored in the cell. [`docs/finance.md`](../finance.md) has listed "Add CSV
export/import for backups" under future improvements since the Supabase migration,
and [spec 021](./021-core-data-table-refinement.md) explicitly non-goaled CSV
export from the data table. This spec supersedes that line and reopens that
exclusion — deliberately, and not as CSV.

## Goals

- **Export the transactions currently in scope as a single `.xlsx` workbook**, in
  one action, from the finance page.
- **Honour the active filters.** The file contains what the page is showing —
  date range, type, categories, cities — not the whole table and not just the
  visible page.
- **Every value lands in its native cell type.** Amounts are numbers with a
  number format, dates are real Excel dates, not pre-formatted strings. A user
  can sum a column, sort by date, and pivot without cleaning anything first.
- **The file explains itself.** A `Summary` sheet records which filters produced
  it, alongside income/expense/net totals and a per-category breakdown, so the
  workbook is still interpretable months later with no access to the app.
- **All rows, not one page.** The export refetches the full filtered set in
  batches rather than serialising whatever page the table happens to be on.
- Keep the writer off the critical path — the spreadsheet library must not appear
  in the `/finance` route bundle.
- Make the rows → workbook transform a **pure, unit-testable function** with no
  DOM, no network, and no library import.

## Non-Goals

- **No CSV.** Not as an option, not as a fallback. CSV cannot carry a number
  format, a real date, a second sheet, or a column width; and Excel re-parses CSV
  dates under the machine's locale, which silently turns `03/04` into the wrong
  month. If a plain-text interchange format is wanted later it is its own spec.
- **No `.xls`** (the pre-2007 binary format) and no OpenDocument `.ods`.
- **No import.** Reading a workbook back into Momentum is a strictly harder
  problem — validation, category matching, duplicate detection, partial failure —
  and is out of scope. This spec is write-only, which also keeps the app clear of
  the whole class of spreadsheet-parsing vulnerabilities (see
  [Library choice](#library-choice)).
- **No charts embedded in the workbook.** The `Summary` sheet gives a pivot-ready
  breakdown; the user's own spreadsheet tool draws better charts than a generator
  can, and the chart XML part is a large amount of hand-written OOXML for
  something nobody asked for.
- **No archived-transaction export in v1.** The archive tab is a separate view
  with a separate query; see [Open Questions](#open-questions). The transform
  takes rows as an argument specifically so the archive becomes a row source and
  one extra column later, not a rewrite.
- **No cell styling beyond what the data needs** — bold frozen header, column
  widths, number/date formats, wrapped note text. No brand colours, no category
  colour fills, no conditional formatting, no logo.
- **No server-side generation, no scheduled or emailed exports.** The app is a
  static SPA ([spec 004](./004-core-remove-ssr.md)); the workbook is built in the
  browser and handed to the user via a blob download, exactly as
  [spec 026](./026-notes-pdf-export.md) does for PDF.
- **No multi-currency handling.** Amounts are plain numbers today —
  [`src/utils/currency.ts`](../../src/utils/currency.ts) formats separators only
  and carries no currency symbol — so the workbook writes plain numbers too.

## Acceptance Criteria

- [ ] Given transactions exist, when the user clicks **Export** on `/finance`,
      then a `.xlsx` file downloads containing `Transactions`, `Summary`, and
      `Categories` sheets.
- [ ] Given a date range, type, category, or city filter is active, when the user
      exports, then the `Transactions` sheet contains exactly the rows that
      filter set selects — every matching row, across every page, and no others.
- [ ] Given the filtered set spans more than one fetch batch, when the user
      exports, then all rows are present (verified with a set larger than the
      1,000-row batch size).
- [ ] Given the file is opened in Excel/Numbers/LibreOffice, when the user selects
      the `Amount` column, then the status bar shows a numeric sum — the cells are
      numbers, not text.
- [ ] Given the file is open, when the user sorts by `Date`, then rows order
      chronologically — the cells are dates, not strings.
- [ ] Expenses appear as negative amounts and income as positive, so `Amount`
      sums to net; the `Type` column is present so gross-by-type is one pivot away.
- [ ] The `Summary` sheet states the export timestamp, the active filters, the row
      count, income/expense/net totals, and a per-category breakdown.
- [ ] Given no transactions match the active filters, when the user clicks
      **Export**, then no file is produced and a toast explains that nothing
      matches.
- [ ] The header row of `Transactions` stays visible when scrolling (frozen) and
      is bold.
- [ ] Given the export is in flight, then the button shows a pending state and
      cannot be double-clicked into two downloads.
- [ ] Given the fetch fails (offline, auth expired), then no partial file is
      produced and an error toast is shown.
- [ ] Given the filtered set exceeds the row cap, then no file is produced and a
      toast asks the user to narrow the range.
- [ ] The spreadsheet library appears in no chunk loaded by `/finance` on first
      paint — only in a chunk fetched when the export runs.

## Data Model Changes

**Store:** `src/stores/finance-store.ts` — none. No new persisted state, no
`version` bump, no `migrate`. The export reads existing `Transaction` and
`FinanceCategory` domain types and filter state already living in the URL
([spec 011](./011-finance-filters-url-state.md)).

New types go in
[`-types/finance-export.ts`](../../src/routes/_authenticated/finance/-types/),
per [spec 019](./019-core-feature-types-folders.md):

```ts
/** The filter set an export was taken under — drives both the query and the Summary sheet. */
export interface FinanceExportFilters {
  dateFrom: string | null
  dateTo: string | null
  type: TransactionType | null
  categoryIds: string[]
  cities: string[]
  countries: string[]
  search: string | null
}

/** One sheet, library-agnostic: the transform emits these, the writer consumes them. */
export interface ExportSheet {
  name: string
  columns: Array<{ width?: number }>
  rows: ExportCell[][]
}

export type ExportCell =
  | { type: 'string'; value: string; wrap?: boolean; bold?: boolean }
  | { type: 'number'; value: number; format?: string }
  | { type: 'date'; value: Date; format?: string }
  | null // empty cell

export interface FinanceExportResult {
  filename: string
  rowCount: number
  /** Notes clipped at Excel's 32,767-character cell limit. */
  truncatedNotes: number
}
```

`ExportSheet` deliberately does not mirror any library's own shape. The transform
is testable against plain objects, and swapping the writer is a change confined to
one adapter module.

## UI / UX Notes

**Entry point** — a right-aligned `Export` button in
[`finance-filters.tsx`](../../src/routes/_authenticated/finance/-components/finance-filters.tsx),
on the same row as the date-range picker:

```
┌──────────────────────────────────────────────────────────────┐
│ [📅 Jan 1 – Jun 30]  [⚙ Filters (2)]        [⬇ Export]      │
└──────────────────────────────────────────────────────────────┘
```

It lives with the filters because the filters are what it exports. That placement
also gets the visibility rules for free: `FinanceFilters` already renders for the
chart and table views and is hidden on the archive tab
(`showFiltersAndStats` in
[`finance/index.tsx`](../../src/routes/_authenticated/finance/index.tsx)), which
matches this spec's scope exactly.

Behaviour:

- Available in both **chart** and **table** views — the export is of the filtered
  data, not of the current visual representation.
- Disabled with a tooltip (`No transactions to export`) when the filtered set is
  empty. The aggregate query already in the page
  (`useFinanceAggregateQuery`) can answer this without a new request.
- While running: spinner in the button, label `Exporting…`, button disabled.
- On success: `toast.success` — `Exported 342 transactions`. When notes were
  clipped, a second line: `3 notes were shortened to fit Excel's cell limit.`
- On failure: `toast.error` with the cause — `Export failed. Check your
connection and try again.` / `Too many transactions to export at once — narrow
the date range.`
- Icon: `Download` from `lucide-react`, matching the icon-plus-label pattern of
  the sibling filter buttons.

**On mobile**, the button keeps its label rather than collapsing to an icon —
exporting is a rare, consequential action and an unlabelled download glyph next to
a filter glyph is a coin flip.

### Sheet 1 — `Transactions`

One row per transaction, newest first (the table's existing order:
`created_at desc, date desc`).

| Column     | Cell type | Format             | Width | Notes                                                |
| ---------- | --------- | ------------------ | ----- | ---------------------------------------------------- |
| `Date`     | date      | `yyyy-mm-dd hh:mm` | 18    | Local wall-clock — see [Edge Cases](#edge-cases)     |
| `Type`     | string    | —                  | 10    | `Income` / `Expense`                                 |
| `Category` | string    | —                  | 20    | Name at export time; `Uncategorized` if unresolvable |
| `Amount`   | number    | `#,##0.00`         | 14    | **Signed** — expenses negative                       |
| `Note`     | string    | —                  | 44    | Raw markdown, `wrap: true`                           |
| `Place`    | string    | —                  | 24    | `location.placeName`                                 |
| `City`     | string    | —                  | 18    |                                                      |
| `Country`  | string    | —                  | 18    |                                                      |
| `Maps URL` | string    | —                  | 30    | Plain text, not a hyperlink object                   |

Header row is bold and frozen (`stickyRowsCount: 1`).

The signed-`Amount`-plus-`Type` pairing is the one non-obvious choice here: a
single signed column means `SUM` gives net with no formula and a pivot on `Type`
still gives gross income and gross expense. Two separate `Income`/`Expense`
columns would force a formula for the far more common question.

### Sheet 2 — `Summary`

Three stacked blocks, blank row between each:

```
Momentum — Finance Export
Exported at        2026-08-24 14:32
Date range         2026-01-01 → 2026-06-30
Type               Expense
Categories         Groceries, Transport
Cities             Jakarta
Search             —
Transactions       342

Income                    12,400.00
Expense                  -8,215.50
Net                       4,184.50

Category        Type       Count        Total     % of type
Groceries       Expense       128    -3,940.00        47.9%
Transport       Expense        94    -2,110.25        25.7%
...
```

An omitted filter renders as `All` (`Type   All`), never as blank — blank reads as
"the exporter forgot", `All` reads as "no filter was set".

### Sheet 3 — `Categories`

`Name`, `Type`, `Colour` (hex string), `System` (`Yes`/`No`), `Created` (date).
Every category the user has, not only those appearing in the filtered rows — this
sheet is the legend, and a backup of the category setup.

### Filename

`finance-<range>-<exported-on>.xlsx`, built with `slugify` from
[`#/utils/download`](../../src/utils/download.ts):

- range given: `finance-2026-01-01-to-2026-06-30-2026-08-24.xlsx`
- no range: `finance-all-time-2026-08-24.xlsx`

## Edge Cases

- **Empty state:** no rows match → no file, no blob, toast only. An empty
  workbook is worse than no workbook: it looks like the data is gone.
- **Persistence boundary:** nothing persists. The workbook is a blob handed to the
  browser; no store writes, no cache entries, and a reload leaves no trace. The
  filters that produced it do survive a reload, because they live in the URL.
- **Pagination:** the table's cached query holds one page. The export runs its own
  query with the same filters and no page bound, looping `.range()` in batches of
  1,000 (Supabase's default row ceiling) until a short batch comes back.
- **Row cap:** 20 batches / 20,000 rows. Beyond that, abort before writing
  anything and tell the user to narrow the range. A silent truncation that
  produces a plausible-looking file is the worst possible outcome for a financial
  export.
- **Timezone.** Transaction `date` is a timestamp
  ([spec 007](./007-finance-transaction-datetime-and-markdown-note.md)); Excel
  date serials carry no timezone at all. Dates are written as **local
  wall-clock**, so a cell matches what the table shows on the same machine
  (`formatDateTimeLabel`). A workbook opened in another timezone shows the
  exporter's local times — correct for reconciliation, and the alternative (UTC)
  would disagree with the app's own UI for every user not on UTC.
- **Long notes:** Excel caps a cell at 32,767 characters. Notes are clipped to
  32,764 plus `…`, and the count surfaces in the success toast rather than
  failing the export.
- **Multi-line notes:** notes are markdown and may contain newlines. Kept
  verbatim with `wrap: true` — no flattening, no markdown rendering. A cell
  cannot render markdown, and stripping the syntax would lose the user's content.
- **Deleted category:** `transformTransaction` cannot resolve a `category_id`
  whose row is gone; the cell reads `Uncategorized` rather than an empty string or
  a raw UUID.
- **Missing location:** blank cells, not `—` or `N/A`. A filter on a blank column
  behaves; a filter on a placeholder string does not.
- **Offline:** unlike the note PDF export, this one needs the network — it
  refetches to get every row. It fails with a network toast rather than exporting
  a partial cached page.
- **Concurrent clicks:** the button is disabled while pending, so one click can
  only ever produce one file.
- **Archived rows** are excluded — the export query applies the same `liveOnly`
  predicate as the table ([spec 022](./022-core-archive-soft-delete.md)).

## Library choice

Writing valid OOXML by hand means a zip container, `workbook.xml`,
`sharedStrings.xml`, per-sheet parts, a `styles.xml` with a `numFmt`/`cellXfs`
chain, and two content-type manifests. That is a real amount of code to get the
`Amount` column to say `#,##0.00`, so this spec takes a dependency.

| Option                          | Verdict                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`write-excel-file`**          | **Chosen.** Browser-first (`write-excel-file/browser`), declarative sheet/column schema, number formats, date formats, `wrap`, `stickyRowsCount` for the frozen header, multiple sheets. Write-only, which is exactly this feature's shape. Risks: small project, primary repo on GitLab, no autofilter support. |
| `xlsx` (SheetJS CE)             | **Rejected.** The npm registry is frozen at `0.18.5` — current releases ship only from the vendor's own CDN, which suits neither Bun's lockfile nor this repo's dependency hygiene. Its prototype-pollution advisory only affects _reading_ files, so it is not the disqualifier; the distribution story is.     |
| `exceljs`                       | **Rejected for v1.** Far deeper styling and heavily used (~11M weekly downloads), but ~1MB, no npm release in over a year, and inactive issue/PR activity. Its extra capability is styling this spec has non-goaled. Reconsider if rich formatting is ever wanted.                                               |
| Hand-rolled OOXML writer        | **Rejected.** Zero dependencies, but it re-implements a styles table and a zip writer to serve one export. Revisit only if the chosen library is abandoned.                                                                                                                                                      |
| `jszip` + minimal SpreadsheetML | **Rejected.** Same hand-rolling cost, minus the useful parts of a real library.                                                                                                                                                                                                                                  |

Autofilter is not available in the chosen library, so the design above does not
promise it — a user can enable filtering in one click in their own spreadsheet
tool. Pin an exact version and treat the adapter module as the only file that
knows the library's name.

## Implementation Notes

Mirrors the shape [spec 026](./026-notes-pdf-export.md) established for the note
PDF export: one module owns the runtime, dynamically imported; the transform next
to it is pure.

1. `package.json` — add `write-excel-file` (exact version, no caret).
2. `src/routes/_authenticated/finance/-types/finance-export.ts` — the types above.
3. `src/routes/_authenticated/finance/-utils/finance-export-query.ts` —
   `fetchAllTransactionsForExport(filters)`: batched `.range()` loop reusing the
   filter-building helpers already in
   [`finance-queries.ts`](../../src/routes/_authenticated/finance/-utils/finance-queries.ts)
   (`liveOnly`, `buildLocationFilter`, `transformTransaction`). Extract those
   predicate builders if they are not already reachable, rather than restating the
   filter logic — two copies of it will drift.
4. `src/routes/_authenticated/finance/-utils/finance-export-sheets.ts` — **pure**
   `buildFinanceWorkbook(rows, categories, filters, exportedAt): ExportSheet[]`.
   No imports beyond types and date/currency helpers. `exportedAt` is a parameter,
   not a `new Date()` call, so tests are deterministic.
5. `src/routes/_authenticated/finance/-utils/export-finance-xlsx.ts` — the only
   module that imports the library, via `await import(...)`. Converts
   `ExportSheet[]` to the library's shape, gets a `Blob`, calls `downloadBlob`.
   Returns `FinanceExportResult`.
6. `src/routes/_authenticated/finance/-utils/use-finance-export.ts` — hook wiring
   filter state → fetch → transform → write, owning `isPending` and the toasts.
7. `src/routes/_authenticated/finance/-components/finance-filters.tsx` — the
   button.
8. `CHANGELOG.md` — `### Added` under `## [Unreleased]`.
9. `docs/finance.md` — document the export; drop the stale "Add CSV
   export/import" line from future improvements.

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/`):

- [x] `finance-export-sheets` — three sheets, in order, with the documented names.
- [x] Expenses emit negative `Amount`, income positive; `Type` column matches.
- [x] `Amount` cells are `{ type: 'number' }` with `#,##0.00`; `Date` cells are
      `{ type: 'date' }` — never pre-formatted strings.
- [x] Summary totals: income, expense, net across a mixed row set; net equals the
      sum of the signed amounts.
- [x] Summary per-category block: counts and signed totals; a 100%-share case and
      an all-empty-workbook case stand in for "percentages never `NaN`" — the
      `typeTotal > 0` guard can't be exercised any other way through the public
      `buildFinanceWorkbook` API, since a nonzero group total always implies a
      nonzero type total.
- [x] Unset filters render `All`, not blank.
- [x] A 40,000-character note is clipped to exactly 32,767 characters and counted
      in the result.
- [x] A multi-line note keeps its newlines and is marked `wrap`.
- [x] A row whose `categoryId` matches no category renders `Uncategorized`.
- [x] A row with no location leaves the four location cells empty.
- [x] Filename: full range, open-ended-from-start, and no range ("all-time").
- [x] `finance-export-query` (mocked Supabase) — 2,500 matching rows arrive as
      2,500 rows over three batched calls; a set of exactly 1,000 does not loop
      forever; exceeding the cap throws before any write; a mid-loop error
      propagates and produces no partial result.
- [x] `use-finance-export` — an empty fetch result shows the empty-state error
      toast and never calls the writer (this is where "the transform is never
      reached" actually lives, not in a component test); success shows the row
      count and a truncated-notes suffix when applicable; `FinanceExportRowCapError`
      and any other rejection each show their own toast message; `isPending`
      is `true` for the duration of the call and clears afterward.

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [x] `finance-filters` renders the Export button.
- [x] Disabled when there is nothing to export.
- [x] Clicking calls the export once.
- [x] A disabled (pending) button ignores a click — the actual mechanism behind
      "cannot be double-clicked into two downloads"; see the Open Questions note
      on why a hook-level reentrancy guard alone can't be asserted deterministically.

**Manual verification:**

- [x] Open `/finance`, set a date range and a category filter, export; open the
      file in Excel and in Numbers.
- [x] Select the `Amount` column — the status bar shows a sum.
- [x] Sort by `Date` — chronological, and the times match the app's table.
- [x] Insert a pivot table on `Type` — gross income and gross expense are right.
- [x] Scroll `Transactions` — the header stays put.
- [x] Clear all filters and export — `Summary` says `All time` / `All`.
- [x] Filter to a category with no rows — the button is disabled.
- [x] Throttle to offline and export — error toast, no file.
- [x] Inspect the built bundle: no spreadsheet-library code in the `/finance`
      entry chunk.

## Open Questions

- [x] **`Maps URL` hyperlink, resolved during implementation:** shipped as plain
      text, per the option above.
- [x] **The `isPending` reentrancy guard, resolved during implementation:** two
      calls to `exportTransactions()` fired back-to-back with no render between
      them (no `await`, no event loop turn) both pass the `if (isPending) return`
      check, because a `setState` call doesn't synchronously update the value a
      same-render closure already captured. The guard still does real work once
      React has had a chance to re-render — which is exactly what happens
      between two separate user clicks — so in the UI, the disabled button
      attribute (which does require a render) is what actually prevents a
      double-click, and the in-hook guard is defense in depth for a second
      programmatic call, not the primary mechanism. Tested that way: the
      component test asserts a disabled button ignores a click, rather than
      asserting the hook itself rejects a truly simultaneous second call.
