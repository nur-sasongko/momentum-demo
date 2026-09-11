---
id: 29
title: 'Draggable Table Context Menu in the Notes Editor'
status: done
feature: notes
created: 2026-09-11
updated: 2026-09-11
---

# Draggable Table Context Menu in the Notes Editor

## Problem Statement

Right-clicking inside a table cell in the note editor opens `TableContextMenu`
(row/column/cell/table actions like "Delete row"). It is positioned with
`position: fixed` at the raw click coordinates, so on smaller tables or near
the edge of the viewport it frequently renders on top of the row or column
the user just right-clicked — covering the exact content they were about to
act on, with no way to see what's underneath.

## Goals

- Let the user drag the context menu to a different position after it opens,
  so they can move it off content it's covering.
- Keep the menu within the visible viewport while dragging (no dragging it
  fully off-screen).

## Non-Goals

- Not touching `table-bubble-menu.tsx` (the persistent table toolbar) — user
  confirmed only the right-click context menu is in scope.
  **(Superseded — see [Amendments](#amendments): `table-bubble-menu.tsx` is
  now in scope too.)**
- Not persisting a dragged position across menu opens/closes — every new
  right-click opens the menu fresh at the click position, undragged.
- Not implementing table row/column drag-to-reorder — that's tracked
  separately by the dormant `moveTableRow` helper in `table-utils.ts` and is
  explicitly out of scope per `docs/specs/028-notes-block-drag-handles.md`.
- Not adding drag support to any other popover/menu in the app.

## Acceptance Criteria

- [x] Given the context menu is open, when the user presses down on its drag
      handle and moves the mouse, then the menu follows the cursor.
- [x] Given the user is dragging the menu, when they release the mouse, then
      the menu stays at the drop position until closed.
- [x] Given the user drags the menu near a viewport edge, then the menu is
      clamped so it stays fully visible (no part goes off-screen).
- [x] Given the user is dragging, when the drag ends, then the menu does not
      immediately close (dragging must not trigger the existing "click
      outside" / mouseup dismissal).
- [x] Given the menu is closed and reopened via another right-click, then it
      appears at the new click position, not the previously dragged position.
- [x] Given the user clicks an action item (e.g. "Delete row") without
      dragging, then the existing click-to-run-and-close behavior still works
      unchanged.

## Data Model Changes

None.

## UI / UX Notes

Add a small drag handle strip to the top of the menu (e.g. a thin bar with a
grip icon, `cursor: grab` / `cursor: grabbing` while active), above the
existing section list, inside the same portaled container. Dragging is
mouse-position delta based:

1. `onMouseDown` on the handle records the starting cursor position and the
   menu's current `{ x, y }`, and flags `isDragging`.
2. A `window` `mousemove` listener (added only while dragging) updates
   `{ x, y }` by the cursor delta, clamped to
   `[0, window.innerWidth - menuWidth]` / `[0, window.innerHeight - menuHeight]`
   using the menu element's own `getBoundingClientRect()`.
3. `window` `mouseup` clears `isDragging` and removes the listener.
4. While `isDragging` is true (or immediately after a drag ends), the existing
   window-level `click`/`scroll` dismiss handlers must not close the menu —
   e.g. guard them on a ref flag, the same pattern already used for
   `onMouseDown={(event) => event.stopPropagation()}` on the menu root.

```
┌──────────────────────┐
│ ⠿ (drag handle)       │  <- new: mousedown+drag moves the menu
├──────────────────────┤
│ Row                   │
│  Insert row above     │
│  Insert row below     │
│  Delete row           │
├──────────────────────┤
│ Column ...            │
└──────────────────────┘
```

## Edge Cases

- **Drag started, then window resized:** re-clamp on the next move; no resize
  listener needed since the menu closes on scroll/most interactions already.
- **Menu near right/bottom edge on open (before any drag):** already loosely
  handled today by `position: fixed` off raw coordinates — out of scope to
  change initial placement, only dragging afterward needs clamping.
- **Fast drag past viewport bounds:** clamp per-move against the menu's
  measured size so the cursor can move faster than the menu without the menu
  escaping the viewport.

## Implementation Notes

1. `src/routes/_authenticated/notes/-components/table-context-menu.tsx` —
   add `isDragging` state/ref, a drag-handle element, `mousemove`/`mouseup`
   window listeners while dragging, clamped position updates, and a guard so
   the existing dismiss-on-click/scroll handlers ignore drag-related events.
2. `src/styles.css` (if a dedicated class is cleaner than inline
   Tailwind for the handle) — add `.note-table-context-menu-handle` styling
   for the grip affordance and `cursor: grab`/`grabbing` states, following the
   existing `.note-drag-handle` pattern used by the block drag handle.

## Test Plan

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [x] Dragging the handle updates the menu's rendered position.
- [x] A drag that ends does not close the menu.
- [x] Position is clamped to viewport bounds when dragged past an edge.
- [x] Clicking a menu action (no drag) still runs the action and closes the
      menu.
- [x] Closing and reopening the menu resets its position to the new click
      coordinates.

**Manual verification:**

- [ ] Right-click a table cell near the bottom-right of the viewport, confirm
      the menu can be dragged fully into view.
- [ ] Drag the menu, release, click "Delete row" — confirm it still deletes
      the correct row.

## Open Questions

- None.

## Amendments

### 2026-09-11 — Extend dragging to `table-bubble-menu.tsx`

Reopening this spec: the user asked for the persistent table toolbar
(`TableBubbleMenu`) to become draggable too, not just the right-click context
menu.

**Why this needed a separate design pass:** `TableContextMenu` is a plain
portaled `fixed`-position `<div>` with a manually tracked `{ x, y }` — dragging
it is a straightforward delta update. `TableBubbleMenu` renders via Tiptap's
`<BubbleMenu>` (`@tiptap/react/menus`), which uses floating-ui internally to
compute and re-anchor its position from the current editor selection on
every selection change / scroll. There is no `{ x, y }` state to own.

**Chosen approach:** layer a CSS `transform: translate(dx, dy)` drag offset
on top of `BubbleMenu`'s own computed position, using the same delta-drag
mouse handling already implemented in `table-context-menu.tsx` (mousedown on
a handle records the start cursor position and current offset;
`window` `mousemove` updates the offset; `window` `mouseup` ends the drag).
The offset is intentionally **not** re-derived from or clamped against
`BubbleMenu`'s internal position — it's a visual offset applied after
floating-ui places the menu.

**Accepted limitation:** because `BubbleMenu` recomputes its base position
whenever the selection changes (e.g. the user clicks a different cell, or
extends a table selection) while the toolbar stays mounted, the drag offset
is **not preserved** across such repositions — it resets to `(0, 0)` the
next time `BubbleMenu` recalculates and the toolbar snaps back to
floating-ui's default anchor. This mirrors the context menu's own "no
persisted drag position" non-goal (dragging is a per-appearance, temporary
nudge, not a pinned position) and was an explicit tradeoff versus the
alternative (fully replacing `<BubbleMenu>` with a self-managed portal, which
would preserve the offset but is materially more work and risk for a toolbar
that's visible far more often than the context menu).

#### Additional Acceptance Criteria

- [x] Given the table bubble menu is visible, when the user presses down on
      its drag handle and moves the mouse, then the menu follows the cursor
      via a transform offset.
- [x] Given the user is dragging the bubble menu, when they release the
      mouse, then the menu stays at the drop offset until the selection
      changes or the menu closes.
- [x] Given the user drags the bubble menu near a viewport edge, then the
      offset is clamped so the menu (at its dragged position) stays fully
      visible.
- [x] Given the user is dragging, when the drag ends, then existing bubble
      menu interactions (e.g. clicking a toolbar button, the align popover's
      outside-click dismissal) are not triggered by the drag's own
      mouseup/click.
- [x] Given the selection changes (bubble menu repositions) after a drag,
      then the offset resets to zero — the menu appears at floating-ui's
      default anchor again, not at the previously dragged screen position.
- [x] Given the user clicks a toolbar button or the align popover (no drag),
      then all existing click-to-run behavior is unchanged.

#### Additional Implementation Notes

1. `src/routes/_authenticated/notes/-components/table-bubble-menu.tsx` — add
   a drag handle (reuse `.note-table-context-menu-handle` styling or a
   variant of it), `dragOffset: { x, y }` state/ref, `isDragging` state/ref,
   and the same window `mousemove`/`mouseup` drag pattern as
   `table-context-menu.tsx`. Apply the offset via an inline
   `style={{ transform: `translate(${x}px, ${y}px)` }}` on the
   `<BubbleMenu>`'s rendered root (or an inner wrapper div, if `BubbleMenu`
   doesn't forward `style`/`className` to its root element — verify against
   the installed `@tiptap/react/menus` version). Reset the offset to
   `{ x: 0, y: 0 }` on every `shouldShow` transition back to `true`
   (i.e. whenever the bubble menu newly appears for a fresh selection).
2. Clamping: since there's no owned `{ x, y }` to clamp directly, clamp the
   **offset** against the menu element's `getBoundingClientRect()` at drag
   time, the same way `table-context-menu.tsx` clamps its absolute position
   — just expressed as a delta from the current rect instead of from `(0,
0)`.
3. Guard the align-popover's `pointerdown` outside-click handler and any
   other dismiss logic in this file the same way `onDismiss` is guarded in
   `table-context-menu.tsx` (an `isDraggingRef` / `suppressClickRef` pair),
   so a drag-release doesn't close the align popover or otherwise misfire.

#### Additional Test Plan

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [x] Dragging the bubble menu's handle updates its rendered transform
      offset.
- [x] A drag that ends does not trigger toolbar button actions or close the
      align popover.
- [x] The offset is clamped when dragged past a viewport edge.
- [x] Clicking a toolbar button (no drag) still runs the action.
- [x] The offset resets to zero when the bubble menu's `shouldShow`
      transitions from hidden to visible again (simulating a new selection).

  `table-bubble-menu.test.tsx` mounts the full `TiptapEditor` with a real
  Tiptap `Editor` (Table extension included) rather than a fake `editor`
  object — `<BubbleMenu>` registers a real ProseMirror plugin that computes
  its position via floating-ui from the live selection, which a fake editor
  can't drive. jsdom implements no layout, so this also required two
  narrowly-scoped stubs local to this test file: `Range.prototype
.getClientRects`/`getBoundingClientRect` (unimplemented in jsdom; needed
  by ProseMirror to translate a doc position into screen coordinates) and a
  `getBoundingClientRect` mock scoped to _only_ the bubble menu's own
  element (mocking it on `HTMLElement.prototype` broke unrelated internals —
  the Placeholder extension's viewport-boundary check started calling
  `document.elementFromPoint`, which jsdom also doesn't implement).

**Manual verification:**

- [ ] Drag the table toolbar off of the table it's floating over, confirm it
      stays put until the selection changes.
- [ ] Change the selection (click a different cell) after dragging, confirm
      the toolbar snaps back to its default position above/below the
      selection.
