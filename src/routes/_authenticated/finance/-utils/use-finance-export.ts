import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { useFinanceStore } from '#/stores/finance-store'
import { exportFinanceTransactionsToXlsx } from './export-finance-xlsx'
import {
  FinanceExportRowCapError,
  fetchAllTransactionsForExport,
} from './finance-export-query'
import { useFinanceAggregateQuery } from './finance-queries'
import { getFilteredSummary } from './finance-utils'
import { useFinanceFilters } from './use-finance-filters'

import type { FinanceExportFilters } from '../-types/finance-export'

function toExportFilters(
  filters: ReturnType<typeof useFinanceFilters>,
): FinanceExportFilters {
  return {
    dateFrom: filters.dateRange.from,
    dateTo: filters.dateRange.to,
    type: filters.selectedType,
    categoryIds: filters.selectedCategories,
    cities: filters.selectedCities,
    // No country filter is exposed in the UI yet — see `TransactionsTable`.
    countries: [],
    search: null,
  }
}

/**
 * Wires the active filter state to the batched fetch and the `.xlsx`
 * writer, owning the pending flag and every toast. Mirrors the shape of
 * `note-editor.tsx`'s `runExport` for the PDF export (spec 026).
 */
export function useFinanceExport() {
  const [isPending, setIsPending] = useState(false)
  const filters = useFinanceFilters()
  const categories = useFinanceStore((s) => s.categories)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const summary = getFilteredSummary(
    aggregateRows,
    filters.dateRange,
    filters.selectedType,
    filters.selectedCategories,
    filters.selectedCities,
  )
  const isEmpty = summary.count === 0

  const exportTransactions = useCallback(async () => {
    if (isPending) return
    setIsPending(true)
    const toastId = toast.loading('Exporting…')

    try {
      const exportFilters = toExportFilters(filters)
      const rows = await fetchAllTransactionsForExport(exportFilters)

      if (rows.length === 0) {
        toast.error('No transactions match the current filters.', {
          id: toastId,
        })
        return
      }

      const result = await exportFinanceTransactionsToXlsx(
        rows,
        categories,
        exportFilters,
        new Date(),
      )

      const suffix =
        result.truncatedNotes > 0
          ? ` · ${result.truncatedNotes} note${result.truncatedNotes === 1 ? '' : 's'} shortened to fit Excel's cell limit`
          : ''
      toast.success(
        `Exported ${result.rowCount} transaction${result.rowCount === 1 ? '' : 's'}${suffix}`,
        { id: toastId },
      )
    } catch (error) {
      if (error instanceof FinanceExportRowCapError) {
        toast.error(
          'Too many transactions to export at once — narrow the date range.',
          { id: toastId },
        )
      } else {
        toast.error('Export failed. Check your connection and try again.', {
          id: toastId,
        })
      }
    } finally {
      setIsPending(false)
    }
  }, [isPending, filters, categories])

  return { exportTransactions, isPending, isEmpty }
}
