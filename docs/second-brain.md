# Second Brain Module

The Second Brain module is the notes experience at `/notes`. It provides a two-pane workspace with a searchable note list on the left and a Markdown editor/preview on the right.

## Goals

- Capture quick ideas and longer notes in one place.
- Keep interaction fast with local-first persistence.
- Support basic organization through search and tags.
- Provide a clean writing flow with optional Markdown preview.

## Source of Truth

- Route entry: `src/routes/notes/index.tsx`
- Notes store: `src/stores/notes-store.ts`
- Notes utilities: `src/routes/notes/-utils/notes-utils.ts`
- List pane: `src/routes/notes/-components/note-list.tsx`
- List row: `src/routes/notes/-components/note-list-item.tsx`
- Editor pane: `src/routes/notes/-components/note-editor.tsx`
- Markdown preview: `src/routes/notes/-components/markdown-preview.tsx`
- Empty state: `src/routes/notes/-components/notes-empty-state.tsx`

## Route and Layout

`createFileRoute('/notes/')` is defined in `src/routes/notes/index.tsx`.

- The page uses a full-height split container (`h-[calc(100dvh-3.5rem)]`) to account for the shared top bar.
- Left pane is fixed-width (`w-80`) and scrollable.
- Right pane is flexible and hosts the editor/preview.
- If there are no notes, the route renders `NotesEmptyState`.

## Data Model

`Note` in `src/stores/notes-store.ts`:

- `id: string`
- `title: string`
- `body: string` (Markdown text)
- `tags: string[]`
- `createdAt: string` (ISO timestamp)
- `updatedAt: string` (ISO timestamp)

The module includes `SEED_NOTES` so the page has meaningful starter content.

## State and Persistence

State is managed by Zustand with `persist` middleware (`useNotesStore`).

- Storage key: `myspace-notes`
- Version: `1`
- Persisted slice: `notes` only (`partialize`)
- Rehydrate behavior:
  - Re-seeds when persisted notes are empty
  - Ensures a selected note exists when notes are present

### Store Actions

- `addNote()` creates a new blank note (`Untitled`) and selects it.
- `updateNote(id, patch)` updates fields and refreshes `updatedAt`.
- `deleteNote(id)` removes the note and selects a neighboring fallback.
- `selectNote(id)` sets active note and exits preview mode.
- `setSearch(query)` updates search input state.
- `setActiveTag(tag | null)` sets chip-based filter state.
- `togglePreview()` switches between edit and preview.

Autosave is implicit: all updates flow through store actions and persist middleware writes to localStorage.

## Search, Tags, and Sorting

Search/filter logic is centralized in `src/routes/notes/-utils/notes-utils.ts`.

- `getAllTags(notes)` returns unique sorted tags for chips.
- `filterNotes(notes, query, tag)`:
  - Matches `title`, `body`, and `tags`
  - Applies active tag filter
  - Sorts by latest `updatedAt` first
- `getExcerpt(body)` strips markdown-ish tokens for list preview text.
- `formatRelativeTime(iso)` powers "Last edited X ago" labels.

## Editor and Markdown Preview

The editor pane (`note-editor.tsx`) includes:

- Inline title input
- Last-edited timestamp
- Preview toggle
- Delete action
- Markdown textarea (`Textarea` from shadcn)

Preview rendering uses:

- `react-markdown`
- `remark-gfm`
- Tailwind prose classes in `markdown-preview.tsx`

Typography plugin is enabled in `src/styles.css` via `@plugin "@tailwindcss/typography";`.

## UX States

- Empty module state: `NotesEmptyState` with CTA ("Create your first note")
- Empty search result state: "No notes match your search."
- Untagged note fallback in editor when `tags` is empty

## Navigation Integration

Sidebar entry is enabled in `src/components/AppSidebar.tsx`:

- Label: `Second Brain`
- Route: `/notes`
- Shared nav typing ensures only valid enabled routes are passed to `<Link to={...}>`

## Extending This Module

Recommended next steps:

- Add tag editing UI in the editor (currently tags come from seed/new data only).
- Add note pinning/favorites (new persisted field and sort rule).
- Add markdown shortcuts or slash commands for faster authoring.
- Add optional export/import for local backups.
