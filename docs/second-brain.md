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
- Persist notes per-user in Supabase Postgres, with autosave so typing never blocks on a save.
- Support organization through search, tags, and list excerpts — resolved server-side so the whole
  library never has to load into the browser at once.
- Provide a writing flow similar to Notion: type Markdown shortcuts, use `/` for blocks, link notes with `[[`.

## Current UX at `/notes`

- **Left pane**: search, tag chips, scrollable note list (with lock icon on read-only notes).
- **Right pane**: inline title, read-only badge when locked, lock/unlock + delete actions, Tiptap body editor.
- **Empty state**: CTA to create the first note when the library is empty.
- **Delete flow**: confirmation dialog + Sonner toast (`Note deleted`).

## Source of truth

### Route and layout

- Route entry: `src/routes/_authenticated/notes/index.tsx`
- List pane: `src/routes/_authenticated/notes/-components/note-list.tsx`
- List row: `src/routes/_authenticated/notes/-components/note-list-item.tsx`
- Editor shell: `src/routes/_authenticated/notes/-components/note-editor.tsx`
- Empty state: `src/routes/_authenticated/notes/-components/notes-empty-state.tsx`

### Store and utilities

- Notes store: `src/stores/notes-store.ts`
- List/search helpers: `src/routes/_authenticated/notes/-utils/notes-utils.ts`
- Tiptap extension wiring: `src/routes/_authenticated/notes/-utils/tiptap-extensions.ts`
- JSON seed/content helpers: `src/routes/_authenticated/notes/-utils/tiptap-content.ts`
- Table commands: `src/routes/_authenticated/notes/-utils/table-utils.ts`

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

- Full-height split container (`h-[calc(100dvh-3.5rem)]`) below the shared top bar.
- Left pane: fixed width (`w-80`), scrollable.
- Right pane: flexible; hosts `NoteEditor` + `TiptapEditor`.
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
- `useCreateNoteMutation()`, `useUpdateNoteContentMutation()` (debounced autosave, see below),
  `useUpdateNoteMetaMutation()` (tags/favorite/lock, immediate), `useDeleteNoteMutation()`,
  `useRenameTagMutation()` / `useDeleteTagMutation()` (`rename_note_tag`/`delete_note_tag` RPCs).

`NoteEditor` holds a local draft (`title`, `content`), debounces it 800ms, and flushes on note
switch, unmount, and tab hide/close — see the spec's Autosave section for the full design.

## Search, tags, and sorting

Search, tag filtering (AND/OR/untagged), favorites, and sorting are all resolved server-side by
`useNotesListQuery` — the client never filters a local array. Helpers:

- `buildNotesTsQuery(search)` (`notes-search.ts`) — builds the Postgres full-text prefix query fed
  to `.textSearch('search_vector', ...)`.
- `canonicalizeTag(raw, knownTags)` (`notes-utils.ts`) — snaps a newly typed tag to an existing
  tag's casing.
- `getExcerpt(plainText)` — truncates plain text for list rows (the server already computes
  `excerpt`; this is only used where a fresh plain-text string is on hand).
- `formatRelativeTime(iso)` — "Last edited X ago" in the editor header.

Tag chips (`useNoteTagsQuery`) and tag rename/delete (`TagManagerDialog`) are fully editable from
the UI.

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

Each note can be locked manually from the editor header (lock icon).

When `isReadOnly` is true:

- Title input is `readOnly`
- Tiptap `editable` is false; content updates are not saved
- Slash menu, bubble menus, table context menu, and code language menu are not mounted
- List shows a lock icon; header shows a "Read-only" badge
- Toggle again to unlock; state persists in `localStorage`

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
