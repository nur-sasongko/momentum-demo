import type { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import type { NoteLinkItem } from '#/routes/notes/-components/note-link-extension'
import { SuggestionMenu } from '#/routes/notes/-components/suggestion-menu'

export interface NoteLinkMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface NoteLinkMenuProps {
  items: NoteLinkItem[]
  command: (item: NoteLinkItem) => void
  clientRect?: (() => DOMRect | null) | null
}

export const NoteLinkMenu = forwardRef<NoteLinkMenuRef, NoteLinkMenuProps>(
  function NoteLinkMenu({ items, command, clientRect }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((index) => (index + items.length - 1) % items.length)
          return true
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((index) => (index + 1) % items.length)
          return true
        }

        if (event.key === 'Enter') {
          if (items.length > 0) {
            command(items[selectedIndex])
          }
          return true
        }

        return false
      },
    }))

    const rect = clientRect?.() ?? null

    return (
      <div
        className="fixed z-50"
        style={
          rect
            ? {
                top: rect.bottom + 8,
                left: rect.left,
              }
            : undefined
        }
      >
        <SuggestionMenu
          items={items}
          selectedIndex={selectedIndex}
          onSelect={command}
          emptyMessage="No matching notes"
        />
      </div>
    )
  },
)
