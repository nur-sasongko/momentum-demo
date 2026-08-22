import type * as PdfMakeModule from 'pdfmake/build/pdfmake'

import { downloadBlob, slugify } from '#/utils/download'
import { buildPdfDocument } from '#/routes/_authenticated/notes/-utils/pdf-document'
import {
  PDF_BODY_FONT,
  PDF_FALLBACK_BODY_FONT,
  PDF_FALLBACK_FONTS,
  PDF_FALLBACK_MONO_FONT,
  PDF_MONO_FONT,
  resolveEmbeddedPdfFonts,
} from '#/routes/_authenticated/notes/-utils/pdf-fonts'
import { resolvePdfImage } from '#/routes/_authenticated/notes/-utils/pdf-images'
import {
  collectImageSources,
  tiptapToPdfContent,
} from '#/routes/_authenticated/notes/-utils/tiptap-to-pdf'
import type {
  PdfExportNote,
  PdfSkippedItem,
  ResolvedPdfImage,
} from '#/routes/_authenticated/notes/-types/notes-pdf'

export interface ExportNoteResult {
  filename: string
  skipped: PdfSkippedItem[]
  usedFallbackFonts: boolean
}

export function buildNoteFilename(title: string, updatedAt: string): string {
  const stem = slugify(title, 'untitled-note')
  const date = updatedAt.slice(0, 10)
  return `${stem}-${date}.pdf`
}

async function resolveNoteImages(
  note: PdfExportNote,
): Promise<Map<string, ResolvedPdfImage | null>> {
  const sources = collectImageSources(note.content)
  const resolved = await Promise.all(
    sources.map(async (src) => [src, await resolvePdfImage(src)] as const),
  )
  return new Map(resolved)
}

/**
 * The only module that touches the pdfmake runtime. Dynamically imported so
 * pdfmake never lands in the `/notes` route's initial JS — see spec 026.
 */
async function loadPdfMake(): Promise<typeof PdfMakeModule> {
  const mod: unknown = await import('pdfmake/build/pdfmake')
  const withDefault = mod as { default?: typeof PdfMakeModule }
  return withDefault.default ?? (mod as typeof PdfMakeModule)
}

/**
 * Builds and downloads a single note as an A4 PDF. Tries the app's embedded
 * Inter/IBM Plex Mono fonts first; on any font-load failure (offline cold
 * cache, missing asset) it rebuilds with the standard-14 fallback rather than
 * failing the export outright.
 */
export async function exportNoteToPdf(
  note: PdfExportNote,
): Promise<ExportNoteResult> {
  const images = await resolveNoteImages(note)
  const transform = tiptapToPdfContent(note.content, images)
  const pdfMake = await loadPdfMake()

  let usedFallbackFonts = false
  let blob: Blob
  try {
    pdfMake.setFonts(resolveEmbeddedPdfFonts())
    const docDefinition = buildPdfDocument(note, transform, {
      body: PDF_BODY_FONT,
      mono: PDF_MONO_FONT,
    })
    blob = await pdfMake.createPdf(docDefinition).getBlob()
  } catch {
    usedFallbackFonts = true
    pdfMake.setFonts(PDF_FALLBACK_FONTS)
    const docDefinition = buildPdfDocument(note, transform, {
      body: PDF_FALLBACK_BODY_FONT,
      mono: PDF_FALLBACK_MONO_FONT,
    })
    blob = await pdfMake.createPdf(docDefinition).getBlob()
  }

  const filename = buildNoteFilename(note.title, note.updatedAt)
  downloadBlob(blob, filename)

  return { filename, skipped: transform.skipped, usedFallbackFonts }
}
