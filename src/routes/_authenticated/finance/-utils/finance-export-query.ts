import { getSupabaseBrowserClient } from '#/libs/supabase/client'
import { useFinanceStore } from '#/stores/finance-store'
import {
  applyTransactionFilters,
  liveOnly,
  transformTransaction,
} from './finance-queries'

import type { TransactionRow } from '../-types/finance-api'
import type { FinanceExportFilters } from '../-types/finance-export'
import type { Transaction } from '#/stores/finance-store'

/** Supabase's default per-request row ceiling — also the export's fetch batch size. */
const EXPORT_BATCH_SIZE = 1000

/** See spec 027 Open Questions — a guess, not a measurement. */
const EXPORT_ROW_CAP = 20_000

/** Thrown before any row is fetched into memory when the filtered set exceeds `EXPORT_ROW_CAP`. */
export class FinanceExportRowCapError extends Error {
  constructor(readonly matchCount: number) {
    super(
      `${matchCount} transactions match the current filters — narrow the date range to export.`,
    )
    this.name = 'FinanceExportRowCapError'
  }
}

/**
 * Refetches every live transaction matching `filters`, batched — the
 * table's own cached query (`useTransactionsQuery`) only ever holds one
 * page. Aborts before reading any row if the total exceeds
 * `EXPORT_ROW_CAP`, using the exact count Supabase returns on the first
 * batch, so a huge filtered set never produces a silently truncated file.
 */
export async function fetchAllTransactionsForExport(
  filters: FinanceExportFilters,
): Promise<Transaction[]> {
  const supabase = getSupabaseBrowserClient()
  const rows: TransactionRow[] = []

  for (let batch = 0; ; batch++) {
    const from = batch * EXPORT_BATCH_SIZE
    const to = from + EXPORT_BATCH_SIZE - 1

    const q = applyTransactionFilters(
      liveOnly(
        supabase
          .from('finance_transactions')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('date', { ascending: false })
          .range(from, to),
      ),
      filters,
    )

    const { data, count, error } = await q
    if (error) throw error

    if (batch === 0 && (count ?? 0) > EXPORT_ROW_CAP) {
      throw new FinanceExportRowCapError(count ?? 0)
    }

    const page = data as TransactionRow[]
    rows.push(...page)

    if (page.length < EXPORT_BATCH_SIZE) break
  }

  const categories = useFinanceStore.getState().categories
  return rows.map((row) => transformTransaction(row, categories))
}
