import { Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { HabitCard } from '#/routes/_authenticated/habits/-components/habit-card'
import { useHabitsStore } from '#/stores/habits-store'

function HabitsEmptyState() {
  const setNewHabitOpen = useHabitsStore((s) => s.setNewHabitOpen)

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <svg
        className="mb-6 size-24 text-muted-foreground/40"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="2" />
        <path
          d="M40 65 L55 50 L70 62 L85 45"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="85" cy="45" r="4" fill="currentColor" />
      </svg>
      <h2 className="text-lg font-semibold tracking-tight">No habits yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Build consistency one day at a time. Add your first habit to get
        started.
      </p>
      <Button className="mt-6" onClick={() => setNewHabitOpen(true)}>
        <Plus className="size-4" />
        Add your first habit
      </Button>
    </div>
  )
}

export function HabitGrid() {
  const habits = useHabitsStore((s) => s.habits)
  const setNewHabitOpen = useHabitsStore((s) => s.setNewHabitOpen)

  if (habits.length === 0) {
    return <HabitsEmptyState />
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Your habits
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="hidden md:inline-flex"
          onClick={() => setNewHabitOpen(true)}
        >
          <Plus className="size-4" />
          New Habit
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {habits.map((habit) => (
          <HabitCard key={habit.id} habit={habit} />
        ))}
      </div>
    </div>
  )
}
