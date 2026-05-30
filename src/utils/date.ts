/**
 * Shared date formatting and key helpers for app-wide calendar display.
 *
 * All day-based keys use the user's local timezone so UI labels and persisted
 * keys stay aligned with on-device calendar days.
 *
 * @module utils/date
 */

import { format, parse, parseISO, startOfDay, subDays } from 'date-fns'

/** Local date key in `YYYY-MM-DD` format. */
export type DateKey = string

/** Month key in `YYYY-MM` format. */
export type MonthKey = string

/**
 * A single day entry for streak grids and compact date pickers.
 */
export interface DateKeyEntry {
  /** Local date key in `YYYY-MM-DD` format. */
  dateKey: DateKey
  /** Narrow weekday label (e.g. `"M"`, `"T"`, `"S"`). */
  label: string
}

/**
 * Formats today's date for display in the app shell (e.g. TopBar).
 *
 * @returns Human-readable label such as `"Saturday, May 30"`.
 *
 * @example
 * formatTodayDate() // "Saturday, May 30"
 */
export function formatTodayDate(): string {
  return format(new Date(), 'EEEE, MMMM d')
}

/**
 * Returns a local calendar date key.
 *
 * Day boundaries follow the user's local timezone, which keeps habit streaks
 * and daily summaries consistent with the device calendar.
 *
 * @param offsetDays - Days to subtract from today.
 * @default 0
 * @returns Date key in `YYYY-MM-DD` format.
 *
 * @example
 * toDateKey()  // today
 * toDateKey(1) // yesterday
 */
export function toDateKey(offsetDays = 0): DateKey {
  const date = subDays(startOfDay(new Date()), offsetDays)
  return format(date, 'yyyy-MM-dd')
}

/**
 * Returns the last seven local calendar days ending today.
 *
 * Entries are ordered oldest to newest. Each item pairs a persistence-friendly
 * date key with a narrow weekday label for compact UI display.
 *
 * @returns Seven {@link DateKeyEntry} values, oldest first.
 *
 * @example
 * getLast7Days()
 * // [
 * //   { dateKey: "2026-05-24", label: "S" },
 * //   ...
 * //   { dateKey: "2026-05-30", label: "S" },
 * // ]
 */
export function getLast7Days(): DateKeyEntry[] {
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
 * Expects input shaped like `YYYY-MM-DD` (or a longer ISO datetime string).
 *
 * @param date - Source date string.
 * @returns Month key in `YYYY-MM` format.
 *
 * @example
 * toMonthKey("2026-05-15") // "2026-05"
 */
export function toMonthKey(date: string): MonthKey {
  return date.slice(0, 7)
}

/**
 * Returns the current local month as a month key.
 *
 * @returns Month key in `YYYY-MM` format.
 *
 * @example
 * getCurrentMonthKey() // "2026-05"
 */
export function getCurrentMonthKey(): MonthKey {
  return format(new Date(), 'yyyy-MM')
}

/**
 * Formats a month key for human-readable display.
 *
 * @param monthKey - Month key in `YYYY-MM` format.
 * @returns Label such as `"May 2026"`.
 *
 * @example
 * formatMonthLabel("2026-05") // "May 2026"
 */
export function formatMonthLabel(monthKey: MonthKey): string {
  const date = parse(monthKey, 'yyyy-MM', new Date())
  return format(date, 'LLLL yyyy')
}

/**
 * Formats a date key for compact transaction display.
 *
 * @param date - Date key in `YYYY-MM-DD` format.
 * @returns Label such as `"May 15"`.
 *
 * @example
 * formatTransactionDate("2026-05-15") // "May 15"
 */
export function formatTransactionDate(date: DateKey): string {
  return format(parseISO(date), 'MMM d')
}
