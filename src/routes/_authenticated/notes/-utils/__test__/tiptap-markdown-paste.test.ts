import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { createEditorExtensions } from '../tiptap-extensions'

/**
 * `setContent` is patched by the `Markdown` extension to route its input
 * through the exact same `MarkdownParser` instance used by the paste
 * (`clipboardTextParser`) code path — so exercising it here is a faithful,
 * DOM-event-free way to verify pasted Markdown-like text gets converted into
 * real nodes instead of being dropped in as literal text.
 */
function parseAsMarkdown(markdown: string) {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: createEditorExtensions({
      currentNoteId: 'test-note',
      getNotes: () => [],
    }),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })

  editor.commands.setContent(markdown)
  const json = editor.getJSON()
  editor.destroy()
  return json
}

describe('Markdown paste parsing', () => {
  it('converts a `## ` line into a heading node', () => {
    const doc = parseAsMarkdown('## Start with simple framework')

    expect(doc.content[0]).toMatchObject({
      type: 'heading',
      attrs: expect.objectContaining({ level: 2 }),
    })
  })

  it('splits blank-line-separated text into separate paragraph nodes', () => {
    const doc = parseAsMarkdown(
      'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
    )

    const paragraphs = doc.content.filter((n) => n.type === 'paragraph')
    expect(paragraphs).toHaveLength(3)
  })

  it('converts a numbered list into an ordered list node', () => {
    const doc = parseAsMarkdown('1. First step\n2. Second step\n3. Third step')

    expect(doc.content[0].type).toBe('orderedList')
    expect(doc.content[0].content).toHaveLength(3)
  })

  it('handles a realistic pasted note end to end', () => {
    const doc = parseAsMarkdown(
      [
        "I've changed my mindset.",
        '',
        '## 1 Start with simple framework',
        "Don't start from learning, but start with the goal",
        '',
        'A clear goal lets the brain know which information is important.',
      ].join('\n'),
    )

    const types = doc.content.map((n) => n.type)
    expect(types).toContain('heading')
    expect(
      types.filter((t) => t === 'paragraph').length,
    ).toBeGreaterThanOrEqual(2)

    const heading = doc.content.find((n) => n.type === 'heading')
    expect(heading?.attrs).toMatchObject({ level: 2 })
  })
})
