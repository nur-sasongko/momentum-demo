import type { Editor, JSONContent } from '@tiptap/core'
import { render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TiptapEditor } from '../tiptap-editor'

const DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
}

function Harness({
  onEditorChange,
}: {
  onEditorChange: (editor: Editor | null) => void
}) {
  const editorRef = useRef<Editor | null>(null)
  return (
    <TiptapEditor
      noteId="note-1"
      content={DOC}
      onChange={() => {}}
      editorRef={editorRef}
      onEditorChange={onEditorChange}
    />
  )
}

// Regression test: `note-editor.tsx` used to read `editorRef.current`
// directly during render to feed the outline's scroll-spy hook. Mutating a
// ref never re-renders whoever reads it, so unless something unrelated
// happened to re-render `NoteEditor` afterward, the outline's `editor`
// argument stayed `null` forever and its active-heading tracking never
// worked. `onEditorChange` exists specifically so mounting reliably surfaces
// the editor as a real state update, with no interaction required.
describe('TiptapEditor — onEditorChange', () => {
  it('fires with the live editor instance once mounted, with no interaction required', async () => {
    const onEditorChange = vi.fn()
    render(<Harness onEditorChange={onEditorChange} />)

    await waitFor(() => {
      expect(onEditorChange).toHaveBeenCalled()
      const [lastCall] = onEditorChange.mock.calls.at(-1) as [Editor | null]
      expect(lastCall).toBeTruthy()
    })

    const [editor] = onEditorChange.mock.calls.at(-1) as [Editor]
    expect(editor.view.dom).toBeTruthy()
  })

  it('fires with null on unmount', async () => {
    const onEditorChange = vi.fn()
    const { unmount } = render(<Harness onEditorChange={onEditorChange} />)

    await waitFor(() => {
      expect(onEditorChange).toHaveBeenCalled()
      const [lastCall] = onEditorChange.mock.calls.at(-1) as [Editor | null]
      expect(lastCall).toBeTruthy()
    })

    unmount()

    expect(onEditorChange).toHaveBeenLastCalledWith(null)
  })
})
