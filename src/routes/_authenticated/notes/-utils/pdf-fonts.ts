import type { TFontDictionary } from 'pdfmake/interfaces'

export const PDF_BODY_FONT = 'Inter'
export const PDF_MONO_FONT = 'IBMPlexMono'

const FONT_FILES: Record<string, string> = {
  'Inter-normal': 'Inter-Regular.ttf',
  'Inter-bold': 'Inter-Bold.ttf',
  'Inter-italics': 'Inter-Italic.ttf',
  'Inter-bolditalics': 'Inter-BoldItalic.ttf',
  // No mono italics are shipped — italic code renders upright.
  'IBMPlexMono-normal': 'IBMPlexMono-Regular.ttf',
  'IBMPlexMono-bold': 'IBMPlexMono-Bold.ttf',
  'IBMPlexMono-italics': 'IBMPlexMono-Regular.ttf',
  'IBMPlexMono-bolditalics': 'IBMPlexMono-Bold.ttf',
}

/**
 * Absolute URLs into `public/fonts/pdf/`. pdfmake's own `URLResolver` only
 * resolves `http(s)://` values (root-relative paths are left untouched), so
 * these must be absolute — see spec 026's "Fonts" section.
 */
export function resolveEmbeddedPdfFonts(
  origin: string = window.location.origin,
): TFontDictionary {
  const url = (key: string) => `${origin}/fonts/pdf/${FONT_FILES[key]}`
  return {
    [PDF_BODY_FONT]: {
      normal: url('Inter-normal'),
      bold: url('Inter-bold'),
      italics: url('Inter-italics'),
      bolditalics: url('Inter-bolditalics'),
    },
    [PDF_MONO_FONT]: {
      normal: url('IBMPlexMono-normal'),
      bold: url('IBMPlexMono-bold'),
      italics: url('IBMPlexMono-italics'),
      bolditalics: url('IBMPlexMono-bolditalics'),
    },
  }
}

export const PDF_FALLBACK_BODY_FONT = 'Helvetica'
export const PDF_FALLBACK_MONO_FONT = 'Courier'

/** PDF standard-14 fonts — no file, no network, always available. */
export const PDF_FALLBACK_FONTS: TFontDictionary = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique',
  },
}
