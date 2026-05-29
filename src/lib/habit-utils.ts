export function toDateKey(offsetDays = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

export function getLast7Days(): Array<{ dateKey: string; label: string }> {
  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    return {
      dateKey: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
    }
  })
}

export function getStreak(history: Record<string, boolean>): number {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    if (history[toDateKey(i)]) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export const HABIT_COLORS = [
  'violet',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'sky',
] as const

export type HabitColor = (typeof HABIT_COLORS)[number]

export const HABIT_COLOR_CLASSES: Record<
  HabitColor,
  { bg: string; text: string; ring: string; dot: string }
> = {
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    ring: 'ring-violet-500/50',
    dot: 'bg-violet-500',
  },
  indigo: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    ring: 'ring-indigo-500/50',
    dot: 'bg-indigo-500',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/50',
    dot: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    ring: 'ring-amber-500/50',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    ring: 'ring-rose-500/50',
    dot: 'bg-rose-500',
  },
  sky: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    ring: 'ring-sky-500/50',
    dot: 'bg-sky-500',
  },
}

export const HABIT_EMOJIS = [
  '📖',
  '💪',
  '🧘',
  '💧',
  '📓',
  '🚫',
  '🏃',
  '🎯',
  '☕',
  '🌙',
  '🍎',
  '✍️',
]
