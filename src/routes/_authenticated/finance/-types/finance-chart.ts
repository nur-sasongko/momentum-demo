import type { DateKey } from '#/utils/date'

export interface FilteredSummary {
  /** Expense total within the filtered set. */
  expense: number
  /** Income total within the filtered set. */
  income: number
  /** `income - expense`. */
  net: number
  count: number
  /**
   * Filtered total as a fraction of the same date range's total for that
   * type. `null` when no single `type` is active, the filtered count is 0,
   * or the denominator is 0 — never a silent 0 or NaN.
   */
  share: number | null
  /** Mean amount per matching transaction. `null` when `count === 0`. */
  average: number | null
}

export interface CategorySpending {
  category: string
  categoryId: string
  amount: number
  fill: string
}

export interface DailyCategorySeries {
  /** Category id — also the corresponding key on each `DailySpendingPoint`. */
  key: string
  name: string
  color: string
}

export interface DailySpendingPoint {
  date: DateKey
  dateLabel: string
  total: number
  [seriesKey: string]: string | number
}

export interface LocationSpending {
  location: string
  amount: number
  fill: string
}

export interface FacetOption {
  value: string
  count: number
}

export type DrilldownSelection =
  | {
      kind: 'category'
      label: string
      color: string
      amount: number
      categoryId: string
      categoryName: string
    }
  | {
      kind: 'day-category'
      label: string
      color: string
      amount: number
      categoryId: string
      categoryName: string
      day: DateKey
      dayLabel: string
    }
  | { kind: 'city'; label: string; color: string; amount: number; city: string }
  | {
      kind: 'country'
      label: string
      color: string
      amount: number
      country: string
    }

export interface DrilldownSpec {
  dateFrom: string | null
  dateTo: string | null
  type: 'expense'
  categoryIds: string[]
  cities: string[]
  countries: string[]
}
