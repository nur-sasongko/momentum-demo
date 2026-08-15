/**
 * Shared archive/retention helpers for the soft-delete system (notes,
 * finance transactions).
 *
 * @module utils/archive
 */

/**
 * How long an archived item is kept before `purge_expired_archives()`
 * (see `supabase/migrations/20260815000002_purge_expired_archives.sql`)
 * hard-deletes it. Presentational only — this constant never drives a
 * delete; the Postgres function's own `interval '30 days'` is authoritative
 * and must be kept in sync with this value by hand.
 */
export const ARCHIVE_RETENTION_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Days remaining before an archived item is purged, floored at 0.
 *
 * The purge job runs once daily, so an item can sit at 0 for up to 24 hours
 * before it actually disappears — this never goes negative.
 *
 * @param deletedAt - ISO datetime string the item was archived at.
 * @param now - Reference time; defaults to the current time. Inject a fixed
 *   value in tests instead of relying on the real clock.
 *
 * @example
 * daysUntilPurge("2026-08-15T00:00:00.000Z", new Date("2026-08-16T00:00:00.000Z")) // 29
 */
export function daysUntilPurge(
  deletedAt: string,
  now: Date = new Date(),
): number {
  const elapsedMs = now.getTime() - new Date(deletedAt).getTime()
  const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY)
  return Math.max(0, ARCHIVE_RETENTION_DAYS - elapsedDays)
}

/**
 * Human-readable expiry label for an archived item's "Expires" column.
 *
 * @param deletedAt - ISO datetime string the item was archived at.
 * @param now - Reference time; defaults to the current time. Inject a fixed
 *   value in tests instead of relying on the real clock.
 * @returns `"today"`, `"tomorrow"`, or `"in N days"`.
 *
 * @example
 * formatExpiryLabel("2026-08-15T00:00:00.000Z", new Date("2026-08-15T00:00:00.000Z")) // "in 30 days"
 */
export function formatExpiryLabel(
  deletedAt: string,
  now: Date = new Date(),
): string {
  const days = daysUntilPurge(deletedAt, now)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}
