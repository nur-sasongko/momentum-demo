import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceStore } from '#/stores/finance-store'
import { CategoryManager } from '../category-manager'
import {
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from '../../-utils/finance-queries'

import type { FinanceCategory } from '#/stores/finance-store'

vi.mock('../../-utils/finance-queries', () => ({
  useCreateCategoryMutation: vi.fn(),
  useDeleteCategoryMutation: vi.fn(),
  useUpdateCategoryMutation: vi.fn(),
}))

const category: FinanceCategory = {
  id: 'cat-1',
  name: 'Food',
  type: 'expense',
  color: '#f59e0b',
  isSystem: false,
  createdAt: '2026-01-01T00:00:00.000Z',
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

beforeEach(() => {
  mockMatchMedia()
  useFinanceStore.setState({ categories: [category] })
  vi.mocked(useCreateCategoryMutation).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateCategoryMutation>)
  vi.mocked(useDeleteCategoryMutation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteCategoryMutation>)
  vi.mocked(useUpdateCategoryMutation).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateCategoryMutation>)
})

afterEach(() => {
  vi.clearAllMocks()
})

function openSheet() {
  fireEvent.click(screen.getByRole('button', { name: 'Manage categories' }))
}

describe('CategoryManager — discard/stay confirmation', () => {
  it('closes immediately with no dialog when the Add form is untouched', () => {
    render(<CategoryManager />)
    openSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(
      screen.queryByText(
        'Add or remove categories. System categories cannot be deleted.',
      ),
    ).toBeNull()
  })

  it('shows the confirmation dialog after typing in the Add Category form', () => {
    render(<CategoryManager />)
    openSheet()

    fireEvent.change(screen.getByPlaceholderText('e.g. Travel'), {
      target: { value: 'Travel' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
  })

  it('"Discard changes" closes the sheet', () => {
    render(<CategoryManager />)
    openSheet()

    fireEvent.change(screen.getByPlaceholderText('e.g. Travel'), {
      target: { value: 'Travel' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(
      screen.queryByText(
        'Add or remove categories. System categories cannot be deleted.',
      ),
    ).toBeNull()
  })

  it('editing an existing row does not trigger the sheet-level dialog', () => {
    render(<CategoryManager />)
    openSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }))
    fireEvent.change(screen.getByDisplayValue('Food'), {
      target: { value: 'Groceries' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(
      screen.queryByText(
        'Add or remove categories. System categories cannot be deleted.',
      ),
    ).toBeNull()
  })
})
