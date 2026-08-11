/**
 * Shared helpers for TanStack Router validated search params.
 *
 * @module utils/search-params
 */

import { z } from 'zod'

/**
 * Normalizes a search value that should be a string array. A bare scalar
 * (produced by a hand-typed URL, e.g. `?cat=a`) is wrapped into a
 * single-element array rather than rejected.
 */
export const stringArrayParam = z
  .preprocess((val) => {
    if (val === undefined) return undefined
    return Array.isArray(val) ? val : [val]
  }, z.array(z.string()))
  .catch([])

/**
 * Toggles a value in a list and reports whether the list crossed the
 * empty/non-empty boundary, so callers can decide whether the change should
 * push a new browser-history entry or replace the current one (coalescing a
 * run of toggles into a single Back step while the selection stays
 * non-empty).
 */
export function toggleArrayValue<T>(
  list: T[],
  value: T,
): { next: T[]; isBoundary: boolean } {
  const next = list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
  const isBoundary = list.length === 0 || next.length === 0
  return { next, isBoundary }
}
