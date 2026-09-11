import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns2,
  GripVertical,
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

interface DragOffset {
  x: number
  y: number
}

const ZERO_OFFSET: DragOffset = { x: 0, y: 0 }

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

  const [dragOffset, setDragOffset] = useState<DragOffset>(ZERO_OFFSET)
  const [isDragging, setIsDragging] = useState(false)
  const bubbleMenuRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<HTMLDivElement | null>(null)
  // Synchronous mirrors of the state above, read by the drag move handler
  // and the align popover's outside-pointerdown handler, which close over
  // stale values if they relied on React state instead.
  const dragOffsetRef = useRef<DragOffset>(ZERO_OFFSET)
  const isDraggingRef = useRef(false)
  const wasVisibleRef = useRef(false)

  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()

  const alignColumn = (align: TableAlign) => {
    setColumnAlignment(editor, align)
    setAlignOpen(false)
  }

  const resetDragOffset = () => {
    dragOffsetRef.current = ZERO_OFFSET
    setDragOffset(ZERO_OFFSET)
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
      // A drag in progress (or one just starting on the handle) is not an
      // "outside click" — it must not dismiss the popover.
      if (isDraggingRef.current) {
        return
      }
      const target = event.target
      if (target instanceof Node && dragHandleRef.current?.contains(target)) {
        return
      }
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

  const onHandleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const menuEl = bubbleMenuRef.current
    if (!menuEl) {
      return
    }

    const startX = event.clientX
    const startY = event.clientY
    const startOffset = dragOffsetRef.current

    // The menu's rendered rect already includes the current drag offset;
    // subtract it back out to get floating-ui's un-offset base position,
    // so the offset can be clamped against the viewport directly.
    const rect = menuEl.getBoundingClientRect()
    const baseLeft = rect.left - startOffset.x
    const baseTop = rect.top - startOffset.y
    const width = rect.width
    const height = rect.height

    isDraggingRef.current = true
    setIsDragging(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const minOffsetX = -baseLeft
      const maxOffsetX = Math.max(
        minOffsetX,
        window.innerWidth - width - baseLeft,
      )
      const minOffsetY = -baseTop
      const maxOffsetY = Math.max(
        minOffsetY,
        window.innerHeight - height - baseTop,
      )

      const nextOffset: DragOffset = {
        x: Math.min(Math.max(startOffset.x + deltaX, minOffsetX), maxOffsetX),
        y: Math.min(Math.max(startOffset.y + deltaY, minOffsetY), maxOffsetY),
      }
      dragOffsetRef.current = nextOffset
      setDragOffset(nextOffset)
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <BubbleMenu
      ref={bubbleMenuRef}
      editor={editor}
      shouldShow={({ editor: currentEditor }) => {
        const visible = currentEditor.isActive('table')
        // A fresh appearance (not a re-anchor of an already-visible menu)
        // starts undragged, matching the context menu's "reopen at the new
        // position" behavior.
        if (visible && !wasVisibleRef.current) {
          resetDragOffset()
        }
        wasVisibleRef.current = visible
        return visible
      }}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      }}
    >
      <TooltipProvider delayDuration={200}>
        <div
          ref={dragHandleRef}
          className="note-table-bubble-menu-handle"
          data-dragging={isDragging ? 'true' : undefined}
          role="button"
          aria-label="Drag to move toolbar"
          onMouseDown={onHandleMouseDown}
        >
          <GripVertical className="size-4" />
        </div>
        <Divider />

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
          <Rows2 className="size-4 text-destructive" />
        </TableMenuButton>

        <Divider />

        <TableMenuButton
          label="Insert column left"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
        >
          <ArrowLeftToLine className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Insert column right"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <ArrowRightToLine className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Delete column"
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          <Columns2 className="size-4 opacity-50 text-destructive" />
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
