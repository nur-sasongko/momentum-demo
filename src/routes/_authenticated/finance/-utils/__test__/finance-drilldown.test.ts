import { describe, expect, it } from 'vitest'

import { NO_LOCATION_LABEL } from '../finance-utils'
import {
  selectionFromCityBar,
  selectionFromCountryBar,
} from '../finance-drilldown'

import type { LocationSpending } from '../../-types/finance-chart'

describe('selectionFromCityBar', () => {
  it('builds a city selection from a known-city bar', () => {
    const entry: LocationSpending = {
      location: 'Jakarta',
      amount: 50,
      fill: '#0ea5e9',
    }

    expect(selectionFromCityBar(entry)).toEqual({
      kind: 'city',
      label: 'Jakarta',
      color: '#0ea5e9',
      amount: 50,
      city: 'Jakarta',
    })
  })

  it('maps the "No location" bucket to an empty city filter', () => {
    const entry: LocationSpending = {
      location: NO_LOCATION_LABEL,
      amount: 40,
      fill: '#71717a',
    }

    expect(selectionFromCityBar(entry)).toEqual({
      kind: 'city',
      label: NO_LOCATION_LABEL,
      color: '#71717a',
      amount: 40,
      city: '',
    })
  })
})

describe('selectionFromCountryBar', () => {
  it('builds a country selection from a known-country bar', () => {
    const entry: LocationSpending = {
      location: 'Indonesia',
      amount: 50,
      fill: '#0ea5e9',
    }

    expect(selectionFromCountryBar(entry)).toEqual({
      kind: 'country',
      label: 'Indonesia',
      color: '#0ea5e9',
      amount: 50,
      country: 'Indonesia',
    })
  })

  it('maps the "No location" bucket to an empty country filter', () => {
    const entry: LocationSpending = {
      location: NO_LOCATION_LABEL,
      amount: 40,
      fill: '#71717a',
    }

    expect(selectionFromCountryBar(entry)).toEqual({
      kind: 'country',
      label: NO_LOCATION_LABEL,
      color: '#71717a',
      amount: 40,
      country: '',
    })
  })
})
