import { NoteCodeBlock } from '#/routes/_authenticated/notes/-components/code-block-extension'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Typography from '@tiptap/extension-typography'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'

import { Callout } from '#/routes/_authenticated/notes/-components/callout-extension'
import { MarkdownPasteFallback } from '#/routes/_authenticated/notes/-components/markdown-paste-extension'
import { NoteLinkExtension } from '#/routes/_authenticated/notes/-components/note-link-extension'
import { SlashCommandExtension } from '#/routes/_authenticated/notes/-components/slash-command-extension'
import type { NoteSummary } from '#/stores/notes-store'

const lowlight = createLowlight(common)

const tableCellAlignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.style.textAlign || null,
  renderHTML: ({ align }: { align: string | null }) =>
    align ? { style: `text-align: ${align}` } : {},
}

export function createContentExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
      trailingNode: false,
    }),
    NoteCodeBlock.configure({
      lowlight,
      defaultLanguage: null,
    }),
    TaskList,
    TaskItem.configure({
      nested: false,
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'note-link',
      },
    }),
    Typography,
    Callout,
    Table.configure({
      resizable: true,
      lastColumnResizable: false,
      allowTableNodeSelection: true,
      HTMLAttributes: {
        class: 'notion-table',
      },
    }),
    TableRow,
    TableHeader.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          align: tableCellAlignAttribute,
        }
      },
    }),
    TableCell.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          align: tableCellAlignAttribute,
        }
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
  ]
}

export interface EditorExtensionOptions {
  currentNoteId: string
  getNotes: () => NoteSummary[]
}

export function createEditorExtensions(options: EditorExtensionOptions) {
  return [
    ...createContentExtensions(),
    // Parses pasted plain text as Markdown (headings, lists, blockquotes,
    // etc.) instead of dropping it in as one literal blob — input rules only
    // run on typed keystrokes, never on paste, so this is what makes `##`,
    // `1. `, `- ` and blank-line paragraph breaks work when pasting text
    // copied from elsewhere.
    Markdown.configure({
      transformPastedText: true,
    }),
    // …but `transformPastedText` above is dead weight whenever the clipboard
    // also carries a `text/html` flavour (Notepad, VS Code, and friends add a
    // formatting-free one), because ProseMirror then never asks the Markdown
    // parser. This covers that case.
    MarkdownPasteFallback,
    Placeholder.configure({
      placeholder: 'Type / for commands…',
    }),
    SlashCommandExtension.configure({
      currentNoteId: options.currentNoteId,
      getNotes: options.getNotes,
    }),
    NoteLinkExtension.configure({
      currentNoteId: options.currentNoteId,
      getNotes: options.getNotes,
    }),
  ]
}
