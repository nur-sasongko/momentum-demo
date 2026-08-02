import { describe, expect, it } from 'vitest'

import { buildCityFilter } from '../finance-queries'

describe('buildCityFilter', () => {
  it('returns none when no cities are selected', () => {
    expect(buildCityFilter([])).toEqual({ kind: 'none' })
  })

  it('uses an `in` filter when only named cities are selected', () => {
    expect(buildCityFilter(['Jakarta', 'Bandung'])).toEqual({
      kind: 'in',
      values: ['Jakarta', 'Bandung'],
    })
  })

  it('falls back to `or` for the "no location" bucket alone', () => {
    expect(buildCityFilter([''])).toEqual({
      kind: 'or',
      expression: 'location_city.is.null,location_city.eq.',
    })
  })

  it('combines the "no location" bucket with named cities via `or`', () => {
    expect(buildCityFilter(['', 'Jakarta'])).toEqual({
      kind: 'or',
      expression:
        'location_city.is.null,location_city.eq.,location_city.in.("Jakarta")',
    })
  })

  it('quotes a city containing a comma or space', () => {
    expect(buildCityFilter(['', 'New York'])).toEqual({
      kind: 'or',
      expression:
        'location_city.is.null,location_city.eq.,location_city.in.("New York")',
    })
  })

  it('escapes an embedded double quote', () => {
    expect(buildCityFilter(['', 'Foo "Bar"'])).toEqual({
      kind: 'or',
      expression:
        'location_city.is.null,location_city.eq.,location_city.in.("Foo \\"Bar\\"")',
    })
  })
})
