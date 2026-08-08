import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { MarkdownStorage } from 'tiptap-markdown'

/**
 * Elements that mean the clipboard HTML carries formatting of its own, so it
 * should be parsed as HTML (the ProseMirror default) rather than re-read as
 * Markdown. A copy straight out of ChatGPT lands here — it ships real
 * `<h2>`/`<ul>`/`<strong>` markup.
 */
const RICH_HTML_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'hr',
  'img',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'u',
  'a',
].join(',')

/**
 * Line- and inline-level Markdown syntax. Used to decide whether a
 * formatting-free clipboard payload is Markdown source worth parsing, so that
 * ordinary prose is still pasted verbatim.
 */
const MARKDOWN_SIGNALS = [
  /^ {0,3}#{1,6} +\S/m, // # heading
  /^ {0,3}[-*+] +\S/m, // - bullet
  /^ {0,3}\d+[.)] +\S/m, // 1. ordered item
  /^ {0,3}> +\S/m, // > blockquote
  /^ {0,3}(?:```|~~~)/m, // ``` fenced code
  /^ {0,3}([-*_]) *(?:\1 *){2,}$/m, // --- thematic rule
  /^ {0,3}\|.*\| *$/m, // | table | row |
  /^ {0,3}[-*+] +\[[ xX]\] +\S/m, // - [ ] task item
  /\*\*[^*\n]+\*\*/, // **bold**
  /\[[^\]\n]+\]\([^\s)]+\)/, // [text](href)
]

export function hasRichHtmlFormatting(html: string): boolean {
  if (!html.trim()) {
    return false
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return parsed.body.querySelector(RICH_HTML_SELECTOR) !== null
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) {
    return false
  }

  return MARKDOWN_SIGNALS.some((pattern) => pattern.test(text))
}

/**
 * `tiptap-markdown` puts its parser on editor storage at runtime but leaves it
 * out of the published `MarkdownStorage` type, so it has to be re-declared.
 */
type MarkdownStorageWithParser = MarkdownStorage & {
  parser?: { parse: (content: string) => string }
}

/**
 * Rescues Markdown that arrives with a useless `text/html` flavour alongside it.
 *
 * `tiptap-markdown`'s `transformPastedText` only ever runs through ProseMirror's
 * `clipboardTextParser`, and ProseMirror consults that parser *only* when the
 * clipboard has no `text/html` at all (see `parseFromClipboard`). Plain-text
 * editors — Windows Notepad, VS Code, Notepad++ — put both flavours on the
 * clipboard: an HTML one that is just `<div>`/`<span>` wrappers around the raw
 * characters. That flavour wins, so `## Heading` and `- item` get pasted as
 * literal text and none of the Markdown is applied.
 *
 * This hook spots that case — HTML with no formatting of its own, plus a
 * plain-text flavour that reads as Markdown — and swaps in HTML rendered from
 * the Markdown instead. Rich clipboard payloads and non-Markdown text are
 * passed through untouched, and holding Shift while pasting still bypasses
 * everything (ProseMirror skips the HTML path entirely for a forced plain paste).
 *
 * Requires the `Markdown` extension for the parser; without it, pastes are
 * left alone.
 */
export const MarkdownPasteFallback = Extension.create({
  name: 'markdownPasteFallback',

  addProseMirrorPlugins() {
    // `transformPastedHTML` receives only the HTML flavour, so the plain-text
    // one is stashed from the paste event that precedes it.
    let lastPastedText = ''

    return [
      new Plugin({
        key: new PluginKey('markdownPasteFallback'),
        props: {
          handleDOMEvents: {
            paste: (_view, event) => {
              lastPastedText = event.clipboardData?.getData('text/plain') ?? ''
              return false
            },
          },
          transformPastedHTML: (html) => {
            const text = lastPastedText

            if (hasRichHtmlFormatting(html) || !looksLikeMarkdown(text)) {
              return html
            }

            const markdown: MarkdownStorageWithParser =
              this.editor.storage.markdown

            return markdown.parser?.parse(text) ?? html
          },
        },
      }),
    ]
  },
})
