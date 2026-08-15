// Supabase response rows — snake_case, mirrors the `finance_categories` /
// `finance_transactions` table columns exactly (see supabase/migrations).
// `transform*` in `-utils/finance-queries.ts` maps these onto the camelCase
// domain types in `#/stores/finance-store`.

export interface FinanceCategoryRow {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  color: string
  is_system: boolean
  created_at: string
}

export interface TransactionRow {
  id: string
  user_id: string
  category_id: string
  type: 'income' | 'expense'
  amount: number
  date: string
  note: string | null
  created_at: string
  updated_at: string
  location_place_name: string | null
  location_address: string | null
  location_city: string | null
  location_country: string | null
  location_maps_url: string | null
  /** `null` means live. Set means archived — see `#/utils/archive`. */
  deleted_at: string | null
}

// Lightweight row used by aggregate query (charts + stat cards)
export interface AggregateRow {
  amount: number
  type: 'income' | 'expense'
  date: string
  category_id: string
  location_city: string | null
  location_country: string | null
}

/**
 * The row shape returned by the archive list query. `deleted_at` is
 * narrowed to `string` — the query filters `deleted_at is not null`, so
 * every row returned is guaranteed to carry one.
 */
export type ArchivedTransactionRow = Omit<TransactionRow, 'deleted_at'> & {
  deleted_at: string
}
