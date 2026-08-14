import { X } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useFinanceStore } from '#/stores/finance-store'
import { formatNumberWithSeparators } from '#/utils/currency'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  formatDateRangeLabel,
  getFilteredSummary,
} from '../-utils/finance-utils'
import { useFinanceFilters } from '../-utils/use-finance-filters'
import { StatBlock } from './stat-block'

import type { ReactNode } from 'react'

function RemovableChip({
  label,
  onRemove,
  children,
}: {
  label: string
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <Badge variant="secondary" className="gap-1 py-1 pr-1 font-normal">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="rounded-full p-0.5 hover:bg-foreground/10"
      >
        <X className="size-3" />
      </button>
    </Badge>
  )
}

export function FilteredSummaryBar({
  isSearchActive,
}: {
  isSearchActive: boolean
}) {
  const categories = useFinanceStore((s) => s.categories)
  const {
    dateRange,
    selectedType,
    setSelectedType,
    selectedCategories,
    toggleCategory,
    selectedCities,
    toggleCity,
    clearTransactionFilters,
    activeFilterCount,
  } = useFinanceFilters()
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  if (isSearchActive || activeFilterCount === 0) return null

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const summary = getFilteredSummary(
    aggregateRows,
    dateRange,
    selectedType,
    selectedCategories,
    selectedCities,
  )
  const hasDateRange = Boolean(dateRange.from || dateRange.to)

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedType && (
          <RemovableChip
            label={selectedType === 'income' ? 'Income' : 'Expense'}
            onRemove={() => setSelectedType(null)}
          >
            {selectedType === 'income' ? 'Income' : 'Expense'}
          </RemovableChip>
        )}
        {selectedCategories.map((id) => {
          const cat = categoryById.get(id)
          const label = cat?.name ?? 'Other'
          return (
            <RemovableChip
              key={id}
              label={label}
              onRemove={() => toggleCategory(id)}
            >
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: cat?.color ?? '#71717a' }}
              />
              {label}
            </RemovableChip>
          )
        })}
        {selectedCities.map((city) => {
          const label = city || 'No location'
          return (
            <RemovableChip
              key={city}
              label={label}
              onRemove={() => toggleCity(city)}
            >
              {label}
            </RemovableChip>
          )
        })}
        {hasDateRange && (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {formatDateRangeLabel(dateRange.from, dateRange.to)}
          </Badge>
        )}
      </div>

      {summary.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {selectedType ? (
            <>
              <StatBlock
                label="Total"
                value={formatNumberWithSeparators(
                  selectedType === 'income' ? summary.income : summary.expense,
                )}
              />
              {summary.share !== null && (
                <StatBlock
                  label="Share of period"
                  value={`${Math.round(summary.share * 100)}%`}
                />
              )}
              <StatBlock label="Transactions" value={String(summary.count)} />
              <StatBlock
                label="Average"
                value={
                  summary.average !== null
                    ? formatNumberWithSeparators(summary.average)
                    : '—'
                }
              />
            </>
          ) : (
            <>
              <StatBlock
                label="Income"
                value={formatNumberWithSeparators(summary.income)}
              />
              <StatBlock
                label="Expenses"
                value={formatNumberWithSeparators(summary.expense)}
              />
              <StatBlock
                label="Net"
                value={formatNumberWithSeparators(summary.net)}
              />
              <StatBlock label="Transactions" value={String(summary.count)} />
            </>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={clearTransactionFilters}
      >
        Clear all
      </Button>
    </div>
  )
}
