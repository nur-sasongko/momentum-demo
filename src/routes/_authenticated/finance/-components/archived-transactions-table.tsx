import { createColumnHelper } from '@tanstack/react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ArchiveRowActions } from '#/components/archive-row-actions'
import { Badge } from '#/components/ui/badge'
import { DataTable } from '#/components/ui/data-table'
import { cn } from '#/libs/utils'
import { formatExpiryLabel } from '#/utils/archive'
import { formatNumberWithSeparators } from '#/utils/currency'
import { formatDateTimeLabel, formatTimeSince } from '#/utils/date'
import {
  useArchivedTransactionsQuery,
  usePurgeTransactionMutation,
  useRestoreTransactionMutation,
} from '../-utils/finance-queries'

import type { ArchivedTransaction } from '../-types/finance-query'

const columnHelper = createColumnHelper<ArchivedTransaction>()
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function buildColumns(
  onRestore: (id: string) => void,
  onPurge: (id: string) => void,
) {
  return [
    columnHelper.accessor('date', {
      header: 'Date',
      size: 130,
      minSize: 110,
      cell: (info) => formatDateTimeLabel(info.getValue()),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor((row) => row.category?.name ?? 'Other', {
      id: 'category',
      header: 'Category',
      size: 150,
      minSize: 110,
      cell: (info) => {
        const row = info.row.original
        const color = row.category?.color ?? '#71717a'
        return (
          <Badge
            variant="outline"
            className="border-0 font-normal"
            style={{ backgroundColor: `${color}26`, color }}
          >
            {row.category?.name ?? 'Other'}
          </Badge>
        )
      },
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('note', {
      header: 'Note',
      size: 220,
      minSize: 120,
      meta: { overflow: 'truncate' },
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      size: 130,
      minSize: 100,
      meta: { align: 'right' },
      cell: (info) => {
        const row = info.row.original
        const isIncome = row.type === 'income'
        return (
          <span
            className={cn(
              'tabular font-semibold whitespace-nowrap',
              isIncome ? 'text-money-in' : 'text-money-out',
            )}
          >
            {isIncome ? '+' : '−'}
            {formatNumberWithSeparators(row.amount)}
          </span>
        )
      },
      sortingFn: 'basic',
    }),
    columnHelper.accessor('deletedAt', {
      header: 'Deleted',
      size: 130,
      minSize: 110,
      cell: (info) => `${formatTimeSince(info.getValue())} ago`,
      sortingFn: 'alphanumeric',
    }),
    columnHelper.display({
      id: 'expires',
      header: 'Expires',
      size: 110,
      minSize: 100,
      cell: (info) => formatExpiryLabel(info.row.original.deletedAt),
    }),
    columnHelper.display({
      id: 'actions',
      size: 90,
      minSize: 90,
      enableResizing: false,
      enableSorting: false,
      meta: { align: 'right' },
      cell: (info) => {
        const row = info.row.original
        const isIncome = row.type === 'income'
        const label = `${row.category?.name ?? 'Other'} — ${isIncome ? '+' : '−'}${formatNumberWithSeparators(row.amount)}`
        return (
          <ArchiveRowActions
            label={label}
            onRestore={() => onRestore(row.id)}
            onPurge={() => onPurge(row.id)}
          />
        )
      },
    }),
  ]
}

export function ArchivedTransactionsTable() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { data, isFetching, isLoading } = useArchivedTransactionsQuery({
    page: pageIndex,
    pageSize,
  })
  const restoreMutation = useRestoreTransactionMutation()
  const purgeMutation = usePurgeTransactionMutation()

  const transactions = data?.data ?? []
  const total = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  // Purging the last row on a page (or restoring it) can shrink pageCount
  // below the current page — fall back rather than showing an empty page.
  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) {
      setPageIndex(pageCount - 1)
    }
  }, [pageIndex, pageCount])

  const handleRestore = useCallback(
    (id: string) => {
      restoreMutation.mutate(id)
      toast.success('Transaction restored')
    },
    [restoreMutation],
  )

  const handlePurge = useCallback(
    (id: string) => {
      purgeMutation.mutate(id)
      toast.success('Transaction permanently deleted')
    },
    [purgeMutation],
  )

  const columns = useMemo(
    () => buildColumns(handleRestore, handlePurge),
    [handleRestore, handlePurge],
  )

  return (
    <DataTable
      columns={columns}
      data={transactions}
      tableId="archive.transactions"
      isLoading={isLoading}
      isFetching={isFetching}
      emptyMessage="No archived transactions."
      serverPagination={{
        pageIndex,
        pageSize,
        total,
        pageCount,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        onPageIndexChange: setPageIndex,
        onPageSizeChange: (size) => {
          setPageSize(size)
          setPageIndex(0)
        },
      }}
    />
  )
}
