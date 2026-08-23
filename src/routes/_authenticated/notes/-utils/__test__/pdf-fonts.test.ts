import { describe, expect, it } from 'vitest'

import {
  PDF_BODY_FONT,
  PDF_FALLBACK_BODY_FONT,
  PDF_FALLBACK_FONTS,
  PDF_FALLBACK_MONO_FONT,
  PDF_MONO_FONT,
  resolveEmbeddedPdfFonts,
} from '#/routes/_authenticated/notes/-utils/pdf-fonts'

const ORIGIN = 'https://momentum.app'

describe('resolveEmbeddedPdfFonts', () => {
  const fonts = resolveEmbeddedPdfFonts(ORIGIN)

  it('builds absolute URLs into /fonts/pdf/ for all four faces of both families', () => {
    expect(fonts[PDF_BODY_FONT]).toEqual({
      normal: `${ORIGIN}/fonts/pdf/Inter-Regular.ttf`,
      bold: `${ORIGIN}/fonts/pdf/Inter-Bold.ttf`,
      italics: `${ORIGIN}/fonts/pdf/Inter-Italic.ttf`,
      bolditalics: `${ORIGIN}/fonts/pdf/Inter-BoldItalic.ttf`,
    })
  })

  it('aliases mono italics/bolditalics onto the upright files (no mono italics shipped)', () => {
    const mono = fonts[PDF_MONO_FONT]
    expect(mono.italics).toBe(mono.normal)
    expect(mono.bolditalics).toBe(mono.bold)
    expect(mono.normal).toBe(`${ORIGIN}/fonts/pdf/IBMPlexMono-Regular.ttf`)
    expect(mono.bold).toBe(`${ORIGIN}/fonts/pdf/IBMPlexMono-Bold.ttf`)
  })

  it('references exactly six distinct files across both families', () => {
    const allUrls = [
      ...Object.values(fonts[PDF_BODY_FONT]),
      ...Object.values(fonts[PDF_MONO_FONT]),
    ]
    expect(new Set(allUrls).size).toBe(6)
  })

  it('defaults to window.location.origin when no origin is passed', () => {
    const fromWindow = resolveEmbeddedPdfFonts()
    expect(fromWindow[PDF_BODY_FONT].normal).toBe(
      `${window.location.origin}/fonts/pdf/Inter-Regular.ttf`,
    )
  })
})

describe('PDF_FALLBACK_FONTS', () => {
  it('provides standard-14 Helvetica/Courier with no file paths', () => {
    expect(PDF_FALLBACK_FONTS[PDF_FALLBACK_BODY_FONT]).toEqual({
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    })
    expect(PDF_FALLBACK_FONTS[PDF_FALLBACK_MONO_FONT]).toEqual({
      normal: 'Courier',
      bold: 'Courier-Bold',
      italics: 'Courier-Oblique',
      bolditalics: 'Courier-BoldOblique',
    })
  })
})
