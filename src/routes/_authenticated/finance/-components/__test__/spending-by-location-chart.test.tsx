import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceAggregateQuery } from '../../-utils/finance-queries'
import { useFinanceFilters } from '../../-utils/use-finance-filters'
import { SpendingByLocationChart } from '../spending-by-location-chart'

import type { AggregateRow } from '../../-types/finance-api'
import type { Mock } from 'vitest'

vi.mock('../../-utils/finance-queries', () => ({
  useFinanceAggregateQuery: vi.fn(),
}))
vi.mock('../../-utils/use-finance-filters', () => ({
  useFinanceFilters: vi.fn(),
}))

const useFinanceFiltersMock = useFinanceFilters as unknown as Mock
const useFinanceAggregateQueryMock = useFinanceAggregateQuery as unknown as Mock

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

function mockAggregateRows(rows: AggregateRow[]) {
  useFinanceAggregateQueryMock.mockReturnValue({ data: rows })
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  useFinanceFiltersMock.mockReturnValue({
    dateRange: { from: null, to: null },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('SpendingByLocationChart', () => {
  it('shows an empty state when no expenses fall in range', () => {
    mockAggregateRows([])

    render(<SpendingByLocationChart />)

    expect(
      screen.getByText('No expenses with a location recorded for this period.'),
    ).toBeTruthy()
  })

  it('groups transactions without a location under "No location" instead of the empty state', () => {
    mockAggregateRows([row(), row({ amount: 50 })])

    render(<SpendingByLocationChart />)

    expect(screen.getByText('Spending by location')).toBeTruthy()
    expect(
      screen.queryByText(
        'No expenses with a location recorded for this period.',
      ),
    ).toBeNull()
  })

  it('renders the chart card without the empty state when city data exists', () => {
    mockAggregateRows([
      row({ location_city: 'Jakarta' }),
      row({ location_city: 'Bandung', amount: 20 }),
    ])

    render(<SpendingByLocationChart />)

    expect(screen.getByText('Spending by location')).toBeTruthy()
    expect(
      screen.queryByText(
        'No expenses with a location recorded for this period.',
      ),
    ).toBeNull()
  })
})
