import type { Editor, Range } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import type { ComponentProps } from 'react'

import type { SlashCommandMenuRef } from '#/routes/_authenticated/notes/-components/slash-command-menu'
import { SlashCommandMenu } from '#/routes/_authenticated/notes/-components/slash-command-menu'
import { filterSuggestionItems } from '#/routes/_authenticated/notes/-components/suggestion-menu'
import { insertTableAtRange } from '#/routes/_authenticated/notes/-utils/table-utils'
import type { Note } from '#/stores/notes-store'

export interface SlashCommandItem {
  id: string
  title: string
  description?: string
  keywords?: string[]
  showGridPicker?: boolean
  command: (props: {
    editor: Editor
    range: Range
    rows?: number
    cols?: number
  }) => void
}

function promptForUrl(defaultValue = ''): string | null {
  const url = window.prompt('Enter image URL', defaultValue)
  if (url === null) {
    return null
  }
  const trimmed = url.trim()
  return trimmed.length > 0 ? trimmed : null
}

function promptForExternalLink(defaultValue = ''): string | null {
  const url = window.prompt('Enter link URL', defaultValue)
  if (url === null) {
    return null
  }
  const trimmed = url.trim()
  return trimmed.length > 0 ? trimmed : null
}

function insertImageFromFile(editor: Editor, range: Range) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result
      if (typeof src !== 'string') {
        return
      }

      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setImage({ src, alt: file.name })
        .run()
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

export function buildSlashCommands(
  getNotes: () => Note[],
  currentNoteId: string,
): SlashCommandItem[] {
  return [
    {
      id: 'text',
      title: 'Text',
      description: 'Plain paragraph',
      keywords: ['paragraph', 'plain'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run()
      },
    },
    {
      id: 'heading-1',
      title: 'Heading 1',
      description: 'Large section heading',
      keywords: ['h1', 'title'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 1 })
          .run()
      },
    },
    {
      id: 'heading-2',
      title: 'Heading 2',
      description: 'Medium section heading',
      keywords: ['h2', 'subtitle'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 2 })
          .run()
      },
    },
    {
      id: 'heading-3',
      title: 'Heading 3',
      description: 'Small section heading',
      keywords: ['h3'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 3 })
          .run()
      },
    },
    {
      id: 'bullet-list',
      title: 'Bullet List',
      description: 'Unordered list',
      keywords: ['unordered', 'ul'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      id: 'ordered-list',
      title: 'Ordered List',
      description: 'Numbered list',
      keywords: ['numbered', 'ol'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      id: 'todo-list',
      title: 'Todo List',
      description: 'Checklist with checkboxes',
      keywords: ['task', 'checkbox', 'checklist'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
      },
    },
    {
      id: 'code-block',
      title: 'Code Block',
      description: 'Syntax-highlighted code',
      keywords: ['code', 'snippet'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
    },
    {
      id: 'blockquote',
      title: 'Blockquote',
      description: 'Quoted text',
      keywords: ['quote'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      id: 'divider',
      title: 'Divider',
      description: 'Horizontal rule',
      keywords: ['hr', 'horizontal', 'line'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      id: 'image-url',
      title: 'Image',
      description: 'Insert from URL',
      keywords: ['photo', 'picture', 'upload'],
      command: ({ editor, range }) => {
        const url = promptForUrl()
        if (!url) {
          return
        }

        editor.chain().focus().deleteRange(range).setImage({ src: url }).run()
      },
    },
    {
      id: 'image-upload',
      title: 'Image Upload',
      description: 'Upload from your device',
      keywords: ['photo', 'file'],
      command: ({ editor, range }) => {
        insertImageFromFile(editor, range)
      },
    },
    {
      id: 'table',
      title: 'Table',
      description: 'Insert a table',
      keywords: ['grid', 'spreadsheet'],
      showGridPicker: true,
      command: ({ editor, range, rows = 3, cols = 3 }) => {
        insertTableAtRange(editor, range, rows, cols)
      },
    },
    {
      id: 'callout',
      title: 'Callout',
      description: 'Highlighted info block',
      keywords: ['info', 'alert', 'note'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: 'callout',
            content: [{ type: 'paragraph' }],
          })
          .run()
      },
    },
    {
      id: 'note-link',
      title: 'Link to Note',
      description: 'Link to another note',
      keywords: ['wiki', 'internal', 'reference'],
      command: ({ editor, range }) => {
        const notes = getNotes().filter((note) => note.id !== currentNoteId)
        const titles = notes.map((note) => note.title || 'Untitled').join('\n')
        const picked = window.prompt(
          `Link to note (enter exact title):\n${titles}`,
        )
        if (!picked) {
          return
        }

        const target = notes.find(
          (note) =>
            (note.title || 'Untitled').toLowerCase() === picked.toLowerCase(),
        )
        if (!target) {
          return
        }

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'text',
              text: target.title || 'Untitled',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: `/notes?note=${target.id}`,
                    class: 'note-internal-link',
                  },
                },
              ],
            },
            { type: 'text', text: ' ' },
          ])
          .run()
      },
    },
    {
      id: 'link',
      title: 'External Link',
      description: 'Insert a web link',
      keywords: ['url', 'href'],
      command: ({ editor, range }) => {
        const url = promptForExternalLink('https://')
        if (!url) {
          return
        }

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'text',
              text: url,
              marks: [{ type: 'link', attrs: { href: url } }],
            },
            { type: 'text', text: ' ' },
          ])
          .run()
      },
    },
  ]
}

export interface SlashCommandExtensionOptions {
  getNotes: () => Note[]
  currentNoteId: string
}

const SLASH_MENU_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter'])

export const SlashCommandExtension =
  Extension.create<SlashCommandExtensionOptions>({
    name: 'slashCommand',

    addOptions() {
      return {
        getNotes: () => [],
        currentNoteId: '',
      }
    },

    addProseMirrorPlugins() {
      const getCommands = () =>
        buildSlashCommands(this.options.getNotes, this.options.currentNoteId)

      return [
        Suggestion<SlashCommandItem, SlashCommandItem>({
          editor: this.editor,
          char: '/',
          allowSpaces: true,
          startOfLine: false,
          command: ({ editor, range, props }) => {
            props.command({ editor, range })
          },
          items: ({ query }) => filterSuggestionItems(getCommands(), query),
          render: () => {
            let component: ReactRenderer<
              SlashCommandMenuRef,
              ComponentProps<typeof SlashCommandMenu>
            > | null = null

            return {
              onStart: (props) => {
                const renderer = new ReactRenderer(SlashCommandMenu, {
                  editor: props.editor,
                  props,
                })
                component = renderer
                document.body.appendChild(renderer.element)
              },
              onUpdate: (props) => {
                component?.updateProps(props)
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  component?.destroy()
                  component = null
                  return true
                }

                const handled = component?.ref?.onKeyDown(props)
                if (handled !== undefined) {
                  return handled
                }

                // Block editor cursor movement while the menu mounts.
                return SLASH_MENU_NAVIGATION_KEYS.has(props.event.key)
              },
              onExit: () => {
                component?.destroy()
                component = null
              },
            }
          },
        }),
      ]
    },
  })
