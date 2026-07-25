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
import { useEffect, useState } from 'react'

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
  columns: ColumnDef<TData, any>[]
  data: TData[]
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  emptyMessage?: string
  defaultPageSize?: number
  pageSizeOptions?: number[]
  serverPagination?: ServerPaginationProps
  /** Alternate row background for readability on dense tables. */
  striped?: boolean
  /** Controlled search — pass together with `onSearchChange` to filter server-side
   * instead of via the table's built-in client-side global filter. */
  searchValue?: string
  onSearchChange?: (value: string) => void
}

function PageJumpInput({
  pageIndex,
  pageCount,
  onPageIndexChange,
}: {
  pageIndex: number
  pageCount: number
  onPageIndexChange: (index: number) => void
}) {
  const [value, setValue] = useState(String(pageIndex + 1))

  useEffect(() => {
    setValue(String(pageIndex + 1))
  }, [pageIndex])

  const commit = () => {
    const parsed = Number(value)
    const clamped = Math.min(Math.max(Math.trunc(parsed), 1), pageCount)
    if (Number.isInteger(parsed) && parsed === clamped) {
      if (clamped - 1 !== pageIndex) onPageIndexChange(clamped - 1)
    } else {
      setValue(String(pageIndex + 1))
    }
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      inputMode="numeric"
      aria-label="Page"
      className="h-8 w-10 px-1 text-center text-sm"
    />
  )
}

function PaginationBar({
  pageIndex,
  pageSize,
  total,
  pageCount,
  pageSizeOptions,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onPageIndexChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  total: number
  pageCount: number
  pageSizeOptions: number[]
  canPrevious: boolean
  canNext: boolean
  onPrevious: () => void
  onNext: () => void
  onPageIndexChange: (index: number) => void
  onPageSizeChange: (size: number) => void
}) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto text-sm">
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!canPrevious}
          onClick={onPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          Page
          <PageJumpInput
            pageIndex={pageIndex}
            pageCount={Math.max(1, pageCount)}
            onPageIndexChange={onPageIndexChange}
          />
          of {Math.max(1, pageCount)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
      >
        <SelectTrigger size="sm" className="w-auto shrink-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageSizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} rows
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="shrink-0 whitespace-nowrap text-muted-foreground">
        {total} {total === 1 ? 'record' : 'records'}
      </span>
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
  const pageCount = table.getPageCount()

  return (
    <PaginationBar
      pageIndex={pageIndex}
      pageSize={pageSize}
      total={total}
      pageCount={pageCount}
      pageSizeOptions={pageSizeOptions}
      canPrevious={table.getCanPreviousPage()}
      canNext={table.getCanNextPage()}
      onPrevious={() => table.previousPage()}
      onNext={() => table.nextPage()}
      onPageIndexChange={(index) => table.setPageIndex(index)}
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
      pageCount={pageCount}
      pageSizeOptions={pageSizeOptions}
      canPrevious={pageIndex > 0}
      canNext={pageIndex < pageCount - 1}
      onPrevious={() => onPageIndexChange(pageIndex - 1)}
      onNext={() => onPageIndexChange(pageIndex + 1)}
      onPageIndexChange={onPageIndexChange}
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
  searchValue,
  onSearchChange,
  striped = false,
}: DataTableProps<TData>) {
  const isSearchControlled =
    searchValue !== undefined && onSearchChange !== undefined
  const [internalGlobalFilter, setInternalGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize ?? pageSizeOptions[0],
  })

  const isClientPaginated = defaultPageSize !== undefined && !serverPagination
  const isServerPaginated = !!serverPagination

  const searchInputValue = isSearchControlled
    ? searchValue
    : internalGlobalFilter
  const handleSearchChange = isSearchControlled
    ? onSearchChange
    : setInternalGlobalFilter

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      ...(!isSearchControlled && { globalFilter: internalGlobalFilter }),
      ...(isClientPaginated && { pagination }),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    ...(!isSearchControlled && {
      onGlobalFilterChange: (value: string) => {
        setInternalGlobalFilter(value)
        if (isClientPaginated) setPagination((p) => ({ ...p, pageIndex: 0 }))
      },
    }),
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
            value={searchInputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-10 pr-7 text-sm sm:h-8"
          />
          {searchInputValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={() => handleSearchChange('')}
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
                        'h-11 text-sm font-medium sm:h-9 sm:text-xs',
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
                              <ChevronUp className="size-4 sm:size-3" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="size-4 sm:size-3" />
                            ) : (
                              <ChevronsUpDown className="size-4 sm:size-3" />
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
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(striped && index % 2 === 1 && 'bg-muted/40')}
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
