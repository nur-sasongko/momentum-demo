import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import {
  hasRichHtmlFormatting,
  looksLikeMarkdown,
} from '#/routes/_authenticated/notes/-components/markdown-paste-extension'
import { createEditorExtensions } from '#/routes/_authenticated/notes/-utils/tiptap-extensions'

const MARKDOWN = [
  "I've changed my mindset.",
  '',
  '## 1 Start with simple framework',
  '',
  "Don't start from learning, but start with the goal",
  '',
  '- bullet one',
  '- bullet two',
  '',
  '---',
  '',
  '1. first',
  '2. second',
].join('\r\n') // plain-text editors on Windows hand over CRLF line endings

function makeEditor() {
  return new Editor({
    element: document.createElement('div'),
    extensions: createEditorExtensions({
      currentNoteId: 'test-note',
      getNotes: () => [],
    }),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
}

/**
 * Dispatches a paste event carrying the given clipboard flavours, mirroring
 * what ProseMirror reads off a real `ClipboardEvent`.
 */
function paste(editor: Editor, flavours: { text?: string; html?: string }) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => {
        if (type === 'text/plain') {
          return flavours.text ?? ''
        }
        if (type === 'text/html') {
          return flavours.html ?? ''
        }
        return ''
      },
      types: Object.keys(flavours),
    },
  })
  editor.view.dom.dispatchEvent(event)
}

function pasteAndGetTypes(flavours: { text?: string; html?: string }) {
  const editor = makeEditor()
  paste(editor, flavours)
  const json = editor.getJSON()
  editor.destroy()

  // The empty paragraph the editor started with survives after the insert.
  const nodes = json.content.filter(
    (node) => node.type !== 'paragraph' || node.content !== undefined,
  )

  return { types: nodes.map((node) => node.type), json }
}

describe('hasRichHtmlFormatting', () => {
  it('detects formatting in clipboard HTML from a rich source', () => {
    expect(
      hasRichHtmlFormatting(
        '<h2>Heading</h2><ul><li><strong>bold</strong></li></ul>',
      ),
    ).toBe(true)
  })

  it('treats div/span wrappers around raw text as unformatted', () => {
    expect(
      hasRichHtmlFormatting(
        '<html><body><!--StartFragment--><div style="font-family:Consolas"><span>## Heading</span></div><div><span>- item</span></div><!--EndFragment--></body></html>',
      ),
    ).toBe(false)
  })

  it('treats empty HTML as unformatted', () => {
    expect(hasRichHtmlFormatting('   ')).toBe(false)
  })
})

describe('looksLikeMarkdown', () => {
  it.each([
    ['## Heading', 'heading'],
    ['- item', 'bullet'],
    ['1. item', 'ordered item'],
    ['> quote', 'blockquote'],
    ['```ts', 'fenced code'],
    ['---', 'thematic rule'],
    ['| a | b |', 'table row'],
    ['- [ ] todo', 'task item'],
    ['some **bold** text', 'bold'],
    ['a [link](https://example.com) here', 'link'],
  ])('recognises %j as Markdown (%s)', (text) => {
    expect(looksLikeMarkdown(text)).toBe(true)
  })

  it.each([
    'Just a sentence.',
    'Two sentences. No markup at all.',
    'A dash - mid sentence is not a bullet.',
    '',
  ])('leaves plain prose alone: %j', (text) => {
    expect(looksLikeMarkdown(text)).toBe(false)
  })
})

describe('pasting Markdown', () => {
  it('applies Markdown when the clipboard has plain text only', () => {
    const { types } = pasteAndGetTypes({ text: MARKDOWN })

    expect(types).toEqual([
      'paragraph',
      'heading',
      'paragraph',
      'bulletList',
      'horizontalRule',
      'orderedList',
    ])
  })

  // The regression: Notepad/VS Code add a formatting-free `text/html` flavour,
  // which ProseMirror prefers, so the Markdown used to arrive as literal text.
  it('applies Markdown when a formatting-free HTML flavour tags along', () => {
    const { types, json } = pasteAndGetTypes({
      text: MARKDOWN,
      html: '<html><body><!--StartFragment--><div>I&#39;ve changed my mindset.</div><div>## 1 Start with simple framework</div><div>- bullet one</div><!--EndFragment--></body></html>',
    })

    expect(types).toEqual([
      'paragraph',
      'heading',
      'paragraph',
      'bulletList',
      'horizontalRule',
      'orderedList',
    ])
    expect(JSON.stringify(json)).not.toContain('## 1 Start')
  })

  it('keeps the HTML flavour when the clipboard source was rich', () => {
    const { types } = pasteAndGetTypes({
      text: MARKDOWN,
      html: '<h3>Rich heading</h3><blockquote><p>quoted</p></blockquote>',
    })

    expect(types).toEqual(['heading', 'blockquote'])
  })

  it('leaves non-Markdown plain text with an HTML flavour untouched', () => {
    const { json } = pasteAndGetTypes({
      text: 'Just a sentence.',
      html: '<div>Just a sentence.</div>',
    })

    expect(json.content[0]).toMatchObject({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Just a sentence.' }],
    })
  })
})

describe('pasting Markdown headings', () => {
  it.each([
    ['# One', 1],
    ['#### Four', 4],
    ['###### Six', 6],
  ])('keeps %j as a heading of level %i', (text, level) => {
    const { json } = pasteAndGetTypes({ text })

    expect(json.content.find((node) => node.type === 'heading')).toMatchObject({
      attrs: { level },
    })
  })
})
