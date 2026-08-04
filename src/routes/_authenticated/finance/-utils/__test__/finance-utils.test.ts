import { describe, expect, it } from 'vitest'

import type { FinanceCategory } from '#/stores/finance-store'
import { startOfDayIso } from '#/utils/date'
import type { AggregateRow } from '../finance-utils'
import {
  getCategoryFacetCounts,
  getCityFacetOptions,
  getDailySpendingByCategory,
  getDateRangeTotals,
  getFilteredSummary,
  getSpendingByCategory,
  getSpendingByCity,
  getSpendingByCountry,
  hasLocationData,
  NO_LOCATION_LABEL,
} from '../finance-utils'

const NO_RANGE = { from: null, to: null }

const categories: FinanceCategory[] = [
  {
    id: 'cat-1',
    name: 'Food',
    type: 'expense',
    color: '#f59e0b',
    isSystem: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-2',
    name: 'Transport',
    type: 'expense',
    color: '#0ea5e9',
    isSystem: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

function row(overrides: Partial<AggregateRow> = {}): AggregateRow {
  return {
    amount: 100,
    type: 'expense',
    date: '2026-07-01',
    category_id: 'cat-1',
    location_city: null,
    location_country: null,
    ...overrides,
  }
}

describe('getSpendingByCity', () => {
  it('groups and sums expense amounts by city', () => {
    const rows = [
      row({ amount: 50, location_city: 'Jakarta' }),
      row({ amount: 30, location_city: 'Jakarta' }),
      row({ amount: 20, location_city: 'Bandung' }),
    ]

    expect(getSpendingByCity(rows, NO_RANGE)).toEqual([
      { location: 'Jakarta', amount: 80, fill: expect.any(String) },
      { location: 'Bandung', amount: 20, fill: expect.any(String) },
    ])
  })

  it('groups rows with no city under a trailing "No location" bucket', () => {
    const rows = [
      row({ amount: 50, location_city: 'Jakarta' }),
      row({ amount: 30, location_city: null }),
      row({ amount: 10, location_city: '' }),
    ]

    expect(getSpendingByCity(rows, NO_RANGE)).toEqual([
      { location: 'Jakarta', amount: 50, fill: expect.any(String) },
      { location: NO_LOCATION_LABEL, amount: 40, fill: '#71717a' },
    ])
  })

  it('keeps the "No location" bucket last even when it is the largest amount', () => {
    const rows = [
      row({ amount: 10, location_city: 'Jakarta' }),
      row({ amount: 999, location_city: null }),
    ]

    expect(getSpendingByCity(rows, NO_RANGE)).toEqual([
      { location: 'Jakarta', amount: 10, fill: expect.any(String) },
      { location: NO_LOCATION_LABEL, amount: 999, fill: '#71717a' },
    ])
  })

  it('ignores income rows and rows outside the date range', () => {
    const rows = [
      row({ amount: 50, type: 'income', location_city: 'Jakarta' }),
      row({ amount: 30, date: '2026-01-01', location_city: 'Jakarta' }),
      row({ amount: 10, date: '2026-07-15', location_city: 'Jakarta' }),
    ]

    expect(
      getSpendingByCity(rows, { from: '2026-07-01', to: '2026-07-31' }),
    ).toEqual([{ location: 'Jakarta', amount: 10, fill: expect.any(String) }])
  })
})

describe('getSpendingByCountry', () => {
  it('groups and sums expense amounts by country', () => {
    const rows = [
      row({ amount: 50, location_country: 'Indonesia' }),
      row({ amount: 25, location_country: 'Singapore' }),
    ]

    expect(getSpendingByCountry(rows, NO_RANGE)).toEqual([
      { location: 'Indonesia', amount: 50, fill: expect.any(String) },
      { location: 'Singapore', amount: 25, fill: expect.any(String) },
    ])
  })

  it('groups rows with no country under a trailing "No location" bucket', () => {
    const rows = [
      row({ amount: 50, location_country: 'Indonesia' }),
      row({ amount: 30, location_country: null }),
    ]

    expect(getSpendingByCountry(rows, NO_RANGE)).toEqual([
      { location: 'Indonesia', amount: 50, fill: expect.any(String) },
      { location: NO_LOCATION_LABEL, amount: 30, fill: '#71717a' },
    ])
  })
})

describe('getDateRangeTotals', () => {
  it('includes a same-day afternoon transaction when `to` is that same day', () => {
    const rows = [
      row({ amount: 40, type: 'expense', date: '2026-07-29T14:30:00.000Z' }),
    ]

    expect(
      getDateRangeTotals(rows, { from: '2026-07-01', to: '2026-07-29' }),
    ).toEqual({ income: 0, expense: 40 })
  })

  it('still excludes a transaction from the day after the range', () => {
    const rows = [
      row({ amount: 40, type: 'expense', date: '2026-07-30T09:00:00.000Z' }),
    ]

    expect(
      getDateRangeTotals(rows, { from: '2026-07-01', to: '2026-07-29' }),
    ).toEqual({ income: 0, expense: 0 })
  })

  it('includes a date-only transaction at the exact lower boundary, in PostgREST offset format', () => {
    // Supabase/PostgREST serializes `timestamptz` as offset notation (e.g.
    // "+00:00"), not the "Z"/millisecond form produced by
    // `Date.prototype.toISOString()`. A date-only transaction sits exactly at
    // local midnight, i.e. exactly at the range's lower boundary instant, so
    // it's the case most likely to be dropped by a naive string comparison
    // between the two differently-formatted-but-equal instants.
    const boundaryInstant = startOfDayIso('2026-07-01').replace(
      /\.\d{3}Z$/,
      '+00:00',
    )
    const rows = [row({ amount: 40, type: 'expense', date: boundaryInstant })]

    expect(
      getDateRangeTotals(rows, { from: '2026-07-01', to: '2026-07-29' }),
    ).toEqual({ income: 0, expense: 40 })
  })
})

describe('getDailySpendingByCategory', () => {
  it('returns empty data and series when the date range is unbounded', () => {
    const rows = [row({ date: '2026-07-01T12:00:00.000Z' })]

    expect(getDailySpendingByCategory(rows, NO_RANGE, categories)).toEqual({
      data: [],
      series: [],
    })
  })

  it('zero-fills days with no transactions across the range', () => {
    const rows = [
      row({
        amount: 50,
        category_id: 'cat-1',
        date: '2026-07-01T12:00:00.000Z',
      }),
      row({
        amount: 30,
        category_id: 'cat-1',
        date: '2026-07-03T12:00:00.000Z',
      }),
    ]

    const { data } = getDailySpendingByCategory(
      rows,
      { from: '2026-07-01', to: '2026-07-03' },
      categories,
    )

    expect(data.map((d) => d.date)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ])
    expect(data[1]).toMatchObject({ date: '2026-07-02', total: 0 })
  })

  it('stacks multiple categories on the same day', () => {
    const rows = [
      row({
        amount: 50,
        category_id: 'cat-1',
        date: '2026-07-01T12:00:00.000Z',
      }),
      row({
        amount: 20,
        category_id: 'cat-2',
        date: '2026-07-01T12:00:00.000Z',
      }),
    ]

    const { data, series } = getDailySpendingByCategory(
      rows,
      { from: '2026-07-01', to: '2026-07-01' },
      categories,
    )

    expect(series.map((s) => s.name).sort()).toEqual(['Food', 'Transport'])
    expect(data[0]).toMatchObject({
      date: '2026-07-01',
      Food: 50,
      Transport: 20,
      total: 70,
    })
  })

  it('falls back a deleted category to Other', () => {
    const rows = [
      row({
        amount: 15,
        category_id: 'deleted-cat',
        date: '2026-07-01T12:00:00.000Z',
      }),
    ]

    const { data, series } = getDailySpendingByCategory(
      rows,
      { from: '2026-07-01', to: '2026-07-01' },
      categories,
    )

    expect(series).toEqual([{ key: 'Other', name: 'Other', color: '#71717a' }])
    expect(data[0]).toMatchObject({ Other: 15, total: 15 })
  })

  it('ignores income rows', () => {
    const rows = [
      row({
        amount: 500,
        type: 'income',
        category_id: 'cat-1',
        date: '2026-07-01T12:00:00.000Z',
      }),
    ]

    const { data, series } = getDailySpendingByCategory(
      rows,
      { from: '2026-07-01', to: '2026-07-01' },
      categories,
    )

    expect(series).toEqual([])
    expect(data[0]).toMatchObject({ date: '2026-07-01', total: 0 })
  })
})

describe('getCategoryFacetCounts', () => {
  it('counts transactions per category within the date range', () => {
    const rows = [
      row({ category_id: 'cat-1', date: '2026-07-01' }),
      row({ category_id: 'cat-1', date: '2026-07-02' }),
      row({ category_id: 'cat-2', date: '2026-07-01' }),
      row({ category_id: 'cat-1', date: '2026-01-01' }),
    ]

    const counts = getCategoryFacetCounts(
      rows,
      { from: '2026-07-01', to: '2026-07-31' },
      null,
    )

    expect(counts.get('cat-1')).toBe(2)
    expect(counts.get('cat-2')).toBe(1)
  })

  it('counts income rows too, unlike the chart aggregations', () => {
    const rows = [row({ category_id: 'cat-1', type: 'income' })]

    expect(getCategoryFacetCounts(rows, NO_RANGE, null).get('cat-1')).toBe(1)
  })

  it('filters by transaction type when given', () => {
    const rows = [
      row({ category_id: 'cat-1', type: 'expense' }),
      row({ category_id: 'cat-1', type: 'income' }),
    ]

    expect(getCategoryFacetCounts(rows, NO_RANGE, 'expense').get('cat-1')).toBe(
      1,
    )
  })
})

describe('getCityFacetOptions', () => {
  it('sorts cities by count descending, then name ascending', () => {
    const rows = [
      row({ location_city: 'Bandung' }),
      row({ location_city: 'Jakarta' }),
      row({ location_city: 'Jakarta' }),
    ]

    expect(getCityFacetOptions(rows, NO_RANGE)).toEqual([
      { value: 'Jakarta', count: 2 },
      { value: 'Bandung', count: 1 },
    ])
  })

  it('buckets rows with no city under the empty-string value', () => {
    const rows = [row({ location_city: null }), row({ location_city: null })]

    expect(getCityFacetOptions(rows, NO_RANGE)).toEqual([
      { value: '', count: 2 },
    ])
  })

  it('respects the date range', () => {
    const rows = [
      row({ location_city: 'Jakarta', date: '2026-01-01' }),
      row({ location_city: 'Jakarta', date: '2026-07-01' }),
    ]

    expect(
      getCityFacetOptions(rows, { from: '2026-07-01', to: '2026-07-31' }),
    ).toEqual([{ value: 'Jakarta', count: 1 }])
  })
})

describe('getFilteredSummary', () => {
  it('sums income/expense/count within the date range, ignoring rows outside it', () => {
    const rows = [
      row({ amount: 100, type: 'expense', date: '2026-07-01' }),
      row({ amount: 50, type: 'income', date: '2026-07-02' }),
      row({ amount: 999, type: 'expense', date: '2026-01-01' }),
    ]

    const summary = getFilteredSummary(
      rows,
      { from: '2026-07-01', to: '2026-07-31' },
      null,
      [],
      [],
    )

    expect(summary).toMatchObject({
      income: 50,
      expense: 100,
      net: -50,
      count: 2,
      share: null,
    })
  })

  it('filters by category id', () => {
    const rows = [
      row({ amount: 100, category_id: 'cat-1' }),
      row({ amount: 50, category_id: 'cat-2' }),
    ]

    const summary = getFilteredSummary(rows, NO_RANGE, null, ['cat-1'], [])

    expect(summary).toMatchObject({ count: 1, expense: 100 })
  })

  it('matches rows with a null location_city under the "" city selection', () => {
    const rows = [
      row({ amount: 100, location_city: null }),
      row({ amount: 50, location_city: 'Jakarta' }),
    ]

    const summary = getFilteredSummary(rows, NO_RANGE, null, [], [''])

    expect(summary).toMatchObject({ count: 1, expense: 100 })
  })

  it('combines type, category, and city filters', () => {
    const rows = [
      row({
        amount: 100,
        type: 'expense',
        category_id: 'cat-1',
        location_city: 'Jakarta',
      }),
      row({
        amount: 50,
        type: 'expense',
        category_id: 'cat-1',
        location_city: 'Bandung',
      }),
      row({
        amount: 999,
        type: 'income',
        category_id: 'cat-1',
        location_city: 'Jakarta',
      }),
    ]

    const summary = getFilteredSummary(
      rows,
      NO_RANGE,
      'expense',
      ['cat-1'],
      ['Jakarta'],
    )

    expect(summary.count).toBe(1)
    expect(summary.expense).toBe(100)
  })

  it('returns income/expense/net with a null share for a mixed-type set', () => {
    const rows = [
      row({ amount: 100, type: 'expense' }),
      row({ amount: 200, type: 'income' }),
    ]

    const summary = getFilteredSummary(rows, NO_RANGE, null, [], [])

    expect(summary).toMatchObject({
      income: 200,
      expense: 100,
      net: 100,
      share: null,
    })
  })

  it('returns a share relative to the date range total for a single active type', () => {
    const rows = [
      row({ amount: 100, type: 'expense', category_id: 'cat-1' }),
      row({ amount: 300, type: 'expense', category_id: 'cat-2' }),
    ]

    const summary = getFilteredSummary(rows, NO_RANGE, 'expense', ['cat-1'], [])

    expect(summary.share).toBeCloseTo(0.25)
  })

  it('computes the average amount per matching transaction', () => {
    const rows = [
      row({ amount: 100, type: 'expense' }),
      row({ amount: 300, type: 'expense' }),
    ]

    const summary = getFilteredSummary(rows, NO_RANGE, 'expense', [], [])

    expect(summary.average).toBe(200)
  })

  it('yields a null average and share when the filtered count is 0', () => {
    const rows = [
      row({ amount: 100, type: 'expense', category_id: 'cat-1' }),
      row({ amount: 100, type: 'expense', category_id: 'cat-2' }),
    ]

    const summary = getFilteredSummary(rows, NO_RANGE, 'expense', ['cat-3'], [])

    expect(summary.count).toBe(0)
    expect(summary.average).toBeNull()
    expect(summary.share).toBeNull()
  })

  it('yields a null share rather than NaN for a zero denominator', () => {
    const rows = [row({ amount: 100, type: 'income' })]

    const summary = getFilteredSummary(rows, NO_RANGE, 'expense', [], [])

    expect(summary.count).toBe(0)
    expect(summary.share).toBeNull()
  })

  // Drilldown continuity (spec 13 AC): the sheet's category total
  // (getSpendingByCategory) and the table summary bar's total for the same
  // category + date range must agree, since a "View all" commit carries the
  // exact same categoryIds/dateRange into the table filters.
  it("matches getSpendingByCategory's total for the same category and date range", () => {
    const rows = [
      row({ amount: 120, category_id: 'cat-1', date: '2026-07-05' }),
      row({ amount: 80, category_id: 'cat-1', date: '2026-07-20' }),
      row({ amount: 999, category_id: 'cat-2', date: '2026-07-10' }),
      row({
        amount: 500,
        type: 'income',
        category_id: 'cat-1',
        date: '2026-07-10',
      }),
      row({ amount: 50, category_id: 'cat-1', date: '2026-01-01' }),
    ]
    const dateRange = { from: '2026-07-01', to: '2026-07-31' }

    const chartTotal = getSpendingByCategory(rows, dateRange, categories).find(
      (c) => c.categoryId === 'cat-1',
    )?.amount

    const summary = getFilteredSummary(
      rows,
      dateRange,
      'expense',
      ['cat-1'],
      [],
    )

    expect(chartTotal).toBe(200)
    expect(summary.expense).toBe(chartTotal)
    expect(summary.count).toBe(2)
  })
})

describe('hasLocationData', () => {
  it('returns false when no transaction has a city or country', () => {
    expect(hasLocationData([row(), row()])).toBe(false)
  })

  it('returns true when at least one transaction has a city', () => {
    expect(hasLocationData([row(), row({ location_city: 'Jakarta' })])).toBe(
      true,
    )
  })

  it('returns true when at least one transaction has a country', () => {
    expect(
      hasLocationData([row(), row({ location_country: 'Indonesia' })]),
    ).toBe(true)
  })
})
