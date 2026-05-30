import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isEditableKeyboardTarget,
  shouldIgnoreSidebarKeyboardShortcut,
  SidebarProvider,
  useSidebar,
} from '#/components/ui/sidebar'

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function SidebarStateProbe() {
  const { open } = useSidebar()

  return <div data-testid="sidebar-open">{String(open)}</div>
}

function dispatchSidebarShortcut(
  target: EventTarget = window,
  options?: { defaultPrevented?: boolean },
) {
  const event = new KeyboardEvent('keydown', {
    key: 'b',
    metaKey: true,
    bubbles: true,
    cancelable: true,
  })

  if (options?.defaultPrevented) {
    event.preventDefault()
  }

  target.dispatchEvent(event)

  return event
}

describe('shouldIgnoreSidebarKeyboardShortcut', () => {
  it('ignores shortcuts when defaultPrevented is true', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
      cancelable: true,
    })
    event.preventDefault()

    expect(shouldIgnoreSidebarKeyboardShortcut(event)).toBe(true)
  })

  it('ignores shortcuts from input targets', () => {
    const input = document.createElement('input')
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
    })
    Object.defineProperty(event, 'target', { value: input })

    expect(shouldIgnoreSidebarKeyboardShortcut(event)).toBe(true)
  })

  it('ignores shortcuts from textarea targets', () => {
    const textarea = document.createElement('textarea')
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
    })
    Object.defineProperty(event, 'target', { value: textarea })

    expect(shouldIgnoreSidebarKeyboardShortcut(event)).toBe(true)
  })

  it('ignores shortcuts from contenteditable targets', () => {
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', 'true')
    const paragraph = document.createElement('p')
    editor.appendChild(paragraph)

    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
    })
    Object.defineProperty(event, 'target', { value: paragraph })

    expect(isEditableKeyboardTarget(paragraph)).toBe(true)
    expect(shouldIgnoreSidebarKeyboardShortcut(event)).toBe(true)
  })

  it('allows shortcuts from non-editable targets', () => {
    const button = document.createElement('button')
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
    })
    Object.defineProperty(event, 'target', { value: button })

    expect(shouldIgnoreSidebarKeyboardShortcut(event)).toBe(false)
  })
})

describe('SidebarProvider keyboard shortcut', () => {
  beforeEach(() => {
    mockMatchMedia()
  })

  it('toggles the sidebar on Cmd/Ctrl+B outside editable targets', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarStateProbe />
      </SidebarProvider>,
    )

    expect(screen.getByTestId('sidebar-open').textContent).toBe('true')

    act(() => {
      dispatchSidebarShortcut()
    })

    expect(screen.getByTestId('sidebar-open').textContent).toBe('false')
  })

  it('does not toggle the sidebar from input targets', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarStateProbe />
        <input data-testid="title-input" />
      </SidebarProvider>,
    )

    const input = screen.getByTestId('title-input')
    input.focus()

    fireEvent.keyDown(input, { key: 'b', metaKey: true })

    expect(screen.getByTestId('sidebar-open').textContent).toBe('true')
  })

  it('does not toggle the sidebar from contenteditable targets', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarStateProbe />
        <div
          contentEditable
          suppressContentEditableWarning
          data-testid="editor"
        />
      </SidebarProvider>,
    )

    const editor = screen.getByTestId('editor')
    editor.focus()

    fireEvent.keyDown(editor, { key: 'b', metaKey: true })

    expect(screen.getByTestId('sidebar-open').textContent).toBe('true')
  })

  it('does not toggle the sidebar when the event was already handled', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarStateProbe />
      </SidebarProvider>,
    )

    act(() => {
      dispatchSidebarShortcut(window, { defaultPrevented: true })
    })

    expect(screen.getByTestId('sidebar-open').textContent).toBe('true')
  })
})
