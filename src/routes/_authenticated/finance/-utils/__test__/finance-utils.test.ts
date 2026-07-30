import { describe, expect, it } from 'vitest'

import type { FinanceCategory } from '#/stores/finance-store'
import type { AggregateRow } from '../finance-utils'
import {
  getDailySpendingByCategory,
  getDateRangeTotals,
  getSpendingByCity,
  getSpendingByCountry,
  hasLocationData,
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

  it('excludes rows with no city, without throwing', () => {
    const rows = [
      row({ amount: 50, location_city: 'Jakarta' }),
      row({ amount: 30, location_city: null }),
    ]

    expect(getSpendingByCity(rows, NO_RANGE)).toEqual([
      { location: 'Jakarta', amount: 50, fill: expect.any(String) },
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
