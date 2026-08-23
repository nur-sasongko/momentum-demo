import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '#/utils/download'
import {
  buildNoteFilename,
  exportNoteToPdf,
} from '#/routes/_authenticated/notes/-utils/export-note-pdf'
import {
  PDF_BODY_FONT,
  PDF_FALLBACK_BODY_FONT,
  PDF_MONO_FONT,
} from '#/routes/_authenticated/notes/-utils/pdf-fonts'

import type * as DownloadModule from '#/utils/download'
import type { PdfExportNote } from '#/routes/_authenticated/notes/-types/notes-pdf'

vi.mock('#/utils/download', async () => {
  const actual =
    await vi.importActual<typeof DownloadModule>('#/utils/download')
  return { ...actual, downloadBlob: vi.fn() }
})

const setFonts = vi.fn()
const createPdf = vi.fn()

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    setFonts: (...args: unknown[]) => setFonts(...args),
    createPdf: (...args: unknown[]) => createPdf(...args),
  },
}))

function makeNote(overrides: Partial<PdfExportNote> = {}): PdfExportNote {
  return {
    title: 'Compounding attention',
    tags: [],
    content: { type: 'doc', content: [] },
    updatedAt: '2026-08-22T09:41:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  setFonts.mockClear()
  createPdf.mockClear()
  vi.mocked(downloadBlob).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildNoteFilename', () => {
  it('slugifies the title and appends the date from updatedAt', () => {
    expect(
      buildNoteFilename('Compounding attention', '2026-08-22T09:41:00.000Z'),
    ).toBe('compounding-attention-2026-08-22.pdf')
  })

  it('falls back to "untitled-note" for a blank title', () => {
    expect(buildNoteFilename('   ', '2026-08-22T09:41:00.000Z')).toBe(
      'untitled-note-2026-08-22.pdf',
    )
  })
})

describe('exportNoteToPdf — embedded fonts succeed', () => {
  it('builds with the embedded Inter/IBM Plex Mono fonts and downloads the blob', async () => {
    createPdf.mockReturnValue({
      getBlob: () => Promise.resolve(new Blob(['pdf'])),
    })

    const result = await exportNoteToPdf(makeNote())

    expect(setFonts).toHaveBeenCalledTimes(1)
    const [fontsArg] = setFonts.mock.calls[0] as [Record<string, unknown>]
    expect(fontsArg).toHaveProperty(PDF_BODY_FONT)
    expect(fontsArg).toHaveProperty(PDF_MONO_FONT)

    expect(createPdf).toHaveBeenCalledTimes(1)
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(result.usedFallbackFonts).toBe(false)
    expect(result.filename).toBe('compounding-attention-2026-08-22.pdf')
  })
})

describe('exportNoteToPdf — embedded fonts fail', () => {
  it('rebuilds once with the standard-14 fallback fonts and still downloads a PDF', async () => {
    createPdf
      .mockReturnValueOnce({
        getBlob: () => Promise.reject(new Error('font fetch failed')),
      })
      .mockReturnValueOnce({
        getBlob: () => Promise.resolve(new Blob(['pdf'])),
      })

    const result = await exportNoteToPdf(makeNote())

    expect(createPdf).toHaveBeenCalledTimes(2)
    expect(setFonts).toHaveBeenCalledTimes(2)
    const [fallbackFontsArg] = setFonts.mock.calls[1] as [
      Record<string, unknown>,
    ]
    expect(fallbackFontsArg).toHaveProperty(PDF_FALLBACK_BODY_FONT)

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(result.usedFallbackFonts).toBe(true)
  })
})

describe('exportNoteToPdf — skipped items', () => {
  it('surfaces an unknown-node skip from the transform in the result', async () => {
    createPdf.mockReturnValue({
      getBlob: () => Promise.resolve(new Blob(['pdf'])),
    })

    const result = await exportNoteToPdf(
      makeNote({
        content: {
          type: 'doc',
          content: [{ type: 'someWeirdNode', content: [] }],
        },
      }),
    )

    expect(result.skipped).toContainEqual({
      kind: 'unknown-node',
      detail: 'someWeirdNode',
    })
  })
})
