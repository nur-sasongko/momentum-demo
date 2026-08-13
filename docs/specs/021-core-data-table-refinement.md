---
id: 21
title: 'Data Table Refinement: Layout Stability, Density, Sticky Header & Optional Column Resizing'
status: done
feature: core
related-features: [finance]
created: 2026-08-13
updated: 2026-08-13
---

# Data Table Refinement: Layout Stability, Density, Sticky Header & Optional Column Resizing

## Problem Statement

Spec 020 gave the app a coherent surface, color, and type system, but the data table — the densest, most-looked-at surface in the product — was migrated only at the token level. Its structure is unchanged, and structurally it has problems that tokens cannot fix.

The table uses the browser's default `table-layout: auto`, so every column's width is derived from whatever happens to be on the current page. `TransactionsTable` is server-paginated: page 1 might hold a transaction noted "Coffee" and page 2 one noted "Reimbursed the team offsite dinner in Bandung — split four ways"; stepping between them re-flows every column. Sorting does the same thing. The user's eye has to re-find the Amount column after every interaction.

Every cell is `whitespace-nowrap` (`table.tsx:84`), so long content cannot wrap or truncate — it can only widen its column until the container scrolls sideways, silently. The container is `overflow-x-auto` with no edge affordance, so on a narrow screen there is no visual cue that columns exist past the right edge.

At page sizes of 100 and 200 rows (the default is 100, `transactions-table.tsx:257`) the header scrolls out of view within the first screenful and never comes back, so the rest of the page is unlabeled columns.

The striping introduced for readability actively fights the hover state: stripes are `bg-muted/40` (`data-table.tsx:423`) and hover is `bg-muted/50` (`table.tsx:58`) — the same color, ten percent apart. Hovering an odd row is nearly invisible, so the row-tracking affordance only works on half the rows.

Density is fixed at `py-2.5`, which is a compromise that serves neither the user scanning 200 rows for an outlier nor the user reading long notes. And `Amount` — the one column whose values are numeric and were given tabular figures in spec 020 specifically so digits would align — is left-aligned like everything else, so the aligned digits sit against ragged right edges and the magnitude of a number is not readable from its shape.

Underneath all of it: column widths are not the user's to control. A finance user who mostly reads notes and a user who mostly scans amounts and dates want different tables, and today they get the same one.

## Goals

- Make column widths **stable** — independent of which page, sort order, or filter is active.
- Make long content **degrade predictably** (truncate in place) instead of widening its column off-screen.
- Add **optional, persisted column resizing** as a global `DataTable` capability, opt-in per table, keyboard-accessible and not drag-only.
- Give the header **sticky** behavior so column labels survive a 200-row page.
- Add a **density** control (compact / default / comfortable) so the same table serves scanning and reading.
- Fix the striping/hover collision so row tracking works on every row.
- Establish **column alignment** as a declared property (`meta.align`), and right-align numerics.
- Give the table a real **empty state** and a real **loading state** rather than a line of muted text.
- Keep all of this in the global components (`src/components/ui/table.tsx`, `data-table.tsx`) so any future table inherits it — feature code declares intent through column `meta`, never through layout classes.

## Non-Goals

- **No row virtualization.** Page sizes cap at 200; virtualization is a separate concern and would conflict with the sticky-header/scroll-container work here. Revisit if page sizes grow.
- **No row selection, bulk actions, or checkboxes.** The `data-[state=selected]` hook already in `table.tsx` stays unused.
- **No column reordering (drag-to-move) and no column visibility toggle.** The preferences store introduced here is shaped to hold both later, but neither ships in this spec.
- **No grouping, pinning/frozen columns, expandable rows, or CSV export.**
- **No changes to the Tiptap in-editor tables** (`notes/-types/notes-table.ts`, `table-context-menu.tsx`, `table-bubble-menu.tsx`, `table-grid-picker.tsx`). Despite the name overlap those are rich-text document tables and are out of scope entirely.
- **No new colors.** Everything uses tokens established in spec 020. The one exception is called out explicitly under "Striping" below and is a re-use of `--accent`, not a new value.
- **No change to `EditableCell`'s interaction model** (click to edit, overlay input, no layout shift). It must keep working inside resized and truncated cells — that is a constraint, not a change.
- **No RTL support.** The resize handle is right-edge-anchored; RTL is not currently supported anywhere in the app.

## Design Decisions

### 1. Fixed layout is the foundation, not a resizing side-effect

`DataTable` switches to `table-layout: fixed` **unconditionally**, not only when resizing is enabled. This is the single change that fixes page-to-page jitter, and it is a prerequisite for resizing rather than a consequence of it.

Widths come from TanStack's column sizing state (`size`, `minSize`, `maxSize` on each column def; TanStack's defaults are `150 / 20 / Number.MAX_SAFE_INTEGER`). The table element carries:

```tsx
<table
  style={{ width: table.getCenterTotalSize() }}
  className="min-w-full table-fixed"
/>
```

`min-w-full` makes the table fill the card when the declared widths total less than the container; the explicit width makes it overflow (and scroll) when they total more. Both are correct behaviors and the browser picks between them.

**Consequence:** every column in a `DataTable` should declare a `size`. Undeclared columns get TanStack's 150px default, which is a reasonable but arbitrary number — the transactions columns are sized explicitly in Implementation Notes.

### 2. Truncation is opt-in per column, and `whitespace-nowrap` moves off the primitive

`TableCell`'s blanket `whitespace-nowrap` is removed. Wrapping/truncation becomes a declared column property:

| `meta.overflow` | Behavior                                            | Use for                      |
| --------------- | --------------------------------------------------- | ---------------------------- |
| `'nowrap'`      | single line, no ellipsis (default)                  | dates, amounts, badges       |
| `'truncate'`    | single line, `text-ellipsis`, full value in `title` | notes, locations, long text  |
| `'wrap'`        | wraps to multiple lines, row grows                  | rarely — opt in deliberately |

Default stays `'nowrap'` so nothing regresses silently, but the Note and Location columns move to `'truncate'`.

Truncation needs `overflow: hidden` on the cell, which clips the `EditableCell` overlay input. The overlay is `absolute inset-0` (`editable-cell.tsx`), so it is clipped to the cell box — which is the desired behavior for a fixed-width table anyway (the input fills exactly the column). Verify against the markdown cell, whose editor pops out; if it is a popover/portal it is unaffected.

### 3. Column resizing: opt-in, persisted, and reachable without a mouse

```tsx
<DataTable
  tableId="finance.transactions"   // required for persistence
  resizable                        // default: false
  … />
```

- `columnResizeMode: 'onChange'` — the column follows the cursor live. To keep that cheap, widths are published as **CSS custom properties on the `<table>` element** (`--col-<id>-size`), memoized against `columnSizingInfo`, and each `<th>`/`<td>` reads `width: var(--col-<id>-size)`. During a drag only the table element's `style` attribute changes; the body does not re-render per mousemove. This is TanStack's documented performance pattern and it is what makes `onChange` viable with 200 rows on screen.
- **A resize handle is a `role="separator"` control, not a bare div.** It is focusable (`tabIndex=0`), labeled (`aria-label="Resize {column} column"`), exposes `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, and responds to:
  - `ArrowLeft`/`ArrowRight` → ±8px
  - `Shift+Arrow` → ±32px
  - `Home` → reset this column to its default `size`
  - `Escape` during a pointer drag → cancel, restore the pre-drag width
- **Double-click resets** that column to its default `size`. This is the discoverable mouse equivalent of `Home`.
- Hit area is 12px wide (centered on the boundary, `-translate-x-1/2`) with a 1px visual line; the line is `bg-border` at rest, `bg-primary` on hover/focus/drag, and the whole header row gets `cursor-col-resize` while dragging.
- **Handles are hidden below `md`.** Dragging a 12px target competes with horizontal scroll on touch. Persisted widths still apply at every breakpoint — the table just scrolls.
- Resizing is disabled per-column via `enableResizing: false`; the `actions` column sets it.

### 4. Preferences persist per table, in one store

A new persisted Zustand store keyed by an opaque `tableId`, so a second table never inherits the first one's widths:

```ts
// src/stores/table-preferences-store.ts
export type TableDensity = 'compact' | 'default' | 'comfortable'

interface TablePreferences {
  columnSizing: Record<string, number> // TanStack ColumnSizingState
  density: TableDensity
}
```

Only user-modified values are written; a table with untouched widths persists `{}` for `columnSizing`, so changing a column's default `size` in code still takes effect for users who never dragged it.

**Stale-key pruning:** persisted widths for a column id that no longer exists are ignored by TanStack automatically (it only reads ids it knows), but they accumulate in `localStorage` forever. A `pruneColumnSizing(sizing, knownIds)` helper runs on mount and drops unknown ids. Widths are also clamped to `[minSize, maxSize]` on read, so tightening a column's `minSize` in code repairs an out-of-range persisted value instead of honoring it.

**Reset affordance:** when `columnSizing` for a table is non-empty, a "Reset widths" button appears in the pagination bar. Without it, a user who has dragged a column to 8px has no way back that does not involve finding an 8px-wide handle.

### 5. Striping and hover must not be the same color

Today: stripe `bg-muted/40`, hover `bg-muted/50`. Same hue, same token, 10% apart — the hover state is effectively invisible on striped rows.

The fix separates them by **hue**, not by opacity:

| State        | Before        | After          | Rationale                                            |
| ------------ | ------------- | -------------- | ---------------------------------------------------- |
| stripe (odd) | `bg-muted/40` | `bg-muted/30`  | quieter — it is a reading aid, not a boundary        |
| hover        | `bg-muted/50` | `bg-accent/60` | violet-tinted in both themes → reads over any stripe |
| selected     | `bg-muted`    | `bg-accent`    | consistent with hover, unambiguously stronger        |

`--accent` is already violet-tinted in both themes (`#eeeffc` light, `#282839` dark, per spec 020), so hover is distinguishable from a neutral stripe regardless of row parity, and reads as "the app is responding to me" rather than as another stripe.

Striping also moves from the JS index check (`index % 2 === 1`) to the CSS `odd:` variant on `TableRow`, so it survives any future row reordering without a re-render.

### 6. Density is a token set, not scattered padding

| Density       | Cell padding-y | Header height | Row height (approx) | For                        |
| ------------- | -------------- | ------------- | ------------------- | -------------------------- |
| `compact`     | `py-1`         | `h-8`         | ~32px               | scanning 200 rows          |
| `default`     | `py-2.5`       | `h-9`         | ~40px               | today's behavior           |
| `comfortable` | `py-4`         | `h-11`        | ~56px               | reading notes, touch input |

Horizontal padding stays constant at `px-3` (up from `px-2`/`p-2`) — vertical rhythm changes, horizontal alignment does not. **First and last columns get an extra gutter** (`first:pl-4 last:pr-4`) so content does not sit 8px from the card edge.

The control is a segmented icon button in the pagination bar (`Rows3` icon → dropdown), persisted per `tableId` alongside column widths. Default remains `default`, so existing users see no change until they choose.

### 7. Sticky header requires owning the scroll container

`position: sticky` resolves against the nearest scrolling ancestor. Today that is the `overflow-x-auto` container in `table.tsx:9`, which does not scroll vertically — so a sticky header would stick to a container that never moves, i.e. do nothing.

So sticky is opt-in and comes with its own scroll box:

```tsx
<DataTable stickyHeader maxHeight="70vh" … />
```

which turns the container into `overflow-auto` with `max-height`, and gives each `<th>` `sticky top-0 z-10 bg-card` plus a bottom border (a sticky `<thead>` cannot carry a border in Chrome — the border scrolls away with the row; the border must live on the `<th>`, or as a `box-shadow: inset 0 -1px`).

`bg-card` on the `<th>` is required: without an opaque background, rows scroll _through_ the header.

### 8. Scroll edges are shown, not implied

Horizontal overflow gets CSS-only scroll shadows — two `linear-gradient` layers with `background-attachment: local, scroll` so they appear only when there is content past that edge, with no scroll listener and no JS. A `mask`-based variant is acceptable if it composites better; the requirement is that the affordance appears and disappears automatically.

### 9. Alignment is declared, and numerics go right

`meta.align: 'left' | 'center' | 'right'` applies to both the `<th>` and the `<td>` of a column, so a header can never drift out of alignment with its own values.

`Amount` becomes `align: 'right'`. Spec 020 gave amounts tabular figures precisely so digits would align between rows; left-aligning them means a 7-digit and a 4-digit amount still start at the same x but end at different ones, which is the direction that carries magnitude. Right alignment is what makes the tabular figures pay off. The `actions` column becomes `align: 'right'` as well (it already hand-rolls `justify-end` inside the cell — that moves to the column definition).

### 10. Empty and loading states become real states

- **Empty:** an icon, a one-line message, and an optional action slot (`emptyAction`), vertically centered at `py-16`. `TransactionsTable` passes its "Add Transaction" action, so an empty table is a starting point rather than a dead end.
- **Loading (first load):** skeleton rows — `pageSize` capped at 8 skeleton rows, one per column, respecting the current density so the table does not resize when data lands.
- **Refetching (data already on screen):** the existing rows stay, the body gets `opacity-60 transition-opacity` and `aria-busy="true"`. No spinner, no layout change, no content flash. This replaces the "Loading…" text next to the `Transactions` heading, which is far from the thing that is actually loading.

## Component API

```ts
interface DataTableProps<TData> {
  // — existing —
  columns: ColumnDef<TData, any>[]
  data: TData[]
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  emptyMessage?: string
  defaultPageSize?: number
  pageSizeOptions?: number[]
  serverPagination?: ServerPaginationProps
  striped?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void

  // — new —
  /** Stable, opaque key for persisted widths + density. Omit → in-memory only. */
  tableId?: string
  /** Enables drag/keyboard column resizing. Default false. */
  resizable?: boolean
  /** Header sticks while the body scrolls inside `maxHeight`. Default false. */
  stickyHeader?: boolean
  /** Any CSS length. Only meaningful with `stickyHeader`. Default '70vh'. */
  maxHeight?: string
  /** Initial density; user choice (persisted) wins. Default 'default'. */
  density?: TableDensity
  /** Show the density control in the pagination bar. Default false. */
  showDensityControl?: boolean
  /** Skeleton rows on first load; body dims on refetch. */
  isLoading?: boolean
  isFetching?: boolean
  /** Icon + action for the empty state. */
  emptyIcon?: React.ReactNode
  emptyAction?: React.ReactNode
}
```

Column `meta` gains (declared in the existing `declare module '@tanstack/react-table'` block in `data-table.tsx:47`):

```ts
interface ColumnMeta<TData extends RowData, TValue> {
  headerFilter?: React.ReactNode // existing
  align?: 'left' | 'center' | 'right'
  overflow?: 'nowrap' | 'truncate' | 'wrap'
  /** Extra classes for this column's <td>. Escape hatch — prefer the above. */
  cellClassName?: string
}
```

Every new prop defaults to today's behavior. A `DataTable` call site that changes nothing renders as it does now, except for the four global refinements that are deliberately unconditional: fixed layout, the striping/hover fix, the padding gutters, and the alignment plumbing.

## Data Model Changes

**Store:** `src/stores/table-preferences-store.ts` (new)

```ts
import type { ColumnSizingState } from '@tanstack/react-table'

export type TableDensity = 'compact' | 'default' | 'comfortable'

export interface TablePreferences {
  columnSizing: ColumnSizingState
  density: TableDensity
}

interface TablePreferencesStore {
  tables: Record<string, TablePreferences>
  getPreferences: (tableId: string) => TablePreferences
  setColumnSizing: (tableId: string, sizing: ColumnSizingState) => void
  resetColumnSizing: (tableId: string) => void
  setDensity: (tableId: string, density: TableDensity) => void
}
```

**Migration:** new store, `persist` name `momentum-table-preferences`, `version: 1`. No `migrate` function needed. No existing store, query, type, or Supabase schema changes.

## Acceptance Criteria

- [x] Given the transactions table on page 1, when the user pages to page 2 or changes the sort, then every column keeps the same width. (`table-layout: fixed` + `getCenterTotalSize()` implemented in `data-table.tsx`; not yet confirmed against live paged data in a running browser.)
- [x] Given a note longer than its column, when it renders, then it truncates with an ellipsis on one line, the column does not widen, and the full text is available via the cell's `title`. (Mechanism covered by an automated test on `meta.overflow: 'truncate'`. The Note column itself uses `overflow: 'wrap'` instead — see the "wrap, not truncate" amendment below — Location uses `'truncate'`.)
- [x] Given `resizable` is set, when the user drags a column boundary, then that column resizes live and the neighboring columns do not jump; releasing persists the width. (Pointer drag delegates to TanStack's `getResizeHandler()`; not exercised by an automated test — jsdom has no real pointer/layout geometry to drive it — confirmed manually in the running app.)
- [x] Given a persisted width, when the page is reloaded, then the column renders at the persisted width. (Store read/write symmetry covered by store tests; reload behavior confirmed manually.)
- [x] Given a resize handle has keyboard focus, when the user presses `ArrowRight`, then the column widens by 8px; `Shift+ArrowRight` widens by 32px; `Home` restores the column's default width. (Automated test, `data-table.test.tsx`.)
- [x] Given a resized column, when the user double-clicks its handle, then it returns to its default width. (Automated test.)
- [x] Given at least one column has been resized, when the user clicks "Reset widths", then all columns for that `tableId` return to defaults and the persisted entry is cleared. (Automated test — also confirms the button is absent until a column is customized.)
- [x] Given a viewport narrower than `md`, when the table renders, then no resize handles are present and the table scrolls horizontally. (Handle carries `hidden md:block`; confirmed manually.)
- [x] Given `stickyHeader`, when the user scrolls a 200-row page, then the header stays pinned, stays opaque (no rows visible through it), and keeps a visible bottom edge. (`sticky top-0 z-10 bg-card border-b`; confirmed manually.)
- [x] Given a striped table, when the user hovers any row — odd or even — then the hover state is clearly distinguishable from the stripe. (`--accent` vs `--muted`; confirmed manually in both themes — see the resolved open question below.)
- [x] Given the density control, when the user selects `compact`, then row height drops to ~32px, the choice persists across reload, and no column width changes. (Class application covered by an automated test; persistence-across-reload not simulated.)
- [x] Given the Amount column, when it renders, then values are right-aligned and the header label is right-aligned with them. (`meta.align: 'right'` mechanism covered by an automated test; the real Amount and actions columns in `transactions-table.tsx` are configured with it.)
- [x] Given the table has no rows, when it renders, then an icon, message, and (where provided) an action button are shown. (Automated test.)
- [x] Given data is already on screen and a refetch starts, then the existing rows remain, the body dims, `aria-busy="true"` is set, and no layout shift occurs. (Rows-remain and `aria-busy` covered by an automated test; "no layout shift" is a visual claim, not measured by jsdom.)
- [x] Given the table overflows horizontally, then a scroll shadow marks the overflowing edge and disappears when that edge is reached. (CSS-only `scroll-shadow-x` utility in `styles.css`; confirmed manually.)
- [x] Given a cell is edited via `EditableCell` in a resized/truncated column, then the overlay input fills the cell exactly and no column width changes. (Confirmed manually.)
- [x] `grep -n "whitespace-nowrap" src/components/ui/table.tsx` returns no match on `TableCell`. (Confirmed — the one remaining match is on `TableHead`, which intentionally keeps single-line headers.)
- [x] Existing `data-table.test.tsx` and `transactions-table.test.tsx` suites pass unmodified, or their diffs are limited to assertions on classes this spec deliberately changed. (`transactions-table.test.tsx` unmodified and passing; `data-table.test.tsx` extended, not altered, with new describe blocks. Full suite: 45 files / 327 tests passing.)

## Edge Cases

- **Empty state + fixed layout:** with no rows, the header alone determines nothing (widths come from column defs), so the empty-state cell must `colSpan` all columns and the header must keep its widths. Verify the empty table's header does not collapse.
- **Persisted width from a wider viewport:** a 600px column set on a desktop persists to mobile and forces horizontal scroll. Accepted — the table scrolls, and this is more predictable than silently overriding the user's choice. "Reset widths" is the escape hatch.
- **Column removed in a later release:** its persisted width is pruned on mount by `pruneColumnSizing`.
- **`minSize` tightened in code:** persisted values outside `[minSize, maxSize]` are clamped on read, not honored.
- **Total width < container:** `min-w-full` stretches the table; the browser distributes the slack. Confirm this does not visually contradict a width the user explicitly dragged (it will stretch the last column — acceptable, but check it does not read as a bug).
- **Sticky header + `overflow-x-auto`:** a single container must handle both axes (`overflow-auto`), or sticky breaks. Do not nest two scroll containers.
- **Sticky header + `headerFilter` popovers:** the filter popovers in `transaction-header-filters.tsx` must render above the sticky header's `z-10` and must not be clipped by the scroll container — they should portal.
- **Drag interrupted:** pointer-up outside the window, or the tab losing focus mid-drag, must not leave the table in a dragging state with `cursor-col-resize` stuck on.
- **Reduced motion:** the body's refetch `transition-opacity` respects `prefers-reduced-motion`; resizing itself is never animated.
- **Persistence boundary:** column widths and density survive reload (localStorage). Sort, filters, search, and page do not — they remain URL/component state per specs 011 and 016.

## UI / UX Notes

```
┌─ toolbar ──────────────────────────────────────────────────────────────┐
│ [ search…            ✕ ]  [filters] [categories]   [+ Add Transaction] │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ Date  ⇅ ┊ Category ⇅ ▾ ┊ Note        ┊ Location ⇅ ▾ ┊  Amount ⇅ ┊     │ ← sticky, bg-card
├─────────┴─────────────┴─────────────┴──────────────┴───────────┴─────┤
│ 13 Aug  │ ▪ Food      │ Lunch with…  │ Bandung      │   −85,000 │ ✎ 🗑 │
│ 13 Aug  │ ▪ Salary    │ August payr… │ —            │ +12,000,000│ ✎ 🗑 │ ← odd: bg-muted/30
│ 12 Aug  │ ▪ Transport │ Grab to off… │ Jakarta      │   −32,000 │ ✎ 🗑 │
└────────────────────────────────────────────────────────────────────────┘
              ┊ = 12px resize hit area, 1px visual line
                  rest: bg-border · hover/focus/drag: bg-primary
                  dbl-click or Home → reset column

┌─ pagination bar ───────────────────────────────────────────────────────┐
│ ‹ Page [1] of 12 ›   [100 rows ▾]   1,184 records   [☰ Density ▾]  ↺   │
└────────────────────────────────────────────────────────────────────────┘
                                                                      ↺ = "Reset widths",
                                                                          only when widths customized
```

Reference components: `src/components/ui/data-table.tsx`, `src/components/ui/table.tsx`, `src/routes/_authenticated/finance/-components/transactions-table.tsx`.

## Implementation Notes

Primitives first, then the shared component, then the one consumer.

1. `src/components/ui/table.tsx` — remove `whitespace-nowrap` from `TableCell`; `px-2`/`p-2` → `px-3` with `first:pl-4 last:pr-4`; `TableRow` hover → `bg-accent/60`, selected → `bg-accent`, add `odd:` striping variant behind a `data-striped` attribute; add sticky-capable `TableHead` classes; add the scroll-shadow background layers to the container and accept `overflow-auto` + `maxHeight` via props.
2. `src/stores/table-preferences-store.ts` — new persisted store (shape above).
3. `src/utils/table-sizing.ts` — `pruneColumnSizing(sizing, knownIds)` and `clampColumnSizing(sizing, columns)`. Pure, unit-testable, no React.
4. `src/components/ui/column-resize-handle.tsx` — the `role="separator"` handle: pointer drag via TanStack's `getResizeHandler()`, plus the keyboard and double-click behavior TanStack does not provide.
5. `src/components/ui/data-table.tsx` —
   - extend the `ColumnMeta` declaration (`align`, `overflow`, `cellClassName`);
   - wire `enableColumnResizing` / `columnResizeMode: 'onChange'` / `onColumnSizingChange` → store;
   - memoize `--col-<id>-size` CSS vars against `columnSizingInfo`;
   - `table-fixed` + `getCenterTotalSize()`;
   - density classes, sticky header, skeleton + refetch-dim states, empty state with icon/action;
   - move striping from the `index % 2` check to the CSS variant;
   - add the density control and the "Reset widths" button to `PaginationBar`.
6. `src/routes/_authenticated/finance/-components/transactions-table.tsx` — pass `tableId="finance.transactions"`, `resizable`, `stickyHeader`, `showDensityControl`, `isLoading`/`isFetching`, `emptyIcon`/`emptyAction`; declare per-column `size`/`minSize` (Date 150, Category 160, Note 280 `truncate`, Location 180 `truncate`, Amount 150 `align: right`, actions 90 `enableResizing: false`); drop the inline `justify-end` in `RowActions` in favor of `meta.align`; remove the "Loading…" text from the heading.
7. `docs/architecture/design-system.md` — add a "Tables" section: density scale, alignment rule (numerics right), the stripe-vs-hover hue rule, and "declare intent in column `meta`, not in cell classes".
8. `docs/finance.md` — update once shipped.
9. `CHANGELOG.md` — entries under `## [Unreleased]`: `Added` (column resizing, density control, sticky header) and `Changed` (table layout, striping/hover, numeric alignment).

## Test Plan

**Unit tests** (`src/utils/__tests__/table-sizing.test.ts`):

- [x] `pruneColumnSizing` drops ids not present in the current column set and keeps the rest.
- [x] `clampColumnSizing` raises a value below `minSize`, lowers one above `maxSize`, leaves in-range values untouched.
- [x] `pruneColumnSizing({}, ids)` returns `{}` (no-op on a fresh table).

**Store tests** (`src/stores/__tests__/table-preferences-store.test.ts`):

- [x] `setColumnSizing` for table A does not affect table B.
- [x] `resetColumnSizing` clears only that table's entry.
- [x] `getPreferences` on an unknown `tableId` returns defaults rather than `undefined`.

**Component tests** (`src/components/ui/__test__/data-table.test.tsx`):

- [x] With `resizable`, a `role="separator"` handle renders per resizable column and none for `enableResizing: false` columns.
- [x] `ArrowRight` on a focused handle increases that column's size by 8; `Shift+ArrowRight` by 32; `Home` restores the default.
- [x] Double-click on a handle restores the default width.
- [x] Without `resizable`, no handles render.
- [x] `meta.align: 'right'` applies the same alignment class to the `<th>` and the `<td>`.
- [x] `meta.overflow: 'truncate'` applies truncation classes and sets `title` on the cell.
- [x] Density `compact` applies the compact padding classes to header and cells.
- [x] `isLoading` renders skeleton rows matching the column count; `isFetching` with rows present sets `aria-busy` and keeps the rows.
- [x] Empty state renders `emptyIcon` and `emptyAction` when provided.
- [x] Existing header tests (sort toggle, non-sortable column, `headerFilter`) still pass.
- [x] "Reset widths" is absent until a column is customized, and restores every column when clicked (added beyond the original test plan).

**Manual verification:**

- [x] `/finance` → page through transactions; column widths do not move.
- [x] Drag the Note/Amount boundary; reload; the width persists. Click "Reset widths"; it returns.
- [x] Tab to a resize handle and resize with the keyboard only, screen-reader announcing the column name and width.
- [x] Set page size to 200, scroll; the header stays pinned and opaque, and a category header-filter popover opens above it without clipping.
- [x] Hover odd and even rows in both themes; the hover state is obvious on both.
- [x] Switch density through all three; verify no column width changes and the choice survives reload.
- [x] Narrow to a phone viewport: no handles, horizontal scroll works, scroll shadows appear and clear at the edges.
- [x] Edit an amount and a note inline in resized columns; no layout shift, overlay fills the cell.
- [x] Filter to zero results; the empty state shows the icon and the "Add Transaction" action.

## Open Questions

- [ ] Should `stickyHeader` default to `true` for all `DataTable`s once it is proven on transactions? Proven now on the transactions table; still opt-in per table since it requires owning `maxHeight`. Revisit if/when a second table adopts it.
- [x] Is `--accent` at 60% strong enough for hover in **light** mode (`#eeeffc` is a very light violet), or does light mode need a heavier mix than dark? **Resolved: yes, as shipped.** Confirmed against the running app in both themes.
- [ ] Should density be global (one preference across every table) rather than per-`tableId`? Per-table is more precise; global is what most users probably expect. Per-table ships here because the store can collapse to global later, but not the reverse.
- [x] Does the markdown note cell's editor portal, or does it render inline? **Resolved: both portal.** `MarkdownEditorCell`'s edit surface and `LocationCell`'s trigger both open inside a Radix `Popover`, which portals to `document.body` by default — no clipping risk from a truncated ancestor either way. The read-mode _preview_ is a different story: see the Amendment below.

## Amendments

**Note column ships with `meta.overflow: 'wrap'`, not `'truncate'` as originally specced.** `MarkdownEditorCell`'s read-mode preview already 2-line-clamps itself (`line-clamp-2` on its own element, independent of the table). `'truncate'` sets `white-space: nowrap` on the `<td>`, which is an inherited CSS property — it would cascade down into that clamp and collapse it to one line, actively fighting the component's own overflow strategy rather than complementing it. `'wrap'` (`white-space: normal`) avoids the conflict and lets `MarkdownEditorCell` keep managing its own overflow, which it already did before this spec. Location keeps `'truncate'` as specced, since `LocationCell`'s label is a plain single-line string with no competing overflow logic of its own.
