import type { Editor, JSONContent } from '@tiptap/core'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TiptapEditor } from '#/routes/_authenticated/notes/-components/tiptap-editor'

// jsdom implements no layout, so `Range.getClientRects`/`getBoundingClientRect`
// don't exist at all — ProseMirror calls them to translate a doc position
// (e.g. the table selection the bubble menu anchors to) into screen
// coordinates. Stub them to empty/zero rects, same as most real browsers
// would return for a range jsdom can't lay out anyway.
Range.prototype.getBoundingClientRect = () => ({
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
})
Range.prototype.getClientRects = () =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  }) as unknown as DOMRectList

const TABLE_DOC: JSONContent = {
  type: 'doc',
  content: [
    // A leading paragraph gives the doc a valid non-table text position, so
    // a test can move the selection "outside" the table at all — a doc that
    // is only a table has no such position.
    { type: 'paragraph', content: [{ type: 'text', text: 'Before table' }] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'A1' }] },
              ],
            },
            {
              type: 'tableCell',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'B1' }] },
              ],
            },
          ],
        },
      ],
    },
  ],
}

function Harness({ onEditor }: { onEditor: (editor: Editor | null) => void }) {
  const editorRef = useRef<Editor | null>(null)
  return (
    <TiptapEditor
      noteId="note-bubble-menu-test"
      content={TABLE_DOC}
      onChange={() => {}}
      editorRef={editorRef}
      onEditorChange={onEditor}
    />
  )
}

function firstTableCellPos(editor: Editor) {
  const positions: number[] = []
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === 'tableCell') {
      positions.push(nodePos)
    }
    return positions.length === 0
  })
  if (positions.length === 0) {
    throw new Error('No tableCell found in document')
  }
  return positions[0]
}

function countTableRows(editor: Editor) {
  let count = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'tableRow') {
      count += 1
    }
    return true
  })
  return count
}

async function renderInsideTableCell() {
  let capturedEditor: Editor | null = null
  const { container } = render(
    <Harness
      onEditor={(editor) => {
        capturedEditor = editor
      }}
    />,
  )

  await waitFor(() => expect(capturedEditor).not.toBeNull())
  const editor = capturedEditor as unknown as Editor

  const cellPos = firstTableCellPos(editor)
  act(() => {
    // +2 clears the cell's own node boundary and the paragraph inside it,
    // landing the selection at the start of the cell's text content.
    editor.commands.setTextSelection(cellPos + 2)
  })

  await waitFor(() => expect(editor.isActive('table')).toBe(true))

  const getHandle = () =>
    container.querySelector<HTMLElement>('[aria-label="Drag to move toolbar"]')

  await waitFor(() => expect(getHandle()).not.toBeNull())

  const handle = getHandle() as HTMLElement
  const menuEl = handle.closest<HTMLElement>('.flex.items-center')
  if (!menuEl) {
    throw new Error('Bubble menu root not found')
  }
  // Only the bubble menu's own element gets a fixed rect — stubbing
  // `getBoundingClientRect` on the whole `HTMLElement.prototype` breaks
  // ProseMirror's internal cursor-position math (it starts calling
  // `document.elementFromPoint`, which jsdom doesn't implement).
  vi.spyOn(menuEl, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 40,
    top: 100,
    left: 100,
    bottom: 140,
    right: 500,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  })

  return {
    editor,
    container,
    menuEl,
    getHandle: () => getHandle() as HTMLElement,
  }
}

describe('TableBubbleMenu dragging', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 800)
    vi.stubGlobal('innerHeight', 600)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('applies a transform offset while dragging the handle', async () => {
    const { getHandle, menuEl } = await renderInsideTableCell()

    fireEvent.mouseDown(getHandle(), { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 40 })

    expect(menuEl.style.transform).toBe('translate(50px, 30px)')

    fireEvent.mouseUp(window)
  })

  it('clamps the offset to viewport bounds', async () => {
    const { getHandle, menuEl } = await renderInsideTableCell()

    fireEvent.mouseDown(getHandle(), { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 5000, clientY: 5000 })

    // Mocked rect: left 100, width 400, innerWidth 800 -> max left is 400,
    // so the max offset is 300; top 100, height 40, innerHeight 600 -> max
    // top is 560, so the max offset is 460.
    expect(menuEl.style.transform).toBe('translate(300px, 460px)')

    fireEvent.mouseUp(window)
  })

  it('does not close the align popover when a drag ends over it', async () => {
    const { getHandle, container } = await renderInsideTableCell()

    const alignButton = container.querySelector<HTMLElement>(
      '[aria-label="Align column"]',
    )
    if (!alignButton) {
      throw new Error('Align column button not found')
    }
    fireEvent.mouseDown(alignButton)
    expect(alignButton.getAttribute('aria-expanded')).toBe('true')

    const handle = getHandle()
    // A real drag-initiating press fires `pointerdown` before `mousedown`;
    // the align popover's outside-pointerdown listener must ignore it
    // because the target is the drag handle.
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.mouseDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 20, clientY: 20 })
    fireEvent.mouseUp(window)

    expect(alignButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('still runs a toolbar action when clicked without dragging', async () => {
    const { editor, container } = await renderInsideTableCell()
    const rowsBefore = countTableRows(editor)

    const insertRowButton = container.querySelector<HTMLElement>(
      '[aria-label="Insert row below"]',
    )
    if (!insertRowButton) {
      throw new Error('Insert row below button not found')
    }

    fireEvent.mouseDown(insertRowButton)

    expect(countTableRows(editor)).toBe(rowsBefore + 1)
  })

  it('resets the offset when the selection leaves and re-enters the table', async () => {
    const { editor, getHandle, menuEl } = await renderInsideTableCell()

    fireEvent.mouseDown(getHandle(), { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 40 })
    fireEvent.mouseUp(window)
    expect(menuEl.style.transform).toBe('translate(50px, 30px)')

    act(() => {
      // Position 1: inside the leading "Before table" paragraph.
      editor.commands.setTextSelection(1)
    })
    await waitFor(() => expect(editor.isActive('table')).toBe(false))

    const cellPos = firstTableCellPos(editor)
    act(() => {
      editor.commands.setTextSelection(cellPos + 2)
    })
    await waitFor(() => expect(editor.isActive('table')).toBe(true))

    await waitFor(() => {
      expect(menuEl.style.transform).toBe('translate(0px, 0px)')
    })
  })
})
