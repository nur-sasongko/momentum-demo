import { Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  EXPENSE_CATEGORIES,
  getAvailableMonths,
  INCOME_CATEGORIES,
} from '../-utils/finance-utils'
import { formatMonthLabel } from '#/utils/date'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'

const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

export function FinanceFilters() {
  const transactions = useFinanceStore((s) => s.transactions)
  const selectedMonth = useFinanceStore((s) => s.selectedMonth)
  const selectedCategory = useFinanceStore((s) => s.selectedCategory)
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth)
  const setSelectedCategory = useFinanceStore((s) => s.setSelectedCategory)
  const setAddTransactionOpen = useFinanceStore((s) => s.setAddTransactionOpen)

  const months = getAvailableMonths(transactions)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {formatMonthLabel(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedCategory === null
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {ALL_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <Button
        className="gap-2 shrink-0"
        onClick={() => setAddTransactionOpen(true)}
      >
        <Plus className="size-4" />
        Add Transaction
      </Button>
    </div>
  )
}
