import type { Editor } from '@tiptap/react'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { flip, offset, shift } from '@floating-ui/dom'
import { GripVertical } from 'lucide-react'

interface BlockDragHandleProps {
  editor: Editor
}

// The note content column is centered (`max-w-[44rem]`) and can sit close
// to the viewport edge on a phone-width screen, leaving no room for a grip
// placed to its left. `shift`/`flip` keep the handle inside the viewport
// instead of overflowing it, which would otherwise push out the scroll
// container's width and create a horizontal scrollbar.
const computePositionConfig = {
  placement: 'left-start' as const,
  middleware: [offset(4), flip(), shift({ padding: 8 })],
}

/**
 * Notion-style grip in the left gutter of the note editor. The underlying
 * `DragHandle` extension positions a portaled element next to whichever
 * top-level block the pointer is over and shows/hides it for us — we only
 * supply the visual grip and drag it. When the current selection is a
 * multi-block range (see the `NodeRange` extension configured alongside
 * this in `tiptap-extensions.ts`) and the handle is grabbed from within
 * that range, the whole range is dragged together instead of the single
 * hovered block.
 */
export function BlockDragHandle({ editor }: BlockDragHandleProps) {
  return (
    <DragHandle
      editor={editor}
      className="note-drag-handle"
      computePositionConfig={computePositionConfig}
    >
      <button type="button" tabIndex={-1} aria-label="Drag to reorder block">
        <GripVertical className="size-4" />
      </button>
    </DragHandle>
  )
}
