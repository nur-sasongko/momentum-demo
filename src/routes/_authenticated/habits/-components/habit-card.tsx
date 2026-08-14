import { Flame } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { HABIT_COLOR_CLASSES, getStreak } from '../-utils/habit-utils'
import { getLast7Days } from '#/utils/date'
import { cn } from '#/libs/utils'
import type { Habit } from '#/stores/habits-store'
import { useHabitsStore } from '#/stores/habits-store'

export function HabitCard({ habit }: { habit: Habit }) {
  const toggleDay = useHabitsStore((s) => s.toggleDay)
  const days = getLast7Days()
  const streak = getStreak(habit.history)
  const colors = HABIT_COLOR_CLASSES[habit.color]

  return (
    <Card className="gap-0 py-0 transition-transform duration-200 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-start gap-3 px-5 pt-5 pb-3">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-lg text-lg',
            colors.bg,
          )}
        >
          {habit.icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base tracking-tight">
            {habit.name}
          </CardTitle>
          <p
            className={cn(
              'mt-1 flex items-center gap-1 text-xs font-medium',
              colors.text,
            )}
          >
            <Flame className="size-3.5" />
            <span className="tabular">{streak}</span> day streak
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex items-center justify-between gap-2">
          {days.map((day) => {
            const done = !!habit.history[day.dateKey]
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => toggleDay(habit.id, day.dateKey)}
                className="group flex flex-col items-center gap-1.5"
                aria-label={`Toggle ${habit.name} on ${day.dateKey}`}
                aria-pressed={done}
              >
                <span
                  className={cn(
                    'size-7 rounded-full border-2 transition-all',
                    done
                      ? cn(colors.dot, 'border-transparent')
                      : 'border-border bg-secondary group-hover:border-muted-foreground',
                  )}
                />
                <span className="text-[10px] text-muted-foreground">
                  {day.label}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
