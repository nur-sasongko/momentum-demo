import type { TransactionQueryParams } from './finance-query'

/**
 * The filter set an export was taken under — drives both the batched fetch
 * and the `Summary` sheet. Same shape as `TransactionQueryParams` minus
 * pagination: the export fetch reuses the table's filter predicates
 * (`applyTransactionFilters` in `finance-queries.ts`) but has no page bound.
 */
export type FinanceExportFilters = Omit<
  TransactionQueryParams,
  'page' | 'pageSize'
>

/**
 * One sheet, library-agnostic: `finance-export-sheets.ts` emits these,
 * `export-finance-xlsx.ts` is the only module that translates them into the
 * writer library's own shape.
 */
export interface ExportSheet {
  name: string
  columns: Array<{ width?: number }>
  rows: ExportCell[][]
  /** Keeps the header row visible while scrolling — only sheets with a real header row set this. */
  freezeHeaderRow?: boolean
}

export type ExportCell =
  | { type: 'string'; value: string; wrap?: boolean; bold?: boolean }
  | { type: 'number'; value: number; format?: string }
  | { type: 'date'; value: Date; format?: string }
  | null // empty cell

export interface FinanceExportResult {
  filename: string
  rowCount: number
  /** Notes clipped at Excel's 32,767-character cell limit. */
  truncatedNotes: number
}
