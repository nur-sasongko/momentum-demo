import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Subtask {
  id: string
  title: string
  completed: boolean
  notes?: string
  deadline?: string // ISO datetime; local midnight = "no explicit time"
}

export interface Task {
  id: string
  title: string
  notes?: string
  listId: string
  starred: boolean
  completed: boolean
  completedAt?: string
  deadline?: string // ISO datetime; local midnight = "no explicit time"
  subtasks: Subtask[]
  order: number // position within its List column
  createdAt: string
  updatedAt: string
}

export interface TaskList {
  id: string
  name: string
  color?: string
  order: number // column/left-panel order
  createdAt: string
}

export type TaskView =
  | 'all'
  | 'starred'
  | { listId: string }
  | { starred: true; listId: string }

export interface TasksState {
  tasks: Task[]
  lists: TaskList[]
  selectedView: TaskView
  notificationSettings: {
    enabled: boolean
    quietHoursStart: number // 0-23, e.g. 22 for 10 PM
    quietHoursEnd: number // 0-23, e.g. 8 for 8 AM
  }
  // Actions
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleTaskComplete: (id: string) => void
  toggleTaskStar: (id: string) => void
  reorderTask: (id: string, newOrder: number) => void
  moveTaskToList: (id: string, listId: string, newOrder: number) => void
  addSubtask: (taskId: string, subtask: Subtask) => void
  updateSubtask: (
    taskId: string,
    subtaskId: string,
    updates: Partial<Subtask>,
  ) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  addList: (list: TaskList) => void
  updateList: (id: string, updates: Partial<TaskList>) => void
  deleteList: (id: string) => void
  reorderLists: (id: string, newOrder: number) => void
  setSelectedView: (view: TaskView) => void
  updateNotificationSettings: (
    settings: Partial<TasksState['notificationSettings']>,
  ) => void
  // Sync from server
  setTasks: (tasks: Task[]) => void
  setLists: (lists: TaskList[]) => void
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [],
      lists: [],
      selectedView: 'all',
      notificationSettings: {
        enabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
      },
      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, task],
        })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),
      toggleTaskComplete: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id === id) {
              return {
                ...t,
                completed: !t.completed,
                completedAt: !t.completed
                  ? new Date().toISOString()
                  : undefined,
              }
            }
            return t
          }),
        })),
      toggleTaskStar: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, starred: !t.starred } : t,
          ),
        })),
      reorderTask: (id, newOrder) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, order: newOrder } : t,
          ),
        })),
      moveTaskToList: (id, listId, newOrder) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, listId, order: newOrder } : t,
          ),
        })),
      addSubtask: (taskId, subtask) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t,
          ),
        })),
      updateSubtask: (taskId, subtaskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, ...updates } : s,
                  ),
                }
              : t,
          ),
        })),
      deleteSubtask: (taskId, subtaskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
                }
              : t,
          ),
        })),
      toggleSubtask: (taskId, subtaskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s,
                  ),
                }
              : t,
          ),
        })),
      addList: (list) =>
        set((state) => ({
          lists: [...state.lists, list],
        })),
      updateList: (id, updates) =>
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === id ? { ...l, ...updates } : l,
          ),
        })),
      deleteList: (id) =>
        set((state) => ({
          lists: state.lists.filter((l) => l.id !== id),
          tasks: state.tasks.map((t) =>
            t.listId === id ? { ...t, listId: 'inbox' } : t,
          ),
        })),
      reorderLists: (id, newOrder) =>
        set((state) => ({
          lists: state.lists.map((l) =>
            l.id === id ? { ...l, order: newOrder } : l,
          ),
        })),
      setSelectedView: (view) =>
        set({
          selectedView: view,
        }),
      updateNotificationSettings: (settings) =>
        set((state) => ({
          notificationSettings: { ...state.notificationSettings, ...settings },
        })),
      setTasks: (tasks) =>
        set({
          tasks,
        }),
      setLists: (lists) =>
        set({
          lists,
        }),
    }),
    {
      name: 'tasks-store',
      version: 0,
      partialize: (state) => ({
        tasks: state.tasks,
        lists: state.lists,
        selectedView: state.selectedView,
        notificationSettings: state.notificationSettings,
      }),
    },
  ),
)
