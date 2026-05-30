import { format } from 'date-fns'

/**
 * Formats today's date for display in the app shell (e.g. TopBar).
 *
 * @returns A human-readable date string such as `"Saturday, May 30"`.
 */
export function formatTodayDate() {
  return format(new Date(), 'EEEE, MMMM d')
}
