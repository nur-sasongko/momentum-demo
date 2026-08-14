import type { DateRange } from '#/stores/finance-store'
import { NO_LOCATION_LABEL } from './finance-utils'

import type {
  CategorySpending,
  DailyCategorySeries,
  DailySpendingPoint,
  DrilldownSelection,
  DrilldownSpec,
  LocationSpending,
} from '../-types/finance-chart'
import type { FinanceFiltersPatch } from '../-types/finance-query'

/**
 * Converts a chart selection into the underlying filter spec.
 *
 * Replace, not merge: unrelated dimensions are always empty, and the date
 * range collapses to a single day for a `day-category` selection. The charts
 * compute a bar's amount from `dateRange` alone, ignoring the table's active
 * type/category/city filters, so merging those active filters into the spec
 * could make the resulting table total disagree with the bar the user
 * clicked.
 */
export function toDrilldownSpec(
  selection: DrilldownSelection,
  dateRange: DateRange,
): DrilldownSpec {
  const base: DrilldownSpec = {
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    type: 'expense',
    categoryIds: [],
    cities: [],
    countries: [],
  }

  switch (selection.kind) {
    case 'category':
      return { ...base, categoryIds: [selection.categoryId] }
    case 'day-category':
      return {
        ...base,
        dateFrom: selection.day,
        dateTo: selection.day,
        categoryIds: [selection.categoryId],
      }
    case 'city':
      return { ...base, cities: [selection.city] }
    case 'country':
      return { ...base, countries: [selection.country] }
  }
}

/** Only a country bucket has no table filter to commit to (see spec Non-Goals). */
export function isCommittable(selection: DrilldownSelection): boolean {
  return selection.kind !== 'country'
}

/**
 * Converts a spec into the patch passed to `useFinanceFilters().setFilters`
 * for the "View all" commit. Always switches to the Table tab. Never sets
 * `countries` — spec 11's URL schema has no such filter.
 */
export function toFilterPatch(spec: DrilldownSpec): FinanceFiltersPatch {
  return {
    view: 'table',
    dateRange: { from: spec.dateFrom, to: spec.dateTo },
    selectedType: spec.type,
    selectedCategories: spec.categoryIds,
    selectedCities: spec.cities,
  }
}

export function selectionFromCategoryBar(
  entry: CategorySpending,
): DrilldownSelection {
  return {
    kind: 'category',
    label: entry.category,
    color: entry.fill,
    amount: entry.amount,
    categoryId: entry.categoryId,
    categoryName: entry.category,
  }
}

/** Returns `null` for a zero-amount (empty) segment — no sheet should open. */
export function selectionFromDaySegment(
  point: DailySpendingPoint,
  series: DailyCategorySeries,
): DrilldownSelection | null {
  const amount = Number(point[series.key] ?? 0)
  if (amount <= 0) return null

  return {
    kind: 'day-category',
    label: `${series.name} · ${point.dateLabel}`,
    color: series.color,
    amount,
    categoryId: series.key,
    categoryName: series.name,
    day: point.date,
    dayLabel: point.dateLabel,
  }
}

export function selectionFromCityBar(
  entry: LocationSpending,
): DrilldownSelection {
  const isNoLocation = entry.location === NO_LOCATION_LABEL
  return {
    kind: 'city',
    label: entry.location,
    color: entry.fill,
    amount: entry.amount,
    city: isNoLocation ? '' : entry.location,
  }
}

export function selectionFromCountryBar(
  entry: LocationSpending,
): DrilldownSelection {
  const isNoLocation = entry.location === NO_LOCATION_LABEL
  return {
    kind: 'country',
    label: entry.location,
    color: entry.fill,
    amount: entry.amount,
    country: isNoLocation ? '' : entry.location,
  }
}
