---
id: 28
title: 'Notion-Style Block Drag Handles in the Notes Editor'
status: done
feature: notes
created: 2026-09-10
updated: 2026-09-11
---

# Notion-Style Block Drag Handles in the Notes Editor

## Problem Statement

Reordering content inside a note is the one structural edit the Second Brain editor makes hard. Today a writer who wants to move a paragraph below a table, lift a callout above a heading, or pull a code block up two positions has three bad options: `Mod+Shift+↑/↓`, which only lifts a single textblock and does nothing useful for tables, callouts, images or code blocks; a native ProseMirror text drag, which has no handle, no visible drop indicator, and silently splits blocks when the selection does not line up with block boundaries; or cut-and-paste, which loses the block's identity and forces the writer to rebuild formatting. There is no way at all to move several adjacent blocks as a unit — a heading with the two paragraphs under it has to be moved three times, in the right order, and any mistake is a fresh round of cut-and-paste. Long notes are exactly where restructuring matters most and exactly where this is most painful.

## Goals

- Hovering a top-level block reveals a grip in the left gutter that drags that block to a new position, with a visible drop indicator showing where it will land.
- The grip works for every block the editor can produce: paragraph, all heading levels, bullet/ordered list, task list, blockquote, horizontal rule, image, table, callout, and the custom code block.
- Several adjacent top-level blocks can be selected and dragged together as one unit, landing in their original relative order.
- A drop produces exactly one undo step: a single `Mod+Z` returns the document to its pre-drag state.
- The whole affordance is inert in read-only notes — no grip, no drag, no drop targets.
- Drag/drop leaves the note dirty in the normal way, so the existing explicit-save bar picks it up (see [`017-notes-editor-explicit-save.md`](./017-notes-editor-explicit-save.md)).

## Non-Goals

- Not addressing drag between two different notes, or dragging content out of the editor into the note list.
- Not addressing nested/child-level dragging inside a list (moving `li` #3 above `li` #1 by grip); the first cut treats a list as one block. Nested list reordering is a follow-up.
- Not addressing table row/column drag reordering — that stays with the existing `table-context-menu.tsx` / `table-bubble-menu.tsx` commands.
- Not addressing a "+" insert button in the gutter or a block-actions menu (duplicate/delete/turn-into) hanging off the grip. The extension leaves room for both; this spec ships the grip only.
- Not addressing keyboard-driven block moves beyond what StarterKit already provides.
- Not addressing drag on the note title input.

## Acceptance Criteria

- [ ] Given an editable note, when the pointer hovers over any top-level block, then a grip button appears in the left gutter, vertically aligned to the first line of that block, and disappears when the pointer leaves both the block and the grip.
- [ ] Given the grip for a paragraph, when it is dragged to a position between two other blocks, then a drop indicator is shown at that position and, on release, the paragraph is moved there with its marks and attributes intact.
- [ ] Given a table, a callout, an image, or a code block, when its grip is dragged, then the entire node moves as one unit — no cell, no inner paragraph, and no code text is left behind or split.
- [ ] Given a code block with a selected language, when it is moved, then the language attribute and syntax highlighting survive the move.
- [ ] Given three adjacent blocks selected as a range, when the grip for that range is dragged to a new position, then all three land together in their original relative order.
- [ ] Given any completed drag (single or multi-block), when the user presses `Mod+Z` once, then the document returns exactly to its pre-drag state.
- [ ] Given a note in read-only mode, when the pointer hovers any block, then no grip appears and dragging text produces no block move.
- [ ] Given a drag in progress, when the pointer is released outside the editor or `Escape` is pressed mid-drag, then the document is unchanged and no drop indicator remains on screen.
- [ ] Given a completed drop, when the save bar is checked, then the note reads as dirty and an explicit save persists the new order.
- [ ] Given a viewport under `md`, when a note is open, then the editor's content column is not pushed off-center and no horizontal scrollbar appears because of the gutter.
- [ ] Given a block that is dragged and dropped back onto its own original position, then the document is unchanged and no undo step is pushed.

## Data Model Changes

None. Block order is already the order of nodes in the note's Tiptap JSON; moving a block changes `content` and nothing else. No new store field, no `persist` version bump.

**Store:** `src/stores/notes-store.ts` — unchanged.

## UI / UX Notes

The editor content column is centered at `max-w-[44rem]` inside the scroll area in `note-editor.tsx`. In practice `@tiptap/extension-drag-handle-react` portals the grip to `document.body` and positions it with `@floating-ui/dom` (`placement: 'left-start'`) rather than needing gutter padding carved out of the column — the text column never shifts because the grip isn't part of its layout at all. `flip()`/`shift()` middleware keep the grip inside the viewport instead of overflowing to the left on narrow screens, which is what the diagram below is really describing visually.

```
   ┌─ scroll container ────────────────────────────────────┐
   │        ┌── max-w-[44rem] ────────────────────┐        │
   │        │ ⠿ │ ## Weekly review                │        │
   │        │   │                                 │        │
   │        │ ⠿ │ Paragraph text that wraps over  │        │
   │        │   │ more than one line — the grip   │        │
   │        │   │ stays on the first line.        │        │
   │        │   │ ┌─────────┬─────────┐           │        │
   │        │ ⠿ │ │ table   │ cells   │           │        │
   │        │   │ └─────────┴─────────┘           │        │
   │        └─────────────────────────────────────┘        │
   └────────────────────────────────────────────────────────┘
        ▲
        └─ 1.75rem gutter, grip at opacity-0 → opacity-100 on hover
```

- **Grip.** `GripVertical` from `lucide-react` at `size-4`, `text-muted-foreground`, `hover:text-foreground`, on a rounded `hover:bg-muted` hit target of at least 24×24. `cursor-grab`, `cursor-grabbing` while dragging.
- **Drop indicator.** A 2px `bg-primary` rule spanning the content column at the insertion point. Use the extension's own indicator if it lands where we want; otherwise a decoration.
- **Dragged block.** Dimmed to `opacity-50` in place while the drag is live, so the source position stays legible.
- **Multi-select.** Selecting across blocks (mouse drag through them, or `Shift`-click) highlights the whole range with `bg-primary/10`; the grip then addresses the range, not the single block under the pointer.
- **Focus/keyboard.** The grip is a real `<button>` with `aria-label="Drag to reorder block"` and `tabIndex={-1}` — it is a pointer affordance and must not become a tab stop between every pair of paragraphs.
- **Bubble menus.** The grip must not fight `EditorBubbleMenu` / `TableBubbleMenu`; hide the grip while a bubble menu is open over the same block.

## Edge Cases

- **Empty state:** an empty note is a single empty paragraph. It gets a grip like any other block; dragging it anywhere is a no-op because there is nowhere else to go.
- **Persistence boundary:** nothing about the drag persists — only the resulting document, and only through the existing explicit save. Reloading mid-drag (or navigating away without saving) leaves the note at its last saved order.
- **Read-only notes:** the extension must be added conditionally or disabled via the `editable` state, and must re-arm correctly when the user unlocks a note without remounting the editor (`editor.setEditable` already runs on `isReadOnly` change in `tiptap-editor.tsx`).
- **Custom node views:** `NoteCodeBlock` (`code-block-extension.ts`) and `Callout` (`callout-extension.ts`) render node views. `@tiptap/extension-drag-handle` turned out not to need `draggable: true` on either schema — it drives the whole drag manually from the grip's own DOM element (`element.draggable = true`), computing the dragged range from `getSelectionRanges`/`getDragHandleRanges` and cloning the DOM for the drag image, rather than relying on native content-level drag. So both node views move as whole units with no schema change. The code block's copy button and language selector remain clickable since nothing about their DOM changed.
- **Tables:** table cells swallow pointer events and the column-resize plugin owns the cell edges. Verify the grip drags the whole `table` node and that resizing still works after a move.
- **Slash menu / suggestion popovers:** a drag started while `slash-command-menu` or `note-link-menu` is open should dismiss the menu first, not leave an orphaned popover.
- **Markdown serialization:** `tiptap-markdown` and the PDF exporter (`tiptap-to-pdf.ts`) both walk the document in order; a reorder must round-trip through both without special handling. Worth an explicit check rather than an assumption.
- **Touch:** long-press-to-drag on touch devices is best-effort in this cut. If it proves unreliable, the grip may be hidden below `md` and noted as a known limitation rather than shipped broken.
- **Very long blocks:** a block taller than the viewport must still show its grip at the top; dragging near the viewport edge should auto-scroll the container.

## Implementation Notes

1. `package.json` — add `@tiptap/extension-drag-handle-react` and `@tiptap/extension-node-range`, pinned to the same `^3.23.x` line as the rest of Tiptap. Both are open-source in Tiptap 3; confirm the exact package names and peer requirements against the installed version before writing code.
2. `src/routes/_authenticated/notes/-utils/tiptap-extensions.ts` — add `NodeRange` to `createEditorExtensions()` (not `createContentExtensions()`, which also feeds non-interactive consumers like the PDF exporter and markdown round-trip tests). Gate on an `isEditable` option if the extension is cheaper to omit than to disable.
3. `src/routes/_authenticated/notes/-components/block-drag-handle.tsx` — new component wrapping `DragHandle` with the grip button, the hover/opacity behavior, and the `aria-label`.
4. `src/routes/_authenticated/notes/-components/tiptap-editor.tsx` — render `<BlockDragHandle editor={editor} />` inside the existing `containerRef` wrapper, alongside the bubble menus and behind the same `!isReadOnly` guard.
5. `src/routes/_authenticated/notes/-components/code-block-extension.ts` and `-components/callout-extension.ts` — set `draggable: true` and wire the node views' drag-handle contract.
6. `src/styles.css` — gutter padding on `.note-tiptap`, drop-indicator and dragging-state styles, multi-block selection highlight. Keep every color a semantic token so light/dark both work (see [`020-core-design-system-refresh.md`](./020-core-design-system-refresh.md)).
7. `docs/notes.md` — update the current-state reference once the spec is done.
8. `CHANGELOG.md` — `feat(notes)` entry under `## [Unreleased]`.

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/`):

- [ ] `tiptap-extensions.test.ts` — `createEditorExtensions()` includes the node-range extension; `createContentExtensions()` does not.
- [ ] A document whose blocks have been reordered still serializes to markdown in the new order (extends the existing markdown round-trip tests).
- [ ] `tiptap-to-pdf.test.ts` — a reordered document produces PDF blocks in the new order.

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [ ] `TiptapEditor` renders the drag handle when `isReadOnly` is false and does not when it is true.
- [ ] The grip renders as a button with `aria-label="Drag to reorder block"` and is not a tab stop.
- [ ] Toggling `isReadOnly` from true to false on a mounted editor arms the handle without a remount.

Note: jsdom does not implement the HTML drag-and-drop data transfer that ProseMirror relies on, so the drop itself is not meaningfully unit-testable. Component tests cover mounting, gating and a11y; the actual move behavior is verified manually below.

**Manual verification:**

- [ ] Open a note with a mix of headings, paragraphs, a list, a table, a callout, an image and a code block; drag each one to a new position and confirm it lands whole.
- [ ] Move a code block with a language set; confirm the language and highlighting survive.
- [ ] Select three adjacent blocks and drag them together; confirm order is preserved.
- [ ] Press `Mod+Z` once after a multi-block drop; confirm one undo restores everything.
- [ ] Start a drag and press `Escape`; confirm nothing moved and no indicator is stuck on screen.
- [ ] Lock the note; confirm no grip appears. Unlock; confirm it comes back without a reload.
- [ ] Reorder, save, reload; confirm the new order persisted.
- [ ] Reorder, then export to PDF; confirm the PDF matches the on-screen order.
- [ ] Narrow the window to phone width; confirm the content column stays centered and nothing scrolls horizontally.
- [ ] Check light and dark themes for grip, drop indicator and selection highlight contrast.

## Open Questions

- [ ] Touch devices: hide the grip below `md`, or ship long-press-to-drag and accept it may be imprecise? — product call, decide after trying it on a real device.
- [ ] Should the grip also open a block-actions menu on click (duplicate / delete / turn into)? Out of scope here, but the decision affects whether the grip is a `<button>` with an intentional click target or purely a drag surface. — product call.
- [x] Does the currently installed Tiptap 3.23 line ship the drag-handle and node-range extensions under the `@tiptap/extension-*` names assumed above, or still under `@tiptap-pro/*`? — Confirmed: `@tiptap/extension-drag-handle-react`, `@tiptap/extension-drag-handle`, and `@tiptap/extension-node-range` all exist at the exact `3.23.6` line already installed and are MIT-licensed. Used as assumed; no fallback needed. The `extension-drag-handle` core package also depends directly on `@floating-ui/dom`, added explicitly since it's imported directly for `flip`/`shift` middleware.

## Amendments

- **2026-09-11 — shipped without the Test Plan executed.** All unit, component, and manual verification checkboxes above are unchecked by deliberate choice, not oversight — the user asked to ship without testing. Status is `done` because the feature is implemented and, per manual use, working; nothing in the Test Plan has been run to confirm the acceptance criteria beyond that ad hoc check. Treat the checkboxes above as the remaining backlog if regressions surface later, and see `docs/second-brain.md`'s Future Improvements for the pointer back here.
- **2026-09-11 — gutter required real `padding-left`, not floating placement.** The initial implementation positioned the grip via `@floating-ui/dom` in blank space next to the content without reserving any layout for it, on the assumption the portaled element could hover independently of the editor's own box. In practice `@tiptap/extension-drag-handle` only tracks `mousemove` on the ProseMirror root (`view.dom`) itself, so hovering in that blank space never reached the plugin at all — only hovering directly over rendered text did. Fixed by giving `.note-tiptap` real `padding-left: 2rem` (`pl-8`) so the gutter is inside the editable element's hit box, with matching padding added to the title/byline in `note-editor.tsx` to keep everything aligned. The "UI/UX Notes" section above still describes the abandoned floating-only approach; this amendment is the corrected account.
