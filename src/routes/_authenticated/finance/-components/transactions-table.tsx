import { createColumnHelper } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { LocationCell } from '#/components/location/location-cell'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DataTable } from '#/components/ui/data-table'
import { EditableCell } from '#/components/ui/editable-cell'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import { formatTransactionDate } from '#/utils/date'
import { CategoryManager } from './category-manager'
import { TransactionFilters } from './transaction-filters'
import {
  useDeleteTransactionMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from '../-utils/finance-queries'
import { formatCurrency } from '../-utils/finance-utils'

import type {
  FinanceCategory,
  Transaction,
  TransactionLocation,
} from '#/stores/finance-store'

const columnHelper = createColumnHelper<Transaction>()

type UpdateInput = {
  type: 'income' | 'expense'
  amount: number
  date: string
  note: string
  categoryId: string
  location?: TransactionLocation | null
}

function toUpdateInput(tx: Transaction): UpdateInput {
  return {
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    note: tx.note,
    categoryId: tx.categoryId,
    location: tx.location,
  }
}

function RowActions({ row }: { row: Transaction }) {
  const setEditingTransaction = useFinanceStore((s) => s.setEditingTransaction)
  const deleteMutation = useDeleteTransactionMutation()

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setEditingTransaction(row)}
        aria-label="Edit transaction"
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteMutation.mutate(row.id)}
        aria-label="Delete transaction"
        className="text-muted-foreground hover:text-destructive"
        disabled={deleteMutation.isPending}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

function buildColumns(
  onUpdate: (id: string, input: UpdateInput) => void,
  categories: FinanceCategory[],
) {
  return [
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => {
        const row = info.row.original
        return (
          <EditableCell
            value={row.date}
            type="date"
            display={
              <span className="whitespace-nowrap text-muted-foreground">
                {formatTransactionDate(row.date)}
              </span>
            }
            onSave={(newDate) =>
              onUpdate(row.id, { ...toUpdateInput(row), date: newDate })
            }
          />
        )
      },
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor((row) => row.category?.name ?? 'Other', {
      id: 'category',
      header: 'Category',
      cell: (info) => {
        const row = info.row.original
        const color = row.category?.color ?? '#71717a'
        const typeCategories = categories.filter((c) => c.type === row.type)
        return (
          <EditableCell
            value={row.categoryId}
            options={typeCategories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            display={
              <Badge
                variant="outline"
                className="border-0 font-normal"
                style={{ backgroundColor: `${color}26`, color }}
              >
                {row.category?.name ?? 'Other'}
              </Badge>
            }
            onSave={(newCategoryId) =>
              onUpdate(row.id, {
                ...toUpdateInput(row),
                categoryId: newCategoryId,
              })
            }
          />
        )
      },
      sortingFn: 'alphanumeric',
      enableGlobalFilter: false,
    }),
    columnHelper.accessor('note', {
      header: 'Note',
      cell: (info) => {
        const row = info.row.original
        return (
          <EditableCell
            value={row.note}
            placeholder="Add a note…"
            display={
              row.note ? (
                <span>{row.note}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
            onSave={(newNote) =>
              onUpdate(row.id, { ...toUpdateInput(row), note: newNote })
            }
          />
        )
      },
    }),
    columnHelper.accessor(
      (row) => row.location?.placeName || row.location?.city || '',
      {
        id: 'location',
        header: 'Location',
        cell: (info) => {
          const row = info.row.original
          return (
            <LocationCell
              location={row.location}
              onSave={(location) =>
                onUpdate(row.id, { ...toUpdateInput(row), location })
              }
            />
          )
        },
        sortingFn: 'alphanumeric',
      },
    ),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => {
        const row = info.row.original
        const isIncome = row.type === 'income'
        return (
          <EditableCell
            value={String(row.amount)}
            type="number"
            display={
              <span
                className={cn(
                  'font-semibold tabular-nums whitespace-nowrap',
                  isIncome
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400',
                )}
              >
                {isIncome ? '+' : '−'}
                {formatCurrency(row.amount)}
              </span>
            }
            onSave={(raw) => {
              const parsed = parseFloat(raw)
              if (!isNaN(parsed) && parsed > 0)
                onUpdate(row.id, { ...toUpdateInput(row), amount: parsed })
            }}
          />
        )
      },
      sortingFn: 'basic',
      enableGlobalFilter: false,
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => <RowActions row={info.row.original} />,
      enableSorting: false,
    }),
  ]
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export function TransactionsTable() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const dateRange = useFinanceStore((s) => s.dateRange)
  const selectedType = useFinanceStore((s) => s.selectedType)
  const selectedCategory = useFinanceStore((s) => s.selectedCategory)
  const categories = useFinanceStore((s) => s.categories)
  const setAddTransactionOpen = useFinanceStore((s) => s.setAddTransactionOpen)

  // Reset to first page when filters change
  useEffect(() => {
    setPageIndex(0)
  }, [
    dateRange.from,
    dateRange.to,
    selectedType,
    selectedCategory,
    debouncedSearch,
  ])

  const { data, isFetching } = useTransactionsQuery({
    page: pageIndex,
    pageSize,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    type: selectedType,
    categoryId: selectedCategory,
    search: debouncedSearch || null,
  })

  const transactions = data?.data ?? []
  const total = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const updateMutation = useUpdateTransactionMutation()

  const handleUpdate = useCallback(
    (id: string, input: UpdateInput) => {
      updateMutation.mutate({ id, input })
    },
    [updateMutation],
  )

  const columns = useMemo(
    () => buildColumns(handleUpdate, categories),
    [handleUpdate, categories],
  )

  const toolbar = (
    <div className="flex w-full flex-1 items-center gap-2">
      <TransactionFilters />
      <CategoryManager />
      <Button
        size="sm"
        className="ml-auto gap-1.5"
        aria-label="Add transaction"
        onClick={() => setAddTransactionOpen(true)}
      >
        <Plus className="size-4 sm:size-3.5" />
        <span className="hidden sm:inline">Add Transaction</span>
      </Button>
    </div>
  )

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">
        Transactions
        {isFetching && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Loading…
          </span>
        )}
      </h2>
      <DataTable
        columns={columns}
        data={transactions}
        searchPlaceholder="Search notes…"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        toolbar={toolbar}
        emptyMessage={
          total === 0
            ? 'No transactions match your filters.'
            : 'No results on this page.'
        }
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
        striped
      />
    </div>
  )
}
