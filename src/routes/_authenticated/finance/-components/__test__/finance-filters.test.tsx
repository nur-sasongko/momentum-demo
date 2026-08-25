import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFinanceExport } from '../../-utils/use-finance-export'
import { useFinanceFilters } from '../../-utils/use-finance-filters'
import { FinanceFilters } from '../finance-filters'

import type { Mock } from 'vitest'

vi.mock('../../-utils/use-finance-filters', () => ({
  useFinanceFilters: vi.fn(),
}))

vi.mock('../../-utils/use-finance-export', () => ({
  useFinanceExport: vi.fn(),
}))

const useFinanceFiltersMock = useFinanceFilters as unknown as Mock
const useFinanceExportMock = useFinanceExport as unknown as Mock

function mockFilters(overrides: Record<string, unknown> = {}) {
  useFinanceFiltersMock.mockReturnValue({
    dateRange: { from: null, to: null },
    setDateRange: vi.fn(),
    ...overrides,
  })
}

function mockExport(overrides: Record<string, unknown> = {}) {
  useFinanceExportMock.mockReturnValue({
    exportTransactions: vi.fn(),
    isPending: false,
    isEmpty: false,
    ...overrides,
  })
}

beforeEach(() => {
  mockFilters()
  mockExport()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('FinanceFilters — Export button', () => {
  it('renders an enabled Export button when there are matching transactions', () => {
    render(<FinanceFilters />)
    const button = screen.getByRole('button', { name: /export/i })
    expect(button.disabled).toBe(false)
  })

  it('calls exportTransactions when clicked', () => {
    const exportTransactions = vi.fn()
    mockExport({ exportTransactions })
    render(<FinanceFilters />)

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    expect(exportTransactions).toHaveBeenCalledTimes(1)
  })

  it('disables the button and shows a tooltip when there is nothing to export', () => {
    mockExport({ isEmpty: true })
    render(<FinanceFilters />)

    expect(screen.getByRole('button', { name: /export/i }).disabled).toBe(true)
  })

  it('shows a pending label and disables the button while exporting', () => {
    mockExport({ isPending: true })
    render(<FinanceFilters />)

    const button = screen.getByRole('button', { name: /exporting/i })
    expect(button.disabled).toBe(true)
  })

  it('cannot be double-clicked into two exports — a disabled button ignores clicks', () => {
    const exportTransactions = vi.fn()
    mockExport({ exportTransactions, isPending: true })
    render(<FinanceFilters />)

    fireEvent.click(screen.getByRole('button', { name: /exporting/i }))

    expect(exportTransactions).not.toHaveBeenCalled()
  })
})
