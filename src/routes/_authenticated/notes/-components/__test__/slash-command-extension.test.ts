import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { buildSlashCommands } from '#/routes/_authenticated/notes/-components/slash-command-extension'
import { createEditorExtensions } from '#/routes/_authenticated/notes/-utils/tiptap-extensions'

const commands = buildSlashCommands(() => [], 'test-note')

function makeEditor(text: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: createEditorExtensions({
      currentNoteId: 'test-note',
      getNotes: () => [],
    }),
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  })
}

describe('buildSlashCommands — headings', () => {
  it('offers Heading 2, 3 and 4 but not Heading 1', () => {
    const ids = commands.map((item) => item.id)

    expect(ids).toEqual(
      expect.arrayContaining(['heading-2', 'heading-3', 'heading-4']),
    )
    expect(ids).not.toContain('heading-1')
  })

  it('makes Heading 4 searchable as h4', () => {
    const item = commands.find((entry) => entry.id === 'heading-4')

    expect(item?.title).toBe('Heading 4')
    expect(item?.keywords).toContain('h4')
  })

  it.each([
    ['heading-2', 2],
    ['heading-3', 3],
    ['heading-4', 4],
  ])('%s converts the block to a level-%i heading', (id, level) => {
    const editor = makeEditor('/h')
    const item = commands.find((entry) => entry.id === id)

    item?.command({ editor, range: { from: 1, to: 3 } })

    expect(editor.getJSON().content[0]).toMatchObject({
      type: 'heading',
      attrs: { level },
    })
    editor.destroy()
  })
})
