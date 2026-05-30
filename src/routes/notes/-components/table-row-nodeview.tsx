import type { NodeViewProps } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useRef } from 'react'

import { moveTableRow } from '#/routes/notes/-utils/table-utils'

const DRAG_TYPE = 'application/x-table-row-index'

function getRowIndex(editor: NodeViewProps['editor'], pos: number): number {
  const $pos = editor.state.doc.resolve(pos)
  return $pos.index($pos.depth)
}

export function TableRowNodeView({ editor, getPos }: NodeViewProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    const row = rowRef.current
    if (!row) {
      return
    }

    const firstCell = row.querySelector('td, th')
    if (!firstCell) {
      return
    }

    let dragHandle = firstCell.querySelector('.table-row-drag-handle')
    if (!(dragHandle instanceof HTMLSpanElement)) {
      dragHandle = document.createElement('span')
      dragHandle.className = 'table-row-drag-handle'
      dragHandle.textContent = '⠿'
      dragHandle.setAttribute('contenteditable', 'false')
      dragHandle.draggable = true
      firstCell.insertBefore(dragHandle, firstCell.firstChild)
    }

    const onDragStart = (event: DragEvent) => {
      const pos = getPos()
      if (typeof pos !== 'number') {
        return
      }
      const rowIndex = getRowIndex(editor, pos)
      event.dataTransfer?.setData(DRAG_TYPE, String(rowIndex))
      event.dataTransfer!.effectAllowed = 'move'
    }

    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'move'
    }

    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const sourceIndex = Number.parseInt(
        event.dataTransfer?.getData(DRAG_TYPE) ?? '',
        10,
      )
      const pos = getPos()
      if (Number.isNaN(sourceIndex) || typeof pos !== 'number') {
        return
      }
      const targetIndex = getRowIndex(editor, pos)
      moveTableRow(editor, sourceIndex, targetIndex)
    }

    dragHandle.addEventListener('dragstart', onDragStart)
    row.addEventListener('dragover', onDragOver)
    row.addEventListener('drop', onDrop)

    return () => {
      dragHandle.removeEventListener('dragstart', onDragStart)
      row.removeEventListener('dragover', onDragOver)
      row.removeEventListener('drop', onDrop)
    }
  }, [editor, getPos])

  return (
    <NodeViewWrapper
      as="tr"
      ref={rowRef}
      className="group/table-row table-row-node-view"
    >
      <NodeViewContent />
    </NodeViewWrapper>
  )
}
