import type { Editor } from '@tiptap/core'
import { findParentNode } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CellSelection, TableMap } from 'prosemirror-tables'

export type TableAlign = 'left' | 'center' | 'right'

export function insertTableAtRange(
  editor: Editor,
  range: { from: number; to: number },
  rows: number,
  cols: number,
): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertTable({ rows, cols, withHeaderRow: true })
    .run()
}

export function getTableContext(editor: Editor) {
  const table = findParentNode((node) => node.type.name === 'table')(
    editor.state.selection,
  )
  const row = findParentNode((node) => node.type.name === 'tableRow')(
    editor.state.selection,
  )
  const cell = findParentNode((node) =>
    ['tableCell', 'tableHeader'].includes(node.type.name),
  )(editor.state.selection)

  if (!table || !row) {
    return null
  }

  const { $from } = editor.state.selection

  return {
    table,
    row,
    cell,
    rowIndex: $from.index(row.depth),
    cellIndex: cell ? $from.index(cell.depth) : 0,
  }
}

export function setColumnAlignment(editor: Editor, align: TableAlign): void {
  const context = getTableContext(editor)
  if (!context) {
    return
  }

  const { table, cellIndex } = context
  const tableNode = table.node
  const tableMap = TableMap.get(tableNode)
  const positions = new Set<number>()
  const selection = editor.state.selection

  const selectedColumns =
    selection instanceof CellSelection
      ? (() => {
          const anchor = tableMap.findCell(
            selection.$anchorCell.pos - table.start,
          )
          const head = tableMap.findCell(selection.$headCell.pos - table.start)
          const startColumn = Math.min(anchor.left, head.left)
          const endColumn = Math.max(anchor.right, head.right)
          return Array.from(
            { length: endColumn - startColumn },
            (_, index) => startColumn + index,
          )
        })()
      : [cellIndex]

  for (let rowIndex = 0; rowIndex < tableMap.height; rowIndex += 1) {
    for (const columnIndex of selectedColumns) {
      if (columnIndex < 0 || columnIndex >= tableMap.width) {
        continue
      }
      const cellPos = tableMap.positionAt(rowIndex, columnIndex, tableNode)
      positions.add(table.start + cellPos)
    }
  }

  editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      for (const pos of positions) {
        const cellNode = tr.doc.nodeAt(pos)
        if (
          !cellNode ||
          !['tableCell', 'tableHeader'].includes(cellNode.type.name)
        ) {
          continue
        }
        tr.setNodeMarkup(pos, undefined, {
          ...cellNode.attrs,
          align,
        })
      }
      dispatch?.(tr)
      return true
    })
    .run()
}

export function moveTableRow(
  editor: Editor,
  sourceRowIndex: number,
  targetRowIndex: number,
): void {
  if (sourceRowIndex === targetRowIndex) {
    return
  }

  editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const tableMatch = findParentNode((node) => node.type.name === 'table')(
        state.selection,
      )
      if (!tableMatch) {
        return false
      }

      const { node: table, pos: tablePos } = tableMatch
      if (
        sourceRowIndex < 0 ||
        targetRowIndex < 0 ||
        sourceRowIndex >= table.childCount ||
        targetRowIndex >= table.childCount
      ) {
        return false
      }

      const rows: PMNode[] = []
      for (let i = 0; i < table.childCount; i += 1) {
        rows.push(table.child(i))
      }

      const movedRow = rows.splice(sourceRowIndex, 1)[0]
      rows.splice(targetRowIndex, 0, movedRow)

      const newTable = table.type.create(table.attrs, rows)
      tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable)
      dispatch?.(tr)
      return true
    })
    .run()
}
