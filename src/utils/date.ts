/**
 * Shared date formatting and key helpers for app-wide calendar display.
 *
 * All day-based keys use the user's local timezone so UI labels and persisted
 * keys stay aligned with on-device calendar days.
 *
 * @module utils/date
 */

import {
  addDays,
  endOfDay,
  format,
  parse,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'

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

/**
 * Whether an ISO date string carries an explicit time-of-day.
 *
 * Local midnight is treated as "no time set" — the sentinel used across the
 * app for dates that were entered without a specific time.
 *
 * @param isoDate - ISO date/datetime string.
 * @returns `true` if the time component is not local midnight.
 *
 * @example
 * hasExplicitTime("2026-07-29T00:00:00.000Z") // depends on local offset
 * hasExplicitTime("2026-07-29T14:30:00.000Z") // true
 */
export function hasExplicitTime(isoDate?: string): boolean {
  if (!isoDate) return false
  const d = new Date(isoDate)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/**
 * Formats an ISO date/datetime string for display, omitting the time when
 * none was explicitly set.
 *
 * @param isoDate - ISO date/datetime string.
 * @returns Label such as `"Jul 29"` or `"Jul 29, 2:30 PM"`.
 *
 * @example
 * formatDateTimeLabel("2026-07-29T00:00:00.000Z") // "Jul 29" (if local midnight)
 * formatDateTimeLabel("2026-07-29T14:30:00.000Z") // "Jul 29, 2:30 PM"
 */
export function formatDateTimeLabel(isoDate: string): string {
  const date = new Date(isoDate)
  return hasExplicitTime(isoDate)
    ? format(date, 'MMM d, h:mm a')
    : format(date, 'MMM d')
}

/**
 * Returns how long ago an ISO date/datetime string was, as a bare duration.
 *
 * Returns just the magnitude — e.g. `"5 minutes"`, not `"5 minutes ago"` —
 * so callers control the surrounding phrasing (e.g. "Last edited 5 minutes
 * ago" vs. a bare "5 minutes" in a compact list row).
 *
 * @param isoDate - ISO date/datetime string in the past.
 * @returns A duration label such as `"just now"`, `"5 minutes"`, `"3 hours"`, or `"2 days"`.
 *
 * @example
 * formatTimeSince("2026-05-30T12:00:00.000Z") // "5 minutes" (no "ago" suffix)
 */
export function formatTimeSince(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour' : `${diffHours} hours`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) {
    return '1 day'
  }
  return `${diffDays} days`
}

/**
 * Returns how long ago an ISO date/datetime string was, as a complete
 * phrase — `"just now"` or `"5 minutes ago"` — never a dangling `"just now
 * ago"`.
 *
 * @param isoDate - ISO date/datetime string in the past.
 * @returns A phrase such as `"just now"`, `"5 minutes ago"`, or `"2 days ago"`.
 *
 * @example
 * formatTimeAgo("2026-05-30T12:00:00.000Z") // "5 minutes ago"
 */
export function formatTimeAgo(isoDate: string): string {
  const since = formatTimeSince(isoDate)
  return since === 'just now' ? since : `${since} ago`
}

/**
 * Formats an ISO date/datetime string as a short absolute date, omitting
 * the year within the current year and appending it otherwise.
 *
 * @param isoDate - ISO date/datetime string.
 * @returns A label such as `"Aug 12"` or `"Aug 12, 2025"`.
 *
 * @example
 * formatShortDate("2026-08-12T09:41:00.000Z") // "Aug 12" (in 2026)
 * formatShortDate("2025-08-12T09:41:00.000Z") // "Aug 12, 2025"
 */
export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate)
  const isCurrentYear = date.getFullYear() === new Date().getFullYear()
  return format(date, isCurrentYear ? 'MMM d' : 'MMM d, yyyy')
}

/**
 * Formats an ISO date/datetime string as a full, unambiguous timestamp for
 * a tooltip that peeks the exact instant behind a relative or abbreviated
 * label.
 *
 * @param isoDate - ISO date/datetime string.
 * @returns A label such as `"Aug 12, 2026  9:41 AM"`.
 *
 * @example
 * formatExactTimestamp("2026-08-12T09:41:00.000Z") // "Aug 12, 2026  9:41 AM"
 */
export function formatExactTimestamp(isoDate: string): string {
  return format(new Date(isoDate), 'MMM d, yyyy  h:mm a')
}

/**
 * Returns the end of the local day for a date key, for use as an inclusive
 * upper bound when comparing against timestamps that may carry time-of-day.
 *
 * @param date - Date key in `YYYY-MM-DD` format.
 * @returns ISO datetime string at `23:59:59.999` local time on that day.
 *
 * @example
 * endOfDayIso("2026-07-29") // "2026-07-29T23:59:59.999" (local offset applied)
 */
export function endOfDayIso(date: DateKey): string {
  return endOfDay(parseISO(date)).toISOString()
}

/**
 * Returns the start of the local day for a date key, for use as an inclusive
 * lower bound when comparing against timestamps that may carry time-of-day.
 *
 * Pairs with {@link endOfDayIso}. Using the date key's raw string (or its
 * UTC midnight) as a lower bound instead of this would silently exclude
 * early-morning local transactions at positive UTC offsets.
 *
 * @param date - Date key in `YYYY-MM-DD` format.
 * @returns ISO datetime string at `00:00:00.000` local time on that day.
 *
 * @example
 * startOfDayIso("2026-07-29") // "2026-07-29T00:00:00.000" (local offset applied)
 */
export function startOfDayIso(date: DateKey): string {
  return startOfDay(parseISO(date)).toISOString()
}

/**
 * Truncates an ISO date/datetime string to its local calendar day key,
 * regardless of any time-of-day component.
 *
 * @param isoDate - ISO date/datetime string.
 * @returns Date key in `YYYY-MM-DD` format.
 *
 * @example
 * toDayKey("2026-07-29T14:30:00.000Z") // "2026-07-29" (local offset applied)
 */
export function toDayKey(isoDate: string): DateKey {
  return format(new Date(isoDate), 'yyyy-MM-dd')
}

/**
 * Returns every local calendar day between two date keys, inclusive.
 *
 * @param from - Start date key in `YYYY-MM-DD` format.
 * @param to - End date key in `YYYY-MM-DD` format.
 * @returns Date keys ordered oldest to newest.
 *
 * @example
 * getDaysInRange("2026-07-01", "2026-07-03")
 * // ["2026-07-01", "2026-07-02", "2026-07-03"]
 */
export function getDaysInRange(from: DateKey, to: DateKey): DateKey[] {
  const start = startOfDay(parseISO(from))
  const end = startOfDay(parseISO(to))
  const days: DateKey[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(format(d, 'yyyy-MM-dd'))
  }
  return days
}
