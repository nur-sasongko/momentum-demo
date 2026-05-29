import { createFileRoute } from '@tanstack/react-router'

import { HabitGrid } from '#/routes/habits/-components/habit-grid'
import { HabitSummary } from '#/routes/habits/-components/habit-summary'
import { NewHabitModal } from '#/routes/habits/-components/new-habit-modal'

export const Route = createFileRoute('/habits/')({
  head: () => ({
    meta: [{ title: 'Habits — MySpace' }],
  }),
  component: HabitsPage,
})

function HabitsPage() {
  return (
    <div className="route-fade-in space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Habit Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track streaks and mark each day complete.
        </p>
      </div>

      <HabitSummary />
      <HabitGrid />
      <NewHabitModal />
    </div>
  )
}
