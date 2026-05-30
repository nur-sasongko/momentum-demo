import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
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
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'

import { Callout } from '#/routes/notes/-components/callout-extension'
import { NoteLinkExtension } from '#/routes/notes/-components/note-link-extension'
import { SlashCommandExtension } from '#/routes/notes/-components/slash-command-extension'
import { TableRowNodeView } from '#/routes/notes/-components/table-row-nodeview'
import type { Note } from '#/stores/notes-store'

const lowlight = createLowlight(common)

export function createContentExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
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
    TableRow.extend({
      addNodeView() {
        return ReactNodeViewRenderer(TableRowNodeView)
      },
    }),
    TableHeader,
    TableCell,
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
  ]
}

export interface EditorExtensionOptions {
  currentNoteId: string
  getNotes: () => Note[]
}

export function createEditorExtensions(options: EditorExtensionOptions) {
  return [
    ...createContentExtensions(),
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
