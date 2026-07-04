---
title: 'Tasks Management'
status: draft
feature: tasks
created: 2026-07-04
updated: 2026-07-04
---

# Tasks Management

## Problem Statement

Users have no dedicated place to capture and organize discrete to-dos. Habits track recurring behavior and Notes capture free-form knowledge, but neither supports one-off actionable items with completion state, deadlines, sub-steps, or lightweight grouping into work streams (e.g. "Do", "Decide", "Do it Later").

## Goals

- Create, edit, and delete tasks with a title, optional notes/description, and deadline.
- Organize tasks into user-created Lists (e.g. "Do", "Decide", "Do it Later"); a task belongs to exactly one List.
- Star tasks independent of List membership, filterable via a "Starred" view.
- Add, complete, and remove subtasks (single level, no nested subtasks) on a task.
- Mark tasks finished/unfinished; completed tasks collapse into a per-column completed count.
- Two-pane layout: left panel (All Tasks / Starred / user Lists, create-new-list action) and right panel (Kanban board of List columns, drag-and-drop to reorder within and move across columns).

## Non-Goals

- Second Brain / Notes integration (linking tasks to notes) — explicitly deferred to a future spec.
- Recurring/repeating tasks.
- Reminders/notifications for deadlines.
- Multi-user collaboration or sharing.
- Nested (multi-level) subtasks.
- A task belonging to more than one List simultaneously.
- Priority levels beyond the existing star flag.

## Acceptance Criteria

- [ ] Given the Tasks board, when a user creates a task with a title and assigns it to a List, then the task appears as a card in that List's column.
- [ ] Given an existing task, when a user edits its title, notes, or List, then the changes are reflected immediately on its card.
- [ ] Given an existing task, when a user deletes it, then it is removed from its column and no longer appears in any view.
- [ ] Given a task, when a user stars it, then it appears in the "Starred" view; unstarring removes it from that view.
- [ ] Given a task, when a user sets a deadline via the calendar popover, then the deadline is shown as a badge on the card; clearing it removes the badge.
- [ ] Given a task, when a user adds subtasks and completes some of them, then the card shows a progress count (e.g. "2/4").
- [ ] Given a task, when a user marks it finished, then it disappears from the column body and the column's completed count increments; expanding the footer reveals it.
- [ ] Given a completed task, when a user marks it unfinished, then it reappears in the column body and the completed count decrements.
- [ ] Given the left panel, when a user creates a new List, then it appears both as a left-panel entry and as a new board column.
- [ ] Given the "All Tasks" view, when selected, then every List renders as a column on the board.
- [ ] Given the "Starred" view, when selected, then every List renders as a column, each showing only starred tasks.
- [ ] Given a specific List selected in the left panel, when selected, then the board shows only that List's column (focused view).
- [ ] Given a card, when a user drags it to a new position within the same column, then its order updates and persists.
- [ ] Given a card, when a user drags it into a different column, then its List assignment and order update and persist.
- [ ] Given any task or list change, when the page is reloaded, then all data persists (localStorage via Zustand `persist`).

## Data Model Changes

**Store:** `src/stores/tasks-store.ts`

```ts
interface Subtask {
  id: string
  title: string
  completed: boolean
}

interface Task {
  id: string
  title: string
  notes?: string
  listId: string
  starred: boolean
  completed: boolean
  completedAt?: string
  deadline?: string // ISO date
  subtasks: Subtask[]
  order: number // position within its List column
  createdAt: string
  updatedAt: string
}

interface TaskList {
  id: string
  name: string
  color?: string
  order: number // column/left-panel order
  createdAt: string
}

type TaskView = 'all' | 'starred' | { listId: string }

interface TasksState {
  tasks: Task[]
  lists: TaskList[]
  selectedView: TaskView
  // actions: addTask, updateTask, deleteTask, toggleComplete, toggleStar,
  // addSubtask, toggleSubtask, deleteSubtask, reorderTask, moveTaskToList,
  // addList, renameList, deleteList, reorderLists, setSelectedView
}
```

**Migration:** New store, persist `version: 0`. `partialize` persists `tasks`, `lists`, and `selectedView`. On first rehydrate with no existing data, seed one default List (e.g. "Inbox"), mirroring the `SEED_*` pattern in `habits-store.ts`/`notes-store.ts`.

## UI / UX Notes

- Route shell mirrors `src/routes/notes/index.tsx`: `flex h-[calc(100dvh-3.5rem)] overflow-hidden`, left panel + right panel, with a mobile view-toggle (list ⇄ board) instead of a separate route.
- Left panel (`task-sidebar.tsx`, plain divs/Buttons — not the shadcn `Sidebar` primitive, which is reserved for the global `AppSidebar`): "All Tasks", "Starred", then user Lists in `order`; a "+ New list" action opens `new-list-dialog.tsx`.
- Right panel (`task-board.tsx`): renders one `task-column.tsx` per visible List (all Lists for `all`/`starred` views, one for a focused List view). Each column: header (name, task count), scrollable card stack, footer showing "`N` completed" that expands in place to reveal collapsed cards.
- Cards (`task-card.tsx`): title, star toggle, deadline badge (if set), subtask progress badge (if any subtasks), opens `task-detail-sheet.tsx` on click for full edit (title, notes, list, deadline calendar popover, subtask checklist, delete).
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`: sortable within a column (updates `order`), droppable across columns (updates `listId` + `order`).
- Reuse existing shadcn primitives: `card`, `sheet`, `dialog`, `dropdown-menu`, `badge`, `select`, `input`, `textarea`, `label`, `tooltip`, `skeleton`, `sonner`. Add new primitives via `bunx --bun shadcn@latest add checkbox popover calendar`.

```
┌─────────────────┬──────────────────────────────────────────────┐
│ All Tasks        │  Do            Decide          Do it Later   │
│ ★ Starred        │ ┌──────────┐  ┌──────────┐    ┌──────────┐   │
│ ──────────────   │ │ Card     │  │ Card     │    │ Card     │   │
│ Do               │ │ ★ 2/4 📅 │  │          │    │          │   │
│ Decide           │ └──────────┘  └──────────┘    └──────────┘   │
│ Do it Later      │ ┌──────────┐                  ┌──────────┐   │
│ + New list       │ │ Card     │                  │ Card     │   │
│                  │ └──────────┘                  └──────────┘   │
│                  │ 3 completed ⌄  1 completed ⌄   0 completed    │
└─────────────────┴──────────────────────────────────────────────┘
```

## Edge Cases

- **Empty state:** a List with no tasks shows an empty-column placeholder (mirrors `finance-empty-state.tsx`/`notes-empty-state.tsx` pattern).
- **Persistence boundary:** all task/list state persists via Zustand `persist` to localStorage, same boundary as habits/notes/finance stores.
- Deleting a List that still has tasks — see Open Questions; needs a product decision before implementation.
- Deleting the last remaining List — must always keep at least one List (e.g. the default "Inbox") so the board is never empty of columns.

## Implementation Notes

1. `src/stores/tasks-store.ts` — new Zustand persisted store (types + actions above).
2. `src/routes/tasks/-utils/tasks-utils.ts` — grouping-by-list, completed-count, ordering/reorder helpers, default-list seeding.
3. `src/routes/tasks/-components/task-sidebar.tsx` — left panel (views + list management entry point).
4. `src/routes/tasks/-components/new-list-dialog.tsx` — create/rename a List.
5. `src/routes/tasks/-components/task-board.tsx` — renders columns per current `selectedView`.
6. `src/routes/tasks/-components/task-column.tsx` — column header, card stack, collapsible completed footer, drop target.
7. `src/routes/tasks/-components/task-card.tsx` — card content + drag handle.
8. `src/routes/tasks/-components/task-detail-sheet.tsx` — create/edit sheet (title, notes, list, deadline popover, subtasks, star, delete).
9. `src/routes/tasks/index.tsx` — thin route file wiring the store + sidebar + board into the notes-style two-pane shell.
10. Register a "Tasks" nav entry in `src/components/AppSidebar.tsx`.
11. Add dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-day-picker`; add shadcn components `checkbox`, `popover`, `calendar`.
12. After the spec ships (status → `done`), create `docs/tasks.md` (current-state feature doc, mirroring `docs/habits.md`).

## Test Plan

**Unit tests** (`src/routes/tasks/-utils/__test__/`):

- [ ] Grouping tasks by list
- [ ] Completed-count computation per column
- [ ] Reorder/move ordering math (within-column and cross-column)
- [ ] Default-list seeding on first rehydrate

**Component tests** (`src/routes/tasks/-components/__test__/`):

- [ ] `task-card` renders star, deadline, and subtask progress badges correctly
- [ ] `task-column` collapses completed tasks into the footer and expands on demand
- [ ] `task-sidebar` switches between all/starred/single-list views
- [ ] `new-list-dialog` creates a new list

**Manual verification:**

- [ ] Create, edit, complete, and delete a task end-to-end
- [ ] Drag a card across columns and confirm `listId`/`order` persist after reload
- [ ] Toggle star and confirm the task surfaces in "Starred"
- [ ] Add and complete subtasks and confirm the progress badge updates
- [ ] Confirm the board can't be emptied of all Lists

## Open Questions

- [ ] When a List with tasks is deleted, do its tasks move to a default "Inbox" List, or is deletion blocked until the List is empty?
- [ ] Should "Starred" ever support the single-column focus view, or does it always stay multi-column?
- [ ] Should subtasks be quick-toggleable directly on the card (compact inline checklist), or only inside the task detail sheet (current assumption)?
- [ ] Should List color be a fixed palette (reusing the `HabitColor`-style pattern) or free-form?
