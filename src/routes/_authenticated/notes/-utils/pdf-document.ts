import type {
  Content,
  CustomTableLayout,
  Node,
  NodeQueries,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces'

import { formatExactTimestamp } from '#/utils/date'
import type {
  PdfExportNote,
  PdfTransformResult,
} from '#/routes/_authenticated/notes/-types/notes-pdf'

/** A4 portrait content width in pt: 595.28 - 2 × 56 margin. See spec 026. */
export const CONTENT_WIDTH = 483.28
export const PAGE_MARGIN = 56

/** CSS pixels (96dpi) → PDF points (72dpi). Tiptap `colwidth`/image sizes are px. */
export const PX_TO_PT = 0.75

const INK_COLOR = '#18181b' // zinc-900
const MUTED_COLOR = '#71717a' // zinc-500
const RULE_COLOR = '#d4d4d8' // zinc-300
const TINT_COLOR = '#f4f4f5' // zinc-100
const LINK_COLOR = '#2563eb' // blue-600

const BODY_FONT_SIZE = 10.5
const BODY_LINE_HEIGHT = 1.4

export function buildPdfStyles(fonts: {
  body: string
  mono: string
}): StyleDictionary {
  return {
    title: { fontSize: 20, bold: true, color: INK_COLOR },
    byline: { fontSize: 9, color: MUTED_COLOR, margin: [0, 4, 0, 20] },
    h1: { fontSize: 20, bold: true, color: INK_COLOR, margin: [0, 18, 0, 8] },
    h2: { fontSize: 15, bold: true, color: INK_COLOR, margin: [0, 16, 0, 6] },
    h3: { fontSize: 12.5, bold: true, color: INK_COLOR, margin: [0, 14, 0, 6] },
    paragraph: { margin: [0, 0, 0, 8] },
    muted: { color: MUTED_COLOR },
    link: { color: LINK_COLOR, decoration: 'underline' },
    inlineCode: { font: fonts.mono, fontSize: 9.5, background: TINT_COLOR },
    codeBlockText: {
      font: fonts.mono,
      fontSize: 9,
      color: INK_COLOR,
      preserveLeadingSpaces: true,
    },
    codeBlockCaption: { fontSize: 8, color: MUTED_COLOR, margin: [0, 0, 0, 2] },
    blockquoteText: { color: MUTED_COLOR, italics: false },
    calloutText: { color: INK_COLOR },
    footer: { fontSize: 9, color: MUTED_COLOR },
  }
}

export function buildPdfFooter(): TDocumentDefinitions['footer'] {
  return (currentPage: number, pageCount: number): Content => ({
    text: `${currentPage} / ${pageCount}`,
    style: 'footer',
    alignment: 'right',
    margin: [PAGE_MARGIN, 8, PAGE_MARGIN, 0],
  })
}

/**
 * Pushes a heading to the next page if it would otherwise be the last line
 * on the current one. Mirrors pdfmake's documented orphan-heading recipe —
 * `nodeQueries` reflects the fully laid-out document, so this only fires
 * when a heading truly has nothing following it on its page, and pdfmake
 * skips re-evaluating a node once it has applied a break to it, so this
 * cannot loop.
 */
export function pdfPageBreakBefore(
  currentNode: Node,
  nodeQueries: NodeQueries,
): boolean {
  return (
    currentNode.headlineLevel !== undefined &&
    nodeQueries.getFollowingNodesOnPage().length === 0
  )
}

function buildByline(note: PdfExportNote): string {
  const parts: string[] = []
  if (note.tags.length > 0) {
    parts.push(note.tags.map((tag) => `#${tag}`).join('  '))
  }
  parts.push(`Edited ${formatExactTimestamp(note.updatedAt)}`)
  return parts.join('   ·   ')
}

function buildTitleBlock(note: PdfExportNote): Content[] {
  const title = note.title.trim() || 'Untitled note'
  return [
    { text: title, style: 'title' },
    { text: buildByline(note), style: 'byline' },
  ]
}

export function buildPdfDocument(
  note: PdfExportNote,
  transform: PdfTransformResult,
  fonts: { body: string; mono: string },
): TDocumentDefinitions {
  const title = note.title.trim() || 'Untitled note'

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN],
    defaultStyle: {
      font: fonts.body,
      fontSize: BODY_FONT_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
      color: INK_COLOR,
    },
    styles: buildPdfStyles(fonts),
    footer: buildPdfFooter(),
    pageBreakBefore: pdfPageBreakBefore,
    info: { title, creator: 'Momentum', producer: 'Momentum' },
    content: [...buildTitleBlock(note), ...transform.content],
  }
}

/** Borderless table layout with a single left rule — blockquotes and callouts. */
export function ruleLayout(color: string = RULE_COLOR): CustomTableLayout {
  return {
    hLineWidth: () => 0,
    vLineWidth: (i) => (i === 0 ? 3 : 0),
    vLineColor: () => color,
    paddingLeft: () => 12,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  }
}

/** Borderless, padded table layout — code blocks and task-item boxes. */
export function boxLayout(): CustomTableLayout {
  return {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 10,
    paddingRight: () => 10,
    paddingTop: () => 8,
    paddingBottom: () => 8,
  }
}

export const PDF_COLORS = {
  ink: INK_COLOR,
  muted: MUTED_COLOR,
  rule: RULE_COLOR,
  tint: TINT_COLOR,
  link: LINK_COLOR,
}
