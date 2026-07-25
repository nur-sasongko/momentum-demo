import { createColumnHelper } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DataTable } from '#/components/ui/data-table'
import { EditableCell } from '#/components/ui/editable-cell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import { formatTransactionDate } from '#/utils/date'
import {
  useDeleteTransactionMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from '../-utils/finance-queries'
import { formatCurrency } from '../-utils/finance-utils'

import type { FinanceCategory, Transaction } from '#/stores/finance-store'

const columnHelper = createColumnHelper<Transaction>()

type UpdateInput = {
  type: 'income' | 'expense'
  amount: number
  date: string
  note: string
  categoryId: string
}

function toUpdateInput(tx: Transaction): UpdateInput {
  return {
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    note: tx.note,
    categoryId: tx.categoryId,
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

  const dateRange = useFinanceStore((s) => s.dateRange)
  const selectedType = useFinanceStore((s) => s.selectedType)
  const setSelectedType = useFinanceStore((s) => s.setSelectedType)
  const selectedCategory = useFinanceStore((s) => s.selectedCategory)
  const setSelectedCategory = useFinanceStore((s) => s.setSelectedCategory)
  const categories = useFinanceStore((s) => s.categories)

  const categoryOptions = selectedType
    ? categories.filter((c) => c.type === selectedType)
    : categories

  // Reset to first page when filters change
  useEffect(() => {
    setPageIndex(0)
  }, [dateRange.from, dateRange.to, selectedType, selectedCategory])

  const { data, isFetching } = useTransactionsQuery({
    page: pageIndex,
    pageSize,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    type: selectedType,
    categoryId: selectedCategory,
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
    <div className="flex w-full gap-2 sm:w-auto">
      <Select
        value={selectedType ?? 'all'}
        onValueChange={(v) => {
          const nextType = v === 'all' ? null : (v as 'income' | 'expense')
          setSelectedType(nextType)
          if (
            selectedCategory &&
            nextType &&
            categories.find((c) => c.id === selectedCategory)?.type !== nextType
          ) {
            setSelectedCategory(null)
          }
        }}
      >
        <SelectTrigger
          size="sm"
          className="flex-1 text-sm sm:w-[120px] sm:flex-none"
        >
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="income">Income</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={selectedCategory ?? 'all'}
        onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}
      >
        <SelectTrigger
          size="sm"
          className="flex-1 text-sm sm:w-[160px] sm:flex-none"
        >
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categoryOptions.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      />
    </div>
  )
}
