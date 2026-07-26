import { addDays, format, startOfDay } from 'date-fns'
import type { Task, TaskList, TaskView } from '#/stores/tasks-store'

export function groupTasksByList(
  tasks: Task[],
  lists: TaskList[],
): Record<string, Task[]> {
  const grouped: Record<string, Task[]> = {}

  lists.forEach((list) => {
    grouped[list.id] = tasks
      .filter((t) => t.listId === list.id)
      .sort((a, b) => a.order - b.order)
  })

  return grouped
}

export function getCompletedCount(tasks: Task[]): number {
  return tasks.filter((t) => t.completed).length
}

export function getIncompleteTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.completed).sort((a, b) => a.order - b.order)
}

export function getCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.completed).sort((a, b) => a.order - b.order)
}

export function filterByView(
  tasks: Task[],
  view:
    | 'all'
    | 'starred'
    | { listId: string }
    | { starred: true; listId: string },
): Task[] {
  if (view === 'all') {
    return tasks
  }

  if (view === 'starred') {
    return tasks.filter((t) => t.starred)
  }

  if ('listId' in view && 'starred' in view) {
    return tasks.filter((t) => t.listId === view.listId && t.starred)
  }

  if ('listId' in view) {
    return tasks.filter((t) => t.listId === view.listId)
  }

  return tasks
}

export function getListsForView(
  lists: TaskList[],
  view:
    | 'all'
    | 'starred'
    | { listId: string }
    | { starred: true; listId: string },
): TaskList[] {
  if (view === 'all') {
    return lists.sort((a, b) => a.order - b.order)
  }

  if (view === 'starred') {
    return []
  }

  if ('listId' in view) {
    return lists.filter((l) => l.id === view.listId)
  }

  return []
}

export function getViewKey(view: TaskView): string {
  if (view === 'all') return 'all'
  if (view === 'starred') return 'starred'
  return `list-${view.listId}`
}

export function isListView(view: TaskView, listId: string): boolean {
  return (
    typeof view === 'object' &&
    'listId' in view &&
    !('starred' in view) &&
    view.listId === listId
  )
}

export function getDefaultListId(
  view: TaskView,
  lists: TaskList[],
): string | undefined {
  return typeof view === 'object' && 'listId' in view
    ? view.listId
    : lists[0]?.id
}

export function getNextOrder(tasks: Task[], listId?: string): number {
  const relevantTasks = listId
    ? tasks.filter((t) => t.listId === listId && !t.completed)
    : tasks.filter((t) => !t.completed)

  if (relevantTasks.length === 0) return 0

  const maxOrder = Math.max(...relevantTasks.map((t) => t.order))
  return maxOrder + 1
}

export function getSubtaskCompletionPercentage(task: Task): number {
  if (task.subtasks.length === 0) return 0
  const completed = task.subtasks.filter((s) => s.completed).length
  return Math.round((completed / task.subtasks.length) * 100)
}

export function formatSubtaskCount(task: Task): string {
  const completed = task.subtasks.filter((s) => s.completed).length
  return `${completed}/${task.subtasks.length}`
}

export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color)
}

export function createDefaultInboxList(): TaskList {
  return {
    id: 'inbox',
    name: 'Inbox',
    order: 0,
    createdAt: new Date().toISOString(),
  }
}

export function hasExplicitTime(deadlineIso?: string): boolean {
  if (!deadlineIso) return false
  const d = new Date(deadlineIso)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

export function getTodayDeadline(): string {
  return startOfDay(new Date()).toISOString()
}

export function getTomorrowDeadline(): string {
  return startOfDay(addDays(new Date(), 1)).toISOString()
}

export type DeadlineColorState = 'today' | 'overdue' | 'future'

export function getDeadlineColorState(deadlineIso: string): DeadlineColorState {
  const now = new Date()
  const deadlineDate = new Date(deadlineIso)
  const isToday = deadlineDate.toDateString() === now.toDateString()
  if (isToday) return 'today'
  return deadlineDate < now ? 'overdue' : 'future'
}

export function formatDeadlineLabel(deadlineIso: string): string {
  const date = new Date(deadlineIso)
  return hasExplicitTime(deadlineIso)
    ? format(date, 'MMM d, h:mm a')
    : format(date, 'MMM d')
}

export const DEADLINE_COLOR_CLASSES: Record<DeadlineColorState, string> = {
  today: 'text-orange-600 dark:text-orange-400',
  overdue: 'text-red-600 dark:text-red-400',
  future: 'text-zinc-500 dark:text-zinc-400',
}
