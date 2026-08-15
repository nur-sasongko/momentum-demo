---
id: 22
title: 'Archive: Soft Delete, Restore & 30-Day Auto-Purge for Notes and Transactions'
status: in-progress
feature: core
related-features: [notes, finance]
created: 2026-08-15
updated: 2026-08-15
---

# Archive: Soft Delete, Restore & 30-Day Auto-Purge for Notes and Transactions

## Problem Statement

Deleting a transaction is a single unguarded click. `RowActions` in `transactions-table.tsx:78-87` calls `deleteMutation.mutate(row.id)` straight from `onClick`, and `useDeleteTransactionMutation` (`finance-queries.ts:364`) issues `supabase.from('finance_transactions').delete()`. There is no confirmation, no undo, and no copy of the row anywhere — the amount, the note, the location, and the timestamp are gone the moment the pointer comes up. A misclick on a dense 100-row table is unrecoverable, and this has already happened in real use.

Notes are only marginally better protected. The editor does show a confirm dialog (`note-editor.tsx:407-425`) — it even says the note "will be permanently deleted", which is accurate — but a user who clicks through it has the same outcome: `useDeleteNoteMutation` hard-deletes the row, taking the Tiptap document, its tags, and every `[[wiki-link]]` that pointed at it. A confirm dialog is a speed bump in front of an irreversible operation; it is not a recovery path.

Neither table has a `deleted_at` column, so there is nothing to recover from even at the database level. There is no view anywhere in the app that lists deleted items, no way to undo a delete after the toast disappears, and consequently no retention policy either — data is either live or permanently gone, with no state in between.

What is missing is the ordinary two-stage delete that users expect from anything holding data they care about: the delete button removes an item from view and puts it somewhere recoverable, and permanent destruction is a separate, deliberate, explicitly-confirmed act — with an expiry so the recoverable bucket does not grow without bound.

## Goals

- **Nothing is destroyed by the delete button.** `delete` on a note or transaction sets `deleted_at` and removes the row from every live view; the row itself stays in Postgres.
- **A single place to see and act on deleted items** — a new `/archive` route in the sidebar, with a tab per content type (Second Brain, Finance).
- **Restore** puts an item back exactly as it was, in one click, from the archive.
- **Permanent delete exists but is deliberate** — only from the archive, always behind an explicit confirmation naming the item.
- **Confirmation before archiving on both features**, closing the gap where transactions have none today, backed by an **Undo** action in the success toast.
- **Automatic purge after 30 days**, enforced by the database on a schedule rather than by the app, so it happens whether or not the app is ever opened.
- **Archived rows are invisible to every existing query** — list, detail, search, tag counts, link targets, chart aggregates, stat cards, drilldown, pagination counts.
- **The archive surface is generic**, so a third feature (tasks, habits) can join it later by supplying a table config, not by building a second archive.

## Non-Goals

- **No archive for habits, tasks, finance categories, or tags.** Categories already have a non-destructive delete path (the `reassign_transactions_on_category_delete` trigger moves transactions to "Other"), and tags are derived values, not rows. Habits and tasks are still local-store-backed and out of scope here.
- **No bulk actions in v1** — no "Restore all", no "Empty archive now", no multi-select. Each row is restored or purged individually. The archive tables are built on `DataTable`, which already has an unused `data-[state=selected]` hook if this is revisited.
- **No user-configurable retention.** 30 days is a constant in one SQL function and one TS module, not a setting.
- **No archive for the row's edit history.** Restore returns the item as it was at archive time; there is no version history and this spec does not add one.
- **No offline/PWA queueing of archive actions.** Archive, restore, and purge are ordinary online mutations like every other write in the app.
- **No changes to the Tiptap editor's own delete affordances** (table row/column deletion inside a document). Those operate on document content, not rows.
- **No "recently deleted" indicator on the source pages.** The sidebar entry is the only discovery point; archived items do not appear greyed-out in the notes list or transactions table.

## Design Decisions

### 1. `deleted_at timestamptz` on the row, not a separate archive table

Both `public.notes` and `public.finance_transactions` get a nullable `deleted_at timestamptz`. `null` means live; a timestamp means archived, and the timestamp is both the "Deleted" column the user sees and the input to the retention clock.

The alternative — moving rows into `notes_archive` / `finance_transactions_archive` tables — was rejected. It duplicates the schema (including the `notes` generated column, `tsvector`, and triggers), breaks the `finance_transactions.category_id` foreign key on the way out and back, and makes restore a cross-table move that can half-fail. A nullable column keeps restore as a single `update … set deleted_at = null` and keeps every constraint intact the whole time.

**Consequence:** every read of live data must filter. That cost is paid explicitly, in section 2.

### 2. Live queries filter with `.is('deleted_at', null)` at every read site — no views

Reads of live data add `.is('deleted_at', null)`. There are exactly seven such sites and they are all in two files:

| File                 | Line (current) | Query                                       |
| -------------------- | -------------- | ------------------------------------------- |
| `notes-queries.ts`   | 186            | list (infinite scroll)                      |
| `notes-queries.ts`   | 235            | detail by id                                |
| `notes-queries.ts`   | 284            | link targets for `[[`                       |
| `finance-queries.ts` | 160            | aggregate (charts + stat cards + drilldown) |
| `finance-queries.ts` | 218            | paginated table (and its `count: 'exact'`)  |

plus the two RPCs (`get_note_tags`, section 5).

A Postgres view (`notes_live`) was considered and rejected: PostgREST-updatable views add a layer the write paths would have to reason about, and `docs/specs/001` commits the app to staying portable across Supabase instances — one more schema object to keep in sync in every environment. Seven explicit filters are greppable, obvious in review, and cannot silently apply to a write.

To make the omission of a filter loud rather than silent, both feature query modules get a tiny local helper used at every live read:

```ts
/** Restricts a select to live (non-archived) rows. Every live read goes through this. */
function liveOnly<T extends { is: (col: string, val: null) => T }>(
  query: T,
): T {
  return query.is('deleted_at', null)
}
```

### 3. Archive/restore/purge are guarded, idempotent mutations

Three mutation shapes replace the current single delete per feature:

```ts
// archive — the delete button. Guarded so re-archiving cannot reset the 30-day clock.
.update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null)

// restore
.update({ deleted_at: null }).eq('id', id).not('deleted_at', 'is', null)

// purge — the only hard delete left in the app
.delete().eq('id', id).not('deleted_at', 'is', null)
```

The `.not('deleted_at', 'is', null)` on purge is a safety interlock: even if a caller passes a live row's id, the DELETE matches nothing. **Hard delete is only reachable for rows that are already archived.** RLS (`auth.uid() = user_id`) is unchanged and already covers archived rows in all three cases.

`useDeleteTransactionMutation` and `useDeleteNoteMutation` are **renamed**, not kept as aliases — `useArchiveTransactionMutation` / `useArchiveNoteMutation`. Leaving a `useDelete*` name pointing at a soft delete is how the wrong one gets called six months from now.

### 4. Archiving must not disturb `updated_at` semantics

The two tables' timestamp triggers behave differently and this matters:

- `update_notes_timestamp` only bumps `updated_at` when `title` or `content` change. Setting `deleted_at` therefore leaves a note's "Last edited" untouched — correct, and free.
- `update_finance_transaction_timestamp` bumps `updated_at` on **any** update, so archiving a transaction moves its `updated_at`. This is left as-is: `updated_at` is not surfaced anywhere in the finance UI, and `deleted_at` is the authoritative archive timestamp. Do not "fix" this by special-casing the trigger — that would mean a transaction edited and archived in the same session loses its edit timestamp.

### 5. Tags: mutations follow archived notes, aggregates do not

The three tag RPCs split:

| RPC                         | Sees archived notes?                  | Why                                                                                                                    |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `get_note_tags()`           | **No** — add `and deleted_at is null` | It drives the filter chips and the Tag Manager counts. An archived note must not keep a tag chip alive in the sidebar. |
| `rename_note_tag(old, new)` | **Yes** — unchanged                   | If a rename skipped archived notes, restoring one would resurrect the old tag name the user deliberately renamed away. |
| `delete_note_tag(target)`   | **Yes** — unchanged                   | Same reasoning: a deleted tag must not come back through the archive.                                                  |

This asymmetry is intentional and gets a comment in the migration. The rule is: **aggregates describe the live library; mutations keep the whole library consistent.**

### 6. Retention is enforced by Postgres on a schedule, not by the client

A `SECURITY DEFINER` function does the purge across all users, and `pg_cron` runs it daily at 03:00 UTC:

```sql
create or replace function public.purge_expired_archives()
returns table(notes_purged bigint, transactions_purged bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
  n bigint;
  t bigint;
begin
  with d as (delete from public.notes where deleted_at is not null and deleted_at < cutoff returning 1)
  select count(*) into n from d;

  with d as (delete from public.finance_transactions where deleted_at is not null and deleted_at < cutoff returning 1)
  select count(*) into t from d;

  return query select n, t;
end;
$$;

revoke all on function public.purge_expired_archives() from public, anon, authenticated;
```

`SECURITY DEFINER` is required because pg_cron runs as `postgres` with no `auth.uid()`, so RLS cannot scope the delete — the function is the scope instead. It is **not** granted to `authenticated`; the client never calls it, and a client that could would be able to purge other users' rows.

The scheduling migration must not fail on a database without `pg_cron` (local resets, a self-hosted instance, CI), so it is guarded:

```sql
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema extensions';
    perform cron.unschedule('purge-expired-archives')
      where exists (select 1 from cron.job where jobname = 'purge-expired-archives');
    perform cron.schedule(
      'purge-expired-archives', '0 3 * * *',
      $cron$select public.purge_expired_archives()$cron$
    );
  else
    raise notice 'pg_cron unavailable — purge_expired_archives() must be invoked manually';
  end if;
end
$$;
```

The `unschedule`-before-`schedule` makes the migration re-runnable against a database that already has the job.

**Client-side purge-on-boot was rejected.** It only runs when the app is opened, would need throttling state in `localStorage`, and puts a destructive operation on the app's startup path where a bug is maximally expensive.

### 7. `/archive` is its own slice; each feature keeps ownership of its own data access

The archive route is a new vertical slice at `src/routes/_authenticated/archive/`. It owns the page, the tab state, and the two table configs — the **composition**.

It does **not** own the queries. `useArchivedNotesQuery` / `useRestoreNoteMutation` / `usePurgeNoteMutation` live in `notes/-utils/notes-queries.ts` next to every other `notes` query; the finance equivalents live in `finance/-utils/finance-queries.ts`. The archive route imports them via `#/routes/_authenticated/<feature>/-utils/…`. This keeps a single module responsible for each table's cache keys and invalidation, which is what makes "archive a note, then look at the tag chips" correct.

Per `docs/architecture/feature-slices.md`, the shared confirm dialog is promoted to `src/components/confirm-dialog.tsx` — it is provably domain-free and gets three consumers immediately (archive-transaction, archive-note, purge), alongside the existing `discard-changes-dialog.tsx` which it deliberately does **not** replace (that one's copy and semantics are specific to the unsaved-changes guard).

### 8. Retention is one number, declared twice, cross-referenced

`ARCHIVE_RETENTION_DAYS = 30` lives in `src/utils/archive.ts` for the "Expires" column and the archive page's subtitle. The authoritative value is the `interval '30 days'` in `purge_expired_archives()`. Both carry a comment naming the other. The TS value is presentational only — it never drives a delete.

## Data Model Changes

**Postgres** — `supabase/migrations/20260815000001_add_deleted_at_soft_delete.sql`:

```sql
alter table public.notes                add column deleted_at timestamptz;
alter table public.finance_transactions add column deleted_at timestamptz;

-- Archive list reads: user's archived rows, newest-deleted first.
create index notes_user_id_deleted_at
  on public.notes(user_id, deleted_at desc) where deleted_at is not null;
create index finance_transactions_user_id_deleted_at
  on public.finance_transactions(user_id, deleted_at desc) where deleted_at is not null;

-- Hot live-read paths become partial so archived rows are not scanned.
drop index if exists notes_user_id_updated_at;
create index notes_user_id_updated_at
  on public.notes(user_id, updated_at desc) where deleted_at is null;

drop index if exists finance_transactions_user_id_date;
create index finance_transactions_user_id_date
  on public.finance_transactions(user_id, date) where deleted_at is null;
```

RLS policies are unchanged — `for all using (auth.uid() = user_id)` already covers archived rows for select, update, and delete.

**Zustand:** none. No store gains a field, and no `persist` version bump is needed. `finance-store` stays at `version: 5`. Archive state is server state (TanStack Query) plus one URL search param for the active tab.

**TypeScript** — `-types/` additions:

```ts
// finance/-types/finance-api.ts
export interface TransactionRow {
  /* … */ deleted_at: string | null
}

// notes/-types/notes-api.ts
export interface NoteRow {
  /* … */ deleted_at: string | null
}
export type ArchivedNoteRow = Pick<
  NoteRow,
  'id' | 'title' | 'excerpt' | 'tags' | 'deleted_at' | 'updated_at'
>

// archive/-types/archive.ts — the shape both tabs render
export interface ArchivedItem {
  id: string
  deletedAt: string
}
export interface ArchivedNote extends ArchivedItem {
  title: string
  excerpt: string
  tags: string[]
}
export interface ArchivedTransaction extends ArchivedItem {
  type: 'income' | 'expense'
  amount: number
  date: string
  note: string
  categoryName: string
  categoryColor: string
}
```

**Query keys:**

```ts
ARCHIVE_KEYS = {
  notes: (page: ArchivePageParams) => ['archive', 'notes', page] as const,
  transactions: (page: ArchivePageParams) =>
    ['archive', 'transactions', page] as const,
  counts: ['archive', 'counts'] as const,
}
```

Invalidation matrix — every archive/restore/purge must hit both sides of the boundary:

| Mutation            | Invalidates                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- |
| archive note        | `['notes','list']`, `NOTES_KEYS.tags`, `NOTES_KEYS.linkTargets`, remove detail, `['archive']` |
| restore note        | same set                                                                                      |
| purge note          | `['archive']` only — the row was already absent from every live cache                         |
| archive transaction | `FINANCE_KEYS.aggregate`, `['finance','transactions']`, `['archive']`                         |
| restore transaction | same set                                                                                      |
| purge transaction   | `['archive']` only                                                                            |

## UI / UX Notes

### Sidebar

A fifth item is appended to `navItems` in `AppSidebar.tsx`: `{ to: '/archive', label: 'Archive', icon: Archive }` (lucide `Archive`). No count badge in the sidebar — it would need a query on every page load to render a number nobody is waiting for.

### `/archive`

```
┌───────────────────────────────────────────────────────────────────┐
│ Archive                                                           │
│ Deleted items are kept for 30 days, then permanently removed.     │
│                                                                   │
│ [ Second Brain (3) ] [ Finance (12) ]                             │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Title            Tags        Deleted      Expires             │ │
│ ├───────────────────────────────────────────────────────────────┤ │
│ │ Q3 planning      work, ops   2 days ago   in 28 days  [↺] [🗑] │ │
│ │ Grocery list     —           29 d ago     tomorrow    [↺] [🗑] │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                       Rows per page 25  ‹ 1/1 ›    │
└───────────────────────────────────────────────────────────────────┘
```

- Both tabs are `DataTable` (`tableId: 'archive.notes'` / `'archive.transactions'`), server-paginated at 25/page, sticky header off, resizing off, density control off. The archive is for scanning and acting, not for configuring.
- The active tab is a URL search param (`?tab=notes|transactions`, default `notes`, `stripSearchParams`'d like every other filter in the app) so a reload or a Back keeps its place.
- Tab labels carry live counts from `ARCHIVE_KEYS.counts` (two `head: true, count: 'exact'` requests).
- **Expires** is derived client-side from `deleted_at` — `in 28 days` / `tomorrow` / `today`. It floors at "today"; a row never shows a negative or zero-day expiry (see Edge Cases).
- Row actions are icon buttons with `aria-label`s: `RotateCcw` → Restore, `Trash2` → Delete permanently (`text-destructive`).
- Restore is **not** confirmed — it is non-destructive and self-evidently reversible. It fires immediately and toasts `Note restored` with no undo.
- Empty state per tab: "Nothing in the archive." / "No archived transactions."
- The Finance tab shows the same amount formatting and category badge as the live table (`+`/`−`, `text-money-in`/`text-money-out`), so a row is recognizable as the one that was deleted.

### Confirmation copy

A new `src/components/confirm-dialog.tsx` — `AlertDialog`-based, same shape as `discard-changes-dialog.tsx`:

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Move to Archive?"
  description={`“${label}” will be moved to the Archive and permanently deleted after 30 days.`}
  confirmLabel="Move to Archive"
  cancelLabel="Cancel"
  onConfirm={handleArchive}
/>
```

| Action                      | Title               | Confirm button     | Variant     |
| --------------------------- | ------------------- | ------------------ | ----------- |
| Archive a note              | Move to Archive?    | Move to Archive    | default     |
| Archive a transaction       | Move to Archive?    | Move to Archive    | default     |
| Permanently delete (either) | Delete permanently? | Delete permanently | destructive |

The permanent-delete description is explicit about finality and names the item: `“Q3 planning” will be permanently deleted. This cannot be undone.`

`note-editor.tsx`'s existing inline `Dialog` (lines 407-425) is replaced by `ConfirmDialog`, and its "will be permanently deleted" copy — currently true, about to be false — is corrected.

### Undo toast

Both archive actions toast with an action:

```ts
toast.success('Transaction archived', {
  action: { label: 'Undo', onClick: () => restore.mutate(id) },
})
```

For notes, Undo also re-selects the restored note so the editor returns to where the user was.

### Transactions table

`RowActions` (`transactions-table.tsx:63`) gains local `confirmOpen` state; the trash button opens `ConfirmDialog` instead of mutating. The button label changes from "Delete transaction" to "Archive transaction". The `disabled={mutation.isPending}` guard stays.

## Edge Cases

- **An archived note is still in the URL** (`/notes?note=<id>` from a bookmark, or the user archives from another tab). The detail query now filters archived rows, so Supabase returns `PGRST116` (no rows). `NotesPage` treats that specific error as "gone": clears `selectedId`, falls back to the first live note, and toasts `That note is in the Archive.` It must **not** render an empty editor over a stale draft.
- **Archiving the currently-open note.** The existing next-selection logic in `handleDelete` (`note-editor.tsx:228-245`) is reused verbatim — the only change is which mutation it calls. `deletedRef` still suppresses the unmount flush so the archived note is not resurrected by a trailing save.
- **`[[wiki-links]]` pointing at an archived note.** The link-targets query excludes archived notes, so the link renders unresolved, exactly as it does for a note that never existed. Restoring re-resolves it. No rewriting of link marks in either direction — that would mutate documents the user did not edit.
- **A locked (`is_read_only`) note can still be archived.** The lock protects content from edits; it is not a lifecycle guard. The confirm dialog is the guard. (If this proves wrong in use, requiring an unlock first is a one-line change.)
- **Restoring a transaction whose category was deleted while it was archived.** Already handled: `reassign_transactions_on_category_delete` updates `finance_transactions` by `category_id` without filtering `deleted_at`, so archived rows are reassigned to "Other" alongside live ones and the `on delete restrict` FK stays satisfied. Verify this explicitly during implementation — it is load-bearing.
- **Restoring a note whose tags were renamed while archived.** It returns with the current tag names, because `rename_note_tag` operates on archived rows too (decision 5).
- **Expiry display vs. actual purge time.** The label is computed client-side from `deleted_at`; the purge runs at 03:00 UTC. A row can sit at "today" for up to 24 hours before it disappears. `daysUntilPurge` clamps at 0 and the label floors at `today` — never "expired", never a negative number.
- **Archiving twice** (double-click, or two tabs). The `.is('deleted_at', null)` guard on the update means the second write matches zero rows, so the 30-day clock is set once and only once.
- **Purging a row that pg_cron already purged.** The DELETE matches nothing; the mutation succeeds and the list refetches. No error toast for a zero-row purge.
- **`pg_cron` unavailable** (local reset, self-hosted). The migration raises a notice and applies cleanly. `purge_expired_archives()` still exists and can be run by hand; the app is fully functional, just without automatic expiry.
- **Empty archive.** Both tabs show their empty state; the tab counts read `(0)`. The sidebar entry stays visible — an archive that hides itself when empty is an archive users forget exists.
- **Pagination past the end.** Purging the last row of page 3 leaves the table on an empty page; the archive tables clamp `pageIndex` down when `pageCount` shrinks, matching the transactions table's existing filter-change reset.

## Implementation Notes

Rough order — database first, then the filters that hide archived rows, then the surfaces that show them.

1. `supabase/migrations/20260815000001_add_deleted_at_soft_delete.sql` — columns, indexes, and the `get_note_tags()` replacement (with the comment explaining why `rename_note_tag`/`delete_note_tag` are deliberately untouched).
2. `supabase/migrations/20260815000002_purge_expired_archives.sql` — `purge_expired_archives()` + `revoke`.
3. `supabase/migrations/20260815000003_schedule_purge_expired_archives.sql` — guarded `pg_cron` schedule.
4. `src/utils/archive.ts` — `ARCHIVE_RETENTION_DAYS`, `daysUntilPurge(deletedAt, now?)`, `formatExpiryLabel(deletedAt, now?)`. Pure, injectable clock for tests.
5. `src/components/confirm-dialog.tsx` — shared `AlertDialog` confirm with `confirmVariant?: 'default' | 'destructive'`.
6. `src/routes/_authenticated/notes/-types/notes-api.ts`, `finance/-types/finance-api.ts` — `deleted_at`, `ArchivedNoteRow`.
7. `notes/-utils/notes-queries.ts` — `liveOnly()` on the three live reads; rename delete → `useArchiveNoteMutation`; add `useRestoreNoteMutation`, `usePurgeNoteMutation`, `useArchivedNotesQuery`; extend the invalidation helper to cover `['archive']`.
8. `finance/-utils/finance-queries.ts` — same treatment: `liveOnly()` on the aggregate and paginated reads, `useArchiveTransactionMutation` / `useRestoreTransactionMutation` / `usePurgeTransactionMutation` / `useArchivedTransactionsQuery`, and `invalidateAll` extended with `['archive']`.
9. `finance/-components/transactions-table.tsx` — `RowActions` gets `ConfirmDialog` + undo toast; `aria-label` becomes "Archive transaction".
10. `notes/-components/note-editor.tsx` — swap the inline `Dialog` for `ConfirmDialog`, correct the copy, add the undo toast that also re-selects.
11. `src/routes/_authenticated/archive/-utils/archive-search.ts` — `tab` search param schema + defaults + `useArchiveTab()`.
12. `src/routes/_authenticated/archive/-types/archive.ts` — `ArchivedNote`, `ArchivedTransaction`, `ArchivePageParams`.
13. `src/routes/_authenticated/archive/-components/archive-notes-table.tsx`, `archive-transactions-table.tsx`, `archive-row-actions.tsx`.
14. `src/routes/_authenticated/archive/index.tsx` — route, `validateSearch`, loader prefetching the active tab, tabs + counts.
15. `src/components/AppSidebar.tsx` — the `Archive` nav item.
16. `CHANGELOG.md` — add an `## [Unreleased]` section (the file currently starts at `## [0.0.3]`) with `Added` and `Changed` entries.
17. `docs/second-brain.md`, `docs/finance.md` — update the delete-behavior sections; add `docs/archive.md` describing the route, the retention policy, and the purge function.

## Test Plan

**Unit tests** (`src/utils/__tests__/archive.test.ts`):

- [x] `daysUntilPurge` returns 30 for a just-archived row, 1 for one archived 29 days ago, 0 for one archived 30+ days ago (never negative)
- [x] `formatExpiryLabel` renders `in 28 days` / `tomorrow` / `today` at the corresponding boundaries
- [x] Both are stable across a DST boundary (fixed injected clock, not `Date.now()`)

**Unit tests** (`notes/-utils/__test__/notes-queries.test.ts`, `finance/-utils/__test__/finance-queries.test.ts` — both files exist):

- [ ] Every live-read query builder applies `is('deleted_at', null)` — asserted against a mock query builder, one case per read site, so a future added query without the filter fails a test
- [ ] The archive mutation builders apply their guards: archive → `.is('deleted_at', null)`, restore/purge → `.not('deleted_at','is',null)`
- [ ] Archive and restore invalidate both the feature's live keys and `['archive']`; purge invalidates only `['archive']`

  **Gap confirmed 2026-08-15:** none of these three exist. Both test files only cover
  pre-archive helpers (`buildNotesListQueryParams`, `buildEmptyNote`, `useUpdateNoteContentMutation`,
  `buildCityFilter`). The `liveOnly()` filter and the archive/restore/purge guards are real in the
  source (verified by direct read) but are only exercised indirectly, through component tests that
  mock the hooks entirely — so a future regression that drops `.is('deleted_at', null)` from a read
  site would not fail any test today.

**Component tests:**

- [x] `src/components/__test__/confirm-dialog.test.tsx` — renders title/description, `onConfirm` fires only on confirm, cancel closes without calling it ~~, destructive variant applies destructive styling~~

  **Gap confirmed 2026-08-15:** `confirmVariant` (`'default' | 'destructive'`) is implemented and
  wired to `AlertDialogAction`, but no test asserts the destructive case renders destructive styling.

- [x] `finance/-components/__test__/transactions-table.test.tsx` — clicking the trash icon opens the dialog and does **not** mutate; confirming calls the archive mutation once; cancelling calls nothing
- [x] `notes/-components/__test__/note-editor.test.tsx` — the confirm dialog calls the archive mutation (not a hard delete) and advances selection to the next note
- [x] `archive/-components/__test__/archive-notes-table.test.tsx` — renders the expiry label, Restore fires without a dialog, Delete permanently requires confirmation

  (Moved to `notes/-components/__test__/archived-notes-table.test.tsx` by spec 023 — same assertions, new path.)

- [x] Empty archive renders the empty state, not a blank table — verified for the notes side (`archived-notes-table.test.tsx`). **No equivalent test file exists for `archived-transactions-table.tsx`** (none did before the 023 move either) — the finance archive table's empty state is untested.

**Manual verification** (requires a live Supabase instance / browser — not run by the assistant; confirm and check off each as you verify it):

- [ ] Delete a transaction → dialog appears → confirm → row leaves the table, stat cards and charts drop its amount, toast offers Undo → Undo restores it into the same filtered view
- [ ] Delete a note → it leaves the list, its tag chip disappears if it was that tag's only live note, `[[link]]`s to it stop resolving → restore from `/archive` brings all three back
- [ ] `/archive` tab counts match the rows listed; reload keeps the active tab
- [ ] Permanently delete from the archive → confirm dialog names the item → row is gone from the archive and does not reappear on reload
- [ ] Open a bookmarked `/notes?note=<archived-id>` → falls back to the first live note with the "in the Archive" toast, no empty editor
- [ ] `select public.purge_expired_archives();` against a row with a back-dated `deleted_at` removes exactly that row and returns the counts
- [ ] `select jobname, schedule from cron.job;` shows `purge-expired-archives` at `0 3 * * *`
- [ ] `supabase db reset` applies all three migrations cleanly, and applies cleanly a second time (idempotent scheduling)

## Open Questions

- [ ] Should the archive tables show **who/where** an item was archived from (e.g. the drilldown sheet vs. the main table)? Currently no provenance is recorded. Decide before implementation — it is a column on the migration, expensive to add later. _Recommendation: no; `deleted_at` is enough._
- [ ] Should `/archive` be reachable from the feature pages too (a small "View archive" link near each delete affordance), or is the sidebar entry sufficient discovery? _Recommendation: sidebar only for v1; revisit if items get archived and forgotten._
- [ ] 03:00 UTC is 10:00 in UTC+7. Fine for a purge job, but confirm there is no preferred window.

## Amendments

Implementation complete (2026-08-15) with two structural deviations from Implementation Notes,
both simplifications rather than scope changes:

- **No `archive/-types/archive.ts`.** `ArchivedNote` and `ArchivedTransaction` live in
  `notes/-types/notes-query.ts` and `finance/-types/finance-query.ts` instead, each defined as the
  feature's existing domain type (`NoteSummary` / `Transaction`) extended with `deletedAt: string`.
  This keeps `-types/` one-way-dependent per `docs/architecture/feature-slices.md` (the archive
  route depends on notes/finance types, never the reverse) without introducing a third file for
  two one-line type aliases.
- **Tab counts are separate hooks**, not folded into the paginated list query:
  `useArchivedNotesCountQuery()` / `useArchivedTransactionsCountQuery()` issue their own
  `head: true, count: 'exact'` request, matching the "two lightweight requests" described under UI
  / UX Notes.

Everything else — schema, `liveOnly()` filtering, the archive/restore/purge mutation shapes and
guards, the shared `ConfirmDialog`, the Undo toast, the `PGRST116` fallback in `NotesPage`, the
`get_note_tags()` exclusion with `rename_note_tag`/`delete_note_tag` left untouched, and the guarded
`pg_cron` schedule — matches the design as specced.

**Not yet done by the assistant, left for the user:** running `bun --bun run test` (unit/component
tests were written per the Test Plan but not executed), running `supabase db reset` against a real
instance to apply the three new migrations, and the Manual Verification checklist above. Check off
the boxes above as each is confirmed, and flip `status` to `done` once verification is complete —
see `docs/architecture/spec-workflow.md`.

**Verification pass (2026-08-15):** ran `bun --bun run test` (50 files / 359 tests, all pass) and
`tsc --noEmit` (pre-existing errors only, all in files outside this spec's scope — none introduced
here). Read every file the Design Decisions and Implementation Notes name to confirm the Amendments'
claims against the actual code, not just the prose: the three migrations, `liveOnly()`, the
archive/restore/purge guards, the invalidation calls, `finance-search.ts`'s widened `view` enum, the
Finance tab-gating logic, the notes sheet/trigger, the sidebar entry, `CHANGELOG.md`, and
`docs/archive.md` all match what the spec and its Amendments describe. Two real gaps found and
recorded inline above: the `liveOnly()`/guard/invalidation unit tests specced for
`notes-queries.test.ts` / `finance-queries.test.ts` were never written, and the destructive-variant
styling case in `confirm-dialog.test.tsx` is untested. Everything under Manual Verification still
needs a human with a browser and a live Supabase instance — not run here.
