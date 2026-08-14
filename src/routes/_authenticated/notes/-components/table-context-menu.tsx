import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { TableAlign } from '#/routes/_authenticated/notes/-types/notes-table'
import { setColumnAlignment } from '#/routes/_authenticated/notes/-utils/table-utils'
import { cn } from '#/libs/utils'

interface TableContextMenuProps {
  editor: Editor
  containerRef: React.RefObject<HTMLElement | null>
}

interface MenuState {
  x: number
  y: number
}

interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
  destructive?: boolean
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

function MenuButton({
  item,
  onClose,
}: {
  item: MenuItem
  onClose: () => void
}) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      className={cn(
        'flex w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        item.disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : item.destructive
            ? 'text-destructive hover:bg-destructive/10'
            : 'hover:bg-muted',
      )}
      onMouseDown={(event) => {
        event.preventDefault()
        if (item.disabled) {
          return
        }
        item.action()
        onClose()
      }}
    >
      {item.label}
    </button>
  )
}

export function TableContextMenu({
  editor,
  containerRef,
}: TableContextMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('td, th')) {
        return
      }

      if (!editor.isActive('table')) {
        return
      }

      event.preventDefault()
      setMenu({ x: event.clientX, y: event.clientY })
    }

    const onDismiss = () => setMenu(null)

    container.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('click', onDismiss)
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    })

    return () => {
      container.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('click', onDismiss)
      window.removeEventListener('scroll', onDismiss, true)
    }
  }, [containerRef, editor])

  if (!menu) {
    return null
  }

  const align = (value: TableAlign) => {
    setColumnAlignment(editor, value)
  }

  const sections: MenuSection[] = [
    {
      title: 'Row',
      items: [
        {
          label: 'Insert row above',
          action: () => editor.chain().focus().addRowBefore().run(),
        },
        {
          label: 'Insert row below',
          action: () => editor.chain().focus().addRowAfter().run(),
        },
        {
          label: 'Delete row',
          action: () => editor.chain().focus().deleteRow().run(),
          destructive: true,
        },
      ],
    },
    {
      title: 'Column',
      items: [
        {
          label: 'Insert column left',
          action: () => editor.chain().focus().addColumnBefore().run(),
        },
        {
          label: 'Insert column right',
          action: () => editor.chain().focus().addColumnAfter().run(),
        },
        {
          label: 'Delete column',
          action: () => editor.chain().focus().deleteColumn().run(),
          destructive: true,
        },
        { label: 'Align left', action: () => align('left') },
        { label: 'Align center', action: () => align('center') },
        { label: 'Align right', action: () => align('right') },
      ],
    },
    {
      title: 'Cell',
      items: [
        {
          label: 'Merge selected cells',
          action: () => editor.chain().focus().mergeCells().run(),
          disabled: !editor.can().mergeCells(),
        },
        {
          label: 'Split cell',
          action: () => editor.chain().focus().splitCell().run(),
          disabled: !editor.can().splitCell(),
        },
        {
          label: 'Toggle header row',
          action: () => editor.chain().focus().toggleHeaderRow().run(),
        },
        {
          label: 'Toggle header column',
          action: () => editor.chain().focus().toggleHeaderColumn().run(),
        },
      ],
    },
    {
      title: 'Table',
      items: [
        {
          label: 'Delete table',
          action: () => editor.chain().focus().deleteTable().run(),
          destructive: true,
        },
      ],
    },
  ]

  return createPortal(
    <div
      data-note-editor-portal=""
      className="fixed z-50 min-w-48 rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ top: menu.y, left: menu.x }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {sections.map((section) => (
        <div key={section.title} className="py-1">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {section.title}
          </p>
          {section.items.map((item) => (
            <MenuButton
              key={item.label}
              item={item}
              onClose={() => setMenu(null)}
            />
          ))}
        </div>
      ))}
    </div>,
    document.body,
  )
}
