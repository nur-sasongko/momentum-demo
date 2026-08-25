import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FinanceExportRowCapError,
  fetchAllTransactionsForExport,
} from '../finance-export-query'

import type { TransactionRow } from '../../-types/finance-api'
import type { FinanceExportFilters } from '../../-types/finance-export'

const { fromMock, setResponses } = vi.hoisted(() => {
  let queue: Array<{ data: unknown[]; count: number | null; error: unknown }> =
    []
  let index = 0

  function nextResponse() {
    const response = queue[index] ?? queue[queue.length - 1]
    index += 1
    return response
  }

  function createBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    const chainMethods = [
      'select',
      'order',
      'range',
      'gte',
      'lte',
      'eq',
      'in',
      'or',
      'ilike',
      'is',
    ]
    for (const method of chainMethods) {
      builder[method] = () => builder
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(nextResponse()).then(resolve)
    return builder
  }

  return {
    fromMock: vi.fn(() => createBuilder()),
    setResponses: (responses: typeof queue) => {
      queue = responses
      index = 0
    },
  }
})

vi.mock('#/libs/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ from: fromMock }),
}))

vi.mock('#/stores/finance-store', () => ({
  useFinanceStore: { getState: () => ({ categories: [] }) },
}))

const NO_FILTERS: FinanceExportFilters = {
  dateFrom: null,
  dateTo: null,
  type: null,
  categoryIds: [],
  cities: [],
  countries: [],
  search: null,
}

function row(id: string): TransactionRow {
  return {
    id,
    user_id: 'user-1',
    category_id: 'cat-1',
    type: 'expense',
    amount: 10,
    date: '2026-07-01T00:00:00.000Z',
    note: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    location_place_name: null,
    location_address: null,
    location_city: null,
    location_country: null,
    location_maps_url: null,
    deleted_at: null,
  }
}

beforeEach(() => {
  fromMock.mockClear()
})

describe('fetchAllTransactionsForExport', () => {
  it('collects every row across batches and stops once a short batch arrives', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => row(`tx-${i}`))
    setResponses([
      { data: rows.slice(0, 1000), count: 2500, error: null },
      { data: rows.slice(1000, 2000), count: 2500, error: null },
      { data: rows.slice(2000, 2500), count: 2500, error: null },
    ])

    const result = await fetchAllTransactionsForExport(NO_FILTERS)

    expect(result).toHaveLength(2500)
    expect(fromMock).toHaveBeenCalledTimes(3)
  })

  it('does not loop forever when the match count is an exact multiple of the batch size', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row(`tx-${i}`))
    setResponses([
      { data: rows, count: 1000, error: null },
      { data: [], count: 1000, error: null },
    ])

    const result = await fetchAllTransactionsForExport(NO_FILTERS)

    expect(result).toHaveLength(1000)
    expect(fromMock).toHaveBeenCalledTimes(2)
  })

  it('throws before reading any row when the match count exceeds the row cap', async () => {
    setResponses([{ data: [], count: 20_001, error: null }])

    await expect(
      fetchAllTransactionsForExport(NO_FILTERS),
    ).rejects.toBeInstanceOf(FinanceExportRowCapError)
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('propagates a mid-loop error and produces no partial result', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row(`tx-${i}`))
    setResponses([
      { data: rows, count: 2000, error: null },
      { data: [], count: 2000, error: new Error('network dropped') },
    ])

    await expect(fetchAllTransactionsForExport(NO_FILTERS)).rejects.toThrow(
      'network dropped',
    )
  })
})
