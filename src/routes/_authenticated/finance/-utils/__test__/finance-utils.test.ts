import { describe, expect, it } from 'vitest'

import type { AggregateRow } from '../finance-utils'
import {
  getSpendingByCity,
  getSpendingByCountry,
  hasLocationData,
} from '../finance-utils'

const NO_RANGE = { from: null, to: null }

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
