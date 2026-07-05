---
id: 3
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
- Send browser notifications (via Notification API) for tasks with upcoming deadlines; user controls frequency/quiet hours via settings.

## Non-Goals

- Second Brain / Notes integration (linking tasks to notes) — explicitly deferred to a future spec.
- Recurring/repeating tasks.
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
- [ ] Given a task or list change, when the mutation completes, then Zustand state updates immediately (optimistic); the change syncs to Supabase in the background without blocking the UI.
- [ ] Given a task or list change that fails to sync to Supabase (network error), when the sync fails, then a toast error appears and local state reverts to match the last successful server state.
- [ ] Given any task or list change, when the page is reloaded, then data is fetched fresh from Supabase (via route loader); if offline, the app hydrates from localStorage cache instead.
- [ ] Given a user offline with cached tasks in localStorage, when they reconnect and revisit the route, then fresh server data rehydrates the app (server data takes precedence over stale cache).
- [ ] Given a task with a deadline set to tomorrow, when the user has notifications enabled and has not dismissed the notification, then a browser notification fires at a user-configured time (e.g. 9 AM) with the task title and list name.
- [ ] Given a task deadline notification, when the user clicks the notification, then the app opens and focuses the task detail sheet; clicking again on a subsequent day does not re-fire if already shown once.
- [ ] Given the notification system, when a user clicks "Settings" in the app header, then a Notifications panel allows enabling/disabling deadline alerts and setting a quiet-hours window (e.g. 10 PM – 8 AM, no notifications outside app focus).

## Data Model Changes

**Store:** `src/stores/tasks-store.ts` (client-side Zustand persisted store, mirrors server schema for conflict-free sync)

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
  notificationSettings: {
    enabled: boolean
    quietHoursStart: number // 0-23, e.g. 22 for 10 PM
    quietHoursEnd: number // 0-23, e.g. 8 for 8 AM
  }
  // actions: addTask, updateTask, deleteTask, toggleComplete, toggleStar,
  // addSubtask, toggleSubtask, deleteSubtask, reorderTask, moveTaskToList,
  // addList, renameList, deleteList, reorderLists, setSelectedView,
  // updateNotificationSettings
}
```

**Client state architecture:**

- **Server source of truth** — tasks/lists live in Supabase Postgres; fetched via TanStack Query on route load (via `loader:`).
- **Local cache** — Zustand store (`src/stores/tasks-store.ts`) with `persist` version 0, caches server state to `localStorage` for offline support and fast rehydration.
- **Optimistic updates** — mutations (create/update/delete task/list) update local Zustand state immediately, then sync to Supabase in background; if sync fails, revert local state and show error toast.
- **Sync strategy** — `partialize` persists `tasks`, `lists`, and `selectedView` to localStorage. On first load with no server data, client-side cache may be stale; the route loader always fetches fresh data from server, which takes precedence.
- **Default list seeding** — when a new user first loads the route, if they have no lists in Supabase, server-side logic creates one default "Inbox" list via a database trigger or initial mutation.

## Migrations

Database schema for Supabase PostgreSQL. Run via `supabase migration new <name>` and apply with `supabase db push`.

**1. Create `task_lists` table**

```sql
create table public.task_lists (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text, -- optional hex color (e.g. '#FF5733'), null defaults to neutral gray
  "order" int not null default 0, -- column/sidebar order
  created_at timestamp with time zone not null default now(),

  unique(user_id, name) -- user can't have duplicate list names
);

create index task_lists_user_id_order on public.task_lists(user_id, "order");
```

**2. Create `tasks` table**

```sql
create table public.tasks (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.task_lists(id) on delete cascade,
  title text not null,
  notes text, -- optional task description
  deadline date, -- optional ISO date
  starred boolean not null default false,
  completed boolean not null default false,
  completed_at timestamp with time zone, -- set when completed = true
  "order" int not null default 0, -- position within its list column
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint valid_completed check (
    (completed = false and completed_at is null) or
    (completed = true and completed_at is not null)
  )
);

create index tasks_user_id on public.tasks(user_id);
create index tasks_list_id on public.tasks(list_id);
create index tasks_user_id_completed on public.tasks(user_id, completed);
create index tasks_user_id_starred on public.tasks(user_id, starred);
```

**3. Create `subtasks` table**

```sql
create table public.subtasks (
  id uuid not null default gen_random_uuid() primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamp with time zone not null default now(),

  unique(task_id, title) -- task can't have duplicate subtask titles
);

create index subtasks_task_id on public.subtasks(task_id);
```

**4. Enable RLS on all tables**

```sql
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;

create policy "Users can view/edit their own lists" on public.task_lists
  for all using (auth.uid() = user_id);

create policy "Users can view/edit their own tasks" on public.tasks
  for all using (auth.uid() = user_id);

create policy "Users can view/edit subtasks of their own tasks" on public.subtasks
  for all using (
    exists (select 1 from public.tasks where id = task_id and user_id = auth.uid())
  );
```

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
- **Offline mode:** when offline, the app hydrates from localStorage cache; mutations are queued locally and retried on reconnect. TanStack Query's `useIsMutating` can show a "syncing..." indicator while offline changes await sync.
- **Stale cache:** if server data changes (e.g. via another device), the next `useTasksQuery` fetch will refresh the cache; localStorage is not authoritative and revalidates on every route load.
- **Network failures:** mutation errors revert local state and show a toast; the user can retry the action. The Zustand store acts as a rollback buffer.
- Deleting a List that still has tasks — see Open Questions; needs a product decision before implementation.
- Deleting the last remaining List — must always keep at least one List (e.g. the default "Inbox") so the board is never empty of columns.

## Implementation Notes

**Server integration & data fetching:**

0. **Database schema** — Run migrations in order:
   - `supabase migration new create_task_lists` → add table + RLS
   - `supabase migration new create_tasks` → add table + RLS
   - `supabase migration new create_subtasks` → add table + RLS
   - `supabase db push` (or manual apply via Supabase dashboard for production)

1. **Data layer** (`src/routes/tasks/-utils/tasks-queries.ts`) — TanStack Query hooks:
   - `useTasksQuery()` — fetches all tasks + lists for authenticated user from Supabase.
   - `useCreateTaskMutation()` — POST to server (via `createServerFn` or API route), optimistically updates Zustand, reverts on error.
   - `useUpdateTaskMutation()` — PATCH, optimistic + rollback.
   - `useDeleteTaskMutation()` — DELETE, optimistic + rollback.
   - Similar mutations for lists: `useCreateListMutation`, `useUpdateListMutation`, `useDeleteListMutation`.
   - All mutations invalidate the `useTasksQuery` cache on success.

2. `src/routes/tasks/index.tsx` — add `loader:` function that calls `useTasksQuery().suspense()` to fetch data before render; wrap route in `<Suspense>` with fallback loading state.

3. `src/stores/tasks-store.ts` — Zustand persisted store (types + actions) with `persist` config to sync with localStorage for offline cache.
4. `src/routes/tasks/-utils/tasks-utils.ts` — grouping-by-list, completed-count, ordering/reorder helpers, default-list seeding.
5. `src/routes/tasks/-components/task-sidebar.tsx` — left panel (views + list management entry point).
6. `src/routes/tasks/-components/new-list-dialog.tsx` — create/rename a List.
7. `src/routes/tasks/-components/task-board.tsx` — renders columns per current `selectedView`.
8. `src/routes/tasks/-components/task-column.tsx` — column header, card stack, collapsible completed footer, drop target.
9. `src/routes/tasks/-components/task-card.tsx` — card content + drag handle.
10. `src/routes/tasks/-components/task-detail-sheet.tsx` — create/edit sheet (title, notes, list, deadline popover, subtasks, star, delete).
11. Register a "Tasks" nav entry in `src/components/AppSidebar.tsx`.
12. Add dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-day-picker`; add shadcn components `checkbox`, `popover`, `calendar`.
13. **Notifications system** — new files:
    - `src/routes/tasks/-utils/notification-service.ts` — schedule deadline checks; fire browser `Notification` API; respect quiet hours and per-task "shown" state (stored in `localStorage`).
    - `src/routes/tasks/-components/notifications-settings.tsx` — modal/panel for enabling/disabling and setting quiet-hours window.
    - Hook into `useEffect` in main `tasks/index.tsx` to start notification polling when the route mounts (e.g. check every 5 minutes); clean up on unmount.
14. After the spec ships (status → `done`), create `docs/tasks.md` (current-state feature doc, mirroring `docs/habits.md`).

## Test Plan

**Unit tests** (`src/routes/tasks/-utils/__test__/`):

- [ ] `useTasksQuery` returns tasks and lists from Supabase
- [ ] `useCreateTaskMutation` optimistically updates Zustand state before server response
- [ ] `useCreateTaskMutation` reverts state on network error and shows toast
- [ ] `useCreateTaskMutation` invalidates `useTasksQuery` on success
- [ ] Similar error/optimistic tests for update/delete mutations
- [ ] Grouping tasks by list
- [ ] Completed-count computation per column
- [ ] Reorder/move ordering math (within-column and cross-column)
- [ ] Default-list seeding on first rehydrate (or server-side trigger)

**Component tests** (`src/routes/tasks/-components/__test__/`):

- [ ] `task-card` renders star, deadline, and subtask progress badges correctly
- [ ] `task-column` collapses completed tasks into the footer and expands on demand
- [ ] `task-sidebar` switches between all/starred/single-list views
- [ ] `new-list-dialog` creates a new list
- [ ] `notifications-settings` toggles notifications and updates quiet hours in store

**Unit tests** (`src/routes/tasks/-utils/__test__/notification-service.test.ts`):

- [ ] `shouldFireNotification` returns false if notifications disabled
- [ ] `shouldFireNotification` returns false if within quiet hours
- [ ] `shouldFireNotification` returns false if notification already shown for that task on that day
- [ ] `shouldFireNotification` returns true for upcoming deadline within notification window and outside quiet hours
- [ ] Notification fires with correct title and task details

**Manual verification:**

- [ ] Create, edit, complete, and delete a task end-to-end; confirm data persists in Supabase after page reload
- [ ] Create a task while offline (dev tools network → offline), then reconnect; confirm task syncs to Supabase
- [ ] Create a task, see optimistic update on card, then introduce a simulated network error; confirm state reverts and error toast shows
- [ ] Drag a card across columns and confirm `listId`/`order` sync to Supabase and persist after reload
- [ ] Toggle star and confirm the task surfaces in "Starred" and Supabase reflects the change
- [ ] Add and complete subtasks and confirm the progress badge updates and syncs to server
- [ ] Confirm the board can't be emptied of all Lists
- [ ] Load app with stale localStorage cache (manually clear browser cache), open devtools Network tab, confirm fresh fetch from Supabase on route load

## Open Questions

- [ ] When a List with tasks is deleted, do its tasks move to a default "Inbox" List, or is deletion blocked until the List is empty?
- [ ] Should "Starred" ever support the single-column focus view, or does it always stay multi-column?
- [ ] Should subtasks be quick-toggleable directly on the card (compact inline checklist), or only inside the task detail sheet (current assumption)?
- [ ] Should List color be a fixed palette (reusing the `HabitColor`-style pattern) or free-form?
