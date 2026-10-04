import type { JSONContent } from '@tiptap/core'
import type {
  CanvasElement,
  Content,
  ContentText,
  StyleReference,
  Table,
  TableCell,
  TableCellProperties,
} from 'pdfmake/interfaces'

import {
  CONTENT_WIDTH,
  PDF_COLORS,
  PX_TO_PT,
  boxLayout,
  ruleLayout,
} from '#/routes/_authenticated/notes/-utils/pdf-document'
import type {
  PdfSkippedItem,
  PdfTransformResult,
  ResolvedPdfImage,
} from '#/routes/_authenticated/notes/-types/notes-pdf'

/** Absurdly wide tables (spreadsheet pastes) get clamped rather than crushed. */
const MAX_TABLE_COLUMNS = 20

type ImageMap = Map<string, ResolvedPdfImage | null>

function isContent(value: Content | null): value is Content {
  return value !== null
}

function clampHeadingLevel(level: unknown): 1 | 2 | 3 | 4 {
  const numeric = typeof level === 'number' ? level : 1
  if (numeric <= 1) return 1
  if (numeric === 2) return 2
  if (numeric === 3) return 3
  return 4
}

function collectPlainText(node: JSONContent): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(collectPlainText).join(' ').trim()
}

function appendStyle(
  existing: StyleReference | undefined,
  name: string,
): StyleReference {
  if (!existing) return name
  return Array.isArray(existing) ? [...existing, name] : [existing, name]
}

function appendDecoration(
  existing: ContentText['decoration'],
  value: NonNullable<ContentText['decoration']>,
): NonNullable<ContentText['decoration']> {
  const decoration = value as 'underline' | 'lineThrough' | 'overline'
  if (!existing) return decoration
  return Array.isArray(existing)
    ? [...existing, decoration]
    : [existing, decoration]
}

function applyMark(
  run: ContentText,
  mark: { type: string; attrs?: Record<string, unknown> },
): void {
  switch (mark.type) {
    case 'bold':
      run.bold = true
      break
    case 'italic':
      run.italics = true
      break
    case 'strike':
      run.decoration = appendDecoration(run.decoration, 'lineThrough')
      break
    case 'code':
      run.style = appendStyle(run.style, 'inlineCode')
      break
    case 'highlight': {
      const color = mark.attrs?.color
      run.background = typeof color === 'string' ? color : '#fef08a'
      break
    }
    case 'link': {
      const isNoteLink = mark.attrs?.class === 'note-internal-link'
      run.style = appendStyle(run.style, 'link')
      if (!isNoteLink && typeof mark.attrs?.href === 'string') {
        run.link = mark.attrs.href
      }
      break
    }
  }
}

function inlineNode(node: JSONContent, skipped: PdfSkippedItem[]): Content {
  if (node.type === 'hardBreak') return '\n'
  if (node.type !== 'text') {
    skipped.push({ kind: 'unknown-node', detail: node.type ?? 'unknown' })
    return ''
  }
  const run: ContentText = { text: node.text ?? '' }
  for (const mark of node.marks ?? []) applyMark(run, mark)
  return run
}

function inlineRuns(
  nodes: JSONContent[] | undefined,
  skipped: PdfSkippedItem[],
): Content {
  if (!nodes || nodes.length === 0) return ''
  const runs = nodes.map((node) => inlineNode(node, skipped))
  return runs.length === 1 ? runs[0] : runs
}

function transformListItem(
  node: JSONContent,
  images: ImageMap,
  skipped: PdfSkippedItem[],
): Content {
  const children = (node.content ?? [])
    .map((child) => transformBlock(child, images, skipped))
    .filter(isContent)
  if (children.length === 0) return { text: '' }
  return children.length === 1 ? children[0] : { stack: children }
}

function checkboxCanvas(checked: boolean): CanvasElement[] {
  const box: CanvasElement = {
    type: 'rect',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    r: 2,
    lineWidth: 1,
    lineColor: PDF_COLORS.rule,
    color: checked ? PDF_COLORS.ink : undefined,
  }
  if (!checked) return [box]
  const check: CanvasElement = {
    type: 'polyline',
    lineWidth: 1.3,
    lineColor: '#ffffff',
    points: [
      { x: 2, y: 5.2 },
      { x: 4.3, y: 7.6 },
      { x: 8.2, y: 2.6 },
    ],
  }
  return [box, check]
}

function transformTaskItem(
  node: JSONContent,
  images: ImageMap,
  skipped: PdfSkippedItem[],
): Content {
  const checked = node.attrs?.checked === true
  const children = (node.content ?? [])
    .map((child) => transformBlock(child, images, skipped))
    .filter(isContent)
  return {
    columns: [
      { width: 12, canvas: checkboxCanvas(checked), margin: [0, 3, 0, 0] },
      { width: '*', stack: children.length ? children : [{ text: '' }] },
    ],
    columnGap: 6,
    margin: [0, 2, 0, 2],
  }
}

function collectColumnWidthsPx(rows: JSONContent[]): (number | null)[] {
  const widths: (number | null)[] = []
  for (const row of rows) {
    let colIndex = 0
    for (const cell of row.content ?? []) {
      const colspan = Math.max(1, Number(cell.attrs?.colspan) || 1)
      const colwidth = cell.attrs?.colwidth
      for (let i = 0; i < colspan; i++) {
        if (widths[colIndex + i] == null) {
          const px = Array.isArray(colwidth) ? colwidth[i] : null
          widths[colIndex + i] = typeof px === 'number' ? px : null
        }
      }
      colIndex += colspan
    }
  }
  return widths
}

function computeColumnWidths(rows: JSONContent[]): Array<number | '*'> {
  const widthsPx = collectColumnWidthsPx(rows)
  const widthsPt = widthsPx.map((px) => (px != null ? px * PX_TO_PT : null))
  const knownSum = widthsPt.reduce((sum: number, pt) => sum + (pt ?? 0), 0)
  const scale = knownSum > CONTENT_WIDTH ? CONTENT_WIDTH / knownSum : 1
  return widthsPt.map((pt) => (pt != null ? pt * scale : '*'))
}

function transformTableCell(
  cell: JSONContent,
  images: ImageMap,
  skipped: PdfSkippedItem[],
): Content & TableCellProperties {
  const isHeader = cell.type === 'tableHeader'
  const children = (cell.content ?? [])
    .map((child) => transformBlock(child, images, skipped))
    .filter(isContent)
  const align = cell.attrs?.align
  const alignment =
    align === 'left' || align === 'center' || align === 'right'
      ? align
      : undefined

  return {
    stack: children.length ? children : [{ text: '' }],
    alignment,
    bold: isHeader || undefined,
    fillColor: isHeader ? PDF_COLORS.tint : undefined,
  }
}

function transformTable(
  node: JSONContent,
  images: ImageMap,
  skipped: PdfSkippedItem[],
): Content {
  const rows = node.content ?? []
  const headerRows = rows[0]?.content?.[0]?.type === 'tableHeader' ? 1 : 0

  const grid: TableCell[][] = []
  const rowspanCarry = new Map<number, number>()
  let totalColumns = 0

  for (const row of rows) {
    const outRow: TableCell[] = []
    let colIndex = 0
    const cells = [...(row.content ?? [])]

    while (cells.length > 0 || rowspanCarry.has(colIndex)) {
      const carried = rowspanCarry.get(colIndex)
      if (carried && carried > 0) {
        outRow[colIndex] = {}
        if (carried === 1) rowspanCarry.delete(colIndex)
        else rowspanCarry.set(colIndex, carried - 1)
        colIndex += 1
        continue
      }
      const cellNode = cells.shift()
      if (!cellNode) break

      const colspan = Math.max(1, Number(cellNode.attrs?.colspan) || 1)
      const rowspan = Math.max(1, Number(cellNode.attrs?.rowspan) || 1)
      const built = transformTableCell(cellNode, images, skipped)
      if (colspan > 1) built.colSpan = colspan
      if (rowspan > 1) built.rowSpan = rowspan

      outRow[colIndex] = built
      for (let i = 1; i < colspan; i++) outRow[colIndex + i] = {}
      if (rowspan > 1) {
        for (let i = 0; i < colspan; i++) {
          rowspanCarry.set(colIndex + i, rowspan - 1)
        }
      }
      colIndex += colspan
    }

    totalColumns = Math.max(totalColumns, outRow.length)
    grid.push(outRow)
  }

  const columns = Math.min(totalColumns, MAX_TABLE_COLUMNS)
  if (totalColumns > MAX_TABLE_COLUMNS) {
    skipped.push({
      kind: 'unknown-node',
      detail: `table clamped from ${totalColumns} to ${MAX_TABLE_COLUMNS} columns`,
    })
  }

  const body = grid.map((row) => {
    const trimmed = row.slice(0, columns)
    while (trimmed.length < columns) trimmed.push({})
    return trimmed
  })

  const widths = computeColumnWidths(rows).slice(0, columns)
  while (widths.length < columns) widths.push('*')

  const table: Table = { body, widths, headerRows }
  return { table, margin: [0, 4, 0, 12] }
}

function transformBlock(
  node: JSONContent,
  images: ImageMap,
  skipped: PdfSkippedItem[],
): Content | null {
  switch (node.type) {
    case 'paragraph':
      return { text: inlineRuns(node.content, skipped), style: 'paragraph' }

    case 'heading': {
      const level = clampHeadingLevel(node.attrs?.level)
      return {
        text: inlineRuns(node.content, skipped),
        style: `h${level}`,
        headlineLevel: level,
      }
    }

    case 'bulletList':
      return {
        ul: (node.content ?? []).map((item) =>
          transformListItem(item, images, skipped),
        ),
      }

    case 'orderedList':
      return {
        ol: (node.content ?? []).map((item) =>
          transformListItem(item, images, skipped),
        ),
      }

    case 'taskList':
      return {
        stack: (node.content ?? []).map((item) =>
          transformTaskItem(item, images, skipped),
        ),
      }

    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((child) => transformBlock(child, images, skipped))
        .filter(isContent)
      return {
        table: {
          widths: ['*'],
          body: [[{ stack: inner, style: 'blockquoteText' }]],
        },
        layout: ruleLayout(),
        margin: [0, 8, 0, 8],
      }
    }

    case 'callout': {
      const inner = (node.content ?? [])
        .map((child) => transformBlock(child, images, skipped))
        .filter(isContent)
      return {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: inner,
                style: 'calloutText',
                fillColor: PDF_COLORS.tint,
              },
            ],
          ],
        },
        layout: ruleLayout(),
        margin: [0, 8, 0, 8],
      }
    }

    case 'horizontalRule':
      return {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 4,
            x2: CONTENT_WIDTH,
            y2: 4,
            lineWidth: 1,
            lineColor: PDF_COLORS.rule,
          },
        ],
        margin: [0, 12, 0, 12],
      }

    case 'codeBlock': {
      const language =
        typeof node.attrs?.language === 'string' ? node.attrs.language : null
      const code = collectPlainText(node)
      const caption: Content[] = language
        ? [{ text: language, style: 'codeBlockCaption' }]
        : []
      return {
        stack: [
          ...caption,
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    text: code || ' ',
                    style: 'codeBlockText',
                    fillColor: PDF_COLORS.tint,
                  },
                ],
              ],
            },
            layout: boxLayout(),
          },
        ],
        margin: [0, 4, 0, 12],
      }
    }

    case 'table':
      return transformTable(node, images, skipped)

    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      const alt =
        (typeof node.attrs?.alt === 'string' && node.attrs.alt) ||
        (typeof node.attrs?.title === 'string' && node.attrs.title) ||
        ''
      const resolved = images.get(src)
      if (resolved) {
        return {
          image: resolved.dataUrl,
          width: resolved.width,
          height: resolved.height,
          margin: [0, 8, 0, 8],
        }
      }
      skipped.push({ kind: 'image', detail: alt || src || 'untitled image' })
      return {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: alt || 'Image unavailable',
                style: 'muted',
                alignment: 'center',
              },
            ],
          ],
        },
        layout: ruleLayout(),
        margin: [0, 8, 0, 8],
      }
    }

    default: {
      skipped.push({ kind: 'unknown-node', detail: node.type ?? 'unknown' })
      if (node.content && node.content.length > 0) {
        const inner = node.content
          .map((child) => transformBlock(child, images, skipped))
          .filter(isContent)
        return inner.length > 0 ? { stack: inner } : null
      }
      const text = collectPlainText(node)
      return text ? { text } : null
    }
  }
}

/** Every unique `image` node `src` in the document, for a pre-export resolve pass. */
export function collectImageSources(doc: JSONContent): string[] {
  const sources = new Set<string>()
  function visit(node: JSONContent) {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      sources.add(node.attrs.src)
    }
    node.content?.forEach(visit)
  }
  visit(doc)
  return [...sources]
}

/**
 * Walks a note's ProseMirror JSON and returns pdfmake content — no DOM, no
 * editor instance, no pdfmake import. `images` must already hold a resolved
 * (or `null`, meaning failed) entry for every source `collectImageSources`
 * returned; resolving them is the caller's job.
 */
export function tiptapToPdfContent(
  doc: JSONContent,
  images: ImageMap,
): PdfTransformResult {
  const skipped: PdfSkippedItem[] = []
  const content = (doc.content ?? [])
    .map((node) => transformBlock(node, images, skipped))
    .filter(isContent)
  return { content, skipped }
}
