import type { JSONContent } from '@tiptap/core'
import type { Content } from 'pdfmake/interfaces'

/** A note as the PDF export pipeline sees it — always a saved snapshot. */
export interface PdfExportNote {
  title: string
  tags: string[]
  content: JSONContent
  updatedAt: string
}

export interface PdfSkippedItem {
  kind: 'unknown-node' | 'image'
  detail: string
}

export interface PdfTransformResult {
  content: Content[]
  skipped: PdfSkippedItem[]
}

/** An image resolved to embeddable bytes, already scaled to fit the page. */
export interface ResolvedPdfImage {
  dataUrl: string
  width: number
  height: number
}
