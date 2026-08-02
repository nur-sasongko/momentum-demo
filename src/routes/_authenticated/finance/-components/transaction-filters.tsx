import { ListFilter } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '#/components/ui/accordion'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  getCategoryFacetCounts,
  getCityFacetOptions,
} from '../-utils/finance-utils'
import { useFinanceFilters } from '../-utils/use-finance-filters'
import { FacetCheckboxList, TYPE_OPTIONS } from './transaction-header-filters'

export function TransactionFilters() {
  const isMobile = useIsMobile()
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
    activeFilterCount: activeCount,
  } = useFinanceFilters()
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const categoryFacetCounts = getCategoryFacetCounts(
    aggregateRows,
    dateRange,
    selectedType,
  )
  const categoryOptions = categories
    .filter((c) => !selectedType || c.type === selectedType)
    .map((c) => ({ value: c.id, count: categoryFacetCounts.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const cityOptions = getCityFacetOptions(aggregateRows, dateRange)

  // Start expanded only for sections that already have an active selection,
  // so opening the sheet doesn't hide filters the user has already set.
  const defaultOpenSections = [
    ...(selectedCategories.length > 0 ? ['category'] : []),
    ...(selectedCities.length > 0 ? ['location'] : []),
  ]

  const filterSections = (
    <>
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <div className="flex gap-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setSelectedType(option.value)}
              className={
                selectedType === option.value
                  ? 'flex-1 rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground'
                  : 'flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/60'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Accordion type="multiple" defaultValue={defaultOpenSections}>
        <AccordionItem value="category">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              Category
              {selectedCategories.length > 0 && (
                <Badge variant="secondary" className="rounded-full">
                  {selectedCategories.length}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="location">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              Location
              {selectedCities.length > 0 && (
                <Badge variant="secondary" className="rounded-full">
                  {selectedCities.length}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <FacetCheckboxList
              options={cityOptions}
              selected={selectedCities}
              onToggle={toggleCity}
              emptyMessage="No locations recorded."
              renderLabel={(value) => value || 'No location'}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={clearTransactionFilters}
        >
          Clear filters
        </Button>
      )}
    </>
  )

  return (
    <>
      {/* Header filters cover this on md+; keep a sheet for small screens. */}
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="relative gap-1.5 text-sm"
              aria-label="Filters"
            >
              <ListFilter className="size-4 sm:size-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeCount > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 size-4 rounded-full p-0 text-[10px] sm:static sm:ml-0.5 sm:size-auto sm:rounded-full sm:px-1.5 sm:py-0">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-8">
              {filterSections}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
