import { describe, expect, it } from 'vitest'

import {
  collectImageSources,
  tiptapToPdfContent,
} from '#/routes/_authenticated/notes/-utils/tiptap-to-pdf'

import type { JSONContent } from '@tiptap/core'
import type { ContentText, Table } from 'pdfmake/interfaces'
import type { ResolvedPdfImage } from '#/routes/_authenticated/notes/-types/notes-pdf'

function doc(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content }
}

function text(value: string, marks?: JSONContent['marks']): JSONContent {
  return marks
    ? { type: 'text', text: value, marks }
    : { type: 'text', text: value }
}

const noImages = new Map<string, ResolvedPdfImage | null>()

describe('tiptapToPdfContent — headings', () => {
  it.each([
    [1, 'h1'],
    [2, 'h2'],
    [3, 'h3'],
    [4, 'h3'],
    [5, 'h3'],
    [6, 'h3'],
  ])('maps heading level %i to style %s', (level, style) => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'heading',
        attrs: { level },
        content: [text('Title')],
      }),
      noImages,
    )
    expect(content).toHaveLength(1)
    expect(content[0]).toMatchObject({
      style,
      headlineLevel: level <= 1 ? 1 : level === 2 ? 2 : 3,
    })
  })
})

describe('tiptapToPdfContent — paragraph marks', () => {
  it('produces a run array reflecting bold, italic, strike, code, and highlight', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'paragraph',
        content: [
          text('bold', [{ type: 'bold' }]),
          text('italic', [{ type: 'italic' }]),
          text('strike', [{ type: 'strike' }]),
          text('code', [{ type: 'code' }]),
          text('hl', [{ type: 'highlight', attrs: { color: '#ff0000' } }]),
        ],
      }),
      noImages,
    )
    const node = content[0] as { text: ContentText[] }
    const [bold, italic, strike, code, highlight] = node.text

    expect(bold).toMatchObject({ text: 'bold', bold: true })
    expect(italic).toMatchObject({ text: 'italic', italics: true })
    expect(strike).toMatchObject({ text: 'strike', decoration: 'lineThrough' })
    expect(code).toMatchObject({ text: 'code', style: 'inlineCode' })
    expect(highlight).toMatchObject({ text: 'hl', background: '#ff0000' })
  })

  it('falls back to a default highlight color when no color attr is present', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'paragraph',
        content: [text('hl', [{ type: 'highlight' }])],
      }),
      noImages,
    )
    const node = content[0] as { text: ContentText }
    expect(node.text).toMatchObject({ background: '#fef08a' })
  })

  it('a single inline node produces a bare run, not a one-element array', () => {
    const { content } = tiptapToPdfContent(
      doc({ type: 'paragraph', content: [text('solo')] }),
      noImages,
    )
    const node = content[0] as { text: ContentText }
    expect(Array.isArray(node.text)).toBe(false)
    expect(node.text).toMatchObject({ text: 'solo' })
  })

  it('renders a hardBreak as a newline inside the run', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'paragraph',
        content: [text('line1'), { type: 'hardBreak' }, text('line2')],
      }),
      noImages,
    )
    const node = content[0] as { text: ContentText[] }
    expect(node.text[1]).toBe('\n')
  })
})

describe('tiptapToPdfContent — links', () => {
  it('maps an external link mark to a clickable link', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'paragraph',
        content: [
          text('anthropic', [
            { type: 'link', attrs: { href: 'https://anthropic.com' } },
          ]),
        ],
      }),
      noImages,
    )
    const node = content[0] as { text: ContentText }
    expect(node.text.link).toBe('https://anthropic.com')
    expect(node.text.style).toBe('link')
  })

  it('a `[[` note link renders styled text with no link or linkToDestination key', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'paragraph',
        content: [
          text('My Note', [
            {
              type: 'link',
              attrs: {
                href: '#',
                class: 'note-internal-link',
              },
            },
          ]),
        ],
      }),
      noImages,
    )
    const node = content[0] as { text: ContentText }
    expect(node.text.style).toBe('link')
    expect(node.text).not.toHaveProperty('link')
    expect(node.text).not.toHaveProperty('linkToDestination')
  })
})

describe('tiptapToPdfContent — lists', () => {
  it('nests a bulletList inside a bulletList', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [text('outer')] },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [text('inner')] }],
                  },
                ],
              },
            ],
          },
        ],
      }),
      noImages,
    )
    const list = content[0] as { ul: unknown[] }
    expect(list.ul).toHaveLength(1)
    const outerItem = list.ul[0] as { stack: Array<{ ul?: unknown[] }> }
    expect(outerItem.stack).toHaveLength(2)
    expect(outerItem.stack[1].ul).toHaveLength(1)
  })

  it('nests an orderedList inside an orderedList', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'orderedList',
                content: [
                  {
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [text('inner')] }],
                  },
                ],
              },
            ],
          },
        ],
      }),
      noImages,
    )
    const list = content[0] as { ol: Array<{ ol?: unknown[] }> }
    expect(list.ol[0].ol).toHaveLength(1)
  })
})

describe('tiptapToPdfContent — task items', () => {
  it('emits a canvas box reflecting an unchecked task item', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [text('todo')] }],
          },
        ],
      }),
      noImages,
    )
    const taskList = content[0] as {
      stack: Array<{ columns: Array<{ canvas?: unknown[] }> }>
    }
    const box = taskList.stack[0].columns[0]
    expect(box.canvas).toHaveLength(1)
  })

  it('emits an additional checkmark polyline when checked is true', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [text('done')] }],
          },
        ],
      }),
      noImages,
    )
    const taskList = content[0] as {
      stack: Array<{
        columns: Array<{ canvas?: Array<{ type: string; color?: string }> }>
      }>
    }
    const canvas = taskList.stack[0].columns[0].canvas
    expect(canvas).toHaveLength(2)
    expect(canvas?.[0].type).toBe('rect')
    expect(canvas?.[0].color).toBeDefined()
    expect(canvas?.[1].type).toBe('polyline')
  })
})

describe('tiptapToPdfContent — tables', () => {
  function cell(
    type: 'tableCell' | 'tableHeader',
    text_: string,
    attrs?: Record<string, unknown>,
  ): JSONContent {
    return {
      type,
      attrs,
      content: [{ type: 'paragraph', content: [text(text_)] }],
    }
  }

  it('sets headerRows: 1 only when row 0 is tableHeader', () => {
    const withHeader = tiptapToPdfContent(
      doc({
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('tableHeader', 'H')] },
          { type: 'tableRow', content: [cell('tableCell', 'A')] },
        ],
      }),
      noImages,
    )
    const withHeaderTable = withHeader.content[0] as { table: Table }
    expect(withHeaderTable.table.headerRows).toBe(1)

    const noHeader = tiptapToPdfContent(
      doc({
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('tableCell', 'A')] },
          { type: 'tableRow', content: [cell('tableCell', 'B')] },
        ],
      }),
      noImages,
    )
    const noHeaderTable = noHeader.content[0] as { table: Table }
    expect(noHeaderTable.table.headerRows).toBe(0)
  })

  it('maps colspan/rowspan to colSpan/rowSpan', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [cell('tableCell', 'merged', { colspan: 2, rowspan: 2 })],
          },
          { type: 'tableRow', content: [] },
        ],
      }),
      noImages,
    )
    const table = (content[0] as { table: Table }).table
    const mergedCell = table.body[0][0]
    expect(mergedCell.colSpan).toBe(2)
    expect(mergedCell.rowSpan).toBe(2)
  })

  it('normalizes a colwidth array (px) to points, and colwidth: null falls back to *', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              cell('tableCell', 'A', { colwidth: [100] }),
              cell('tableCell', 'B', { colwidth: null }),
            ],
          },
        ],
      }),
      noImages,
    )
    const table = (content[0] as { table: Table }).table
    expect(table.widths).toEqual([75, '*'])
  })

  it('scales a colwidth row proportionally down when the total (in points) would exceed CONTENT_WIDTH', () => {
    // 500px + 500px = 1000px × 0.75 = 750pt, well over the 483.28pt content
    // width — both columns must shrink by the same factor, not clip.
    const { content } = tiptapToPdfContent(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              cell('tableCell', 'A', { colwidth: [500] }),
              cell('tableCell', 'B', { colwidth: [500] }),
            ],
          },
        ],
      }),
      noImages,
    )
    const table = (content[0] as { table: Table }).table
    const widths = table.widths as number[]
    expect(widths).toHaveLength(2)
    expect(widths[0]).toBeCloseTo(widths[1], 5)
    expect(widths[0] + widths[1]).toBeCloseTo(483.28, 5)
  })

  it('maps per-cell align to alignment', () => {
    const { content } = tiptapToPdfContent(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [cell('tableCell', 'right', { align: 'right' })],
          },
        ],
      }),
      noImages,
    )
    const table = (content[0] as { table: Table }).table
    const builtCell = table.body[0][0] as { alignment?: string }
    expect(builtCell.alignment).toBe('right')
  })
})

describe('tiptapToPdfContent — unknown nodes and empty docs', () => {
  it('reports an unknown node type in skipped and still reaches its text into the output', () => {
    const { content, skipped } = tiptapToPdfContent(
      doc({
        type: 'someWeirdNode',
        content: [{ type: 'text', text: 'still here' }],
      }),
      noImages,
    )
    expect(skipped).toContainEqual({
      kind: 'unknown-node',
      detail: 'someWeirdNode',
    })
    expect(content).toContainEqual({ stack: [{ text: 'still here' }] })
  })

  it('an empty doc yields a valid, empty content array', () => {
    const { content, skipped } = tiptapToPdfContent(doc(), noImages)
    expect(content).toEqual([])
    expect(skipped).toEqual([])
  })
})

describe('collectImageSources', () => {
  it('collects every unique image src in the document', () => {
    const sources = collectImageSources(
      doc(
        { type: 'image', attrs: { src: 'a.png' } },
        { type: 'image', attrs: { src: 'b.png' } },
        { type: 'image', attrs: { src: 'a.png' } },
      ),
    )
    expect(sources).toEqual(['a.png', 'b.png'])
  })
})
