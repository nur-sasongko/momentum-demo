import type { Editor, Range } from '@tiptap/core'
import type { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import type { SlashCommandItem } from '#/routes/notes/-components/slash-command-extension'
import { TableGridPicker } from '#/routes/notes/-components/table-grid-picker'
import { SuggestionMenu } from '#/routes/notes/-components/suggestion-menu'

export interface SlashCommandMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
  editor: Editor
  range: Range
  clientRect?: (() => DOMRect | null) | null
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(function SlashCommandMenu(
  { items, command, editor, range, clientRect },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [gridPickerItem, setGridPickerItem] = useState<SlashCommandItem | null>(
    null,
  )

  useEffect(() => {
    setSelectedIndex(0)
    setGridPickerItem(null)
  }, [items])

  const selectItem = (item: SlashCommandItem) => {
    if (item.showGridPicker) {
      setGridPickerItem(item)
      return
    }
    command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (gridPickerItem) {
        if (event.key === 'Escape') {
          setGridPickerItem(null)
          return true
        }
        return false
      }

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
          selectItem(items[selectedIndex])
        }
        return true
      }

      return false
    },
  }))

  const rect = clientRect?.() ?? null

  if (gridPickerItem) {
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
        <TableGridPicker
          onSelect={(rows, cols) => {
            command({
              ...gridPickerItem,
              command: (props) =>
                gridPickerItem.command({ ...props, rows, cols }),
            })
          }}
          onCancel={() => setGridPickerItem(null)}
        />
      </div>
    )
  }

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
        onSelect={selectItem}
        emptyMessage="No matching commands"
      />
    </div>
  )
})
