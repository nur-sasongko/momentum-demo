import type { Editor } from '@tiptap/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TableContextMenu } from '#/routes/_authenticated/notes/-components/table-context-menu'

function createChain() {
  const chain: Record<string, unknown> = {}
  const methods = [
    'focus',
    'addRowBefore',
    'addRowAfter',
    'deleteRow',
    'addColumnBefore',
    'addColumnAfter',
    'deleteColumn',
    'mergeCells',
    'splitCell',
    'toggleHeaderRow',
    'toggleHeaderColumn',
    'deleteTable',
  ]
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain.run = vi.fn()
  return chain
}

function createEditor() {
  const chain = createChain()
  return {
    isActive: vi.fn(() => true),
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({
      mergeCells: () => true,
      splitCell: () => true,
    })),
  } as unknown as Editor
}

function Wrapper({ editor }: { editor: Editor }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  return (
    <div ref={containerRef}>
      <table>
        <tbody>
          <tr>
            <td data-testid="cell">cell</td>
          </tr>
        </tbody>
      </table>
      <TableContextMenu editor={editor} containerRef={containerRef} />
    </div>
  )
}

function getMenuElement() {
  return document.querySelector<HTMLElement>('[data-note-editor-portal]')
}

function openMenu(x: number, y: number) {
  fireEvent.contextMenu(screen.getByTestId('cell'), {
    clientX: x,
    clientY: y,
  })
}

describe('TableContextMenu dragging', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    vi.stubGlobal('innerWidth', 800)
    vi.stubGlobal('innerHeight', 600)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('updates the menu position while dragging the handle', () => {
    render(<Wrapper editor={createEditor()} />)
    openMenu(50, 50)

    const handle = screen.getByRole('button', { name: /drag to move menu/i })
    fireEvent.mouseDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 40 })

    const menuEl = getMenuElement()
    expect(menuEl?.style.left).toBe('100px')
    expect(menuEl?.style.top).toBe('80px')

    fireEvent.mouseUp(window)
  })

  it('clamps the dragged position to viewport bounds', () => {
    render(<Wrapper editor={createEditor()} />)
    openMenu(50, 50)

    const handle = screen.getByRole('button', { name: /drag to move menu/i })
    fireEvent.mouseDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 5000, clientY: 5000 })

    const menuEl = getMenuElement()
    // innerWidth/Height (800/600) minus the mocked menu size (200/300).
    expect(menuEl?.style.left).toBe('600px')
    expect(menuEl?.style.top).toBe('300px')

    fireEvent.mouseUp(window)
  })

  it('does not close the menu when a drag ends', () => {
    render(<Wrapper editor={createEditor()} />)
    openMenu(50, 50)

    const handle = screen.getByRole('button', { name: /drag to move menu/i })
    fireEvent.mouseDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 40 })
    fireEvent.mouseUp(window)

    // The click that follows the drag's mouseup must be swallowed.
    fireEvent.click(window)
    expect(getMenuElement()).not.toBeNull()

    // A later, unrelated click still dismisses the menu.
    fireEvent.click(window)
    expect(getMenuElement()).toBeNull()
  })

  it('still runs a menu action and closes the menu when clicked without dragging', () => {
    const editor = createEditor()
    render(<Wrapper editor={editor} />)
    openMenu(50, 50)

    const deleteRowButton = screen.getByRole('button', {
      name: 'Delete row',
    })
    fireEvent.mouseDown(deleteRowButton)

    expect(editor.chain).toHaveBeenCalled()
    expect(getMenuElement()).toBeNull()
  })

  it('resets to the new click position when reopened after a drag', () => {
    render(<Wrapper editor={createEditor()} />)
    openMenu(50, 50)

    const handle = screen.getByRole('button', { name: /drag to move menu/i })
    fireEvent.mouseDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 40 })
    fireEvent.mouseUp(window)

    // Consume the drag's suppressed click, then close the menu for real.
    fireEvent.click(window)
    fireEvent.click(window)
    expect(getMenuElement()).toBeNull()

    openMenu(120, 90)
    const menuEl = getMenuElement()
    expect(menuEl?.style.left).toBe('120px')
    expect(menuEl?.style.top).toBe('90px')
  })
})
