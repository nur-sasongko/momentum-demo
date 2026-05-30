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
- Keep interaction fast with local-first persistence.
- Support organization through search, tags, and list excerpts.
- Provide a writing flow similar to Notion: type Markdown shortcuts, use `/` for blocks, link notes with `[[`.

## Current UX at `/notes`

- **Left pane**: search, tag chips, scrollable note list (with lock icon on read-only notes).
- **Right pane**: inline title, read-only badge when locked, lock/unlock + delete actions, Tiptap body editor.
- **Empty state**: CTA to create the first note when the library is empty.
- **Delete flow**: confirmation dialog + Sonner toast (`Note deleted`).

## Source of truth

### Route and layout

- Route entry: `src/routes/notes/index.tsx`
- List pane: `src/routes/notes/-components/note-list.tsx`
- List row: `src/routes/notes/-components/note-list-item.tsx`
- Editor shell: `src/routes/notes/-components/note-editor.tsx`
- Empty state: `src/routes/notes/-components/notes-empty-state.tsx`

### Store and utilities

- Notes store: `src/stores/notes-store.ts`
- List/search helpers: `src/routes/notes/-utils/notes-utils.ts`
- Tiptap extension wiring: `src/routes/notes/-utils/tiptap-extensions.ts`
- JSON seed/content helpers: `src/routes/notes/-utils/tiptap-content.ts`
- Table commands: `src/routes/notes/-utils/table-utils.ts`

### Editor components

- Core editor: `src/routes/notes/-components/tiptap-editor.tsx`
- Text selection bubble menu: `src/routes/notes/-components/bubble-menu.tsx`
- Slash commands: `src/routes/notes/-components/slash-command-extension.ts`, `slash-command-menu.tsx`, `suggestion-menu.tsx`
- Note links (`[[`): `src/routes/notes/-components/note-link-extension.ts`, `note-link-menu.tsx`
- Code block languages: `src/routes/notes/-components/code-block-language-menu.tsx`
- Custom callout block: `src/routes/notes/-components/callout-extension.ts`

### Table UI

- Grid picker (slash `/table`): `src/routes/notes/-components/table-grid-picker.tsx`
- Table bubble menu: `src/routes/notes/-components/table-bubble-menu.tsx`
- Table context menu: `src/routes/notes/-components/table-context-menu.tsx`

### App-wide

- Toasts: `src/components/ui/sonner.tsx` mounted in `src/routes/__root.tsx`
- Editor/table styles: `src/styles.css` (`.note-tiptap`, `.notion-table`, `.selectedCell`, resize handles)

## Route and layout

`createFileRoute('/notes/')` is defined in `src/routes/notes/index.tsx`.

- Full-height split container (`h-[calc(100dvh-3.5rem)]`) below the shared top bar.
- Left pane: fixed width (`w-80`), scrollable.
- Right pane: flexible; hosts `NoteEditor` + `TiptapEditor`.
- If there are no notes, the route renders `NotesEmptyState`.

## Data model

`Note` in `src/stores/notes-store.ts`:

```ts
interface Note {
  id: string
  title: string
  content: JSONContent // Tiptap document JSON (not Markdown, not HTML)
  tags: string[]
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  isFavorite: boolean
  isReadOnly: boolean // manual lock; disables editing when true
}
```

Seed notes are built with `buildSeedContent()` in `tiptap-content.ts` so demo data is valid Tiptap JSON.

## State and persistence

State is managed by Zustand with `persist` middleware (`useNotesStore`).

- Storage key: `myspace-notes`
- Persist version: `3` (adds `isReadOnly` normalization on older payloads)
- Persisted slice: `notes` only (`partialize`)
- In-memory UI state (not persisted): `selectedId`, `searchQuery`, `activeTag`

### Store actions

- `addNote()` — new note with empty doc (`paragraph`), selects it.
- `updateNote(id, patch)` — updates `title`, `content`, `tags`, `isFavorite`, `isReadOnly`; bumps `updatedAt`.
- `deleteNote(id)` — removes note and selects a neighbor.
- `selectNote(id)` — sets active note.
- `setSearch(query)` / `setActiveTag(tag | null)` — list filters.

Content changes flow from `TiptapEditor` `onUpdate` → `updateNote(id, { content })` → persist middleware → `localStorage`.

## Search, tags, and sorting

Logic in `src/routes/notes/-utils/notes-utils.ts`:

- `getAllTags(notes)` — unique sorted tags for filter chips.
- `filterNotes(notes, query, tag)` — matches `title`, plain text from `content` (via `generateText` + content extensions), and `tags`; sorts by `updatedAt` desc.
- `getExcerpt(content)` — plain-text excerpt for list rows.
- `formatRelativeTime(iso)` — "Last edited X ago" in the editor header.

Tag chips filter the list; tag editing in the editor UI is still read-only (first tag shown as label).

## Editor architecture (Tiptap)

`TiptapEditor` (`tiptap-editor.tsx`) mounts:

- `useEditor` with `createEditorExtensions()` from `tiptap-extensions.ts`
- `EditorContent` with `note-tiptap prose` classes
- `EditorBubbleMenu` — text selection only (hidden inside tables and in read-only mode)
- `TableBubbleMenu` — when cursor is in a table
- `CodeBlockLanguageMenu` — when cursor is in a code block
- `TableContextMenu` — right-click inside table cells

### Extension stack

Configured in `createContentExtensions()` / `createEditorExtensions()`:

| Extension                    | Role                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| StarterKit                   | Headings, lists, bold/italic, blockquote, HR, etc. (`codeBlock` and `link` disabled — replaced below) |
| CodeBlockLowlight            | Syntax-highlighted code blocks                                                                        |
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

When the cursor is inside a code block, a floating menu offers language presets (JavaScript, TypeScript, Python, etc.).

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

- Tag editing UI in the editor (tags exist on the model but are not editable in the UI).
- Favorites filter/sort using `isFavorite`.
- Automated tests for slash commands, table menus, and read-only guards (`src/routes/notes/-components/__test__/`).
- Optional export/import of notes (JSON or Markdown).
- Server sync / multi-device persistence (currently local-first only).
- Tab key navigation between table cells and auto-append row on last cell (Notion-style).
