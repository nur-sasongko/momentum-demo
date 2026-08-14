import { useRef } from 'react'

import { cn } from '#/libs/utils'

import type { Header, RowData } from '@tanstack/react-table'

const ARROW_STEP = 8
const ARROW_STEP_LARGE = 32

interface ColumnResizeHandleProps<TData extends RowData, TValue> {
  header: Header<TData, TValue>
  /** Column label, used for the accessible name only. */
  label: string
}

/**
 * Drag + keyboard column-width resizer. Pointer drag delegates to
 * TanStack's `getResizeHandler()`; the keyboard and double-click behavior
 * (arrow-key nudge, `Home`/`Escape`, double-click reset) are not part of
 * TanStack's API and are implemented here.
 */
export function ColumnResizeHandle<TData extends RowData, TValue>({
  header,
  label,
}: ColumnResizeHandleProps<TData, TValue>) {
  const { column, getContext } = header
  const table = getContext().table
  const isResizing = column.getIsResizing()
  const sizeBeforeDrag = useRef(column.getSize())
  const wasResizing = useRef(false)

  if (isResizing && !wasResizing.current) {
    sizeBeforeDrag.current = column.getSize()
  }
  wasResizing.current = isResizing

  const minSize = column.columnDef.minSize ?? 20
  const maxSize = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER

  const setSize = (next: number) => {
    table.setColumnSizing((prev) => ({
      ...prev,
      [column.id]: Math.min(Math.max(next, minSize), maxSize),
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const step = e.shiftKey ? ARROW_STEP_LARGE : ARROW_STEP
      const direction = e.key === 'ArrowLeft' ? -1 : 1
      setSize(column.getSize() + direction * step)
    } else if (e.key === 'Home') {
      e.preventDefault()
      column.resetSize()
    } else if (e.key === 'Escape' && isResizing) {
      e.preventDefault()
      // Ends TanStack's own drag tracking (it listens for mouseup/touchend
      // on `document`), then restores the pre-drag width — cancelling the
      // in-progress drag rather than committing whatever it was at.
      document.dispatchEvent(new MouseEvent('mouseup'))
      if (typeof TouchEvent !== 'undefined') {
        document.dispatchEvent(new TouchEvent('touchend'))
      }
      setSize(sizeBeforeDrag.current)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={Math.round(column.getSize())}
      aria-valuemin={minSize}
      aria-valuemax={maxSize === Number.MAX_SAFE_INTEGER ? undefined : maxSize}
      tabIndex={0}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onDoubleClick={() => column.resetSize()}
      onKeyDown={handleKeyDown}
      className={cn(
        'absolute top-0 right-0 z-10 hidden h-full w-3 translate-x-1/2 cursor-col-resize touch-none select-none md:block',
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border after:transition-colors after:content-['']",
        'hover:after:bg-primary focus-visible:outline-none focus-visible:after:bg-primary',
        isResizing && 'after:bg-primary',
      )}
    />
  )
}
