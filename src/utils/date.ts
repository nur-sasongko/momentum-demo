import { format, parse, parseISO, startOfDay, subDays } from 'date-fns'

/**
 * Formats today's date for display in the app shell (e.g. TopBar).
 *
 * @returns A human-readable date string such as `"Saturday, May 30"`.
 */
export function formatTodayDate(): string {
  return format(new Date(), 'EEEE, MMMM d')
}

/**
 * Returns a local calendar date key in `YYYY-MM-DD` format.
 *
 * Uses the user's local timezone so day boundaries match on-device calendar
 * days (important for habit streaks and daily summaries).
 *
 * @param offsetDays - Number of days to subtract from today. Defaults to `0`.
 * @returns An ISO-like date key for the target local day.
 */
export function toDateKey(offsetDays = 0): string {
  const date = subDays(startOfDay(new Date()), offsetDays)
  return format(date, 'yyyy-MM-dd')
}

/**
 * Returns the last seven local calendar days ending today.
 *
 * Each entry includes a date key for persistence lookups and a narrow weekday
 * label for compact UI display.
 *
 * @returns Seven entries ordered oldest to newest.
 */
export function getLast7Days(): Array<{ dateKey: string; label: string }> {
  const today = startOfDay(new Date())

  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i
    const date = subDays(today, offset)

    return {
      dateKey: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEEE'),
    }
  })
}

/**
 * Extracts a month key from an ISO-like date string.
 *
 * @param date - Date string in `YYYY-MM-DD` (or longer ISO) format.
 * @returns Month key in `YYYY-MM` format.
 */
export function toMonthKey(date: string): string {
  return date.slice(0, 7)
}

/**
 * Returns the current local month as a month key.
 *
 * @returns Month key in `YYYY-MM` format.
 */
export function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

/**
 * Formats a month key for human-readable display.
 *
 * @param monthKey - Month key in `YYYY-MM` format.
 * @returns Label such as `"May 2026"`.
 */
export function formatMonthLabel(monthKey: string): string {
  const date = parse(monthKey, 'yyyy-MM', new Date())
  return format(date, 'LLLL yyyy')
}

/**
 * Formats a date key for compact transaction display.
 *
 * @param date - Date key in `YYYY-MM-DD` format.
 * @returns Label such as `"May 15"`.
 */
export function formatTransactionDate(date: string): string {
  return format(parseISO(date), 'MMM d')
}
