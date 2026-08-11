import type {
  DateRange,
  FinanceCategory,
  TransactionType,
} from '#/stores/finance-store'
import {
  endOfDayIso,
  formatTransactionDate,
  getDaysInRange,
  startOfDayIso,
  toDayKey,
} from '#/utils/date'

import type { AggregateRow } from '../-types/finance-api'
import type {
  CategorySpending,
  DailyCategorySeries,
  DailySpendingPoint,
  FacetOption,
  FilteredSummary,
  LocationSpending,
} from '../-types/finance-chart'
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
  const time = new Date(date).getTime()
  if (from && time < new Date(startOfDayIso(from)).getTime()) return false
  if (to && time > new Date(endOfDayIso(to)).getTime()) return false
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

/**
 * Mirrors the filter semantics of `useTransactionsQuery`: `type` equality,
 * `categoryIds` membership, and `cities` membership where `''` matches a
 * null/empty `location_city`.
 */
export function getFilteredSummary(
  rows: AggregateRow[],
  dateRange: DateRange,
  type: TransactionType | null,
  categoryIds: string[],
  cities: string[],
): FilteredSummary {
  let income = 0
  let expense = 0
  let count = 0

  for (const row of rows) {
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    if (type && row.type !== type) continue
    if (categoryIds.length > 0 && !categoryIds.includes(row.category_id))
      continue
    if (cities.length > 0 && !cities.includes(row.location_city ?? '')) continue

    if (row.type === 'income') income += row.amount
    else expense += row.amount
    count += 1
  }

  const net = income - expense
  const average = count > 0 ? (income + expense) / count : null

  let share: number | null = null
  if (type && count > 0) {
    const periodTotal = getDateRangeTotals(rows, dateRange)[type]
    const filteredTotal = type === 'income' ? income : expense
    share = periodTotal > 0 ? filteredTotal / periodTotal : null
  }

  return { income, expense, net, count, share, average }
}

// Grouped by category_id, not display name — a deleted category (falling
// back to "Other") and a category actually named "Other" must not merge.
export function getSpendingByCategory(
  rows: AggregateRow[],
  dateRange: DateRange,
  categories: FinanceCategory[],
): CategorySpending[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<
    string,
    { name: string; amount: number; fill: string }
  >()

  for (const row of rows) {
    if (row.type !== 'expense') continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    const cat = categoryMap.get(row.category_id)
    const name = cat?.name ?? 'Other'
    const fill = cat?.color ?? '#71717a'
    const existing = totals.get(row.category_id)
    totals.set(row.category_id, {
      name,
      fill,
      amount: (existing?.amount ?? 0) + row.amount,
    })
  }

  return Array.from(totals.entries())
    .map(([categoryId, { name, amount, fill }]) => ({
      category: name,
      categoryId,
      amount,
      fill,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function getDailySpendingByCategory(
  rows: AggregateRow[],
  dateRange: DateRange,
  categories: FinanceCategory[],
): { data: DailySpendingPoint[]; series: DailyCategorySeries[] } {
  if (!dateRange.from || !dateRange.to) return { data: [], series: [] }

  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const dayTotals = new Map<DateKey, Map<string, number>>()
  const categoryTotals = new Map<
    string,
    { name: string; fill: string; amount: number }
  >()

  for (const row of rows) {
    if (row.type !== 'expense') continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue

    const cat = categoryMap.get(row.category_id)
    const name = cat?.name ?? 'Other'
    const fill = cat?.color ?? '#71717a'
    const day = toDayKey(row.date)
    const categoryId = row.category_id

    const dayMap = dayTotals.get(day) ?? new Map<string, number>()
    dayMap.set(categoryId, (dayMap.get(categoryId) ?? 0) + row.amount)
    dayTotals.set(day, dayMap)

    const existing = categoryTotals.get(categoryId)
    categoryTotals.set(categoryId, {
      name,
      fill,
      amount: (existing?.amount ?? 0) + row.amount,
    })
  }

  // key is the category id — grouping by display name would merge a
  // deleted category (falling back to "Other") with one actually named
  // "Other".
  const series: DailyCategorySeries[] = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([categoryId, { name, fill }]) => ({
      key: categoryId,
      name,
      color: fill,
    }))

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

/** Label for expenses with no city/country recorded — matches the "Other" system category's muted color convention. */
export const NO_LOCATION_LABEL = 'No location'
const NO_LOCATION_FILL = '#71717a'

function getSpendingByLocationField(
  rows: AggregateRow[],
  dateRange: DateRange,
  field: 'location_city' | 'location_country',
): LocationSpending[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    if (row.type !== 'expense') continue
    if (!isInDateRange(row.date, dateRange.from, dateRange.to)) continue
    const value = row[field] || NO_LOCATION_LABEL
    totals.set(value, (totals.get(value) ?? 0) + row.amount)
  }

  const noLocationAmount = totals.get(NO_LOCATION_LABEL)
  totals.delete(NO_LOCATION_LABEL)

  const known = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([location, amount], index) => ({
      location,
      amount,
      fill: LOCATION_CHART_COLORS[index % LOCATION_CHART_COLORS.length],
    }))

  // Kept last rather than sorted in by amount, same as the "Other" category convention.
  if (!noLocationAmount) return known
  return [
    ...known,
    {
      location: NO_LOCATION_LABEL,
      amount: noLocationAmount,
      fill: NO_LOCATION_FILL,
    },
  ]
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
// Unlike the chart aggregations these count income rows too.
// ---------------------------------------------------------------------------

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
