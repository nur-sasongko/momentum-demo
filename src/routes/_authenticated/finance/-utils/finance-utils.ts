import type {
  DateRange,
  FinanceCategory,
  TransactionType,
} from '#/stores/finance-store'
import { formatNumberWithSeparators } from '#/utils/currency'
import { formatTransactionDate } from '#/utils/date'

export const DEFAULT_CATEGORY_CONFIGS: Array<{
  name: string
  type: TransactionType
  color: string
  isSystem: boolean
}> = [
  { name: 'Food', type: 'expense', color: '#f59e0b', isSystem: false },
  { name: 'Transport', type: 'expense', color: '#0ea5e9', isSystem: false },
  { name: 'Shopping', type: 'expense', color: '#8b5cf6', isSystem: false },
  { name: 'Bills', type: 'expense', color: '#f43f5e', isSystem: false },
  { name: 'Entertainment', type: 'expense', color: '#ec4899', isSystem: false },
  { name: 'Health', type: 'expense', color: '#10b981', isSystem: false },
  { name: 'Other', type: 'expense', color: '#71717a', isSystem: true },
  { name: 'Salary', type: 'income', color: '#22c55e', isSystem: false },
  { name: 'Freelance', type: 'income', color: '#14b8a6', isSystem: false },
  { name: 'Investment', type: 'income', color: '#6366f1', isSystem: false },
  { name: 'Other', type: 'income', color: '#71717a', isSystem: true },
]

// Lightweight row used by aggregate query (charts + stat cards)
export interface AggregateRow {
  amount: number
  type: 'income' | 'expense'
  date: string
  category_id: string
}

export function formatCurrency(amount: number): string {
  return formatNumberWithSeparators(amount)
}

export function formatDateRangeLabel(
  from: string | null,
  to: string | null,
): string {
  if (!from && !to) return 'All time'
  if (from && !to) return `From ${formatTransactionDate(from)}`
  if (!from && to) return `Until ${formatTransactionDate(to)}`
  return `${formatTransactionDate(from!)} – ${formatTransactionDate(to!)}`
}

function isInDateRange(
  date: string,
  from: string | null,
  to: string | null,
): boolean {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function getCategoriesForType(
  categories: FinanceCategory[],
  type: TransactionType,
): FinanceCategory[] {
  return categories.filter((c) => c.type === type)
}

export function getTotalBalance(rows: AggregateRow[]): number {
  return rows.reduce((sum, row) => {
    return row.type === 'income' ? sum + row.amount : sum - row.amount
  }, 0)
}

export function getDateRangeTotals(
  rows: AggregateRow[],
  dateRange: DateRange,
): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const row of rows) {
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    if (row.type === 'income') {
      income += row.amount
    } else {
      expense += row.amount
    }
  }
  return { income, expense }
}

export interface CategorySpending {
  category: string
  amount: number
  fill: string
}

export function getSpendingByCategory(
  rows: AggregateRow[],
  dateRange: DateRange,
  categories: FinanceCategory[],
): CategorySpending[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, { amount: number; fill: string }>()

  for (const row of rows) {
    if (row.type !== 'expense') continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    const cat = categoryMap.get(row.category_id)
    const name = cat?.name ?? 'Other'
    const fill = cat?.color ?? '#71717a'
    const existing = totals.get(name)
    totals.set(name, {
      amount: (existing?.amount ?? 0) + row.amount,
      fill,
    })
  }

  return Array.from(totals.entries())
    .map(([category, { amount, fill }]) => ({ category, amount, fill }))
    .sort((a, b) => b.amount - a.amount)
}
