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
  location_city: string | null
  location_country: string | null
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

const LOCATION_CHART_COLORS = [
  '#0ea5e9',
  '#f59e0b',
  '#8b5cf6',
  '#f43f5e',
  '#10b981',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

export interface LocationSpending {
  location: string
  amount: number
  fill: string
}

function getSpendingByLocationField(
  rows: AggregateRow[],
  dateRange: DateRange,
  field: 'location_city' | 'location_country',
): LocationSpending[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    if (row.type !== 'expense') continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    const value = row[field]
    if (!value) continue
    totals.set(value, (totals.get(value) ?? 0) + row.amount)
  }

  return Array.from(totals.entries())
    .map(([location, amount], index) => ({
      location,
      amount,
      fill: LOCATION_CHART_COLORS[index % LOCATION_CHART_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function getSpendingByCity(
  rows: AggregateRow[],
  dateRange: DateRange,
): LocationSpending[] {
  return getSpendingByLocationField(rows, dateRange, 'location_city')
}

export function getSpendingByCountry(
  rows: AggregateRow[],
  dateRange: DateRange,
): LocationSpending[] {
  return getSpendingByLocationField(rows, dateRange, 'location_country')
}

export function hasLocationData(rows: AggregateRow[]): boolean {
  return rows.some((row) => row.location_city || row.location_country)
}
