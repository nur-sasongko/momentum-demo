import { z } from 'zod'

import type { TransactionType } from '#/stores/finance-store'

/** Active tab on the finance page. Defined here, not in the store — see docs/specs/011-finance-filters-url-state.md. */
export type FinanceView = 'chart' | 'table'

export const FINANCE_ROUTE_ID = '/_authenticated/finance/' as const

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normalizes a search value that should be a string array. A bare scalar
 * (produced by a hand-typed URL, e.g. `?cat=a`) is wrapped into a
 * single-element array rather than rejected.
 */
const stringArrayParam = z
  .preprocess((val) => {
    if (val === undefined) return undefined
    return Array.isArray(val) ? val : [val]
  }, z.array(z.string()))
  .catch([])

export const financeSearchSchema = z.object({
  view: z.enum(['chart', 'table']).catch('chart'),
  from: z.string().regex(DATE_KEY_PATTERN).optional().catch(undefined),
  to: z.string().regex(DATE_KEY_PATTERN).optional().catch(undefined),
  type: z.enum(['income', 'expense']).optional().catch(undefined),
  /** Selected category ids. Empty means "all categories". */
  cat: stringArrayParam,
  /** Selected `location_city` values. `''` means "no location recorded". */
  city: stringArrayParam,
})

export type FinanceSearch = z.infer<typeof financeSearchSchema>

export const FINANCE_SEARCH_DEFAULTS: FinanceSearch = {
  view: 'chart',
  from: undefined,
  to: undefined,
  type: undefined,
  cat: [],
  city: [],
}

// Re-exported so consumers of the search schema don't also need to import
// from the store just for this type.
export type { TransactionType }
