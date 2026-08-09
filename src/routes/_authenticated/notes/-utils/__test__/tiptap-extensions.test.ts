import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { createEditorExtensions } from '../tiptap-extensions'

import type { JSONContent } from '@tiptap/core'

// Regression test for the phantom-write root cause (spec 17): `Placeholder`
// dispatches a viewport-measurement transaction at construction time, which
// used to wake `TrailingNode` (bundled into `StarterKit`) whenever the
// stored doc's last node wasn't a paragraph — producing a real doc mutation,
// an `onUpdate` fire, and a live Undo button on a note nobody touched.
const DOCS_BY_LAST_NODE: Record<string, JSONContent> = {
  paragraph: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    ],
  },
  'bullet list': {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Item' }] },
            ],
          },
        ],
      },
    ],
  },
  table: {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph' }] },
              { type: 'tableCell', content: [{ type: 'paragraph' }] },
            ],
          },
        ],
      },
    ],
  },
  'code block': {
    type: 'doc',
    content: [
      { type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1' }] },
    ],
  },
}

describe('createEditorExtensions', () => {
  it.each(Object.entries(DOCS_BY_LAST_NODE))(
    'issues zero onUpdate calls and disables Undo for a doc ending in %s',
    (_label, content) => {
      let updateCount = 0

      const editor = new Editor({
        element: document.createElement('div'),
        extensions: createEditorExtensions({
          currentNoteId: 'test-note',
          getNotes: () => [],
        }),
        content,
        onUpdate: () => {
          updateCount += 1
        },
      })

      expect(updateCount).toBe(0)
      expect(editor.can().undo()).toBe(false)

      editor.destroy()
    },
  )
})
