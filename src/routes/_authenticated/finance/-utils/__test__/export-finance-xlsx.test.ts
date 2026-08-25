import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '#/utils/download'
import {
  buildFinanceExportFilename,
  exportFinanceTransactionsToXlsx,
} from '../export-finance-xlsx'

import type * as DownloadModule from '#/utils/download'
import type { FinanceCategory, Transaction } from '#/stores/finance-store'
import type { FinanceExportFilters } from '../../-types/finance-export'

vi.mock('#/utils/download', async () => {
  const actual =
    await vi.importActual<typeof DownloadModule>('#/utils/download')
  return { ...actual, downloadBlob: vi.fn() }
})

const toBlob = vi.fn(async () => new Blob(['workbook']))
const writeXlsxFileMock = vi.fn((_sheets: Array<{ sheet: string }>) => ({
  toBlob,
}))

vi.mock('write-excel-file/browser', () => ({
  default: (sheets: Array<{ sheet: string }>) => writeXlsxFileMock(sheets),
}))

// A local-noon Date, not a UTC-midnight one: `format(date, 'yyyy-MM-dd')`
// converts to local time, and a UTC-midnight instant can format as the
// previous local day depending on the test runner's timezone.
const EXPORTED_AT = new Date(2026, 7, 24, 12, 0, 0)

const NO_FILTERS: FinanceExportFilters = {
  dateFrom: null,
  dateTo: null,
  type: null,
  categoryIds: [],
  cities: [],
  countries: [],
  search: null,
}

const categories: FinanceCategory[] = []

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

beforeEach(() => {
  writeXlsxFileMock.mockClear()
  toBlob.mockClear()
  vi.mocked(downloadBlob).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildFinanceExportFilename', () => {
  it('includes both bounds when a full date range is set', () => {
    expect(
      buildFinanceExportFilename(
        { ...NO_FILTERS, dateFrom: '2026-01-01', dateTo: '2026-06-30' },
        EXPORTED_AT,
      ),
    ).toBe('finance-2026-01-01-to-2026-06-30-2026-08-24.xlsx')
  })

  it('falls back to "all-time" when no range is set', () => {
    expect(buildFinanceExportFilename(NO_FILTERS, EXPORTED_AT)).toBe(
      'finance-all-time-2026-08-24.xlsx',
    )
  })

  it('labels an open-ended range from a start date only', () => {
    expect(
      buildFinanceExportFilename(
        { ...NO_FILTERS, dateFrom: '2026-01-01' },
        EXPORTED_AT,
      ),
    ).toBe('finance-from-2026-01-01-2026-08-24.xlsx')
  })
})

describe('exportFinanceTransactionsToXlsx', () => {
  it('writes three sheets in order, downloads the blob, and reports the row count', async () => {
    const result = await exportFinanceTransactionsToXlsx(
      [tx()],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )

    expect(writeXlsxFileMock).toHaveBeenCalledTimes(1)
    const [sheets] = writeXlsxFileMock.mock.calls[0]
    expect(sheets.map((s) => s.sheet)).toEqual([
      'Transactions',
      'Summary',
      'Categories',
    ])

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      filename: 'finance-all-time-2026-08-24.xlsx',
      rowCount: 1,
      truncatedNotes: 0,
    })
  })
})
