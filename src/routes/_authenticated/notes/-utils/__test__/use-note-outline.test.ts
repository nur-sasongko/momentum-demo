import type { JSONContent } from '@tiptap/core'
import { Editor } from '@tiptap/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { extractOutline } from '../note-outline'
import { createEditorExtensions } from '../tiptap-extensions'
import { useNoteOutline } from '../use-note-outline'

const DOC: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Intro' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Some intro text.' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Code First Development' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Code first body.' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Spec Driven Development' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Spec driven body.' }],
    },
  ],
}

function headingPosition(editor: Editor, ordinal: number): number {
  let seen = 0
  let target = -1
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      seen += 1
      if (seen === ordinal) target = pos + 1
    }
  })
  return target
}

// jsdom always reports zero-sized layout (`getBoundingClientRect`,
// `scrollHeight`, `clientHeight` are all 0), which is exactly the "note
// fits on screen, nothing to scroll" case that broke active-heading
// tracking — `scrollTop` can never move, so the scroll-based updater had no
// signal at all. This suite drives the fix instead: moving the selection.
describe('useNoteOutline — active heading tracks the cursor, not just scroll', () => {
  let editor: Editor

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    editor.destroy()
  })

  it('updates activeIndex when the cursor moves into a later heading with no scrolling involved', async () => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: createEditorExtensions({
        currentNoteId: 'note-1',
        getNotes: () => [],
      }),
      content: DOC,
    })

    const entries = extractOutline(DOC)
    // No scroll container — jsdom's layout is always zero-sized, which
    // would make the scroll-based path degenerate rather than faithfully
    // simulate "nothing to scroll". `current: null` isolates the behavior
    // under test: activeIndex driven purely by selection, independent of
    // scroll measurement.
    const scrollRef: RefObject<HTMLElement | null> = { current: null }

    const { result } = renderHook(() =>
      useNoteOutline(entries, scrollRef, editor),
    )

    const firstHeadingPos = headingPosition(editor, 1)
    act(() => {
      editor.commands.setTextSelection(firstHeadingPos)
    })
    await waitFor(() => {
      expect(result.current.activeIndex).toBe(0)
    })

    const thirdHeadingPos = headingPosition(editor, 3)
    expect(thirdHeadingPos).toBeGreaterThan(-1)

    act(() => {
      editor.commands.setTextSelection(thirdHeadingPos)
    })

    await waitFor(() => {
      expect(result.current.activeIndex).toBe(2)
    })
  })
})
