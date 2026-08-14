import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../../-utils/finance-queries'
import { useFinanceFilters } from '../../-utils/use-finance-filters'
import { SpendingByDailyChart } from '../spending-by-daily-chart'

import type { AggregateRow } from '../../-types/finance-api'
import type { Mock } from 'vitest'

vi.mock('../../-utils/finance-queries', () => ({
  useFinanceAggregateQuery: vi.fn(),
}))
vi.mock('../../-utils/use-finance-filters', () => ({
  useFinanceFilters: vi.fn(),
}))
vi.mock('#/stores/finance-store', () => ({
  useFinanceStore: vi.fn(),
}))

const useFinanceStoreMock = useFinanceStore as unknown as Mock
const useFinanceFiltersMock = useFinanceFilters as unknown as Mock
const useFinanceAggregateQueryMock = useFinanceAggregateQuery as unknown as Mock

function row(overrides: Partial<AggregateRow> = {}): AggregateRow {
  return {
    amount: 100,
    type: 'expense',
    date: '2026-07-01T12:00:00.000Z',
    category_id: 'cat-1',
    location_city: null,
    location_country: null,
    ...overrides,
  }
}

function mockStore(dateRange: { from: string | null; to: string | null }) {
  useFinanceFiltersMock.mockReturnValue({ dateRange })
  useFinanceStoreMock.mockImplementation(
    (selector: (state: { categories: unknown[] }) => unknown) =>
      selector({ categories: [] }),
  )
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
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('SpendingByDailyChart', () => {
  it('prompts to pick a date range when none is selected', () => {
    mockStore({ from: null, to: null })
    mockAggregateRows([row()])

    render(<SpendingByDailyChart />)

    expect(
      screen.getByText('Pick a date range to see daily spending.'),
    ).toBeTruthy()
  })

  it('shows an empty state when no expenses fall in the selected range', () => {
    mockStore({ from: '2026-08-01', to: '2026-08-05' })
    mockAggregateRows([row()])

    render(<SpendingByDailyChart />)

    expect(
      screen.getByText('No expenses recorded for this period.'),
    ).toBeTruthy()
  })

  it('renders the chart card when expenses fall in the selected range', () => {
    mockStore({ from: '2026-07-01', to: '2026-07-01' })
    mockAggregateRows([row()])

    render(<SpendingByDailyChart />)

    expect(screen.getByText('Daily spending')).toBeTruthy()
    expect(
      screen.queryByText('No expenses recorded for this period.'),
    ).toBeNull()
  })
})
