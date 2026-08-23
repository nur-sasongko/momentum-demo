import { describe, expect, it } from 'vitest'

import {
  CONTENT_WIDTH,
  PAGE_MARGIN,
  PX_TO_PT,
  buildPdfDocument,
  buildPdfFooter,
  pdfPageBreakBefore,
} from '#/routes/_authenticated/notes/-utils/pdf-document'

import type { Node, NodeQueries } from 'pdfmake/interfaces'
import type { PdfExportNote } from '#/routes/_authenticated/notes/-types/notes-pdf'

const FONTS = { body: 'Inter', mono: 'IBMPlexMono' }

function makeNote(overrides: Partial<PdfExportNote> = {}): PdfExportNote {
  return {
    title: 'Compounding attention',
    tags: ['focus', 'writing'],
    content: { type: 'doc', content: [] },
    updatedAt: '2026-08-22T09:41:00.000Z',
    ...overrides,
  }
}

describe('buildPdfDocument — page geometry', () => {
  it('sets A4 portrait with 56pt margins on every side', () => {
    const doc = buildPdfDocument(
      makeNote(),
      { content: [], skipped: [] },
      FONTS,
    )
    expect(doc.pageSize).toBe('A4')
    expect(doc.pageOrientation).toBe('portrait')
    expect(doc.pageMargins).toEqual([56, 56, 56, 56])
    expect(PAGE_MARGIN).toBe(56)
  })

  it('CONTENT_WIDTH is 483.28', () => {
    expect(CONTENT_WIDTH).toBe(483.28)
  })

  it('PX_TO_PT converts 96dpi CSS pixels to 72dpi points (×0.75)', () => {
    expect(PX_TO_PT).toBe(0.75)
  })
})

describe('buildPdfDocument — title block', () => {
  it('renders the title, tags, and edited date', () => {
    const doc = buildPdfDocument(
      makeNote(),
      { content: [], skipped: [] },
      FONTS,
    )
    const [titleNode, bylineNode] = doc.content as Array<{
      text: string
      style: string
    }>
    expect(titleNode).toMatchObject({
      text: 'Compounding attention',
      style: 'title',
    })
    expect(bylineNode.style).toBe('byline')
    expect(bylineNode.text).toContain('#focus')
    expect(bylineNode.text).toContain('#writing')
    expect(bylineNode.text).toMatch(/Edited/)
  })

  it('a blank title becomes "Untitled note"', () => {
    const doc = buildPdfDocument(
      makeNote({ title: '   ' }),
      { content: [], skipped: [] },
      FONTS,
    )
    const [titleNode] = doc.content as Array<{ text: string }>
    expect(titleNode.text).toBe('Untitled note')
  })

  it('omits the tags segment entirely when the note has no tags', () => {
    const doc = buildPdfDocument(
      makeNote({ tags: [] }),
      { content: [], skipped: [] },
      FONTS,
    )
    const [, bylineNode] = doc.content as Array<{ text: string }>
    expect(bylineNode.text).not.toContain('#')
    expect(bylineNode.text).toMatch(/^Edited/)
  })

  it('appends the transform content after the title block', () => {
    const transformNode = { text: 'body' }
    const doc = buildPdfDocument(
      makeNote(),
      { content: [transformNode], skipped: [] },
      FONTS,
    )
    expect(doc.content).toHaveLength(3)
    expect(doc.content[2]).toBe(transformNode)
  })
})

describe('buildPdfFooter', () => {
  it('renders "page / pageCount"', () => {
    const footer = buildPdfFooter()
    if (typeof footer !== 'function')
      throw new Error('expected a function footer')
    const rendered = footer(2, 5, []) as { text: string; alignment: string }
    expect(rendered.text).toBe('2 / 5')
    expect(rendered.alignment).toBe('right')
  })
})

describe('pdfPageBreakBefore', () => {
  function nodeQueriesWithFollowing(count: number): NodeQueries {
    return {
      getFollowingNodesOnPage: () => new Array(count).fill({}),
    } as unknown as NodeQueries
  }

  it('breaks before a heading that would otherwise be last on its page', () => {
    const headingNode = { headlineLevel: 2 } as unknown as Node
    expect(pdfPageBreakBefore(headingNode, nodeQueriesWithFollowing(0))).toBe(
      true,
    )
  })

  it('does not break a heading that has content following it on the page', () => {
    const headingNode = { headlineLevel: 2 } as unknown as Node
    expect(pdfPageBreakBefore(headingNode, nodeQueriesWithFollowing(1))).toBe(
      false,
    )
  })

  it('never breaks before a non-heading node', () => {
    const bodyNode = {} as unknown as Node
    expect(pdfPageBreakBefore(bodyNode, nodeQueriesWithFollowing(0))).toBe(
      false,
    )
  })
})
