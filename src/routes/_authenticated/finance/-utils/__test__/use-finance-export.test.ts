import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from 'sonner'
import { useFinanceExport } from '../use-finance-export'

import type { AggregateRow } from '../../-types/finance-api'
import type { Transaction } from '#/stores/finance-store'

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('#/stores/finance-store', () => ({
  useFinanceStore: (selector: (s: { categories: unknown[] }) => unknown) =>
    selector({ categories: [] }),
}))

const fetchAllTransactionsForExportMock = vi.fn()

class MockFinanceExportRowCapError extends Error {}

vi.mock('../finance-export-query', () => ({
  FinanceExportRowCapError: MockFinanceExportRowCapError,
  fetchAllTransactionsForExport: (...args: unknown[]) =>
    fetchAllTransactionsForExportMock(...args),
}))

const exportFinanceTransactionsToXlsxMock = vi.fn()
vi.mock('../export-finance-xlsx', () => ({
  exportFinanceTransactionsToXlsx: (...args: unknown[]) =>
    exportFinanceTransactionsToXlsxMock(...args),
}))

let aggregateRows: AggregateRow[] = []
vi.mock('../finance-queries', () => ({
  useFinanceAggregateQuery: () => ({ data: aggregateRows }),
}))

vi.mock('../use-finance-filters', () => ({
  useFinanceFilters: () => ({
    dateRange: { from: null, to: null },
    selectedType: null,
    selectedCategories: [],
    selectedCities: [],
  }),
}))

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 25,
    date: '2026-07-01T00:00:00.000Z',
    note: '',
    categoryId: 'cat-1',
    location: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function row(overrides: Partial<AggregateRow> = {}): AggregateRow {
  return {
    amount: 25,
    type: 'expense',
    date: '2026-07-01',
    category_id: 'cat-1',
    location_city: null,
    location_country: null,
    ...overrides,
  }
}

beforeEach(() => {
  aggregateRows = []
  fetchAllTransactionsForExportMock.mockReset()
  exportFinanceTransactionsToXlsxMock.mockReset()
  vi.mocked(toast.loading).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('useFinanceExport', () => {
  it('reports isEmpty when the filtered aggregate has no matching rows', () => {
    aggregateRows = []
    const { result } = renderHook(() => useFinanceExport())
    expect(result.current.isEmpty).toBe(true)
  })

  it('reports not-empty when the filtered aggregate has matching rows', () => {
    aggregateRows = [row()]
    const { result } = renderHook(() => useFinanceExport())
    expect(result.current.isEmpty).toBe(false)
  })

  it('shows an error toast and never writes a file when the fetch returns no rows', async () => {
    fetchAllTransactionsForExportMock.mockResolvedValue([])
    const { result } = renderHook(() => useFinanceExport())

    await act(async () => {
      await result.current.exportTransactions()
    })

    expect(exportFinanceTransactionsToXlsxMock).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'No transactions match the current filters.',
      { id: 'toast-id' },
    )
    expect(result.current.isPending).toBe(false)
  })

  it('shows a success toast with the row count on a clean export', async () => {
    fetchAllTransactionsForExportMock.mockResolvedValue([tx()])
    exportFinanceTransactionsToXlsxMock.mockResolvedValue({
      filename: 'finance-all-time-2026-08-24.xlsx',
      rowCount: 1,
      truncatedNotes: 0,
    })
    const { result } = renderHook(() => useFinanceExport())

    await act(async () => {
      await result.current.exportTransactions()
    })

    expect(toast.success).toHaveBeenCalledWith('Exported 1 transaction', {
      id: 'toast-id',
    })
  })

  it('appends a truncated-notes suffix to the success toast', async () => {
    fetchAllTransactionsForExportMock.mockResolvedValue([tx(), tx()])
    exportFinanceTransactionsToXlsxMock.mockResolvedValue({
      filename: 'finance-all-time-2026-08-24.xlsx',
      rowCount: 2,
      truncatedNotes: 1,
    })
    const { result } = renderHook(() => useFinanceExport())

    await act(async () => {
      await result.current.exportTransactions()
    })

    expect(toast.success).toHaveBeenCalledWith(
      "Exported 2 transactions · 1 note shortened to fit Excel's cell limit",
      { id: 'toast-id' },
    )
  })

  it('shows the row-cap message when the fetch rejects with FinanceExportRowCapError', async () => {
    fetchAllTransactionsForExportMock.mockRejectedValue(
      new MockFinanceExportRowCapError('too many rows'),
    )
    const { result } = renderHook(() => useFinanceExport())

    await act(async () => {
      await result.current.exportTransactions()
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Too many transactions to export at once — narrow the date range.',
      { id: 'toast-id' },
    )
  })

  it('shows a generic failure message for any other error', async () => {
    fetchAllTransactionsForExportMock.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useFinanceExport())

    await act(async () => {
      await result.current.exportTransactions()
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Export failed. Check your connection and try again.',
      { id: 'toast-id' },
    )
  })

  it('sets isPending while the export is in flight and clears it afterwards', async () => {
    let resolveFetch: (rows: Transaction[]) => void = () => {}
    fetchAllTransactionsForExportMock.mockReturnValue(
      new Promise<Transaction[]>((resolve) => {
        resolveFetch = resolve
      }),
    )
    const { result } = renderHook(() => useFinanceExport())

    let exportPromise: Promise<void> = Promise.resolve()
    act(() => {
      exportPromise = result.current.exportTransactions()
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    resolveFetch([])
    await act(async () => {
      await exportPromise
    })

    expect(result.current.isPending).toBe(false)
  })
})
