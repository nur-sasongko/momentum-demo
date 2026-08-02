import type {
  DateRange,
  FinanceCategory,
  TransactionType,
} from '#/stores/finance-store'
import { formatNumberWithSeparators } from '#/utils/currency'
import {
  endOfDayIso,
  formatTransactionDate,
  getDaysInRange,
  toDayKey,
} from '#/utils/date'

import type { DateKey } from '#/utils/date'

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
  if (to && date > endOfDayIso(to)) return false
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

export interface DailyCategorySeries {
  key: string
  name: string
  color: string
}

export interface DailySpendingPoint {
  date: DateKey
  dateLabel: string
  total: number
  [seriesKey: string]: string | number
}

export function getDailySpendingByCategory(
  rows: AggregateRow[],
  dateRange: DateRange,
  categories: FinanceCategory[],
): { data: DailySpendingPoint[]; series: DailyCategorySeries[] } {
  if (!dateRange.from || !dateRange.to) return { data: [], series: [] }

  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const dayTotals = new Map<DateKey, Map<string, number>>()
  const categoryTotals = new Map<string, { fill: string; amount: number }>()

  for (const row of rows) {
    if (row.type !== 'expense') continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue

    const cat = categoryMap.get(row.category_id)
    const name = cat?.name ?? 'Other'
    const fill = cat?.color ?? '#71717a'
    const day = toDayKey(row.date)

    const dayMap = dayTotals.get(day) ?? new Map<string, number>()
    dayMap.set(name, (dayMap.get(name) ?? 0) + row.amount)
    dayTotals.set(day, dayMap)

    const existing = categoryTotals.get(name)
    categoryTotals.set(name, {
      fill,
      amount: (existing?.amount ?? 0) + row.amount,
    })
  }

  const series: DailyCategorySeries[] = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, { fill }]) => ({ key: name, name, color: fill }))

  const data: DailySpendingPoint[] = getDaysInRange(
    dateRange.from,
    dateRange.to,
  ).map((day) => {
    const dayMap = dayTotals.get(day)
    const point: DailySpendingPoint = {
      date: day,
      dateLabel: formatTransactionDate(day),
      total: 0,
    }
    for (const s of series) {
      const amount = dayMap?.get(s.key) ?? 0
      point[s.key] = amount
      point.total += amount
    }
    return point
  })

  return { data, series }
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

// ---------------------------------------------------------------------------
// Filter facets — counts shown next to each option in the transaction filters.
// Derived from the aggregate query, which already holds every transaction
// (unpaginated) with its category and city, so no extra request is needed.
// Unlike the chart aggregations these count income rows too, and they do emit
// the "no location" bucket.
// ---------------------------------------------------------------------------

export interface FacetOption {
  value: string
  count: number
}

/** Transaction count per category id, within `dateRange` and `type`. */
export function getCategoryFacetCounts(
  rows: AggregateRow[],
  dateRange: DateRange,
  type: TransactionType | null,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (type && row.type !== type) continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }
  return counts
}

/**
 * Cities present in `dateRange`, most frequent first. Rows without a city are
 * collected under the `''` value, which the filter renders as "No location".
 */
export function getCityFacetOptions(
  rows: AggregateRow[],
  dateRange: DateRange,
): FacetOption[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    const city = row.location_city ?? ''
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}
