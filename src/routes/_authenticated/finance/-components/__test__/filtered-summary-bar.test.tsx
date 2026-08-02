import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../../-utils/finance-queries'
import { useFinanceFilters } from '../../-utils/use-finance-filters'
import { FilteredSummaryBar } from '../filtered-summary-bar'

import type { FinanceCategory } from '#/stores/finance-store'
import type { AggregateRow } from '../../-utils/finance-utils'
import type { Mock } from 'vitest'

vi.mock('../../-utils/finance-queries', () => ({
  useFinanceAggregateQuery: vi.fn(),
}))

vi.mock('../../-utils/use-finance-filters', () => ({
  useFinanceFilters: vi.fn(),
}))

const useFinanceAggregateQueryMock = useFinanceAggregateQuery as unknown as Mock
const useFinanceFiltersMock = useFinanceFilters as unknown as Mock

const category: FinanceCategory = {
  id: 'cat-1',
  name: 'Food',
  type: 'expense',
  color: '#f59e0b',
  isSystem: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

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

function mockFilters(overrides: Record<string, unknown> = {}) {
  useFinanceFiltersMock.mockReturnValue({
    dateRange: { from: null, to: null },
    selectedType: null,
    setSelectedType: vi.fn(),
    selectedCategories: [],
    toggleCategory: vi.fn(),
    selectedCities: [],
    toggleCity: vi.fn(),
    clearTransactionFilters: vi.fn(),
    activeFilterCount: 0,
    ...overrides,
  })
}

beforeEach(() => {
  useFinanceStore.setState({ categories: [category] })
  useFinanceAggregateQueryMock.mockReturnValue({ data: [] })
  mockFilters()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('FilteredSummaryBar', () => {
  it('renders nothing when no type/category/city filter is active', () => {
    const { container } = render(<FilteredSummaryBar isSearchActive={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when isSearchActive is true, even with filters active', () => {
    mockFilters({ selectedType: 'expense', activeFilterCount: 1 })
    const { container } = render(<FilteredSummaryBar isSearchActive={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Total/Share/Transactions/Average for a single-type set', () => {
    mockFilters({ selectedType: 'expense', activeFilterCount: 1 })
    useFinanceAggregateQueryMock.mockReturnValue({
      data: [row({ amount: 100 }), row({ amount: 300, category_id: 'cat-2' })],
    })

    render(<FilteredSummaryBar isSearchActive={false} />)

    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText('Share of period')).toBeTruthy()
    expect(screen.getByText('Transactions')).toBeTruthy()
    expect(screen.getByText('Average')).toBeTruthy()
  })

  it('renders Income/Expenses/Net/Transactions for a mixed set', () => {
    mockFilters({ selectedCategories: ['cat-1'], activeFilterCount: 1 })
    useFinanceAggregateQueryMock.mockReturnValue({
      data: [row({ amount: 100 }), row({ amount: 200, type: 'income' })],
    })

    render(<FilteredSummaryBar isSearchActive={false} />)

    expect(screen.getByText('Income')).toBeTruthy()
    expect(screen.getByText('Expenses')).toBeTruthy()
    expect(screen.getByText('Net')).toBeTruthy()
    expect(screen.getByText('Transactions')).toBeTruthy()
    expect(screen.queryByText('Share of period')).toBeNull()
    expect(screen.queryByText('Average')).toBeNull()
  })

  it('renders one chip per active selection', () => {
    mockFilters({
      selectedType: 'expense',
      selectedCategories: ['cat-1'],
      selectedCities: ['Jakarta'],
      activeFilterCount: 3,
    })

    render(<FilteredSummaryBar isSearchActive={false} />)

    expect(screen.getByText('Expense')).toBeTruthy()
    expect(screen.getByText('Food')).toBeTruthy()
    expect(screen.getByText('Jakarta')).toBeTruthy()
  })

  it("clicking a category chip's remove button calls toggleCategory with that id only", () => {
    const toggleCategory = vi.fn()
    mockFilters({
      selectedCategories: ['cat-1'],
      toggleCategory,
      activeFilterCount: 1,
    })

    render(<FilteredSummaryBar isSearchActive={false} />)
    fireEvent.click(screen.getByLabelText('Remove Food filter'))

    expect(toggleCategory).toHaveBeenCalledTimes(1)
    expect(toggleCategory).toHaveBeenCalledWith('cat-1')
  })

  it("clicking the type chip's remove button calls setSelectedType with null", () => {
    const setSelectedType = vi.fn()
    mockFilters({
      selectedType: 'expense',
      setSelectedType,
      activeFilterCount: 1,
    })

    render(<FilteredSummaryBar isSearchActive={false} />)
    fireEvent.click(screen.getByLabelText('Remove Expense filter'))

    expect(setSelectedType).toHaveBeenCalledTimes(1)
    expect(setSelectedType).toHaveBeenCalledWith(null)
  })

  it("clicking a city chip's remove button calls toggleCity with that city only", () => {
    const toggleCity = vi.fn()
    mockFilters({
      selectedCities: ['Jakarta', 'Bandung'],
      toggleCity,
      activeFilterCount: 1,
    })

    render(<FilteredSummaryBar isSearchActive={false} />)
    fireEvent.click(screen.getByLabelText('Remove Jakarta filter'))

    expect(toggleCity).toHaveBeenCalledTimes(1)
    expect(toggleCity).toHaveBeenCalledWith('Jakarta')
  })

  it('renders "No location" for the "" city selection', () => {
    mockFilters({ selectedCities: [''], activeFilterCount: 1 })

    render(<FilteredSummaryBar isSearchActive={false} />)

    expect(screen.getByText('No location')).toBeTruthy()
  })

  it('renders the date range as a chip with no remove button', () => {
    mockFilters({
      selectedType: 'expense',
      dateRange: { from: '2026-07-01', to: '2026-07-31' },
      activeFilterCount: 1,
    })

    render(<FilteredSummaryBar isSearchActive={false} />)

    expect(screen.getByText('Jul 1 – Jul 31')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Jul/ })).toBeNull()
  })

  it('renders the empty message and no stat blocks when zero transactions match', () => {
    mockFilters({ selectedType: 'expense', activeFilterCount: 1 })
    useFinanceAggregateQueryMock.mockReturnValue({ data: [] })

    render(<FilteredSummaryBar isSearchActive={false} />)

    expect(
      screen.getByText('No transactions match these filters.'),
    ).toBeTruthy()
    expect(screen.queryByText('Total')).toBeNull()
  })

  it('calls clearTransactionFilters exactly once when "Clear all" is clicked', () => {
    const clearTransactionFilters = vi.fn()
    mockFilters({
      selectedType: 'expense',
      clearTransactionFilters,
      activeFilterCount: 1,
    })

    render(<FilteredSummaryBar isSearchActive={false} />)
    fireEvent.click(screen.getByText('Clear all'))

    expect(clearTransactionFilters).toHaveBeenCalledTimes(1)
  })
})
