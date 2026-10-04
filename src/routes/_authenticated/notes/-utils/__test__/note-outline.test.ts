import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { extractOutline } from '../note-outline'

function heading(
  level: number,
  text: string,
  content: JSONContent['content'] = [{ type: 'text', text }],
): JSONContent {
  return { type: 'heading', attrs: { level }, content }
}

describe('extractOutline', () => {
  it('returns entries in document order for a flat H1/H2/H3 document', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        heading(1, 'Intro'),
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
        heading(2, 'Setup'),
        heading(3, 'Env vars'),
      ],
    }

    expect(extractOutline(doc)).toEqual([
      { level: 1, text: 'Intro', domIndex: 0 },
      { level: 2, text: 'Setup', domIndex: 1 },
      { level: 3, text: 'Env vars', domIndex: 2 },
    ])
  })

  it('keeps H4 and clamps H5–H6 to level 4', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [heading(4, 'Four'), heading(5, 'Five'), heading(6, 'Six')],
    }

    expect(extractOutline(doc).map((e) => e.level)).toEqual([4, 4, 4])
  })

  it('skips empty headings but keeps domIndex aligned with the full heading count', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        heading(1, '', []),
        heading(2, 'Real section'),
        heading(1, '', [{ type: 'text', text: '   ' }]),
        heading(2, 'Another'),
      ],
    }

    expect(extractOutline(doc)).toEqual([
      { level: 2, text: 'Real section', domIndex: 1 },
      { level: 2, text: 'Another', domIndex: 3 },
    ])
  })

  it('finds headings nested inside a callout and inside a table cell', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          content: [heading(2, 'Inside callout')],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [heading(3, 'Inside cell')],
                },
              ],
            },
          ],
        },
      ],
    }

    expect(extractOutline(doc)).toEqual([
      { level: 2, text: 'Inside callout', domIndex: 0 },
      { level: 3, text: 'Inside cell', domIndex: 1 },
    ])
  })

  it('returns [] for a document with no headings and for an empty document', () => {
    const withParagraphOnly: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }
    const empty: JSONContent = { type: 'doc' }

    expect(extractOutline(withParagraphOnly)).toEqual([])
    expect(extractOutline(empty)).toEqual([])
  })

  it('concatenates multiple text nodes in one heading, including marked text, into a single label', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        heading(1, '', [
          { type: 'text', text: 'Row-level ' },
          {
            type: 'text',
            text: 'security',
            marks: [{ type: 'bold' }],
          },
          { type: 'text', text: ' policies' },
        ]),
      ],
    }

    expect(extractOutline(doc)).toEqual([
      { level: 1, text: 'Row-level security policies', domIndex: 0 },
    ])
  })
})
