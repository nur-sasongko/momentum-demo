import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceStore } from '#/stores/finance-store'
import {
  useDeleteTransactionMutation,
  useFinanceAggregateQuery,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from '../../-utils/finance-queries'
import { TransactionsTable } from '../transactions-table'

import type { FinanceCategory, Transaction } from '#/stores/finance-store'
import type { Mock } from 'vitest'

vi.mock('../../-utils/finance-queries', () => ({
  useTransactionsQuery: vi.fn(),
  useFinanceAggregateQuery: vi.fn(() => ({ data: [] })),
  useUpdateTransactionMutation: vi.fn(),
  useDeleteTransactionMutation: vi.fn(),
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

const useTransactionsQueryMock = useTransactionsQuery as unknown as Mock
const useFinanceAggregateQueryMock = useFinanceAggregateQuery as unknown as Mock
const useUpdateTransactionMutationMock =
  useUpdateTransactionMutation as unknown as Mock
const useDeleteTransactionMutationMock =
  useDeleteTransactionMutation as unknown as Mock

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

beforeEach(() => {
  mockMatchMedia()
  useFinanceStore.setState({
    categories: [category],
    dateRange: { from: null, to: null },
    selectedType: null,
    selectedCategories: [],
    selectedCities: [],
  })

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
  useDeleteTransactionMutationMock.mockReturnValue({
    mutate: vi.fn(),
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
