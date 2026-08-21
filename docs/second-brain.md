# Second Brain Module

The Second Brain module is the notes experience at `/notes`. It provides a two-pane workspace with a searchable note list on the left and a **Notion-style WYSIWYG editor** on the right, powered by [Tiptap](https://tiptap.dev).

## Refactor summary

The notes editor was refactored from a Markdown textarea + preview toggle to a single **Tiptap JSON document editor**:

| Before                        | After                                                  |
| ----------------------------- | ------------------------------------------------------ |
| `body: string` (raw Markdown) | `content: JSONContent` (ProseMirror/Tiptap JSON)       |
| Edit / preview split          | Live WYSIWYG formatting                                |
| No block commands             | Slash command palette (`/`)                            |
| No rich tables                | Notion-like tables (grid picker, resize, context menu) |
| Always editable               | Per-note **read-only lock**                            |

Related architecture: `docs/architecture/feature-slices.md`.

## Goals

- Capture ideas and long-form notes in one place with inline formatting.
- Persist notes per-user in Supabase Postgres, saved explicitly (no autosave) so a note is never
  written until the user actually means to save it.
- Support organization through search, tags, and list excerpts — resolved server-side so the whole
  library never has to load into the browser at once.
- Provide a writing flow similar to Notion: type Markdown shortcuts, use `/` for blocks, link notes with `[[`.

## Current UX at `/notes`

Layout is fixed-height chrome around scrolling content — see
[`docs/specs/025-notes-workspace-layout.md`](specs/025-notes-workspace-layout.md) for the full
rationale and [`docs/specs/024-notes-table-of-contents.md`](specs/024-notes-table-of-contents.md)
for the outline.

- **Left pane**: one search/filter/new-note row, an optional active-filter summary row, the
  scrollable note list (with lock icon on read-only notes, tags as one line of `#tag` text, no
  per-row border), and a fixed footer (Archive, Manage tags). Tag filtering, match mode
  (`Any`/`All`), favourites-only, untagged-only, and sort all live in the `NotesFilterPopover`
  behind the search bar's filter trigger, which shows a count badge — the full tag vocabulary
  never renders inline. Selected/hovered rows use the sidebar surface tokens
  (`--sidebar-active`/`--sidebar-accent`), not a brand-colored wash.
- **Right pane**: a fixed one-row header (back button on mobile, the note title once it scrolls
  out of view, a read-only badge, favourite, and an overflow menu for Undo/Redo/Lock/Archive);
  title, byline, and Tiptap body share a `max-w-[44rem]` centered column. The byline
  (`note-byline.tsx`) is the note's metadata line — edited time, word count, save status, and the
  note's own tags as `#tag` text with a `＋` picker to edit them. Clicking a tag on the byline adds
  it to the list's active filter without leaving the note.
- **Mobile outline**: below `md`, the table-of-contents trigger is a floating action button
  (bottom-right, matching `TaskAddFab`'s geometry) rather than a header icon — see
  [`024`](specs/024-notes-table-of-contents.md#the-mobile-trigger-is-a-floating-action-button-not-a-header-icon).
  It lifts from `bottom-6` to `bottom-24` while the unsaved-changes bar is visible.
- **Empty state**: CTA to create the first note when the library is empty.
- **Delete flow**: soft delete, not destructive. Confirmation dialog ("Move to Archive?") sets
  `deleted_at`, advances selection to the next note, and shows a toast (`Note archived`) with an
  **Undo** action. Archived notes are hidden from every live query (list, detail, tag counts,
  `[[` link targets) and are recoverable from `/archive` for 30 days — see
  [`docs/archive.md`](archive.md).

## Source of truth

### Route and layout

- Route entry: `src/routes/_authenticated/notes/index.tsx`
- List pane: `src/routes/_authenticated/notes/-components/note-list.tsx`
- List row: `src/routes/_authenticated/notes/-components/note-list-item.tsx`
- Filter popover: `src/routes/_authenticated/notes/-components/notes-filter-popover.tsx`
- Shared tag picker (list filter + note byline): `src/routes/_authenticated/notes/-components/tag-picker.tsx`
- Editor shell: `src/routes/_authenticated/notes/-components/note-editor.tsx`
- Note metadata line (tags, edited time, word count, save status): `src/routes/_authenticated/notes/-components/note-byline.tsx`
- Table of contents rail/FAB: `src/routes/_authenticated/notes/-components/note-outline.tsx`
- Save-state bar: `src/components/unsaved-changes-bar.tsx`
- Empty state: `src/routes/_authenticated/notes/-components/notes-empty-state.tsx`

### Store and utilities

- Notes store: `src/stores/notes-store.ts`
- List/search helpers: `src/routes/_authenticated/notes/-utils/notes-utils.ts`
- Tiptap extension wiring: `src/routes/_authenticated/notes/-utils/tiptap-extensions.ts`
- JSON seed/content helpers: `src/routes/_authenticated/notes/-utils/tiptap-content.ts`
- Table commands: `src/routes/_authenticated/notes/-utils/table-utils.ts`
- Data types: `src/routes/_authenticated/notes/-types/` — see [Data Types](#data-types)

### Editor components

- Core editor: `src/routes/_authenticated/notes/-components/tiptap-editor.tsx`
- Text selection bubble menu: `src/routes/_authenticated/notes/-components/bubble-menu.tsx`
- Slash commands: `src/routes/_authenticated/notes/-components/slash-command-extension.ts`, `slash-command-menu.tsx`, `suggestion-menu.tsx`
- Note links (`[[`): `src/routes/_authenticated/notes/-components/note-link-extension.ts`, `note-link-menu.tsx`
- Code block header: `code-block-view.tsx`, `code-block-language-selector.tsx`, `code-block-copy-button.tsx`, `code-block-extension.ts`
- Custom callout block: `src/routes/_authenticated/notes/-components/callout-extension.ts`

### Table UI

- Grid picker (slash `/table`): `src/routes/_authenticated/notes/-components/table-grid-picker.tsx`
- Table bubble menu: `src/routes/_authenticated/notes/-components/table-bubble-menu.tsx`
- Table context menu: `src/routes/_authenticated/notes/-components/table-context-menu.tsx`

### App-wide

- Toasts: `src/components/ui/sonner.tsx` mounted in `src/routes/__root.tsx`
- Editor/table styles: `src/styles.css` (`.note-tiptap`, `.notion-table`, `.selectedCell`, resize handles)

## Route and layout

`createFileRoute('/_authenticated/notes/')` is defined in `src/routes/_authenticated/notes/index.tsx`, with a `loader` that prefetches the first list page and tags.

- Full-height split container (`h-[calc(100svh-var(--topbar-height))]`, small viewport height so
  mobile Safari's chrome-hiding scroll doesn't resize the panes) below the shared top bar.
- Left pane: fixed width (`w-80`), scrollable.
- Right pane: flexible; hosts `NoteEditor` + `TiptapEditor`, both capped at `max-w-[44rem]` and
  centered for a readable prose measure.
- If there are no notes, the route renders `NotesEmptyState`.

## Data model

Notes are persisted per-user in the `public.notes` Supabase table (see
[`docs/specs/015-notes-supabase-integration.md`](specs/015-notes-supabase-integration.md) for the
full migration). Client-side types in `src/stores/notes-store.ts`:

```ts
/** List-pane row — everything except the body. */
interface NoteSummary {
  id: string
  title: string
  excerpt: string // server-generated: left(plain_text, 200)
  tags: string[]
  isFavorite: boolean
  isReadOnly: boolean // manual lock; disables editing when true
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp — bumped only when title/content change
}

/** A fully loaded note. */
interface Note extends NoteSummary {
  content: JSONContent // Tiptap document JSON (not Markdown, not HTML)
}
```

The list pane only ever fetches `NoteSummary` rows (paginated); `content` loads on demand for the
selected note via `useNoteQuery`. New accounts start with zero rows — there is no demo seeding.

## Data Types

`src/routes/_authenticated/notes/-types/` holds types that cross module boundaries within the slice ([`docs/specs/019-core-feature-types-folders.md`](specs/019-core-feature-types-folders.md)):

- `notes-api.ts` — `NoteRow`, the snake_case Supabase response row mirroring the `notes` table exactly (including `plain_text`/`search_vector`, which the app never reads directly), and `NoteSummaryRow`, a `Pick` of the columns the list/link-target queries select. `transformNote`/`transformNoteSummary` in `-utils/notes-queries.ts` map these onto the camelCase `Note`/`NoteSummary` domain types above. Like the finance row types, this is a compile-time assertion (a typo'd field now fails `tsc`), not a runtime validation of what Postgres actually returns.
- `notes-query.ts` — `NotesListParams` (the list query's cache key), `NotesTagFilter`/`NotesOrder`/`NotesListQueryDescriptor` (query-building), `NotesListPage`, `NoteTagCount`.
- `notes-table.ts` — `TableAlign`, shared between the table bubble menu and context menu.

Component `Props`, Tiptap extension `Options` types, and the route-search schema types (`TagFilterMode`, `NotesSortBy`, `NotesSearch` in `notes-route-search.ts`) stay put — see "What goes in `-types/`" in [`docs/architecture/feature-slices.md`](architecture/feature-slices.md).

## State and persistence

`useNotesStore` (Zustand + `persist`) now holds UI-only state; note data lives in Supabase and is
accessed through TanStack Query hooks in
`src/routes/_authenticated/notes/-utils/notes-queries.ts`.

- Storage key: `myspace-notes`, persist version: `5`
- Persisted slice: `sortBy`, `favoritesOnly`, `tagFilterMode` only
- In-memory, not persisted: `selectedId`, `searchQuery`, `activeTags`, `untaggedOnly`, and
  `linkTargets` (the whole-library `id`/`title`/`tags` list that feeds the `[[` menu, synced from
  `useNoteLinkTargetsQuery`)

### Query hooks (`notes-queries.ts`)

- `useNotesListQuery(params)` — paginated (`useInfiniteQuery`), server-side search/tag/favorite
  filtering and sorting.
- `useNoteQuery(id)` — the selected note's full content.
- `useNoteTagsQuery()` — tag chips + counts via the `get_note_tags()` RPC.
- `useNoteLinkTargetsQuery()` — whole-library targets for the `[[` menu.
- `useCreateNoteMutation()`, `useUpdateNoteContentMutation()` (explicit save, see below),
  `useUpdateNoteMetaMutation()` (tags/favorite/lock, immediate), `useArchiveNoteMutation()`
  (soft delete), `useRestoreNoteMutation()`, `usePurgeNoteMutation()` (hard delete, archive-only —
  see [`docs/archive.md`](archive.md)),
  `useRenameTagMutation()` / `useDeleteTagMutation()` (`rename_note_tag`/`delete_note_tag` RPCs).

`NoteEditor` holds a local draft (`title`, `content`) and a last-saved snapshot, both seeded from
the editor's own post-init JSON so ProseMirror's parse-time attribute normalization is never
mistaken for an edit. There is no autosave — a save fires only when the user leaves the editor pane
(blur, note switch, route change, unmount), presses `Ctrl`/`Cmd`+`S`, or clicks **Save** on the
floating "Unsaved changes" bar that appears at the bottom-center of the pane while the draft is
dirty. Reloading or closing the tab with unsaved changes triggers the browser's native confirmation
via `useBeforeUnloadGuard`. See
[`docs/specs/017-notes-editor-explicit-save.md`](specs/017-notes-editor-explicit-save.md) for the
full design.

## Search, tags, and sorting

Search, tag filtering (`AND`/`OR` internally — shown to the user as `All`/`Any` — plus untagged),
favorites, and sorting are all resolved server-side by `useNotesListQuery` — the client never
filters a local array. Every one of those controls lives in `NotesFilterPopover`
(`-components/notes-filter-popover.tsx`), reachable from the search bar's filter trigger, which
carries a count badge for the number of active filters. Helpers:

- `buildNotesTsQuery(search)` (`notes-search.ts`) — builds the Postgres full-text prefix query fed
  to `.textSearch('search_vector', ...)`.
- `canonicalizeTag(raw, knownTags)` (`notes-utils.ts`) — snaps a newly typed tag to an existing
  tag's casing.
- `getExcerpt(plainText)` — truncates plain text for list rows (the server already computes
  `excerpt`; this is only used where a fresh plain-text string is on hand).
- `countWords(plainText)` (`notes-utils.ts`) — word count shown in the note byline.
- `formatTimeAgo(iso)` (`#/utils/date`) — the complete "Edited 2h ago" / "Edited just now" phrase
  used in the byline; `formatTimeSince(iso)` returns the bare duration used in list rows.

`TagPicker` (`-components/tag-picker.tsx`) is the one searchable, scrollable, count-annotated tag
list backing both `NotesFilterPopover` (`allowCreate={false}`) and the note byline's `＋` tag editor
(`allowCreate`), so filtering and tagging a note go through the same component. Tag rename/delete
stays in `TagManagerDialog`, reachable from the list pane's footer.

## Editor architecture (Tiptap)

`TiptapEditor` (`tiptap-editor.tsx`) mounts:

- `useEditor` with `createEditorExtensions()` from `tiptap-extensions.ts`
- `EditorContent` with `note-tiptap prose` classes
- `EditorBubbleMenu` — text selection only (hidden inside tables and in read-only mode)
- `TableBubbleMenu` — when cursor is in a table
- Persistent code block language header on each block (not a floating menu)
- `TableContextMenu` — right-click inside table cells

### Extension stack

Configured in `createContentExtensions()` / `createEditorExtensions()`:

| Extension                    | Role                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| StarterKit                   | Headings, lists, bold/italic, blockquote, HR, etc. (`codeBlock` and `link` disabled — replaced below) |
| NoteCodeBlock (lowlight)     | Syntax-highlighted code blocks with persistent language header                                        |
| TaskList + TaskItem          | Todo checklists (`- [ ]`)                                                                             |
| Highlight                    | Multicolor text highlight                                                                             |
| Link                         | External and internal note links                                                                      |
| Typography                   | Markdown-like input rules (smart quotes, etc.)                                                        |
| Callout                      | Custom `callout` block node                                                                           |
| Table + TableRow/Header/Cell | Tables with column resize and cell selection                                                          |
| Image                        | URL or file upload (base64)                                                                           |
| Placeholder                  | "Type / for commands…"                                                                                |
| SlashCommandExtension        | `/` command palette                                                                                   |
| NoteLinkExtension            | `[[` note typeahead                                                                                   |

### Markdown-style input rules (WYSIWYG)

Typing these patterns transforms content inline (no preview mode):

- `#` / `##` / `###` + space → headings
- `**text**`, `*text*`, `~~text~~`, `` `code` ``
- ` ``` ` → code block
- `- ` / `1. ` → lists; `- [ ]` → todo
- `> ` → blockquote; `---` → divider

### Slash command menu (`/`)

Opens a fuzzy-filtered palette (arrow keys + Enter). Inserts blocks such as:

- Text, Heading 1–3, bullet/ordered/todo lists
- Code block, blockquote, divider
- Image (URL or upload), table (grid picker), callout
- Link to another note, external link

Table command opens a **6×6 hover grid** (Notion-style) or custom row/column count via prompt.

### Text bubble menu

On non-empty text selection (not in code blocks or tables):

- Bold, italic, strikethrough, inline code, link, highlight colors

### Code blocks

Each code block renders with a **persistent header bar** above the code (always visible):

- **Left:** Shadcn `Select` for language (Plain text, JavaScript, TypeScript, Python, Bash, CSS, HTML, JSON).
- **Right:** Copy button that copies plain code text (no markdown fence) to the clipboard with Sonner toast feedback.

- Language is stored on the `codeBlock` node (`language` attribute) and applied via `NoteCodeBlock` (lowlight).
- Syntax tokens are colorized per language using highlight.js classes (`.hljs-*`) styled in `src/styles.css` for light and dark themes.
- Plain text clears the language attribute so content is not auto-highlighted.
- In read-only mode, the header remains visible; language select is disabled but copy still works.

## Table system

Tables aim for a **simple Notion-like** experience.

| Feature         | Implementation                                                     |
| --------------- | ------------------------------------------------------------------ |
| Insert          | `/table` → grid picker (1–6 × 1–6) or custom size                  |
| Header row      | Default `withHeaderRow: true` on insert                            |
| Column resize   | `Table.configure({ resizable: true, lastColumnResizable: false })` |
| Cell formatting | Full inline marks in cells (bold, links, highlight, etc.)          |
| Multi-select    | Tiptap table selection + `.selectedCell` styling                   |
| Bubble menu     | Row/column add/delete, merge, split, column align, delete table    |
| Context menu    | Right-click: row/column/cell/table sections                        |
| Row reorder     | Planned follow-up (not enabled in current stabilization pass)      |

Table helpers live in `table-utils.ts` (`insertTableAtRange`, `setColumnAlignment`, `moveTableRow`).

Styling in `src/styles.css`: fixed layout, `min-width: 80px`, header row background, `selectedCell`, `column-resize-handle`.

## Read-only mode

Each note can be locked manually from the editor header's overflow menu (`Lock note` / `Unlock note`).

When `isReadOnly` is true:

- Title input is `readOnly`
- Tiptap `editable` is false; content updates are not saved
- Slash menu, bubble menus, table context menu, and code language menu are not mounted
- List shows a lock icon; header shows a "Read-only" badge
- The byline's `＋` tag-editing trigger is hidden; tags still render as plain `#tag` text and are
  still clickable to filter the list
- Toggle again to unlock; state persists in the database (`isReadOnly` on the note row)

Use this when a note is finished and should be read without accidental edits.

## Navigation integration

Sidebar entry in `src/components/AppSidebar.tsx`:

- Label: `Second Brain`
- Route: `/notes`

## Dependencies (editor)

Tiptap packages (see `package.json`): `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table` (+ row/cell/header), `@tiptap/extension-task-list`, `@tiptap/extension-highlight`, `@tiptap/extension-link`, `@tiptap/extension-code-block-lowlight`, `@tiptap/extension-placeholder`, `@tiptap/extension-typography`, `@tiptap/extension-image`, `@tiptap/suggestion`, `lowlight`.

UI: `sonner` via Shadcn `Toaster` in the root layout.

## Future improvements

- Automated tests for slash commands, table menus, and read-only guards (`src/routes/_authenticated/notes/-components/__test__/`).
- Optional export/import of notes (JSON or Markdown).
- Wiring up `?note=<id>` deep links from `[[` note-link clicks.
- Tab key navigation between table cells and auto-append row on last cell (Notion-style).
