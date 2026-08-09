import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import type { ComponentProps } from 'react'

import type { NoteLinkMenuRef } from '#/routes/_authenticated/notes/-components/note-link-menu'
import { NoteLinkMenu } from '#/routes/_authenticated/notes/-components/note-link-menu'
import { filterSuggestionItems } from '#/routes/_authenticated/notes/-components/suggestion-menu'
import type { NoteSummary } from '#/stores/notes-store'

export interface NoteLinkItem {
  id: string
  title: string
  description?: string
  keywords?: string[]
}

export interface NoteLinkExtensionOptions {
  getNotes: () => NoteSummary[]
  currentNoteId: string
}

export const NoteLinkExtension = Extension.create<NoteLinkExtensionOptions>({
  name: 'noteLink',

  addOptions() {
    return {
      getNotes: () => [],
      currentNoteId: '',
    }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('noteLinkSuggestion')

    const getItems = (query: string): NoteLinkItem[] => {
      const notes = this.options
        .getNotes()
        .filter((note) => note.id !== this.options.currentNoteId)
        .map((note) => ({
          id: note.id,
          title: note.title || 'Untitled',
          description: note.tags[0] ? `#${note.tags[0]}` : undefined,
          keywords: note.tags,
        }))

      return filterSuggestionItems(notes, query)
    }

    return [
      Suggestion<NoteLinkItem, NoteLinkItem>({
        editor: this.editor,
        pluginKey,
        char: '[',
        allowSpaces: true,
        startOfLine: false,
        allow: ({ state, range }) => {
          const from = range.from
          if (from < 2) {
            return false
          }

          const openBracket = state.doc.textBetween(
            from - 2,
            from - 1,
            '\0',
            '\0',
          )
          return openBracket === '['
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange({ from: range.from - 2, to: range.to })
            .insertContent([
              {
                type: 'text',
                text: props.title,
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: `/notes?note=${props.id}`,
                      class: 'note-internal-link',
                    },
                  },
                ],
              },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        items: ({ query }) => getItems(query),
        render: () => {
          let component: ReactRenderer<
            NoteLinkMenuRef,
            ComponentProps<typeof NoteLinkMenu>
          > | null = null

          return {
            onStart: (props) => {
              const renderer = new ReactRenderer(NoteLinkMenu, {
                editor: props.editor,
                props,
              })
              component = renderer
              renderer.element.setAttribute('data-note-editor-portal', '')
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

              return component?.ref?.onKeyDown(props) ?? false
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
