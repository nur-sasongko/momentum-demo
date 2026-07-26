import { createColumnHelper } from '@tanstack/react-table'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DataTable } from '#/components/ui/data-table'
import { EditableCell } from '#/components/ui/editable-cell'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import { formatTransactionDate } from '#/utils/date'
import { CategoryManager } from './category-manager'
import { LocationMapEmbed } from './location-map-embed'
import { LocationPickerDialog } from './location-picker'
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

function locationsEqual(
  a: TransactionLocation | null,
  b: TransactionLocation | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.placeName === b.placeName &&
    a.address === b.address &&
    a.city === b.city &&
    a.country === b.country &&
    a.mapsUrl === b.mapsUrl
  )
}

function LocationCell({
  location,
  onSave,
}: {
  location: TransactionLocation | null
  onSave: (location: TransactionLocation | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState(location)
  const debouncedDraft = useDebouncedValue(draft, 500)

  const commitDraft = (next: TransactionLocation) => {
    setDraft(next)
    if (!locationsEqual(next, location)) onSave(next)
  }

  const label = location?.placeName || location?.city

  if (!location) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto justify-start gap-1.5 px-1 py-0.5 text-muted-foreground hover:text-foreground"
          onClick={() => setPickerOpen(true)}
        >
          <MapPin className="size-3.5" />
          Add location
        </Button>
        <LocationPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onConfirm={(next) => {
            setDraft(next)
            onSave(next)
          }}
        />
      </>
    )
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setDraft(location)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group/editable inline-flex max-w-40 items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
          >
            <MapPin className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="start">
          {draft && (
            <div className="space-y-2">
              {debouncedDraft && (
                <LocationMapEmbed location={debouncedDraft} className="h-40" />
              )}
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="tx-row-location-place-name">Place name</Label>
                  <Input
                    id="tx-row-location-place-name"
                    placeholder="Place name"
                    value={draft.placeName}
                    onChange={(e) =>
                      setDraft({ ...draft, placeName: e.target.value })
                    }
                    onBlur={() => commitDraft(draft)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tx-row-location-address">Address</Label>
                  <Textarea
                    id="tx-row-location-address"
                    placeholder="Address"
                    rows={2}
                    value={draft.address}
                    onChange={(e) =>
                      setDraft({ ...draft, address: e.target.value })
                    }
                    onBlur={() => commitDraft(draft)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tx-row-location-city">City</Label>
                  <Input
                    id="tx-row-location-city"
                    placeholder="City"
                    value={draft.city}
                    onChange={(e) =>
                      setDraft({ ...draft, city: e.target.value })
                    }
                    onBlur={() => commitDraft(draft)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tx-row-location-country">Country</Label>
                  <Input
                    id="tx-row-location-country"
                    placeholder="Country"
                    value={draft.country}
                    onChange={(e) =>
                      setDraft({ ...draft, country: e.target.value })
                    }
                    onBlur={() => commitDraft(draft)}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setDraft(null)
                  onSave(null)
                }}
              >
                <Trash2 className="size-3.5" />
                Remove location
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
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
  const setSelectedType = useFinanceStore((s) => s.setSelectedType)
  const selectedCategory = useFinanceStore((s) => s.selectedCategory)
  const setSelectedCategory = useFinanceStore((s) => s.setSelectedCategory)
  const categories = useFinanceStore((s) => s.categories)
  const setAddTransactionOpen = useFinanceStore((s) => s.setAddTransactionOpen)

  const categoryOptions = selectedType
    ? categories.filter((c) => c.type === selectedType)
    : categories

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
    <div className="flex w-full flex-1 flex-wrap items-center gap-2 sm:justify-between">
      <div className="flex w-full gap-2 sm:w-auto">
        <Select
          value={selectedType ?? 'all'}
          onValueChange={(v) => {
            const nextType = v === 'all' ? null : (v as 'income' | 'expense')
            setSelectedType(nextType)
            if (
              selectedCategory &&
              nextType &&
              categories.find((c) => c.id === selectedCategory)?.type !==
                nextType
            ) {
              setSelectedCategory(null)
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="flex-1 text-sm sm:w-30 sm:flex-none"
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
            className="flex-1 text-sm sm:w-40 sm:flex-none"
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

      <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
        <CategoryManager />
        <Button
          size="sm"
          className="flex-1 gap-1.5 sm:flex-none"
          onClick={() => setAddTransactionOpen(true)}
        >
          <Plus className="size-4 sm:size-3.5" />
          Add Transaction
        </Button>
      </div>
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
