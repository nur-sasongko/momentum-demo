import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '#/libs/utils'
import { Button } from './button'
import { Input } from './input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table as TanstackTable,
} from '@tanstack/react-table'

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export interface ServerPaginationProps {
  pageIndex: number
  pageSize: number
  total: number
  pageCount: number
  pageSizeOptions?: number[]
  onPageIndexChange: (index: number) => void
  onPageSizeChange: (size: number) => void
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  emptyMessage?: string
  defaultPageSize?: number
  pageSizeOptions?: number[]
  serverPagination?: ServerPaginationProps
}

function PaginationBar({
  pageIndex,
  pageSize,
  total,
  pageSizeOptions,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  total: number
  pageSizeOptions: number[]
  canPrevious: boolean
  canNext: boolean
  onPrevious: () => void
  onNext: () => void
  onPageSizeChange: (size: number) => void
}) {
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-20 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground">
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={!canPrevious}
          onClick={onPrevious}
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={!canNext}
          onClick={onNext}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ClientPaginationBar<TData>({
  table,
  pageSizeOptions,
}: {
  table: TanstackTable<TData>
  pageSizeOptions: number[]
}) {
  const { pageIndex, pageSize } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length

  return (
    <PaginationBar
      pageIndex={pageIndex}
      pageSize={pageSize}
      total={total}
      pageSizeOptions={pageSizeOptions}
      canPrevious={table.getCanPreviousPage()}
      canNext={table.getCanNextPage()}
      onPrevious={() => table.previousPage()}
      onNext={() => table.nextPage()}
      onPageSizeChange={(size) => {
        table.setPageSize(size)
        table.setPageIndex(0)
      }}
    />
  )
}

function ServerPaginationBar({
  pageIndex,
  pageSize,
  total,
  pageCount,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageIndexChange,
  onPageSizeChange,
}: ServerPaginationProps) {
  return (
    <PaginationBar
      pageIndex={pageIndex}
      pageSize={pageSize}
      total={total}
      pageSizeOptions={pageSizeOptions}
      canPrevious={pageIndex > 0}
      canNext={pageIndex < pageCount - 1}
      onPrevious={() => onPageIndexChange(pageIndex - 1)}
      onNext={() => onPageIndexChange(pageIndex + 1)}
      onPageSizeChange={onPageSizeChange}
    />
  )
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  toolbar,
  emptyMessage = 'No results.',
  defaultPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  serverPagination,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize ?? pageSizeOptions[0],
  })

  const isClientPaginated = defaultPageSize !== undefined && !serverPagination
  const isServerPaginated = !!serverPagination

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      ...(isClientPaginated && { pagination }),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value)
      if (isClientPaginated) setPagination((p) => ({ ...p, pageIndex: 0 }))
    },
    ...(isClientPaginated && { onPaginationChange: setPagination }),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(isClientPaginated && {
      getPaginationRowModel: getPaginationRowModel(),
    }),
    manualPagination: isServerPaginated,
    globalFilterFn: 'includesString',
    autoResetPageIndex: isClientPaginated,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pr-7 text-sm"
          />
          {globalFilter && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={() => setGlobalFilter('')}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        {toolbar}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-9 text-xs font-medium',
                        canSort &&
                          'cursor-pointer select-none hover:text-foreground',
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <span className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {canSort && (
                          <span className="text-muted-foreground">
                            {sorted === 'asc' ? (
                              <ChevronUp className="size-3" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3" />
                            )}
                          </span>
                        )}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isClientPaginated && (
        <ClientPaginationBar table={table} pageSizeOptions={pageSizeOptions} />
      )}
      {isServerPaginated && <ServerPaginationBar {...serverPagination} />}
    </div>
  )
}
