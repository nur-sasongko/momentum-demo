import type {
  DateRange,
  Transaction,
  TransactionType,
} from '#/stores/finance-store'

export interface TransactionQueryParams {
  page: number
  pageSize: number
  dateFrom: string | null
  dateTo: string | null
  type: 'income' | 'expense' | null
  /** Empty means "all categories". Sort before passing — this is a cache key. */
  categoryIds: string[]
  /** Empty means "all locations". `''` selects rows with no city recorded. */
  cities: string[]
  /** Empty means "all countries". `''` selects rows with no country recorded. */
  countries: string[]
  search: string | null
}

export interface TransactionPage {
  data: Transaction[]
  count: number
}

/** An archived transaction — the live `Transaction` shape plus when it was archived. */
export type ArchivedTransaction = Transaction & { deletedAt: string }

export interface ArchivedTransactionsParams {
  page: number
  pageSize: number
}

export interface ArchivedTransactionsPage {
  data: ArchivedTransaction[]
  count: number
}

export type CityFilter =
  | { kind: 'none' }
  | { kind: 'in'; values: string[] }
  | { kind: 'or'; expression: string }

/**
 * Batched patch applied in a single navigation — see `useFinanceFilters().setFilters`.
 * `view` is inlined rather than importing `FinanceView` from `../-utils/finance-search`:
 * `-types/` stays one-way-dependent on `#/stores/`, never on `-utils/`.
 */
export interface FinanceFiltersPatch {
  view?: 'chart' | 'table'
  dateRange?: DateRange
  selectedType?: TransactionType | null
  selectedCategories?: string[]
  selectedCities?: string[]
}
