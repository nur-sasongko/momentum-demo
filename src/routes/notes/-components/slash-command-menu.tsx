import type { Editor, Range } from '@tiptap/core'
import type { SuggestionKeyDownProps } from '@tiptap/suggestion'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

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
  const selectedIndexRef = useRef(selectedIndex)
  selectedIndexRef.current = selectedIndex

  const itemIdsKey = useMemo(
    () => items.map((item) => item.id).join(','),
    [items],
  )

  useEffect(() => {
    setSelectedIndex(0)
    setGridPickerItem(null)
  }, [itemIdsKey])

  useEffect(() => {
    setSelectedIndex((index) => {
      if (items.length === 0) {
        return 0
      }

      return Math.min(index, items.length - 1)
    })
  }, [items.length])

  const selectItem = useCallback(
    (item: SlashCommandItem) => {
      if (item.showGridPicker) {
        setGridPickerItem(item)
        return
      }
      command(item)
    },
    [command],
  )

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (gridPickerItem) {
          if (event.key === 'Escape') {
            setGridPickerItem(null)
            return true
          }
          return false
        }

        if (items.length === 0) {
          return event.key === 'Enter'
        }

        if (event.key === 'ArrowUp') {
          setSelectedIndex((index) => Math.max(index - 1, 0))
          return true
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((index) => Math.min(index + 1, items.length - 1))
          return true
        }

        if (event.key === 'Enter') {
          selectItem(items[selectedIndexRef.current])
          return true
        }

        return false
      },
    }),
    [gridPickerItem, items, selectItem],
  )

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
