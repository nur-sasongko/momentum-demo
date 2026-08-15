---
id: 23
title: 'In-Feature Archive Views: Archived Notes in Second Brain, Archived Transactions in Finance'
status: in-progress
feature: core
related-features: [notes, finance]
created: 2026-08-15
updated: 2026-08-15
---

# In-Feature Archive Views: Archived Notes in Second Brain, Archived Transactions in Finance

## Problem Statement

[`022-core-archive-soft-delete.md`](./022-core-archive-soft-delete.md) shipped the archive as a single destination: a fifth sidebar item at `/archive` with a tab per content type. That is the right place to answer "what have I deleted lately, across everything" — but it is the _only_ place, and it is the wrong shape for the moment recovery actually happens.

Recovery happens in the feature. You are in Second Brain, you archive a note, the Undo toast expires, and thirty seconds later you want it back. Today that means leaving `/notes` entirely, landing on a page whose Second Brain tab shows the rows you were just looking at — detached from the list you were working in — restoring, then navigating back and re-finding your place. The note list, the open editor, the scroll position, and the filters you had set are all discarded to perform a one-click undo. Finance is the same story with the tab strip and filters you had configured.

Spec 022 anticipated exactly one entry point ("the sidebar entry is the only discovery point") and it is not enough. There is currently no way to see archived notes from `/notes` or archived transactions from `/finance`, and no count anywhere that tells you the archive has anything in it before you go looking.

> **Not a reversal of a 022 non-goal.** Spec 022 declined a _"recently deleted" indicator on the source pages_ — greying archived rows out inline in the notes list and the transactions table. That stays declined. This spec adds an **entry point** to a separate surface, which is a different thing: no archived row ever appears interleaved with live rows.

## Goals

- **Archived notes reachable without leaving `/notes`**, and archived transactions without leaving `/finance`.
- **One component per content type, mounted in two places.** The in-feature view and the `/archive` tab render the same table with the same actions, so there is no second behavior to keep in sync or test twice.
- **`/archive` is unchanged** as the cross-feature view — same route, same tabs, same URL contract.
- **A count at each entry point**, so an archive holding something advertises itself instead of waiting to be checked.
- **Restore from the in-feature surface refreshes the live surface behind it** — the list, the table, the charts, the tag chips — with no manual reload.
- **Full parity of actions**: Restore and Delete permanently are available from the in-feature views, with the same confirmation as `/archive`.

## Non-Goals

- **No schema, mutation, retention, or purge changes.** Every migration, query guard, mutation shape, and the `pg_cron` job from spec 022 is untouched. This spec is composition only.
- **No in-feature archive for habits or tasks.** Neither is Supabase-backed yet; they are not in `/archive` either.
- **No read-only preview or in-place editing of an archived note.** Restoring is the only way to read an archived note's body — the archive lists metadata, it is not a second reader.
- **No bulk actions.** Still no multi-select, no "Restore all", no "Empty archive".
- **No filter interaction.** The Finance Archive tab ignores the live finance filters (date range, type, category, city) rather than applying them — see decision 3.
- **No sidebar changes.** `/archive` keeps its item; no sub-items, no count badge in the sidebar (022's reasoning for declining that one still holds).
- **No archive entry point in secondary surfaces** — not in `SpendingDrilldownSheet`, not in `TransactionFormSheet`, not in `TagManagerDialog`.
- **No new URL state for the notes sheet.** It is a transient panel, not a filter; `/archive?tab=notes` is already the bookmarkable form.

## Design Decisions

### 1. The archive tables move into their feature slices; `/archive` becomes pure composition

`archive/-components/archive-notes-table.tsx` already imports `notes/-utils/notes-queries`. If `/notes` imported that component back, the dependency direction inverts into a cycle: `notes` → `archive` → `notes`.

Spec 022 decision 7 established that `/archive` owns the _composition_ and each feature owns its _data access_. Extend the same line one step: each feature also owns its _rendering_.

| From                                                        | To                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `archive/-components/archive-notes-table.tsx`               | `notes/-components/archived-notes-table.tsx`               |
| `archive/-components/archive-transactions-table.tsx`        | `finance/-components/archived-transactions-table.tsx`      |
| `archive/-components/archive-row-actions.tsx`               | `src/components/archive-row-actions.tsx`                   |
| `archive/-components/__test__/archive-notes-table.test.tsx` | `notes/-components/__test__/archived-notes-table.test.tsx` |

`ArchiveRowActions` is promoted to the global layer under the **provably domain-free** half of the promotion rule in `docs/architecture/feature-slices.md`: its props are `label: string` plus two callbacks and two booleans, it imports nothing from any feature, and it now has three consumers. Its file name and exported name stay as they are.

After the move, `archive/-components/` is empty and is deleted. `archive/index.tsx` imports both tables via `#/routes/_authenticated/<feature>/-components/…` and retains only the tabs, the two count queries, `-utils/archive-search.ts`, and `-utils/use-archive-tab.ts`.

This step is a pure move with zero behavior change and should land as its own commit before anything user-visible.

### 2. The table components take no props; the mount point supplies only the chrome

`<ArchivedNotesTable />` already owns its pagination state, its query, its mutations, its empty message, and its `tableId`. Both mount points render it bare. Nothing is parameterized — no `variant`, no `compact`, no `hideActions`. The first time a mount point needs a different table, that is a product decision to spec, not a prop to add.

One consequence, stated plainly rather than discovered later: **the two mount points do not share pagination state.** Page to 2 in the notes sheet, close it, open `/archive` — you are on page 1. That is correct. Each is a fresh view of the same server data, and `useState` scoping is what buys that independence without any coordination.

### 3. Finance: a third tab, and the live filters hide while it is active

`financeSearchSchema.view` widens from `'chart' | 'table'` to `'chart' | 'table' | 'archive'`. The tab strip becomes **Chart | Table | Archive (n)**, with the lucide `Archive` icon matching the sidebar.

`FinanceFilters` and `FinanceStatCards` describe the **live ledger** — a date range, a type, a category set, a city set, and the totals derived from them. `useArchivedTransactionsQuery` accepts none of those. Rendering a filter bar and a set of stat cards above a table they do not filter is a lie the layout tells. So when `view === 'archive'`, neither renders.

This is chosen deliberately over the alternative — teaching the archive query to respect the filters. The archive is a small, short-lived set ordered by deletion time, capped at 30 days. Filtering it by _transaction_ date answers a question nobody asks while looking for something they just deleted. If that turns out to be wrong, the query gains params later and none of the structure here changes.

The tab strip shifts upward when Archive is selected, because two blocks above it disappear. Accepted: honest layout beats stable layout when the alternative is inert controls.

### 4. The Finance archive tab must survive an empty live ledger

`FinancePage` currently renders `FinanceEmptyState` **instead of** the tab strip when `aggregateRows.length === 0`. Archive every transaction you have and the Archive tab disappears along with the strip — precisely the moment it is needed most.

The gate moves off "are there live transactions" and onto "is there anything at all":

```tsx
hasTransactions || archivedCount > 0
  ? <Tabs>
      Chart:   hasTransactions ? <charts…/>            : <FinanceEmptyState />
      Table:   hasTransactions ? <TransactionsTable /> : <FinanceEmptyState />
      Archive: <ArchivedTransactionsTable />
    </Tabs>
  : <FinanceEmptyState />
```

The empty state moves _inside_ the Chart and Table tabs rather than replacing the strip, so no chart is ever asked to render zero rows and the Archive tab stays reachable.

**The default view is not auto-switched** when the live ledger is empty but the archive is not. `view` stays `'chart'`, showing the empty state with `Archive (n)` plainly visible beside it. A default that computes itself from server data fights the URL param, changes under the user as data loads, and surprises on Back.

### 5. Notes: a Sheet from the list header — not a list mode, not a child route

Three shapes were considered for a two-pane layout with no tab strip.

| Shape                                     | Why not                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An "Archived" chip in the list filter row | Swapping the list to archived notes means the editor pane needs a read-only mode, a second selection space, and it reopens 022's `?note=<archived-id>` → `PGRST116` fallback (which would have to _stop_ bouncing while archived mode is active). A large, stateful surface for a rare, brief flow. |
| A `/notes/archive` child route            | Re-poses the two-pane shell question (keep the list? drop it?) and adds a second full-page archive when `/archive` already is one, reachable in one click from the sidebar.                                                                                                                         |
| **A Sheet from the list header** ✔        | The app's existing idiom for "a side panel of rows you act on and dismiss" (`SpendingDrilldownSheet`). Keeps the note list and the open editor alive behind it, mounts the shared table verbatim, introduces no new concept.                                                                        |

**Trigger:** an `Archive` icon button in the `NoteList` header row, left of the existing `Plus`, `aria-label="Archived notes"`, with the count rendered inline beside the icon when greater than zero. The button remains present at zero — 022's "an archive that hides itself when empty is an archive users forget exists" applies to the entry point as much as to the route.

**Sheet:** `side={isMobile ? 'bottom' : 'right'}`, `sm:max-w-3xl` on desktop (four columns plus actions; the drilldown's `sm:max-w-md` is far too narrow for a `DataTable`), `h-[85dvh] rounded-t-xl` on mobile — matching `SpendingDrilldownSheet`'s responsive treatment exactly.

**Open state** is local `useState` in `NoteList`. See the corresponding Non-Goal.

### 6. Restore closes nothing and does not steal selection

Restore from either in-feature surface calls the existing `useRestoreNoteMutation` / `useRestoreTransactionMutation` unchanged. Those already invalidate both the feature's live keys and `['archive']`, so the note list, the transactions table, the charts, the stat cards, and the tag chips refresh behind the surface on their own. No new invalidation is needed and none is added.

The sheet **stays open** after a restore — you may be restoring several — and the row leaves the table as `['archive']` refetches. The toast reads `Note restored`, as it does today from `/archive`.

Restore does **not** select the restored note in the editor. That would yank the pane out from under a user who is mid-restore and has the sheet open over it. This is not inconsistent with the Undo action on the archive toast, which _does_ re-select: there, the note was the user's context one click earlier. Different action, different intent.

### 7. Counts reuse the hooks that already exist

`useArchivedNotesCountQuery()` and `useArchivedTransactionsCountQuery()` were written for the `/archive` tab labels, are keyed under `['archive', <feature>, 'count']`, and are already invalidated by every archive, restore, and purge. Mounting each a second time — in `NoteList` and in `FinancePage` — costs one shared cache entry, not a second request.

Spec 022 declined a sidebar count badge because it would fire a query on every page load for a number nobody is waiting for. That reasoning does not transfer: these fire on the feature page where archiving happens, and the number _is_ the discovery affordance.

## Data Model Changes

**Postgres:** none. **Zustand:** none. **Query keys:** none.

**TypeScript** — one union widened:

```ts
// finance/-utils/finance-search.ts
export type FinanceView = 'chart' | 'table' | 'archive'

export const financeSearchSchema = z.object({
  view: z.enum(['chart', 'table', 'archive']).catch('chart'),
  // … unchanged
})
```

`FINANCE_SEARCH_DEFAULTS.view` stays `'chart'`, so `stripSearchParams` behavior is unchanged and existing bookmarks (`?view=table`, or no param) are unaffected.

**File moves:** see decision 1. No type definitions move — `ArchivedNote`, `ArchivedTransaction`, and their params/page types already live in the feature `-types/` folders per 022's amendment.

## Acceptance Criteria

- [x] Given archived notes exist, when I open `/notes`, then the list header shows an Archive button with the count — `note-list.test.tsx`
- [x] Given I click that button, when the sheet opens, then it lists my archived notes with Title, Deleted, Expires and per-row Restore / Delete permanently — `archived-notes-sheet.test.tsx` + `archived-notes-table.test.tsx`
- [ ] Given the sheet is open, when I click Restore on a row, then the row leaves the sheet, the note reappears in the list behind it, the count decrements, and the sheet stays open — NEEDS MANUAL: the restore call itself is tested, but "reappears in the list behind it" / "sheet stays open" is cross-component and only a browser check confirms it
- [x] Given the sheet is open, when I click Delete permanently, then the same confirm dialog as `/archive` appears naming the note, and nothing is deleted unless I confirm — `archived-notes-table.test.tsx`
- [x] Given no notes are archived, when I open the sheet, then it shows the empty state and the header button shows no count — `archived-notes-table.test.tsx` + `note-list.test.tsx`
- [ ] Given archived transactions exist, when I open `/finance`, then the tab strip reads Chart | Table | Archive (n) — logic present in `finance/index.tsx` (read directly), no automated test; deferred to manual per this spec's own Amendments
- [ ] Given I select the Archive tab, then the filters bar and stat cards are not rendered, and the archived transactions table is — same: `showFiltersAndStats` logic confirmed by reading the code, untested
- [ ] Given the Archive tab is selected, when I reload, then the Archive tab is still selected (`?view=archive`) — NEEDS MANUAL (URL persistence, browser only)
- [ ] Given every transaction is archived, when I open `/finance`, then the tab strip still renders, Chart and Table show the empty state, and Archive lists the archived rows — logic confirmed by reading (`hasTransactions || hasArchivedTransactions`), untested
- [ ] Given nothing exists at all (no live, no archived), when I open `/finance`, then `FinanceEmptyState` renders with no tab strip — logic confirmed by reading, untested
- [ ] Given I restore a transaction from the Archive tab, then switching to Chart or Table shows it, with the charts and stat cards including its amount — NEEDS MANUAL (full e2e refetch/render chain)
- [ ] `/archive` renders identically to before this spec — same route, same tabs, same counts, same actions — structurally confirmed (`archive/index.tsx` now just imports the moved components; no other change), visual regression needs a browser
- [x] Restoring or purging from an in-feature view updates `/archive` and vice versa (same query keys, same invalidation) — confirmed by reading: both surfaces call the exact same mutation hooks (`useRestoreNoteMutation` etc.), which invalidate the same `['archive']` root — there is no separate code path to have diverged

## UI / UX Notes

### `/notes` — Second Brain

```
┌──────────────────┬────────────────────────────────────────┐
│ Second Brain 🗄 3 ⊕│  # Q3 planning                         │
│ ┌──────────────┐ │  ────────────────────────────────────   │
│ │ Search notes…│ │  Lorem ipsum dolor sit amet…            │
│ └──────────────┘ │                                         │
│ [All][Untagged]  │                                         │
│ • Q3 planning  ◀ │                                         │
│ • Meeting notes  │                                         │
└──────────────────┴────────────────────────────────────────┘
                        ↓ click 🗄
        ┌────────────────────────────────────────────┐
        │ Archived notes                        ✕    │
        │ Kept for 30 days, then permanently removed.│
        ├────────────────────────────────────────────┤
        │ Title        Tags     Deleted    Expires   │
        │ Old draft    work     2 days ago in 28 days│  [↺] [🗑]
        │ Recipe       —        29 d ago   tomorrow  │  [↺] [🗑]
        │                        Rows per page 25 ‹1/1›│
        └────────────────────────────────────────────┘
```

- Header button: `variant="ghost" size="icon-sm"`, lucide `Archive`, `aria-label="Archived notes"`. Count rendered inline beside the icon (`text-xs text-muted-foreground tabular`) when `> 0`; the icon alone at 0.
- `SheetTitle`: `Archived notes`. `SheetDescription`: `Kept for 30 days, then permanently removed.` — the same sentence as the `/archive` subtitle, scoped to notes.
- The sheet body is `<ArchivedNotesTable />` verbatim: same columns, same empty message (`Nothing in the archive.`), same page-size options.

### `/finance` — Archive tab

```
┌──────────────────────────────────────────────────────────────┐
│ Finance Tracker                                              │
│ Track income, expenses, and spending by category.            │
│                                                              │
│ [ 📊 Chart ] [ ▦ Table ] [ 🗄 Archive (12) ]                  │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Date        Category   Note      Amount  Deleted  Expires│ │
│ │ 12 Aug 09:14 Groceries  Market   −85,000 2 d ago  in 28 d│ [↺] [🗑]
│ │ 03 Aug 18:22 Transport  Grab     −32,000 29 d ago tomorrow│ [↺] [🗑]
│ └──────────────────────────────────────────────────────────┘ │
│                                    Rows per page 25  ‹ 1/1 › │
└──────────────────────────────────────────────────────────────┘
     ↑ note: no filters bar, no stat cards while this tab is active
```

- Tab label follows the `/archive` convention: `Archive` while the count is loading, `Archive (12)` once resolved — reuse the existing `tabLabel` shape rather than rendering `(0)` during load.
- The tab body is `<ArchivedTransactionsTable />` verbatim.

## Edge Cases

- **Restoring the last archived note with the sheet open.** The table falls to its empty state, the header count disappears, the sheet stays open. It does not auto-close — a panel that closes itself the instant you finish acting reads as a crash.
- **Archiving the last live transaction while on the Table tab.** `hasTransactions` flips false, the Table tab's content becomes `FinanceEmptyState`, and the strip stays (the archive is now non-empty). The user is not thrown to a different tab.
- **`?view=archive` on an account with nothing live and nothing archived.** The strip does not render, `FinanceEmptyState` does, and the orphaned search param is harmless — nothing reads `view` outside the strip. It is stripped on the next filter write.
- **Purging from an in-feature view.** Identical `ConfirmDialog`, identical copy, identical destructive variant — it is the same `ArchiveRowActions` component. There is no weaker confirmation on the in-feature path.
- **Pagination independence** between the two mount points — see decision 2. Not a bug; do not "fix" it by lifting state.
- **A sheet or tab left open overnight.** Expiry labels are computed at render from `deleted_at`, so a long-open surface shows a stale `in 3 days` until something triggers a refetch. Identical to `/archive` today; not addressed here.
- **Two surfaces open in two browser tabs.** Restoring in one invalidates the other only when it refocuses and refetches. Same as every other cross-tab case in the app.
- **Mobile.** The notes sheet is a bottom sheet at `85dvh`; the `DataTable` scrolls inside it and the pagination footer stays reachable. The finance Archive tab is the ordinary responsive `DataTable` — no special handling.
- **A note archived from the editor while its own row is visible in the open sheet.** Not reachable — the sheet overlays the editor, so the editor's delete affordance cannot be clicked while it is open.

## Implementation Notes

Move first, in its own commit, then build on the moved pieces.

1. `src/components/archive-row-actions.tsx` — move `ArchiveRowActions` out of the archive slice unchanged.
2. `notes/-components/archived-notes-table.tsx` and `finance/-components/archived-transactions-table.tsx` — move and rename the two tables; update their `ArchiveRowActions` import to `#/components/archive-row-actions` and their query imports to relative paths within their own slice.
3. `archive/-components/__test__/archive-notes-table.test.tsx` → `notes/-components/__test__/archived-notes-table.test.tsx`, imports updated.
4. `archive/index.tsx` — import both tables from the feature slices; delete the now-empty `archive/-components/`. **`/archive` must render and behave identically at this point** — verify before continuing.
5. `finance/-utils/finance-search.ts` — widen `FinanceView` and the `view` enum.
6. `finance/index.tsx` — add the Archive tab and its count; gate the strip on `hasTransactions || archivedCount > 0`; move `FinanceEmptyState` into the Chart and Table tab contents; render `FinanceFilters` and `FinanceStatCards` only when `activeView !== 'archive'`.
7. `notes/-components/archived-notes-sheet.tsx` — new; `Sheet` + header copy + `<ArchivedNotesTable />`, responsive `side`/width per decision 5.
8. `notes/-components/note-list.tsx` — Archive trigger button with count, local `sheetOpen` state, mount the sheet.
9. Tests per the Test Plan below.
10. `CHANGELOG.md` — `Added` entries under `## [Unreleased]` for both surfaces; `Changed` for the finance empty-state gate.
11. `docs/archive.md` — document the two in-feature entry points and that they render the same tables. `docs/second-brain.md`, `docs/finance.md` — add the entry point to each feature's archive section.

## Test Plan

**Component tests** (`notes/-components/__test__/`):

- [x] `archived-notes-table.test.tsx` — the moved test passes unchanged against the new path (proves the move was behavior-neutral)
- [x] `archived-notes-sheet.test.tsx` — renders the title and description; renders the table's rows when open; renders nothing when closed
- [x] `note-list.test.tsx` — the Archive button renders with the count when archived notes exist, and without a count at zero; clicking it opens the sheet

**Component tests** (`finance/-components/__test__/`):

- [ ] `archived-transactions-table.test.tsx` — the moved coverage, if any, follows the file

  **Confirmed 2026-08-15: no such file exists, and none existed before the move either** (checked
  git history — there was never a test for the archive table on the finance side). The bullet's own
  "if any" hedge means this isn't a regression, but it is a real, standing coverage gap: the finance
  archive table's expiry label, restore-without-dialog, purge-confirmation, and empty state are all
  untested, unlike their notes-side equivalents.

**Route-level tests** (`finance/`):

- [ ] With live transactions and archived transactions: three tabs render; selecting Archive hides `FinanceFilters` and `FinanceStatCards`
- [ ] With zero live and non-zero archived: the strip renders, Chart and Table show `FinanceEmptyState`, Archive lists rows
- [ ] With zero live and zero archived: no strip, `FinanceEmptyState` only

  These three are the ones the Amendments section explicitly deferred to Manual Verification instead
  of automating (`finance/index.tsx` isn't a tested layer in this codebase, and its gating logic isn't
  behind swappable props) — confirmed still true, not re-litigated here.

**Unit tests** (`finance/-utils/__test__/`):

- [x] `financeSearchSchema` accepts `view=archive`; an unknown `view` still `.catch`es to `'chart'`

**Manual verification** (requires a live Supabase instance / browser — not run by the assistant; confirm and check off each as you verify it):

- [ ] Archive a note from the editor, dismiss the Undo toast, open the sheet from the list header, restore — the note is back in the list behind the sheet and the count drops by one
- [ ] Delete permanently from the sheet — confirm dialog names the note; after confirming it is gone from both the sheet and `/archive`
- [ ] Archive a transaction, open `/finance` Archive tab, restore — it reappears in the Table tab and its amount returns to the stat cards and charts
- [ ] Archive every transaction — the Archive tab is still reachable and Chart/Table show the empty state
- [ ] Select the Archive tab, reload — still on Archive; press Back — returns to the previous tab
- [ ] `/archive` still shows both tabs with matching counts and identical row actions
- [ ] Mobile: the notes sheet opens from the bottom at 85dvh, the table scrolls, pagination is reachable

## Open Questions

- [ ] Count rendered **inline** beside the Archive icon vs. a small badge on the button. Inline is specced (a badge on a `size="icon-sm"` ghost button in a compact header row is cramped) — confirm visually during implementation and change if it reads poorly.
- [ ] Should the notes sheet trigger be hidden entirely at count 0? Specced as always-visible, following 022's reasoning about discoverability. _Recommendation: keep it visible; revisit only if it reads as clutter in the header._
- [ ] Once both features have an in-feature view, does `/archive` still earn a sidebar slot? _Recommendation: yes, keep it — it is the only cross-feature view and the only one that answers "what did I delete this week" in one place. Revisit if a third feature joins and the sidebar gets crowded._

## Amendments

Implementation done (2026-08-15), one process deviation and one scope deferral from
Implementation Notes:

- **The notes header trigger ended up `size="sm"` with explicit `h-8`, not `icon-sm`.** `icon-sm`
  is a fixed `size-8` square, which has no room for the inline count text next to the icon at
  non-zero counts. `size="sm"` lets the button grow with its content; `h-8` keeps it the same
  height as the adjacent `icon-sm` "New note" button so the row still reads as one height.
- **`docs/second-brain.md` and `docs/finance.md` are not updated yet.** Per
  `docs/architecture/spec-workflow.md`, feature docs are updated when a spec reaches `done`, not
  mid-`in-progress`. `docs/archive.md`'s Source of Truth section _was_ corrected now — its file
  paths would otherwise point at files this spec moved, which is a stale-reference bug, not a
  forward-looking feature description. The two feature docs' archive sections get their
  "reachable from `/notes` and `/finance` too" update when this spec is marked `done`.
- **No dedicated route-level test file for `finance/index.tsx`.** This codebase has no existing
  test for any route `index.tsx` (per `docs/architecture/testing.md`, route files wire loaders and
  render components — they aren't a tested layer here), and `FinancePage` calls
  `useFinanceFilters`, `useDrilldown`, and three query hooks directly rather than through
  swappable props, so unit-testing the new tab-gating logic in isolation would mean mocking most
  of the file's dependency surface for one component. The gating logic (`showTabs`,
  `showFiltersAndStats`) is covered by the Manual Verification checklist above instead. Flagging
  this explicitly rather than silently dropping it from the Test Plan: if this logic grows more
  branches later, it's worth reconsidering.

Everything else — the component move (`archive/-components/` → `notes/-components/` +
`finance/-components/` + `src/components/`), the Finance Archive tab and its filter/stat-card
hiding, the `hasTransactions || hasArchivedTransactions` gate, the notes Sheet and its trigger, and
the `/archive` route staying behaviorally unchanged — matches the design as specced. Full test
suite (50 files / 359 tests) and typecheck pass with no new failures introduced by this spec.

**Verification pass (2026-08-15):** re-ran `bun --bun run test` (359/359 pass) and `tsc --noEmit`
(same pre-existing, out-of-scope errors as spec 022, nothing new), and read the actual source for
every claim above rather than trusting this Amendments section at face value — the file move really
happened (`archive/-components/` is gone, only `-utils/` and `index.tsx` remain under `archive/`),
`ArchiveRowActions` really is domain-free, `financeSearchSchema` really accepts `'archive'`, and the
tab-gating booleans in `finance/index.tsx` read exactly as described. Acceptance Criteria and Test
Plan checkboxes above are now marked from that verification: automated coverage exists for every
notes-side surface; the finance-side gating logic and the cross-surface refresh behavior (restore in
one mount point reflecting in the other, URL persistence on reload) are correct by code inspection
but were never automated, matching what this section already said about `finance/index.tsx` not
being a tested layer here. Those, plus everything in Manual Verification, still need a human with a
browser and a live Supabase instance.
