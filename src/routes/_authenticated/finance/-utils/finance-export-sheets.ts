import type {
  FinanceCategory,
  Transaction,
  TransactionType,
} from '#/stores/finance-store'
import type {
  ExportCell,
  ExportSheet,
  FinanceExportFilters,
} from '../-types/finance-export'

const CURRENCY_FORMAT = '#,##0.00'
const DATE_TIME_FORMAT = 'yyyy-mm-dd hh:mm'
const DATE_ONLY_FORMAT = 'yyyy-mm-dd'
const PERCENT_FORMAT = '0.0%'
const INTEGER_FORMAT = '0'

/** Excel's hard per-cell character limit. */
const MAX_CELL_LENGTH = 32767

const TRANSACTIONS_HEADERS = [
  'Date',
  'Type',
  'Category',
  'Amount',
  'Note',
  'Place',
  'City',
  'Country',
  'Maps URL',
]
const TRANSACTIONS_COLUMN_WIDTHS = [18, 10, 20, 14, 44, 24, 18, 18, 30]

const CATEGORIES_HEADERS = ['Name', 'Type', 'Colour', 'System', 'Created']
const CATEGORIES_COLUMN_WIDTHS = [24, 10, 10, 8, 14]

export interface FinanceWorkbook {
  sheets: ExportSheet[]
  /** Count of notes clipped to `MAX_CELL_LENGTH` — surfaced in the success toast. */
  truncatedNotes: number
}

function strCell(
  value: string,
  opts: { wrap?: boolean; bold?: boolean } = {},
): ExportCell {
  return { type: 'string', value, ...opts }
}

function numCell(value: number, cellFormat?: string): ExportCell {
  return { type: 'number', value, format: cellFormat }
}

function dateCell(value: Date, cellFormat?: string): ExportCell {
  return { type: 'date', value, format: cellFormat }
}

function headerRow(labels: string[]): ExportCell[] {
  return labels.map((label) => strCell(label, { bold: true }))
}

function typeLabel(type: TransactionType): string {
  return type === 'income' ? 'Income' : 'Expense'
}

function resolveCategoryName(
  categories: FinanceCategory[],
  categoryId: string,
): string {
  return categories.find((c) => c.id === categoryId)?.name ?? 'Uncategorized'
}

/** Truncates to exactly `MAX_CELL_LENGTH` chars (last char is `…`) when over the limit. */
function truncateNote(note: string): { value: string; truncated: boolean } {
  if (note.length <= MAX_CELL_LENGTH) return { value: note, truncated: false }
  return { value: `${note.slice(0, MAX_CELL_LENGTH - 1)}…`, truncated: true }
}

function buildTransactionRow(
  tx: Transaction,
  categories: FinanceCategory[],
): { row: ExportCell[]; truncated: boolean } {
  const signedAmount = tx.type === 'expense' ? -tx.amount : tx.amount
  const { value: note, truncated } = truncateNote(tx.note)
  const location = tx.location

  return {
    row: [
      dateCell(new Date(tx.date), DATE_TIME_FORMAT),
      strCell(typeLabel(tx.type)),
      strCell(resolveCategoryName(categories, tx.categoryId)),
      numCell(signedAmount, CURRENCY_FORMAT),
      note ? strCell(note, { wrap: true }) : null,
      location?.placeName ? strCell(location.placeName) : null,
      location?.city ? strCell(location.city) : null,
      location?.country ? strCell(location.country) : null,
      location?.mapsUrl ? strCell(location.mapsUrl) : null,
    ],
    truncated,
  }
}

function buildTransactionsSheet(
  rows: Transaction[],
  categories: FinanceCategory[],
): { sheet: ExportSheet; truncatedNotes: number } {
  let truncatedNotes = 0
  const dataRows = rows.map((tx) => {
    const { row, truncated } = buildTransactionRow(tx, categories)
    if (truncated) truncatedNotes += 1
    return row
  })

  return {
    sheet: {
      name: 'Transactions',
      columns: TRANSACTIONS_COLUMN_WIDTHS.map((width) => ({ width })),
      rows: [headerRow(TRANSACTIONS_HEADERS), ...dataRows],
      freezeHeaderRow: true,
    },
    truncatedNotes,
  }
}

function formatDateRangeSummary(filters: FinanceExportFilters): string {
  if (!filters.dateFrom && !filters.dateTo) return 'All time'
  if (filters.dateFrom && !filters.dateTo) return `From ${filters.dateFrom}`
  if (!filters.dateFrom && filters.dateTo) return `Until ${filters.dateTo}`
  return `${filters.dateFrom} → ${filters.dateTo}`
}

function formatCategoriesSummary(
  filters: FinanceExportFilters,
  categories: FinanceCategory[],
): string {
  if (filters.categoryIds.length === 0) return 'All'
  return filters.categoryIds
    .map((id) => resolveCategoryName(categories, id))
    .join(', ')
}

function formatCitiesSummary(filters: FinanceExportFilters): string {
  if (filters.cities.length === 0) return 'All'
  return filters.cities
    .map((city) => (city === '' ? '(no location)' : city))
    .join(', ')
}

interface Totals {
  income: number
  expense: number
  net: number
}

function computeTotals(rows: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const tx of rows) {
    if (tx.type === 'income') income += tx.amount
    else expense += tx.amount
  }
  return { income, expense, net: income - expense }
}

interface CategoryBreakdownRow {
  categoryName: string
  type: TransactionType
  count: number
  /** Signed — expense negative, matching the `Transactions` sheet's `Amount` column. */
  total: number
  /** 0–100. `0` (never `NaN`) when the type's total is `0`. */
  percentOfType: number
}

function computeCategoryBreakdown(
  rows: Transaction[],
  categories: FinanceCategory[],
  totals: Totals,
): CategoryBreakdownRow[] {
  const groups = new Map<
    string,
    { categoryId: string; type: TransactionType; count: number; amount: number }
  >()

  for (const tx of rows) {
    const key = `${tx.categoryId}:${tx.type}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      existing.amount += tx.amount
    } else {
      groups.set(key, {
        categoryId: tx.categoryId,
        type: tx.type,
        count: 1,
        amount: tx.amount,
      })
    }
  }

  return [...groups.values()]
    .map((group) => {
      const typeTotal = group.type === 'income' ? totals.income : totals.expense
      const percentOfType = typeTotal > 0 ? (group.amount / typeTotal) * 100 : 0
      return {
        categoryName: resolveCategoryName(categories, group.categoryId),
        type: group.type,
        count: group.count,
        total: group.type === 'expense' ? -group.amount : group.amount,
        percentOfType,
      }
    })
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
}

function buildSummarySheet(
  rows: Transaction[],
  categories: FinanceCategory[],
  filters: FinanceExportFilters,
  exportedAt: Date,
): ExportSheet {
  const totals = computeTotals(rows)
  const breakdown = computeCategoryBreakdown(rows, categories, totals)

  const rowsOut: ExportCell[][] = [
    [strCell('Momentum — Finance Export', { bold: true })],
    [strCell('Exported at'), dateCell(exportedAt, DATE_TIME_FORMAT)],
    [strCell('Date range'), strCell(formatDateRangeSummary(filters))],
    [strCell('Type'), strCell(filters.type ? typeLabel(filters.type) : 'All')],
    [
      strCell('Categories'),
      strCell(formatCategoriesSummary(filters, categories)),
    ],
    [strCell('Cities'), strCell(formatCitiesSummary(filters))],
    [strCell('Search'), strCell(filters.search || 'All')],
    [strCell('Transactions'), numCell(rows.length, INTEGER_FORMAT)],
    [null],
    [strCell('Income'), numCell(totals.income, CURRENCY_FORMAT)],
    [strCell('Expense'), numCell(-totals.expense, CURRENCY_FORMAT)],
    [strCell('Net'), numCell(totals.net, CURRENCY_FORMAT)],
    [null],
    headerRow(['Category', 'Type', 'Count', 'Total', '% of type']),
    ...breakdown.map((b) => [
      strCell(b.categoryName),
      strCell(typeLabel(b.type)),
      numCell(b.count, INTEGER_FORMAT),
      numCell(b.total, CURRENCY_FORMAT),
      numCell(b.percentOfType / 100, PERCENT_FORMAT),
    ]),
  ]

  return {
    name: 'Summary',
    columns: [
      { width: 20 },
      { width: 18 },
      { width: 10 },
      { width: 14 },
      { width: 12 },
    ],
    rows: rowsOut,
  }
}

function buildCategoriesSheet(categories: FinanceCategory[]): ExportSheet {
  return {
    name: 'Categories',
    columns: CATEGORIES_COLUMN_WIDTHS.map((width) => ({ width })),
    rows: [
      headerRow(CATEGORIES_HEADERS),
      ...categories.map((c) => [
        strCell(c.name),
        strCell(typeLabel(c.type)),
        strCell(c.color),
        strCell(c.isSystem ? 'Yes' : 'No'),
        dateCell(new Date(c.createdAt), DATE_ONLY_FORMAT),
      ]),
    ],
    freezeHeaderRow: true,
  }
}

/**
 * Pure rows → sheets transform. No DOM, no network, no writer-library
 * import — `export-finance-xlsx.ts` is the only module that knows how to
 * turn an `ExportSheet` into an actual `.xlsx` file.
 */
export function buildFinanceWorkbook(
  rows: Transaction[],
  categories: FinanceCategory[],
  filters: FinanceExportFilters,
  exportedAt: Date,
): FinanceWorkbook {
  const { sheet: transactionsSheet, truncatedNotes } = buildTransactionsSheet(
    rows,
    categories,
  )
  const summarySheet = buildSummarySheet(rows, categories, filters, exportedAt)
  const categoriesSheet = buildCategoriesSheet(categories)

  return {
    sheets: [transactionsSheet, summarySheet, categoriesSheet],
    truncatedNotes,
  }
}
