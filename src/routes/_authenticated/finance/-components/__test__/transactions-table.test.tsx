import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceStore } from '#/stores/finance-store'
import {
  useArchiveTransactionMutation,
  useFinanceAggregateQuery,
  useRestoreTransactionMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from '../../-utils/finance-queries'
import { useFinanceFilters } from '../../-utils/use-finance-filters'
import { TransactionsTable } from '../transactions-table'

import type { FinanceCategory, Transaction } from '#/stores/finance-store'
import type { Mock } from 'vitest'

vi.mock('../../-utils/finance-queries', () => ({
  useTransactionsQuery: vi.fn(),
  useFinanceAggregateQuery: vi.fn(() => ({ data: [] })),
  useUpdateTransactionMutation: vi.fn(),
  useArchiveTransactionMutation: vi.fn(),
  useRestoreTransactionMutation: vi.fn(),
  useCreateCategoryMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useUpdateCategoryMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useDeleteCategoryMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

vi.mock('../../-utils/use-finance-filters', () => ({
  useFinanceFilters: vi.fn(),
}))

const useTransactionsQueryMock = useTransactionsQuery as unknown as Mock
const useFinanceAggregateQueryMock = useFinanceAggregateQuery as unknown as Mock
const useUpdateTransactionMutationMock =
  useUpdateTransactionMutation as unknown as Mock
const useArchiveTransactionMutationMock =
  useArchiveTransactionMutation as unknown as Mock
const useRestoreTransactionMutationMock =
  useRestoreTransactionMutation as unknown as Mock
const useFinanceFiltersMock = useFinanceFilters as unknown as Mock

function mockFinanceFilters(overrides: Record<string, unknown> = {}) {
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

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

const category: FinanceCategory = {
  id: 'cat-1',
  name: 'Food',
  type: 'expense',
  color: '#f59e0b',
  isSystem: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const transaction: Transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 100,
  date: '2026-07-01T00:00:00.000Z',
  note: 'Lunch',
  categoryId: 'cat-1',
  category,
  location: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

let updateMutate: Mock
let archiveMutate: Mock
let restoreMutate: Mock

beforeEach(() => {
  mockMatchMedia()
  useFinanceStore.setState({ categories: [category] })
  mockFinanceFilters()

  useTransactionsQueryMock.mockReturnValue({
    data: { data: [transaction], count: 1 },
    isFetching: false,
  })
  useFinanceAggregateQueryMock.mockReturnValue({ data: [] })
  updateMutate = vi.fn()
  useUpdateTransactionMutationMock.mockReturnValue({
    mutate: updateMutate,
    isPending: false,
  })
  archiveMutate = vi.fn()
  useArchiveTransactionMutationMock.mockReturnValue({
    mutate: archiveMutate,
    isPending: false,
  })
  restoreMutate = vi.fn()
  useRestoreTransactionMutationMock.mockReturnValue({
    mutate: restoreMutate,
    isPending: false,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TransactionsTable — Amount cell', () => {
  it('renders a formatted currency input in edit mode', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByText('−100.00'))

    expect(screen.getByDisplayValue('100.00')).toBeTruthy()
  })

  it('saves the parsed numeric amount on commit', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByText('−100.00'))
    const input = screen.getByDisplayValue('100.00')
    fireEvent.change(input, { target: { value: '1234.5' } })
    fireEvent.blur(input)

    expect(updateMutate).toHaveBeenCalledWith({
      id: 'tx-1',
      input: expect.objectContaining({ amount: 1234.5 }),
    })
  })

  it('does not save an empty or zero amount', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByText('−100.00'))
    const input = screen.getByDisplayValue('100.00')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('cancels without saving on Escape', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByText('−100.00'))
    const input = screen.getByDisplayValue('100.00')
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(updateMutate).not.toHaveBeenCalled()
    expect(screen.getByText('−100.00')).toBeTruthy()
  })
})

describe('TransactionsTable — archive confirmation', () => {
  it('does not archive when the trash icon is clicked without confirming', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Archive transaction' }))

    expect(archiveMutate).not.toHaveBeenCalled()
    expect(screen.getByText('Move to Archive?')).toBeTruthy()
  })

  it('archives only after the dialog is confirmed', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Archive transaction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move to Archive' }))

    expect(archiveMutate).toHaveBeenCalledWith('tx-1')
  })

  it('does not archive when the dialog is cancelled', () => {
    render(<TransactionsTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Archive transaction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(archiveMutate).not.toHaveBeenCalled()
    expect(screen.queryByText('Move to Archive?')).toBeNull()
  })
})

describe('TransactionsTable — filtered summary bar', () => {
  it('appears with filters set and disappears once a search value is entered', async () => {
    mockFinanceFilters({ selectedType: 'expense', activeFilterCount: 1 })
    useFinanceAggregateQueryMock.mockReturnValue({
      data: [
        {
          amount: 100,
          type: 'expense',
          date: '2026-07-01',
          category_id: 'cat-1',
          location_city: null,
          location_country: null,
        },
      ],
    })

    render(<TransactionsTable />)

    expect(screen.getByText('Clear all')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Search notes…'), {
      target: { value: 'coffee' },
    })

    await waitFor(() => {
      expect(screen.queryByText('Clear all')).toBeNull()
    })
  })

  it('reappears once the search value is cleared', async () => {
    mockFinanceFilters({ selectedType: 'expense', activeFilterCount: 1 })
    useFinanceAggregateQueryMock.mockReturnValue({
      data: [
        {
          amount: 100,
          type: 'expense',
          date: '2026-07-01',
          category_id: 'cat-1',
          location_city: null,
          location_country: null,
        },
      ],
    })

    render(<TransactionsTable />)
    const input = screen.getByPlaceholderText('Search notes…')

    fireEvent.change(input, { target: { value: 'coffee' } })
    await waitFor(() => {
      expect(screen.queryByText('Clear all')).toBeNull()
    })

    fireEvent.change(input, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getByText('Clear all')).toBeTruthy()
    })
  })
})
