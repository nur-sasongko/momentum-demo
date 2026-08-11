import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Columns2,
  Merge,
  Rows2,
  Split,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { TableAlign } from '#/routes/_authenticated/notes/-types/notes-table'
import { setColumnAlignment } from '#/routes/_authenticated/notes/-utils/table-utils'
import { cn } from '#/libs/utils'
import { BubbleMenu } from '@tiptap/react/menus'

interface TableBubbleMenuProps {
  editor: Editor
}

const ALIGN_OPTIONS: { align: TableAlign; label: string; icon: ReactNode }[] = [
  {
    align: 'left',
    label: 'Align left',
    icon: <AlignLeft className="size-4" />,
  },
  {
    align: 'center',
    label: 'Align center',
    icon: <AlignCenter className="size-4" />,
  },
  {
    align: 'right',
    label: 'Align right',
    icon: <AlignRight className="size-4" />,
  },
]

function TableMenuButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          className="size-8 text-foreground"
          onMouseDown={(event) => {
            event.preventDefault()
            if (!disabled) {
              onClick()
            }
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-border" />
}

export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  const [alignOpen, setAlignOpen] = useState(false)
  const alignPopoverRef = useRef<HTMLDivElement>(null)

  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()

  const alignColumn = (align: TableAlign) => {
    setColumnAlignment(editor, align)
    setAlignOpen(false)
  }

  useEffect(() => {
    if (!alignOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAlignOpen(false)
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        alignPopoverRef.current &&
        !alignPopoverRef.current.contains(target)
      ) {
        setAlignOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [alignOpen])

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: currentEditor }) =>
        currentEditor.isActive('table')
      }
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      <TooltipProvider delayDuration={200}>
        <TableMenuButton
          label="Insert row above"
          onClick={() => editor.chain().focus().addRowBefore().run()}
        >
          <ArrowUpToLine className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Insert row below"
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          <ArrowDownToLine className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Delete row"
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          <Rows2 className="size-4" />
        </TableMenuButton>

        <Divider />

        <TableMenuButton
          label="Insert column left"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
        >
          <Columns2 className="size-4 rotate-180" />
        </TableMenuButton>
        <TableMenuButton
          label="Insert column right"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <Columns2 className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Delete column"
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          <Columns2 className="size-4 opacity-50" />
        </TableMenuButton>

        <Divider />

        <TableMenuButton
          label="Merge cells"
          disabled={!canMerge}
          onClick={() => editor.chain().focus().mergeCells().run()}
        >
          <Merge className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Split cell"
          disabled={!canSplit}
          onClick={() => editor.chain().focus().splitCell().run()}
        >
          <Split className="size-4" />
        </TableMenuButton>

        <div ref={alignPopoverRef} className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Align column"
                aria-expanded={alignOpen}
                className="size-8 text-foreground"
                onMouseDown={(event) => {
                  event.preventDefault()
                  setAlignOpen((open) => !open)
                }}
              >
                <AlignLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Align column</TooltipContent>
          </Tooltip>

          {alignOpen ? (
            <div
              role="menu"
              className="absolute top-full left-0 z-50 mt-1 min-w-40 rounded-md border border-border bg-popover p-1 shadow-md"
            >
              {ALIGN_OPTIONS.map(({ align, label, icon }) => (
                <button
                  key={align}
                  type="button"
                  role="menuitem"
                  className={cn(
                    'flex w-full cursor-default items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm outline-hidden',
                    'hover:bg-accent hover:text-accent-foreground',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    alignColumn(align)
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <TableMenuButton
          label="Delete table"
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          <Trash2 className="size-4 text-destructive" />
        </TableMenuButton>
      </TooltipProvider>
    </BubbleMenu>
  )
}
