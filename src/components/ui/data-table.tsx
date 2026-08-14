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
  Inbox,
  RotateCcw,
  Rows3,
  X,
} from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'

import { cn } from '#/libs/utils'
import { useTablePreferencesStore } from '#/stores/table-preferences-store'
import { clampColumnSizing, pruneColumnSizing } from '#/utils/table-sizing'
import { Button } from './button'
import { ColumnResizeHandle } from './column-resize-handle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Input } from './input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { Skeleton } from './skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

import type { TableDensity } from '#/stores/table-preferences-store'
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  PaginationState,
  RowData,
  SortingState,
  Table as TanstackTable,
} from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // The generics are required to match TanStack's declaration.
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Filter control rendered beside the sort icon. Desktop (md+) only. */
    headerFilter?: React.ReactNode
    /** Text alignment for both the header label and every cell. Default 'left'. */
    align?: 'left' | 'center' | 'right'
    /** How overflowing content behaves. Default 'nowrap'. */
    overflow?: 'nowrap' | 'truncate' | 'wrap'
    /** Extra classes for this column's <td>. Escape hatch — prefer `align`/`overflow`. */
    cellClassName?: string
  }
}

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
const EMPTY_COLUMN_SIZING: ColumnSizingState = {}
const SKELETON_ROW_CAP = 8

/**
 * Idle header affordances (neutral sort chevron, inactive filter icon) fade in
 * on hover/focus of the header row. Kept visible below `md`, where there is no
 * hover. Uses opacity rather than `hidden` so nothing shifts on hover.
 */
export const HEADER_AFFORDANCE_REVEAL =
  'opacity-0 transition-opacity max-md:opacity-100 group-hover/header:opacity-100 group-focus-within/header:opacity-100'

const ALIGN_TEXT_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const

const ALIGN_JUSTIFY_CLASSES = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const

const OVERFLOW_CLASSES = {
  nowrap: 'whitespace-nowrap',
  truncate: 'truncate',
  wrap: 'whitespace-normal',
} as const

const DENSITY_HEADER_ROW_CLASSES: Record<TableDensity, string> = {
  compact: 'h-8 text-xs',
  default: 'h-11 text-sm font-medium sm:h-9 sm:text-xs',
  comfortable: 'h-11 text-sm font-medium',
}

const DENSITY_CELL_CLASSES: Record<TableDensity, string> = {
  compact: 'py-1 text-sm',
  default: 'py-2.5 text-sm',
  comfortable: 'py-4 text-sm',
}

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
  /** Stable, opaque key for persisted widths + density. Omit → in-memory only. */
  tableId?: string
  /** Enables drag/keyboard column resizing. Default false. */
  resizable?: boolean
  /** Header sticks while the body scrolls inside `maxHeight`. Default false. */
  stickyHeader?: boolean
  /** Any CSS length. Only meaningful with `stickyHeader`. Default '70vh'. */
  maxHeight?: string
  /** Initial density; a persisted user choice (when `tableId` is set) wins. Default 'default'. */
  density?: TableDensity
  /** Show the density control in the pagination bar. Default false. */
  showDensityControl?: boolean
  /** Skeleton rows on first load — no data yet. */
  isLoading?: boolean
  /** Dims existing rows during a background refetch. */
  isFetching?: boolean
  /** Icon for the empty state. Defaults to a generic inbox icon. */
  emptyIcon?: React.ReactNode
  /** Action rendered below the empty message (e.g. "Add …"). */
  emptyAction?: React.ReactNode
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

function DensityControl({
  value,
  onChange,
}: {
  value: TableDensity
  onChange: (next: TableDensity) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Table density"
          className="shrink-0"
        >
          <Rows3 className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as TableDensity)}
        >
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="default">Default</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">
            Comfortable
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
  trailing,
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
  trailing?: React.ReactNode
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

      {trailing && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {trailing}
        </div>
      )}
    </div>
  )
}

function ClientPaginationBar<TData>({
  table,
  pageSizeOptions,
  trailing,
}: {
  table: TanstackTable<TData>
  pageSizeOptions: number[]
  trailing?: React.ReactNode
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
      trailing={trailing}
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
  trailing,
}: ServerPaginationProps & { trailing?: React.ReactNode }) {
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
      trailing={trailing}
    />
  )
}

/**
 * One body row, memoized on its own props. TanStack's row model is stable
 * across a `columnSizing` update (sizing doesn't feed the row model), so
 * this bails out of re-rendering entirely while the user is dragging a
 * column boundary — only the `<table>` element's CSS-variable widths change
 * per mousemove, not every cell in every row.
 */
const DataTableBodyRow = memo(function DataTableBodyRow({
  row,
  striped,
  cellClassName,
}: {
  row: any
  striped: boolean
  cellClassName: string
}) {
  return (
    <TableRow
      data-state={row.getIsSelected() ? 'selected' : undefined}
      data-striped={striped ? 'true' : undefined}
    >
      {row.getVisibleCells().map((cell: any) => {
        const meta = cell.column.columnDef.meta as
          | {
              align?: keyof typeof ALIGN_TEXT_CLASSES
              overflow?: keyof typeof OVERFLOW_CLASSES
              cellClassName?: string
            }
          | undefined
        const align = meta?.align ?? 'left'
        const overflow = meta?.overflow ?? 'nowrap'
        const rawValue = overflow === 'truncate' ? cell.getValue() : undefined
        return (
          <TableCell
            key={cell.id}
            style={{ width: `var(--col-${cell.column.id}-size)` }}
            title={rawValue ? String(rawValue) : undefined}
            className={cn(
              cellClassName,
              ALIGN_TEXT_CLASSES[align],
              OVERFLOW_CLASSES[overflow],
              meta?.cellClassName,
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}
    </TableRow>
  )
})

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
  tableId,
  resizable = false,
  stickyHeader = false,
  maxHeight = '70vh',
  density: densityProp,
  showDensityControl = false,
  isLoading = false,
  isFetching = false,
  emptyIcon,
  emptyAction,
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

  const [localColumnSizing, setLocalColumnSizing] = useState<ColumnSizingState>(
    {},
  )
  const [localDensity, setLocalDensity] = useState<TableDensity>(
    densityProp ?? 'default',
  )

  const persistedEntry = useTablePreferencesStore((s) =>
    tableId ? s.tables[tableId] : undefined,
  )
  const setStoreColumnSizing = useTablePreferencesStore(
    (s) => s.setColumnSizing,
  )
  const resetStoreColumnSizing = useTablePreferencesStore(
    (s) => s.resetColumnSizing,
  )
  const setStoreDensity = useTablePreferencesStore((s) => s.setDensity)

  const columnSizing = tableId
    ? (persistedEntry?.columnSizing ?? EMPTY_COLUMN_SIZING)
    : localColumnSizing
  const currentDensity: TableDensity = tableId
    ? (persistedEntry?.density ?? densityProp ?? 'default')
    : localDensity

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
    columnResizeMode: 'onChange',
    enableColumnResizing: resizable,
    state: {
      sorting,
      columnFilters,
      columnSizing,
      ...(!isSearchControlled && { globalFilter: internalGlobalFilter }),
      ...(isClientPaginated && { pagination }),
    },
    onColumnSizingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(columnSizing) : updater
      if (tableId) setStoreColumnSizing(tableId, next)
      else setLocalColumnSizing(next)
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

  const leafColumns = table.getAllLeafColumns()

  // Self-healing pass: drop persisted widths for columns that no longer
  // exist and clamp any that fall outside the column's current
  // min/max bounds (e.g. `minSize` was tightened in a later release).
  useEffect(() => {
    const knownIds = leafColumns.map((c) => c.id)
    const bounds = leafColumns.map((c) => ({
      id: c.id,
      minSize: c.columnDef.minSize,
      maxSize: c.columnDef.maxSize,
    }))
    const cleaned = clampColumnSizing(
      pruneColumnSizing(columnSizing, knownIds),
      bounds,
    )
    const changed =
      Object.keys(cleaned).length !== Object.keys(columnSizing).length ||
      Object.entries(cleaned).some(([id, size]) => columnSizing[id] !== size)
    if (changed) {
      if (tableId) setStoreColumnSizing(tableId, cleaned)
      else setLocalColumnSizing(cleaned)
    }
    // Only re-run when the set of columns changes, not on every resize frame.
  }, [leafColumns.map((c) => c.id).join('|')])

  const columnSizeVars = useMemo(() => {
    const vars: Record<string, string> = {}
    for (const column of leafColumns) {
      vars[`--col-${column.id}-size`] = `${column.getSize()}px`
    }
    return vars
  }, [columnSizing, leafColumns])

  const handleDensityChange = (next: TableDensity) => {
    if (tableId) setStoreDensity(tableId, next)
    else setLocalDensity(next)
  }

  const handleResetWidths = () => {
    if (tableId) resetStoreColumnSizing(tableId)
    else setLocalColumnSizing({})
  }

  const canResetWidths =
    resizable && !!tableId && Object.keys(columnSizing).length > 0

  const headerRowClass = DENSITY_HEADER_ROW_CLASSES[currentDensity]
  const cellClass = DENSITY_CELL_CLASSES[currentDensity]

  const trailing = (showDensityControl || canResetWidths) && (
    <>
      {showDensityControl && (
        <DensityControl value={currentDensity} onChange={handleDensityChange} />
      )}
      {canResetWidths && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResetWidths}
          className="gap-1.5 text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          Reset widths
        </Button>
      )}
    </>
  )

  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length
  const showSkeleton = isLoading && rows.length === 0
  const showDimmed = !showSkeleton && isFetching && rows.length > 0
  const skeletonRowCount = Math.min(
    serverPagination?.pageSize ?? pagination.pageSize,
    SKELETON_ROW_CAP,
  )

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
        <Table
          style={{ ...columnSizeVars, width: table.getCenterTotalSize() }}
          className="min-w-full table-fixed"
          containerStyle={stickyHeader ? { maxHeight } : undefined}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="group/header hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const meta = header.column.columnDef.meta
                  const align = meta?.align ?? 'left'
                  const headerFilter = meta?.headerFilter
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                  const canResize = resizable && header.column.getCanResize()
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `var(--col-${header.column.id}-size)` }}
                      className={cn(
                        headerRowClass,
                        ALIGN_TEXT_CLASSES[align],
                        canResize && 'relative',
                        stickyHeader &&
                          'sticky top-0 z-10 border-b border-border bg-card',
                      )}
                    >
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          ALIGN_JUSTIFY_CLASSES[align],
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 rounded select-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {label}
                            {sorted === 'asc' ? (
                              <ChevronUp className="size-4 text-foreground sm:size-3" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="size-4 text-foreground sm:size-3" />
                            ) : (
                              <ChevronsUpDown
                                className={cn(
                                  HEADER_AFFORDANCE_REVEAL,
                                  'size-4 text-muted-foreground sm:size-3',
                                )}
                              />
                            )}
                          </button>
                        ) : (
                          label
                        )}
                        {headerFilter && (
                          <span className="hidden md:inline-flex">
                            {headerFilter}
                          </span>
                        )}
                      </span>
                      {canResize && (
                        <ColumnResizeHandle
                          header={header}
                          label={
                            typeof label === 'string' ? label : header.column.id
                          }
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            className={cn(
              showDimmed &&
                'opacity-60 transition-opacity motion-reduce:transition-none',
            )}
            aria-busy={showDimmed || undefined}
          >
            {showSkeleton ? (
              Array.from({ length: skeletonRowCount }).map((_row, rowIndex) => (
                <TableRow
                  key={`skeleton-${rowIndex}`}
                  className="hover:bg-transparent"
                >
                  {Array.from({ length: columnCount }).map((_col, colIndex) => (
                    <TableCell key={colIndex} className={cellClass}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <DataTableBodyRow
                  key={row.id}
                  row={row}
                  striped={striped}
                  cellClassName={cellClass}
                />
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {emptyIcon ?? <Inbox className="size-8" />}
                    <p className="text-sm">{emptyMessage}</p>
                    {emptyAction}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isClientPaginated && (
        <ClientPaginationBar
          table={table}
          pageSizeOptions={pageSizeOptions}
          trailing={trailing}
        />
      )}
      {isServerPaginated && (
        <ServerPaginationBar {...serverPagination} trailing={trailing} />
      )}
      {!isClientPaginated && !isServerPaginated && trailing && (
        <div className="flex justify-end">{trailing}</div>
      )}
    </div>
  )
}
