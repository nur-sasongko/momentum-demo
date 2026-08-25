import { describe, expect, it } from 'vitest'

import { buildFinanceWorkbook } from '../finance-export-sheets'

import type { FinanceCategory, Transaction } from '#/stores/finance-store'
import type {
  ExportCell,
  FinanceExportFilters,
} from '../../-types/finance-export'

const EXPORTED_AT = new Date('2026-08-24T14:32:00.000Z')

const categories: FinanceCategory[] = [
  {
    id: 'cat-groceries',
    name: 'Groceries',
    type: 'expense',
    color: '#f59e0b',
    isSystem: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-salary',
    name: 'Salary',
    type: 'income',
    color: '#22c55e',
    isSystem: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const NO_FILTERS: FinanceExportFilters = {
  dateFrom: null,
  dateTo: null,
  type: null,
  categoryIds: [],
  cities: [],
  countries: [],
  search: null,
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 100,
    date: '2026-07-01T10:00:00.000Z',
    note: '',
    categoryId: 'cat-groceries',
    location: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }
}

function sheetNamed(
  sheets: ReturnType<typeof buildFinanceWorkbook>['sheets'],
  name: string,
) {
  const sheet = sheets.find((s) => s.name === name)
  if (!sheet) throw new Error(`No sheet named ${name}`)
  return sheet
}

describe('buildFinanceWorkbook', () => {
  it('produces exactly Transactions, Summary, Categories in that order', () => {
    const { sheets } = buildFinanceWorkbook(
      [],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    expect(sheets.map((s) => s.name)).toEqual([
      'Transactions',
      'Summary',
      'Categories',
    ])
  })

  it('emits a negative signed Amount for expenses and positive for income, with a matching Type column', () => {
    const rows = [
      tx({ type: 'expense', amount: 50, categoryId: 'cat-groceries' }),
      tx({ type: 'income', amount: 200, categoryId: 'cat-salary' }),
    ]
    const { sheets } = buildFinanceWorkbook(
      rows,
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, expenseRow, incomeRow] = sheetNamed(sheets, 'Transactions').rows

    expect(expenseRow[1]).toEqual({ type: 'string', value: 'Expense' })
    expect(expenseRow[3]).toMatchObject({ type: 'number', value: -50 })
    expect(incomeRow[1]).toEqual({ type: 'string', value: 'Income' })
    expect(incomeRow[3]).toMatchObject({ type: 'number', value: 200 })
  })

  it('never emits pre-formatted strings for Amount or Date — real number/date cell types', () => {
    const { sheets } = buildFinanceWorkbook(
      [tx()],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, row] = sheetNamed(sheets, 'Transactions').rows
    const dateCell = row[0] as Extract<ExportCell, { type: 'date' }>
    const amountCell = row[3] as Extract<ExportCell, { type: 'number' }>

    expect(dateCell.type).toBe('date')
    expect(dateCell.value).toBeInstanceOf(Date)
    expect(amountCell.type).toBe('number')
    expect(typeof amountCell.value).toBe('number')
  })

  it('computes income, expense, and net totals whose net equals the sum of signed amounts', () => {
    const rows = [
      tx({ type: 'income', amount: 12400, categoryId: 'cat-salary' }),
      tx({ type: 'expense', amount: 8215.5, categoryId: 'cat-groceries' }),
    ]
    const { sheets } = buildFinanceWorkbook(
      rows,
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const summaryRows = sheetNamed(sheets, 'Summary').rows

    const incomeRow = summaryRows.find(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Income',
    )!
    const expenseRow = summaryRows.find(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Expense',
    )!
    const netRow = summaryRows.find(
      (r) => (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Net',
    )!

    expect(
      (incomeRow[1] as Extract<ExportCell, { type: 'number' }>).value,
    ).toBe(12400)
    expect(
      (expenseRow[1] as Extract<ExportCell, { type: 'number' }>).value,
    ).toBe(-8215.5)
    expect(
      (netRow[1] as Extract<ExportCell, { type: 'number' }>).value,
    ).toBeCloseTo(4184.5)
  })

  it('breaks down per category with counts, signed totals, and a 100% share when it is the only category of its type', () => {
    const rows = [
      tx({ type: 'expense', amount: 40, categoryId: 'cat-groceries' }),
      tx({ type: 'expense', amount: 60, categoryId: 'cat-groceries' }),
    ]
    const { sheets } = buildFinanceWorkbook(
      rows,
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const summaryRows = sheetNamed(sheets, 'Summary').rows
    const breakdownRow = summaryRows.find(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Groceries',
    )!

    expect(
      (breakdownRow[2] as Extract<ExportCell, { type: 'number' }>).value,
    ).toBe(2)
    expect(
      (breakdownRow[3] as Extract<ExportCell, { type: 'number' }>).value,
    ).toBe(-100)
    const percentCell = breakdownRow[4] as Extract<
      ExportCell,
      { type: 'number' }
    >
    expect(percentCell.value).toBeCloseTo(1)
  })

  it('never produces NaN when there are no transactions at all', () => {
    const { sheets } = buildFinanceWorkbook(
      [],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const summaryRows = sheetNamed(sheets, 'Summary').rows
    const netRow = summaryRows.find(
      (r) => (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Net',
    )!
    expect((netRow[1] as Extract<ExportCell, { type: 'number' }>).value).toBe(0)
    // No rows means no category groups at all — the breakdown table has only its header.
    const headerIndex = summaryRows.findIndex(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Category',
    )
    expect(summaryRows).toHaveLength(headerIndex + 1)
  })

  it('renders unset filters as "All", not blank', () => {
    const { sheets } = buildFinanceWorkbook(
      [],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const summaryRows = sheetNamed(sheets, 'Summary').rows

    const typeRow = summaryRows.find(
      (r) => (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Type',
    )!
    const categoriesRow = summaryRows.find(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value ===
        'Categories',
    )!
    const citiesRow = summaryRows.find(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Cities',
    )!
    const searchRow = summaryRows.find(
      (r) =>
        (r[0] as Extract<ExportCell, { type: 'string' }>).value === 'Search',
    )!

    expect((typeRow[1] as Extract<ExportCell, { type: 'string' }>).value).toBe(
      'All',
    )
    expect(
      (categoriesRow[1] as Extract<ExportCell, { type: 'string' }>).value,
    ).toBe('All')
    expect(
      (citiesRow[1] as Extract<ExportCell, { type: 'string' }>).value,
    ).toBe('All')
    expect(
      (searchRow[1] as Extract<ExportCell, { type: 'string' }>).value,
    ).toBe('All')
  })

  it('clips a note over the Excel cell limit to exactly 32,767 characters and counts it as truncated', () => {
    const longNote = 'x'.repeat(40_000)
    const { sheets, truncatedNotes } = buildFinanceWorkbook(
      [tx({ note: longNote })],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, row] = sheetNamed(sheets, 'Transactions').rows
    const noteCell = row[4] as Extract<ExportCell, { type: 'string' }>

    expect(noteCell.value.length).toBe(32767)
    expect(noteCell.value.endsWith('…')).toBe(true)
    expect(truncatedNotes).toBe(1)
  })

  it('keeps a multi-line note verbatim and wraps it', () => {
    const note = 'Line one\nLine two\nLine three'
    const { sheets } = buildFinanceWorkbook(
      [tx({ note })],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, row] = sheetNamed(sheets, 'Transactions').rows
    const noteCell = row[4] as Extract<ExportCell, { type: 'string' }>

    expect(noteCell.value).toBe(note)
    expect(noteCell.wrap).toBe(true)
  })

  it('renders "Uncategorized" for a row whose category no longer exists', () => {
    const { sheets } = buildFinanceWorkbook(
      [tx({ categoryId: 'cat-deleted' })],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, row] = sheetNamed(sheets, 'Transactions').rows
    expect(row[2]).toEqual({ type: 'string', value: 'Uncategorized' })
  })

  it('leaves the four location cells blank when a transaction has no location', () => {
    const { sheets } = buildFinanceWorkbook(
      [tx({ location: null })],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, row] = sheetNamed(sheets, 'Transactions').rows
    expect(row.slice(5, 9)).toEqual([null, null, null, null])
  })

  it('lists every category, not only those appearing in the filtered rows', () => {
    const { sheets } = buildFinanceWorkbook(
      [],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    const [, ...rows] = sheetNamed(sheets, 'Categories').rows
    expect(rows).toHaveLength(categories.length)
    expect(
      rows.map((r) => (r[0] as Extract<ExportCell, { type: 'string' }>).value),
    ).toEqual(['Groceries', 'Salary'])
  })

  it('freezes the header row for Transactions and Categories but not Summary', () => {
    const { sheets } = buildFinanceWorkbook(
      [],
      categories,
      NO_FILTERS,
      EXPORTED_AT,
    )
    expect(sheetNamed(sheets, 'Transactions').freezeHeaderRow).toBe(true)
    expect(sheetNamed(sheets, 'Categories').freezeHeaderRow).toBe(true)
    expect(sheetNamed(sheets, 'Summary').freezeHeaderRow).toBeUndefined()
  })
})
