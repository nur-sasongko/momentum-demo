import { Funnel, ListFilter } from 'lucide-react'

import { HEADER_AFFORDANCE_REVEAL } from '#/components/ui/data-table'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  getCategoryFacetCounts,
  getCityFacetOptions,
} from '../-utils/finance-utils'
import { useFinanceFilters } from '../-utils/use-finance-filters'

import type { TransactionType } from '#/stores/finance-store'

function HeaderFilterTrigger({
  active,
  label,
}: {
  active: number
  label: string
}) {
  return (
    <PopoverTrigger
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        active === 0 && HEADER_AFFORDANCE_REVEAL,
        active > 0 && 'text-primary',
      )}
    >
      {active > 0 ? (
        <Funnel className="size-3.5 fill-current" />
      ) : (
        <ListFilter className="size-3.5" />
      )}
      {active > 0 && (
        <span className="text-[10px] font-semibold tabular-nums">{active}</span>
      )}
    </PopoverTrigger>
  )
}

export function FacetCheckboxList({
  options,
  selected,
  onToggle,
  renderLabel,
  emptyMessage,
}: {
  options: Array<{ value: string; count: number }>
  selected: string[]
  onToggle: (value: string) => void
  renderLabel: (value: string) => React.ReactNode
  emptyMessage: string
}) {
  if (options.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="max-h-64 space-y-0.5 overflow-y-auto">
      {options.map((option) => {
        const id = `facet-${option.value || 'none'}`
        return (
          <label
            key={option.value}
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted/60"
          >
            <Checkbox
              id={id}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
            />
            <span className="flex-1 truncate">{renderLabel(option.value)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {option.count}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export const TYPE_OPTIONS: Array<{
  value: TransactionType | null
  label: string
}> = [
  { value: null, label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]

export function CategoryHeaderFilter() {
  const categories = useFinanceStore((s) => s.categories)
  const {
    dateRange,
    selectedType,
    setSelectedType,
    selectedCategories,
    toggleCategory,
  } = useFinanceFilters()
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const facetCounts = getCategoryFacetCounts(
    aggregateRows,
    dateRange,
    selectedType,
  )
  const categoryOptions = categories
    .filter((c) => !selectedType || c.type === selectedType)
    .map((c) => ({ value: c.id, count: facetCounts.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const activeCount = (selectedType ? 1 : 0) + selectedCategories.length

  return (
    <Popover>
      <HeaderFilterTrigger active={activeCount} label="Filter category" />
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Type
          </span>
          <div className="flex gap-1">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setSelectedType(option.value)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                  selectedType === option.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted/60',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Category
          </span>
          <FacetCheckboxList
            options={categoryOptions}
            selected={selectedCategories}
            onToggle={toggleCategory}
            emptyMessage="No categories."
            renderLabel={(value) => {
              const cat = categoryById.get(value)
              return (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: cat?.color ?? '#71717a' }}
                  />
                  {cat?.name ?? 'Other'}
                </span>
              )
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function LocationHeaderFilter() {
  const { dateRange, selectedCities, toggleCity } = useFinanceFilters()
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const cityOptions = getCityFacetOptions(aggregateRows, dateRange)

  return (
    <Popover>
      <HeaderFilterTrigger
        active={selectedCities.length}
        label="Filter location"
      />
      <PopoverContent className="w-56 space-y-1.5" align="start">
        <span className="text-xs font-medium text-muted-foreground">
          Location
        </span>
        <FacetCheckboxList
          options={cityOptions}
          selected={selectedCities}
          onToggle={toggleCity}
          emptyMessage="No locations recorded."
          renderLabel={(value) => value || 'No location'}
        />
      </PopoverContent>
    </Popover>
  )
}
