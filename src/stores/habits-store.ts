import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { HabitColor } from '#/lib/habit-utils'
import { toDateKey } from '#/lib/habit-utils'

export interface Habit {
  id: string
  name: string
  icon: string
  color: HabitColor
  history: Record<string, boolean>
  createdAt: string
}

function buildHistory(pattern: boolean[]): Record<string, boolean> {
  const history: Record<string, boolean> = {}
  pattern.forEach((done, i) => {
    const offset = 6 - i
    history[toDateKey(offset)] = done
  })
  return history
}

export const SEED_HABITS: Habit[] = [
  {
    id: 'habit-read',
    name: 'Read 20min',
    icon: '📖',
    color: 'violet',
    history: buildHistory([true, true, true, false, true, true, true]),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'habit-workout',
    name: 'Workout',
    icon: '💪',
    color: 'rose',
    history: buildHistory([false, true, true, true, false, true, true]),
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 'habit-meditate',
    name: 'Meditate',
    icon: '🧘',
    color: 'indigo',
    history: buildHistory([true, true, true, true, true, false, true]),
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'habit-hydrate',
    name: 'Hydrate',
    icon: '💧',
    color: 'sky',
    history: buildHistory([true, false, true, true, true, true, true]),
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'habit-journal',
    name: 'Journal',
    icon: '📓',
    color: 'amber',
    history: buildHistory([true, true, false, false, true, true, false]),
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'habit-no-sugar',
    name: 'No-sugar',
    icon: '🚫',
    color: 'emerald',
    history: buildHistory([true, true, true, true, false, true, true]),
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
]

interface HabitsState {
  habits: Habit[]
  isNewHabitOpen: boolean
  toggleDay: (habitId: string, dateKey: string) => void
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'history'>) => void
  setNewHabitOpen: (open: boolean) => void
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set) => ({
      habits: SEED_HABITS,
      isNewHabitOpen: false,
      toggleDay: (habitId, dateKey) =>
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === habitId
              ? {
                  ...habit,
                  history: {
                    ...habit.history,
                    [dateKey]: !habit.history[dateKey],
                  },
                }
              : habit,
          ),
        })),
      addHabit: (input) =>
        set((state) => ({
          habits: [
            ...state.habits,
            {
              ...input,
              id: crypto.randomUUID(),
              history: {},
              createdAt: new Date().toISOString(),
            },
          ],
          isNewHabitOpen: false,
        })),
      setNewHabitOpen: (open) => set({ isNewHabitOpen: open }),
    }),
    {
      name: 'myspace-habits',
      version: 1,
      partialize: (state) => ({ habits: state.habits }),
      onRehydrateStorage: () => (state) => {
        if (state && state.habits.length === 0) {
          state.habits = SEED_HABITS
        }
      },
    },
  ),
)
