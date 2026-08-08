---
id: 15
title: 'Notes Supabase Integration'
status: draft
feature: notes
created: 2026-08-04
updated: 2026-08-04
---

# Notes Supabase Integration

## Problem Statement

The Second Brain module keeps every note in `localStorage` under the `myspace-notes` key. A user's
notes are trapped in one browser profile on one device: clearing site data destroys them, a second
device shows a different library, and two authenticated users sharing a browser see each other's
notes. Eight demo notes are seeded into every profile, so a real library always starts polluted.
Search, tag filtering, and sorting all run over the entire in-memory array, so the whole corpus —
including every note's full Tiptap JSON body — must be loaded before the list can render.

## Goals

- Persist notes per-user in Supabase Postgres with RLS isolation, matching the pattern established by
  [`finance-supabase-integration.md`](./finance-supabase-integration.md) and
  [`tasks-management.md`](./tasks-management.md).
- Remove all note _data_ from `localStorage`; only UI preferences stay client-persisted.
- Move search, tag filtering, favorites filtering, and sorting to the server, with the list pane
  paginated (infinite scroll) instead of rendering the whole library.
- Load note bodies (`content jsonb`) on demand for the selected note only, never for the whole list.
- Keep the writing experience unchanged: autosave with no explicit Save button, instant tag/favorite/
  lock toggles, `[[` note links, slash commands, tables.
- Ship a migration so the schema applies to any Supabase project.

## Non-Goals

- **Offline support.** No write queue, no service-worker mutation replay. The editor requires a
  connection; failed saves surface a toast and retry on the next keystroke flush.
- **Realtime / multi-device live sync.** No Supabase Realtime subscription. Concurrent edits to the
  same note from two tabs are last-write-wins.
- **Migrating existing `localStorage` notes.** Fresh start — Supabase is the source of truth from the
  first load (decided below; same call as spec 5 for finance).
- **Per-user seed content.** New accounts start empty.
- **Note version history / trash / soft delete.** Delete stays permanent.
- **Attachments / image upload to Storage.** The `Image` extension keeps taking URLs.
- **Sharing notes between users.** RLS is strictly owner-only.
- **Wiring up `?note=<id>` deep links.** `[[` links already insert `href="/notes?note=<id>"` and the
  route already ignores that param — a pre-existing gap. The by-id content query added here removes
  the technical blocker, but the navigation work is deliberately deferred to its own spec.
- **Full-text search ranking / highlighting.** Matching only; no `ts_rank` ordering or snippet
  highlighting.

## Acceptance Criteria

- [ ] Given a brand-new authenticated user, when they open `/notes`, then `NotesEmptyState` renders
      ("Your second brain is empty") and no rows have been written on their behalf.
- [ ] Given the empty state, when the user clicks "Create your first note", then a note row is
      inserted in Supabase, it is selected, and the editor is focusable immediately (no wait for the
      insert to round-trip).
- [ ] Given a selected note, when the user types in the title or body, then the change is persisted
      to Supabase within ~1s of the last keystroke, and the header shows a "Saving…" → "Saved"
      indicator.
- [ ] Given unsaved keystrokes in the editor, when the user selects a different note or navigates
      away from `/notes`, then the pending save is flushed before the editor unmounts (no lost
      characters).
- [ ] Given a note with unsaved keystrokes, when the save request fails, then an error toast appears,
      the local draft is retained, and the next flush retries.
- [ ] Given a library of more than one page of notes, when the user scrolls the list pane to the
      bottom, then the next page is fetched and appended (infinite scroll), and skeleton rows show
      while it loads.
- [ ] Given a search term, when the debounce elapses, then the list shows only notes whose title,
      body text, or tags match — resolved by Postgres full-text search, not by filtering a local
      array.
- [ ] Given two or more active tag chips in `OR` mode, then notes carrying **any** selected tag are
      listed; in `AND` mode, only notes carrying **all** of them.
- [ ] Given the "Untagged" chip is active, then only notes with an empty tag array are listed.
- [ ] Given the favorites toggle is active, then only favorited notes are listed, and the filter
      composes with search and tag filters.
- [ ] Given each sort option (Last updated, Recently created, Title A–Z, Title Z–A), then the list is
      ordered by the server, and the ordering is stable across page boundaries.
- [ ] Given the tag chips row and the Tag Manager, then the tag list and per-tag note counts come
      from a single aggregate query over the user's whole library — not from the notes currently
      paginated into view.
- [ ] Given the Tag Manager, when a tag is renamed, then every note carrying it is updated in one
      atomic server call, the chip row reflects the new name, and any active filter on the old name
      follows the rename.
- [ ] Given the Tag Manager, when a tag is deleted, then it is removed from every note that carried
      it and disappears from the chip row; the notes themselves survive.
- [ ] Given a note, when the user toggles favorite or the read-only lock, or edits its tags, then the
      change persists immediately and the note's `updatedAt` is **not** bumped (preserving today's
      "last edited" semantics).
- [ ] Given a read-only note, then the server rejects nothing extra — the lock stays a client-side
      affordance — but title/body/tag edits are unreachable in the UI, exactly as today.
- [ ] Given a note is deleted, then its row is removed from Supabase, the neighbouring note becomes
      selected (or the empty state renders if it was the last one), and a "Note deleted" toast shows.
- [ ] Given the `[[` note-link menu, then its candidate list covers the user's entire library, not
      just the notes fetched into the current list page.
- [ ] Given two different authenticated users, then each sees only their own notes and tags (RLS
      enforced).
- [ ] Given a page reload, then notes, tags, and note bodies are re-fetched from Supabase, and
      `localStorage` holds no note content — only UI preferences.

## Data Model Changes

### New Supabase table: `public.notes`

| Column          | Type          | Notes                                                             |
| --------------- | ------------- | ----------------------------------------------------------------- |
| `id`            | `uuid` PK     | `default gen_random_uuid()`, but the client supplies it on insert |
| `user_id`       | `uuid`        | `references auth.users(id) on delete cascade`                     |
| `title`         | `text`        | `not null default ''`                                             |
| `content`       | `jsonb`       | `not null`, Tiptap/ProseMirror document                           |
| `plain_text`    | `text`        | `not null default ''`, whitespace-collapsed body text (see below) |
| `excerpt`       | `text`        | generated stored: `left(plain_text, 200)`                         |
| `search_vector` | `tsvector`    | generated stored over `title` + `plain_text` + `tags`             |
| `tags`          | `text[]`      | `not null default '{}'`                                           |
| `is_favorite`   | `boolean`     | `not null default false`                                          |
| `is_read_only`  | `boolean`     | `not null default false`                                          |
| `created_at`    | `timestamptz` | `not null default now()`                                          |
| `updated_at`    | `timestamptz` | `not null default now()`, bumped by trigger (see below)           |

**Why `tags text[]` and not a normalized `note_tags` + junction table:** tags here are freeform
strings typed inline in `TagInput`, with no per-tag metadata (no color, no ordering) — unlike finance
categories, which are first-class records. `text[]` + a GIN index expresses every filter this feature
needs (`&&` for OR, `@>` for AND, `= '{}'` for untagged) with zero joins and leaves `Note.tags:
string[]` unchanged, so `TagInput`, `NoteListItem`, and the editor header keep working. Cross-note
rename/delete — the one thing a junction table would make trivial — is handled by two RPCs.

**Why `plain_text` is client-written:** the client already derives it (`noteContentToPlainText`, used
today for excerpts), and reimplementing Tiptap's text extraction as an `IMMUTABLE` plpgsql walk over
`content` would duplicate editor semantics in SQL. Every content write sends `plain_text` alongside
`content`, collapsed to single spaces and trimmed. A drift between the two only degrades search and
excerpt quality; it can never lose note data, and is repairable by a one-off backfill.

**Why `updated_at` is conditional:** the current store only bumps `updatedAt` when `title` or
`content` changes — tag edits, favoriting, and locking preserve it. The trigger mirrors that:

```sql
new.updated_at = case
  when new.title is distinct from old.title
    or new.content is distinct from old.content then now()
  else old.updated_at
end;
```

**Indexes:** `(user_id, updated_at desc)`, `(user_id, created_at desc)`, `(user_id, title)`,
`(user_id, is_favorite) where is_favorite`, GIN on `tags`, GIN on `search_vector`.

**RLS:** `for all using (auth.uid() = user_id)` plus
`grant select, insert, update, delete on public.notes to authenticated` — same shape as
`finance_transactions` and the `20260705000004_fix_tasks_rls_permissions` grants.

### New RPCs (all `security invoker`, so RLS applies)

- `get_note_tags()` → `table(tag text, note_count bigint)` — `unnest(tags)` grouped by `lower(tag)`,
  returning `min(tag)` as the display casing. One row per case-insensitive tag across the whole
  library, ordered alphabetically.
- `rename_note_tag(old_tag text, new_tag text)` — one `update` replacing the matching element
  (case-insensitive) in `tags`, de-duplicating within each row. Atomic across all notes.
- `delete_note_tag(target_tag text)` — one `update` removing the matching element (case-insensitive)
  from every row's `tags`.

### Client types (`src/stores/notes-store.ts`)

```ts
/** List-pane row — everything except the body. */
export interface NoteSummary {
  id: string
  title: string
  excerpt: string // server-generated from plain_text
  tags: string[]
  isFavorite: boolean
  isReadOnly: boolean
  createdAt: string
  updatedAt: string
}

/** A fully loaded note. */
export interface Note extends NoteSummary {
  content: JSONContent
}
```

### Store rewrite

`useNotesStore` stops owning note data and becomes UI state plus one synced cache slice:

- **Kept:** `selectedId`, `searchQuery`, `activeTags`, `tagFilterMode`, `untaggedOnly`,
  `favoritesOnly`, `sortBy` and their setters.
- **Added:** `linkTargets: NoteSummary[]` + `setLinkTargets` — the whole-library `id`/`title`/`tags`
  list that feeds the `[[` menu, synced from its query. Mirrors how `finance-queries` syncs
  `categories` into `useFinanceStore`.
- **Removed:** `notes`, `addNote`, `updateNote`, `deleteNote`, `toggleFavorite`, `renameTag`,
  `deleteTag`, `SEED_NOTES`, `normalizeNote`, `daysAgo`. Every mutation moves to `notes-queries.ts`.
- **Persistence:** `partialize` narrows to `{ sortBy, favoritesOnly, tagFilterMode }`. Version bumps
  `4 → 5`; `migrate` drops the persisted `notes` array (and `selectedId`) for every earlier version,
  so the old `myspace-notes` payload is discarded rather than imported.

## UI / UX Notes

The layout, chips, sort select, and split-pane behavior are unchanged. What changes is where the data
comes from and three new pieces of feedback:

```
┌─ Second Brain ───────────┐┌─ Editor ──────────────────────────────────┐
│ [Search notes...      ]  ││ #Work #Ideas          [↶][↷][★][🔒][🗑]  │
│ (All)(Untagged)(Work)... ││                                           │
│ [OR|AND] [★] [Sort ▾][⚙] ││  My note title                            │
├──────────────────────────┤│  Last edited 3 minutes ago · Saved        │← new
│ ▸ Q3 Planning      2d    ││  ─────────────────────────────────────    │
│   Goals: ship habits…    ││  Body (Tiptap)                            │
│ ▸ Ideas backlog    4d    ││                                           │
│   Things to explore…     ││                                           │
│ ░░░░░░░░ (skeleton)      │← infinite-scroll sentinel                  │
└──────────────────────────┘└───────────────────────────────────────────┘
```

- **Save indicator** — in `NoteEditor`, appended to the "Last edited …" line: `Saving…` while a
  mutation is in flight, `Saved` for ~2s after it settles, nothing at rest. Failures use a toast, not
  this indicator.
- **Infinite scroll** — an `IntersectionObserver` sentinel at the bottom of the list pane triggers
  `fetchNextPage()`. `PAGE_SIZE = 30`. The existing `NoteListItemSkeleton` renders while a page (or a
  filter change) is loading; the current "is the user mid-typing in search" skeleton behavior folds
  into the query's `isFetching`.
- **Editor loading** — selecting a note whose body isn't cached shows a short skeleton in the body
  area while the by-id query resolves; the title/tags header renders immediately from the summary
  already in the list cache.
- **Tag chips** — sourced from `get_note_tags()`, so the row is stable regardless of how far the user
  has scrolled. The Tag Manager's counts come from the same call instead of counting a local array.
- **Excerpts** — `NoteListItem` renders `note.excerpt` (server-generated) instead of calling
  `getExcerpt(note.content)`; it no longer needs the body at all.

### Autosave

Autosave is the load-bearing change, since every keystroke used to be a synchronous store write.

1. `NoteEditor` holds the working draft in local state (`title`, `content`), seeded from the fetched
   note and re-seeded when `note.id` changes.
2. `useDebouncedValue(draft, 800)` drives an effect that fires `useUpdateNoteContentMutation` when the
   debounced draft differs from the last-saved snapshot (kept in a ref).
3. The mutation sends `title`, `content`, and the recomputed `plain_text`.
4. On success it **patches** the note's summary in the cached list pages via `setQueryData` (title,
   excerpt, `updatedAt`) rather than invalidating — invalidating every 800ms would refetch and
   reshuffle the list under the user's cursor while typing.
5. A pending save is flushed on note switch, on unmount, and on `pagehide` /
   `visibilitychange → hidden`.
6. Tags, favorite, lock, create, and delete are **not** debounced — they fire immediately and
   invalidate the list + tags queries (tag edits change the chip row).

### Queries (`src/routes/_authenticated/notes/-utils/notes-queries.ts`)

Following `finance-queries.ts`: a `NOTES_KEYS` factory, row→client transformers, then hooks.

| Hook                             | Purpose                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `useNotesListQuery(params)`      | `useInfiniteQuery` over summary columns (no `content`); applies all server filters |
| `useNoteQuery(id)`               | Single note **with** `content`; `enabled: !!id`, long `staleTime`                  |
| `useNoteTagsQuery()`             | `rpc('get_note_tags')` → chips + Tag Manager counts                                |
| `useNoteLinkTargetsQuery()`      | `id, title, tags` for the whole library; syncs `linkTargets` into the store        |
| `useCreateNoteMutation()`        | Client-generated `crypto.randomUUID()` id, optimistic insert, selects the new note |
| `useUpdateNoteContentMutation()` | Debounced title/content/plain_text writes; cache patch on success                  |
| `useUpdateNoteMetaMutation()`    | Tags / favorite / read-only; immediate                                             |
| `useDeleteNoteMutation()`        | Delete + next-selection resolution                                                 |
| `useRenameTagMutation()`         | `rpc('rename_note_tag')`                                                           |
| `useDeleteTagMutation()`         | `rpc('delete_note_tag')`                                                           |

`useNotesListQuery` params (sorted before use — this is a cache key):
`{ search, activeTags, tagFilterMode, untaggedOnly, favoritesOnly, sortBy }`. Mapping to PostgREST:

- `search` → `.textSearch('search_vector', buildNotesTsQuery(search))`
- `activeTags` + `OR` → `.overlaps('tags', activeTags)`; `AND` → `.contains('tags', activeTags)`
- `untaggedOnly` → `.filter('tags', 'eq', '{}')`
- `favoritesOnly` → `.eq('is_favorite', true)`
- `sortBy` → `.order('updated_at' | 'created_at' | 'title', { ascending })`, each with a
  `.order('id')` tiebreaker so page boundaries can't drop or duplicate a row
- pagination → `.range(page * PAGE_SIZE, …)`

**Why ids are client-generated:** `[[` links embed the target's id in the inserted href
(`/notes?note=<id>`), and the editor mounts against `note.id` immediately on create. Generating the
UUID client-side means there is never a temporary id that later has to be swapped — no rewriting of
hrefs, no editor remount.

## Edge Cases

- **Empty library** — `NotesEmptyState`; no seeding, so this is what every new account sees.
- **Empty filter result** — existing "No notes match your filters." message; distinguished from
  "still loading" by the query's `isFetching`/`isPending`, not by array length.
- **Persistence boundary** — a reload keeps `sortBy`, `favoritesOnly`, and `tagFilterMode` from
  `localStorage`; search text, active tags, untagged toggle, and selection reset. Notes and tags are
  always re-fetched.
- **Search semantics change** — Postgres FTS matches whole words with a trailing prefix wildcard
  (`buildNotesTsQuery` splits on whitespace, escapes each term, appends `:*`, joins with `&`),
  whereas the old client filter matched any substring. So `brain` still finds "Second Brain" but `rai`
  no longer does. Accepted: this is the cost of not shipping every note body to the browser.
- **Tag casing** — `overlaps`/`contains` on `text[]` are case-sensitive, but today's filtering is
  case-insensitive. Two defenses: (a) `canonicalizeTag(raw, knownTags)` snaps a newly typed tag to an
  existing tag's casing when they match case-insensitively, so stored values stay canonical;
  (b) `get_note_tags()` groups by `lower(tag)`, so pre-existing mixed casing still renders one chip.
- **Title sorting with an empty title** — the client used to substitute `'Untitled'` when comparing.
  Server-side, `''` sorts first in A–Z. Only reachable if a user clears a title (create sets
  `'Untitled'`), so it is accepted rather than worked around with a generated sort column.
- **Typing reorders the list** — with "Last updated" sorting, a save bumps `updated_at`. The cache
  patch updates the row in place without re-sorting, so the list doesn't jump mid-sentence; the new
  order appears on the next natural refetch. Same visible behavior as today, minus the jitter.
- **Deleting the selected note** — next selection is resolved from the loaded pages (the neighbour at
  the deleted index, clamped), falling back to the first note, then to `null` → empty state.
- **Deleting a note that others link to** — `[[` links are plain link marks, so a dangling link stays
  as styled text pointing at a dead id. Unchanged from today; no rewriting is attempted.
- **Concurrent edits in two tabs** — last write wins, whole-field. On remount the server copy wins
  because the query is the source of truth; a tab that stays open with a stale draft will overwrite.
  Documented, not solved (Realtime is a non-goal).
- **Read-only note** — the lock remains a client affordance; RLS does not enforce it. Toggling the
  lock does not bump `updated_at`.
- **Offline / failed save** — toast, draft retained in component state, retried on the next flush.
  Closing the tab while offline loses that draft — a real regression against `localStorage`, and the
  explicit price of the "no offline queue" non-goal.
- **New-note guard** — `isNewNoteActive` (which disables the "+" button while an untouched new note
  is selected) now tests the selected **summary** (`title === 'Untitled' && excerpt === ''`) instead
  of running `isEmptyDoc` over a body the list no longer has.

## Implementation Notes

1. `supabase/migrations/20260804000001_create_notes.sql` — table, generated columns, indexes, RLS,
   grants, conditional `updated_at` trigger.
2. `supabase/migrations/20260804000002_create_notes_tag_functions.sql` — `get_note_tags`,
   `rename_note_tag`, `delete_note_tag`.
3. `src/stores/notes-store.ts` — rewrite per **Data Model Changes**; delete `SEED_NOTES`.
4. `src/routes/_authenticated/notes/-utils/notes-search.ts` (new) — `buildNotesTsQuery`, mirroring
   `finance-search.ts`.
5. `src/routes/_authenticated/notes/-utils/notes-queries.ts` (new) — all hooks in the table above.
6. `src/routes/_authenticated/notes/-utils/notes-utils.ts` — drop `filterNotes` and `getAllTags`
   (both now server-side); change `getExcerpt` to take plain text instead of `JSONContent`; add
   `canonicalizeTag`; keep `formatRelativeTime`, `isEmptyDoc`, `normalizeTag`,
   `addTagsCaseInsensitive`, `noteContentToPlainText` (now also used to build `plain_text`).
7. `src/routes/_authenticated/notes/index.tsx` — add a `loader` that `ensureQueryData`s the first
   list page + tags; resolve the selected note via `useNoteQuery`; keep the mobile list/editor swap.
8. `src/routes/_authenticated/notes/-components/note-list.tsx` — infinite-scroll sentinel, filters
   read from the store but applied by the query, tag chips from `useNoteTagsQuery`.
9. `src/routes/_authenticated/notes/-components/note-list-item.tsx` — take `NoteSummary`, render
   `note.excerpt`.
10. `src/routes/_authenticated/notes/-components/note-editor.tsx` — local draft + debounced autosave +
    flush-on-switch/unmount/`pagehide`, save indicator, meta mutations for tags/favorite/lock, delete
    mutation.
11. `src/routes/_authenticated/notes/-components/tiptap-editor.tsx` — `getNotes` closure reads
    `useNotesStore.getState().linkTargets` instead of `.notes`.
12. `src/routes/_authenticated/notes/-components/tag-input.tsx` — suggestions from
    `useNoteTagsQuery`; apply `canonicalizeTag` on commit.
13. `src/routes/_authenticated/notes/-components/tag-manager-dialog.tsx` — counts from
    `useNoteTagsQuery`, rename/delete via the RPC mutations.
14. `src/routes/_authenticated/notes/-components/notes-empty-state.tsx` — call
    `useCreateNoteMutation`.
15. `src/routes/_authenticated/notes/-utils/tiptap-extensions.ts` — `NoteLinkExtensionOptions.getNotes`
    typed as `() => NoteSummary[]`.
16. `docs/second-brain.md` — replace the "local-first persistence" and store sections; fix the stale
    `src/routes/notes/*` paths while there (they are all `src/routes/_authenticated/notes/*` now).

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/`):

- [ ] `buildNotesTsQuery` — single term gets `:*`; multiple terms join with `&`; quotes/backslashes/
      `&`/`|`/`!`/`:` are escaped; empty or whitespace-only input returns `null` (no filter applied)
- [ ] `canonicalizeTag` — returns the existing tag's casing on a case-insensitive match; returns the
      normalized input when there's no match
- [ ] `getExcerpt` — truncates at the max length with an ellipsis; returns `''` for empty plain text
- [ ] `notes-utils.test.ts` — remove the `filterNotes`/`getAllTags` suites, keep and extend the rest
- [ ] `notes-queries` filter mapping — `OR` mode produces `overlaps`, `AND` produces `contains`,
      `untaggedOnly` produces `tags eq '{}'`, and each `sortBy` maps to the right column/direction
      with the `id` tiebreaker (a pure `buildNotesListQueryParams`-style helper, testable without a
      Supabase client — see `finance-queries.test.ts` for the shape)

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [ ] `<NoteListItem>` renders `excerpt`, the lock and star icons, and tag chips from a `NoteSummary`
- [ ] `<NoteEditor>` debounces: several rapid title keystrokes produce exactly one content mutation
- [ ] `<NoteEditor>` flushes a pending save when `note.id` changes and on unmount
- [ ] `<NoteEditor>` toggling favorite calls the meta mutation, not the content mutation
- [ ] `<TagManagerDialog>` renders counts from the tags query and calls the rename/delete mutations
- [ ] `<NoteList>` shows skeletons while fetching and "No notes match your filters." on an empty
      settled result

**Manual verification:**

- [ ] New user → `/notes` shows the empty state; `notes` table has zero rows for them
- [ ] Create a note, type a paragraph, wait 1s → row in Supabase has the title, `content`, and
      `plain_text`; indicator went "Saving…" → "Saved"
- [ ] Type continuously for ~10s → a handful of writes, not one per keystroke (check the network tab)
- [ ] Type, then immediately click another note → the last characters are persisted
- [ ] Type, then immediately close the tab → reopen and confirm the text survived
- [ ] Add tags, favorite, and lock a note → all persist on reload; "Last edited" did **not** change
- [ ] Search a word from the middle of a note body → the note is listed
- [ ] Two tags in `OR` → union; switch to `AND` → intersection; "Untagged" → only tagless notes
- [ ] Each sort option orders correctly, and stays correct after scrolling past page 1
- [ ] With 40+ notes, scroll the list to the bottom → page 2 appends without duplicates or gaps
- [ ] Rename a tag used by several notes → all update; the active filter follows the rename
- [ ] Delete a tag → gone from all notes and from the chip row; the notes remain
- [ ] `[[` in the editor → the menu offers notes from beyond the first page
- [ ] Delete the selected note → neighbour selected, toast shown; delete the last one → empty state
- [ ] Reload → everything re-fetched; DevTools → Application → Local Storage shows only UI prefs
      under `myspace-notes` (no `notes` array)
- [ ] Log in as a second user → sees only their own notes and tags
- [ ] Go offline, type → error toast; go back online, type again → save succeeds

## Open Questions

- [x] Existing `localStorage` notes → **fresh start**, discard (decided 2026-08-04). Matches the call
      made for finance in spec 5; the `persist` `migrate` at version 5 drops the old array.
- [x] New-user seeding → **none**; the empty state is the first experience (decided 2026-08-04).
      `SEED_NOTES` is deleted rather than moved server-side.
- [x] List loading → **paginated + server-side search** with a denormalized `plain_text`/`tsvector`
      (decided 2026-08-04), rather than fetching every note body and filtering in the browser.
- [x] Tag storage → **`text[]` + GIN + two RPCs**, not a normalized junction table (rationale under
      Data Model Changes).
- [ ] Autosave debounce of 800ms — confirm during implementation that it feels right in the editor;
      adjust in one place (`NoteEditor`) if not.
