import { Progress } from '#/components/ui/progress'
import { toDateKey } from '../-utils/habit-utils'
import { useHabitsStore } from '#/stores/habits-store'

export function HabitSummary() {
  const habits = useHabitsStore((s) => s.habits)
  const today = toDateKey(0)
  const completed = habits.filter((h) => h.history[today]).length
  const total = habits.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6">
      <p className="text-sm text-muted-foreground">
        You&apos;ve completed{' '}
        <span className="font-semibold text-foreground">
          {completed} of {total}
        </span>{' '}
        habits today
      </p>
      <Progress value={percent} className="mt-4 h-2" />
    </section>
  )
}
