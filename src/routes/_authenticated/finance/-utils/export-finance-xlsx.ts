import { format } from 'date-fns'

import { downloadBlob, slugify } from '#/utils/download'
import { buildFinanceWorkbook } from './finance-export-sheets'

import type * as WriteExcelFileModule from 'write-excel-file/browser'
import type { Cell, Row, Sheet } from 'write-excel-file/browser'
import type {
  ExportCell,
  ExportSheet,
  FinanceExportFilters,
  FinanceExportResult,
} from '../-types/finance-export'
import type { FinanceCategory, Transaction } from '#/stores/finance-store'

/**
 * The only module that touches the write-excel-file runtime. Dynamically
 * imported so it never lands in the `/finance` route's initial JS — see
 * spec 027.
 */
async function loadWriteXlsxFile(): Promise<
  typeof WriteExcelFileModule.default
> {
  const mod = await import('write-excel-file/browser')
  return mod.default
}

function toLibraryCell(cell: ExportCell): Cell {
  if (cell === null) return null
  switch (cell.type) {
    case 'string':
      return {
        type: String,
        value: cell.value,
        wrap: cell.wrap,
        fontWeight: cell.bold ? 'bold' : undefined,
      }
    case 'number':
      return { type: Number, value: cell.value, format: cell.format }
    case 'date':
      return { type: Date, value: cell.value, format: cell.format }
  }
}

function toLibrarySheet(sheet: ExportSheet): Sheet<Blob> {
  return {
    sheet: sheet.name,
    columns: sheet.columns,
    stickyRowsCount: sheet.freezeHeaderRow ? 1 : undefined,
    data: sheet.rows.map((row): Row => row.map(toLibraryCell)),
  }
}

function buildRangeSlug(filters: FinanceExportFilters): string {
  if (!filters.dateFrom && !filters.dateTo) return 'all-time'
  if (filters.dateFrom && !filters.dateTo) return `from-${filters.dateFrom}`
  if (!filters.dateFrom && filters.dateTo) return `until-${filters.dateTo}`
  return `${filters.dateFrom}-to-${filters.dateTo}`
}

export function buildFinanceExportFilename(
  filters: FinanceExportFilters,
  exportedAt: Date,
): string {
  const range = slugify(buildRangeSlug(filters))
  const exportedOn = format(exportedAt, 'yyyy-MM-dd')
  return `finance-${range}-${exportedOn}.xlsx`
}

/**
 * Builds and downloads the filtered transactions as an `.xlsx` workbook —
 * `Transactions`, `Summary`, and `Categories` sheets. `rows` must already be
 * the full filtered set (see `fetchAllTransactionsForExport`), not one page.
 */
export async function exportFinanceTransactionsToXlsx(
  rows: Transaction[],
  categories: FinanceCategory[],
  filters: FinanceExportFilters,
  exportedAt: Date,
): Promise<FinanceExportResult> {
  const { sheets, truncatedNotes } = buildFinanceWorkbook(
    rows,
    categories,
    filters,
    exportedAt,
  )
  const writeXlsxFile = await loadWriteXlsxFile()
  const blob = await writeXlsxFile(sheets.map(toLibrarySheet)).toBlob()

  const filename = buildFinanceExportFilename(filters, exportedAt)
  downloadBlob(blob, filename)

  return { filename, rowCount: rows.length, truncatedNotes }
}
