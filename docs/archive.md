# Archive Module

The Archive module is a soft-delete/recovery system for notes and finance transactions, at
`/archive`. Deleting either kind of item never destroys it immediately — it sets `deleted_at` and
disappears from every live view, then is either restored or permanently deleted, or auto-purged
after 30 days.

Built from [spec 022](specs/022-core-archive-soft-delete.md).

## Goals

- Make the delete button non-destructive everywhere it appears (notes, transactions).
- Give every archived item a single, recoverable home: `/archive`.
- Make permanent deletion a deliberate, separately-confirmed act — the only hard delete left in
  either feature.
- Auto-purge archived items after 30 days, enforced by Postgres so it happens whether or not the
  app is ever opened.

## Source of Truth

- Route entry: `src/routes/_authenticated/archive/index.tsx`
- Tab state (URL search param): `src/routes/_authenticated/archive/-utils/archive-search.ts`,
  `-utils/use-archive-tab.ts`
- Tables live in their own feature slice, not under `archive/` — see
  [spec 023](specs/023-core-in-feature-archive-views.md):
  `src/routes/_authenticated/notes/-components/archived-notes-table.tsx`,
  `src/routes/_authenticated/finance/-components/archived-transactions-table.tsx`
- Shared row actions: `src/components/archive-row-actions.tsx`
- Shared confirm dialog: `src/components/confirm-dialog.tsx`
- Retention constant + expiry formatting: `src/utils/archive.ts`
  (`ARCHIVE_RETENTION_DAYS`, `daysUntilPurge`, `formatExpiryLabel`)
- Notes archive queries/mutations: `src/routes/_authenticated/notes/-utils/notes-queries.ts`
  (`useArchivedNotesQuery`, `useArchivedNotesCountQuery`, `useArchiveNoteMutation`,
  `useRestoreNoteMutation`, `usePurgeNoteMutation`)
- Finance archive queries/mutations: `src/routes/_authenticated/finance/-utils/finance-queries.ts`
  (`useArchivedTransactionsQuery`, `useArchivedTransactionsCountQuery`,
  `useArchiveTransactionMutation`, `useRestoreTransactionMutation`, `usePurgeTransactionMutation`)
- Migrations: `supabase/migrations/20260815000001_add_deleted_at_soft_delete.sql`,
  `20260815000002_purge_expired_archives.sql`, `20260815000003_schedule_purge_expired_archives.sql`

## Data Model

Both `public.notes` and `public.finance_transactions` have a nullable `deleted_at timestamptz`.
`null` means live; a timestamp means archived (and is the source for the "Deleted"/"Expires"
columns in the UI). There is no separate archive table — restoring is a single
`update … set deleted_at = null`, and every foreign key (`finance_transactions.category_id`) stays
intact the entire time an item is archived.

Every live read in `notes-queries.ts`/`finance-queries.ts` filters through a `liveOnly()` helper
that appends `.is('deleted_at', null)`. The `get_note_tags()` RPC filters archived notes out of its
aggregate for the same reason; `rename_note_tag`/`delete_note_tag` deliberately do **not** — they
still operate on archived notes, so restoring one can't resurrect a tag name/value the user already
renamed or deleted away.

## Mutations

Three mutation shapes exist per feature, replacing the old single hard-delete mutation:

| Mutation              | What it does                                           | Guard                                                                                                        |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `useArchive*Mutation` | Sets `deleted_at = now()` — the delete button          | `.is('deleted_at', null)` — can't re-archive an already-archived row (keeps the 30-day clock from resetting) |
| `useRestore*Mutation` | Sets `deleted_at = null` — Restore action / Undo toast | `.not('deleted_at', 'is', null)`                                                                             |
| `usePurge*Mutation`   | Hard `DELETE` — only reachable from `/archive`         | `.not('deleted_at', 'is', null)` — can never match a live row                                                |

Archiving and restoring invalidate the feature's own live-query keys **and** the shared `['archive']`
root (so both `/archive` tabs refresh regardless of which feature's mutation fired); purging only
invalidates `['archive']`, since the row was already absent from every live cache.

## UI

`/archive` has two tabs — **Second Brain** and **Finance** — each a `DataTable` (server-paginated,
25/page) with a Title/Category+Amount column, a Tags column (notes only), a "Deleted" column
(relative time), an "Expires" column (`in N days` / `tomorrow` / `today`, derived client-side by
`formatExpiryLabel`), and row actions:

- **Restore** fires immediately — it's non-destructive and self-evidently reversible.
- **Delete permanently** always confirms via the shared `ConfirmDialog`, naming the item.

The active tab is a URL search param (`?tab=notes|transactions`, default `notes`), so a reload or
Back keeps its place. Tab labels carry live counts from a lightweight `head: true, count: 'exact'`
query per feature.

Both feature pages ask for confirmation before archiving (`ConfirmDialog`, "Move to Archive?"),
then toast with an **Undo** action that calls the restore mutation.

## Auto-purge

`public.purge_expired_archives()` is a `SECURITY DEFINER` Postgres function (not granted to
`authenticated` — the client never calls it) that hard-deletes any row with
`deleted_at < now() - interval '30 days'`, across all users. It's scheduled daily at 03:00 UTC via
`pg_cron`, guarded so the migration applies cleanly on a database without the extension (local
resets, self-hosted instances, CI) — in that case the function still exists and can be run by hand.

`ARCHIVE_RETENTION_DAYS` in `src/utils/archive.ts` is presentational only (drives the "Expires"
label); the Postgres function's own `interval '30 days'` is authoritative and must be kept in sync
by hand if the retention window ever changes.

## Edge Cases

- A bookmarked `/notes?note=<archived-id>` gets Supabase's `PGRST116` ("no rows") from the now-filtered
  detail query. `NotesPage` (`src/routes/_authenticated/notes/index.tsx`) treats that specific error
  code as "gone": it clears the selection, falls back to the first live note, and toasts
  `That note is in the Archive.`
- `[[wiki-links]]` to an archived note render unresolved (the link-targets query excludes archived
  rows) and re-resolve automatically on restore. No link-mark rewriting happens in either direction.
- Restoring a transaction whose category was deleted while it was archived still works — the
  category-delete trigger (`reassign_transactions_on_category_delete`) reassigns by `category_id`
  without filtering `deleted_at`, so archived rows get moved to "Other" alongside live ones.
