import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceStore } from '#/stores/finance-store'
import { TransactionFormSheet } from '../transaction-form'

import type { FinanceCategory, Transaction } from '#/stores/finance-store'

vi.mock('../../-utils/finance-queries', () => ({
  useCreateTransactionMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateTransactionMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

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

const existingTransaction: Transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 50,
  date: '2026-07-01T00:00:00.000Z',
  note: 'Lunch',
  categoryId: 'cat-1',
  category,
  location: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

beforeEach(() => {
  mockMatchMedia()
  useFinanceStore.setState({
    categories: [category],
    isAddTransactionOpen: false,
    editingTransactionId: null,
    editingTransaction: null,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TransactionFormSheet — discard/stay confirmation', () => {
  it('closes immediately with no dialog when a fresh add form is unedited', () => {
    useFinanceStore.setState({ isAddTransactionOpen: true })
    render(<TransactionFormSheet />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useFinanceStore.getState().isAddTransactionOpen).toBe(false)
  })

  it('shows the confirmation dialog when closing an edited add form', () => {
    useFinanceStore.setState({ isAddTransactionOpen: true })
    render(<TransactionFormSheet />)

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '25' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(useFinanceStore.getState().isAddTransactionOpen).toBe(true)
  })

  it('"Keep editing" leaves the sheet open with edits intact', () => {
    useFinanceStore.setState({ isAddTransactionOpen: true })
    render(<TransactionFormSheet />)

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '25' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useFinanceStore.getState().isAddTransactionOpen).toBe(true)
    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '25.00')
  })

  it('"Discard changes" closes and resets the sheet', () => {
    useFinanceStore.setState({ isAddTransactionOpen: true })
    render(<TransactionFormSheet />)

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '25' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(useFinanceStore.getState().isAddTransactionOpen).toBe(false)
  })

  it('closes immediately with no dialog when editing an existing transaction without changes', () => {
    useFinanceStore.setState({
      isAddTransactionOpen: true,
      editingTransactionId: existingTransaction.id,
      editingTransaction: existingTransaction,
    })
    render(<TransactionFormSheet />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useFinanceStore.getState().isAddTransactionOpen).toBe(false)
  })

  it('shows the confirmation dialog when closing an edited existing transaction', () => {
    useFinanceStore.setState({
      isAddTransactionOpen: true,
      editingTransactionId: existingTransaction.id,
      editingTransaction: existingTransaction,
    })
    render(<TransactionFormSheet />)

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '99' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
  })
})
