import { ArrowRight, RotateCw } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Skeleton } from '#/components/ui/skeleton'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/libs/utils'
import { formatDateTimeLabel } from '#/utils/date'
import {
  isCommittable,
  toDrilldownSpec,
  toFilterPatch,
} from '../-utils/finance-drilldown'
import {
  useFinanceAggregateQuery,
  useTransactionsQuery,
} from '../-utils/finance-queries'
import {
  formatCurrency,
  formatDateRangeLabel,
  getDateRangeTotals,
} from '../-utils/finance-utils'
import { StatBlock } from './stat-block'

import type { DateRange } from '#/stores/finance-store'
import type { DrilldownSelection } from '../-utils/finance-drilldown'
import type { FinanceFiltersPatch } from '../-utils/use-finance-filters'

const RECENT_LIMIT = 8

function selectionKey(selection: DrilldownSelection): string {
  switch (selection.kind) {
    case 'category':
      return `category:${selection.categoryId}`
    case 'day-category':
      return `day-category:${selection.day}:${selection.categoryId}`
    case 'city':
      return `city:${selection.city}`
    case 'country':
      return `country:${selection.country}`
  }
}

function DrilldownSheetBody({
  selection,
  dateRange,
  onCommit,
  onClose,
}: {
  selection: DrilldownSelection
  dateRange: DateRange
  onCommit: (patch: FinanceFiltersPatch) => void
  onClose: () => void
}) {
  const spec = useMemo(
    () => toDrilldownSpec(selection, dateRange),
    [selection, dateRange],
  )

  const { data: aggregateRows = [] } = useFinanceAggregateQuery()
  const periodExpense = getDateRangeTotals(aggregateRows, {
    from: spec.dateFrom,
    to: spec.dateTo,
  }).expense
  const share = periodExpense > 0 ? selection.amount / periodExpense : 0

  const { data, isLoading, isError, refetch } = useTransactionsQuery({
    page: 0,
    pageSize: RECENT_LIMIT,
    dateFrom: spec.dateFrom,
    dateTo: spec.dateTo,
    type: spec.type,
    categoryIds: spec.categoryIds,
    cities: spec.cities,
    countries: spec.countries,
    search: null,
  })

  const transactions = data?.data ?? []
  const total = data?.count ?? 0
  const committable = isCommittable(selection)

  function handleViewAll() {
    onCommit(toFilterPatch(spec))
    onClose()
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: selection.color }}
          />
          <SheetTitle>{selection.label}</SheetTitle>
        </div>
        <SheetDescription>
          {formatDateRangeLabel(spec.dateFrom, spec.dateTo)}
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-2 px-4">
        <StatBlock label="Total" value={formatCurrency(selection.amount)} />
        <StatBlock label="Share" value={`${Math.round(share * 100)}%`} />
        <StatBlock
          label="Transactions"
          value={isLoading ? '—' : String(total)}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load transactions for this bucket.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RotateCw className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No transactions match this bucket.
          </p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    <span className="text-foreground">
                      {formatDateTimeLabel(tx.date)}
                    </span>
                    {tx.note ? ` · ${tx.note}` : ''}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
            {total > RECENT_LIMIT && (
              <p className="px-2 text-xs text-muted-foreground">
                Showing {transactions.length} of {total}
              </p>
            )}
          </>
        )}
      </div>

      {!isLoading && !isError && transactions.length > 0 && (
        <SheetFooter className="border-t">
          <Button
            className="w-full gap-1.5"
            disabled={!committable}
            onClick={handleViewAll}
          >
            View all {total} transaction{total === 1 ? '' : 's'}
            <ArrowRight className="size-4" />
          </Button>
          {!committable && (
            <p className="text-xs text-muted-foreground">
              Country isn't a table filter yet — switch the chart to City to
              drill into the table.
            </p>
          )}
        </SheetFooter>
      )}
    </>
  )
}

export function SpendingDrilldownSheet({
  selection,
  dateRange,
  onClose,
  onCommit,
}: {
  selection: DrilldownSelection | null
  dateRange: DateRange
  onClose: () => void
  onCommit: (patch: FinanceFiltersPatch) => void
}) {
  const isMobile = useIsMobile()

  return (
    <Sheet
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-4',
          isMobile ? 'h-[85dvh] rounded-t-xl' : 'sm:max-w-md',
        )}
      >
        {selection && (
          <DrilldownSheetBody
            key={selectionKey(selection)}
            selection={selection}
            dateRange={dateRange}
            onCommit={onCommit}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
