import type { Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import type { RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'

import { EditorBubbleMenu } from '#/routes/_authenticated/notes/-components/bubble-menu'
import { TableBubbleMenu } from '#/routes/_authenticated/notes/-components/table-bubble-menu'
import { TableContextMenu } from '#/routes/_authenticated/notes/-components/table-context-menu'
import { createEditorExtensions } from '#/routes/_authenticated/notes/-utils/tiptap-extensions'
import { cn } from '#/libs/utils'
import { useNotesStore } from '#/stores/notes-store'

interface TiptapEditorProps {
  noteId: string
  content: JSONContent
  onChange: (content: JSONContent) => void
  onReady?: (content: JSONContent) => void
  onBlur?: () => void
  editorRef?: RefObject<Editor | null>
  onEditorChange?: (editor: Editor | null) => void
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  isReadOnly?: boolean
  className?: string
}

export function TiptapEditor({
  noteId,
  content,
  onChange,
  onReady,
  onBlur,
  editorRef,
  onEditorChange,
  onHistoryChange,
  isReadOnly = false,
  className,
}: TiptapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const extensions = useMemo(
    () =>
      createEditorExtensions({
        currentNoteId: noteId,
        getNotes: () => useNotesStore.getState().linkTargets,
      }),
    [noteId],
  )

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !isReadOnly,
      extensions,
      content,
      editorProps: {
        attributes: {
          class: cn(
            'note-tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[calc(100dvh-16rem)]',
            isReadOnly && 'cursor-default',
            className,
          ),
          'aria-label': 'Note content',
          'aria-readonly': isReadOnly ? 'true' : 'false',
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        if (isReadOnly) {
          return
        }
        onChange(currentEditor.getJSON())
      },
      onCreate: ({ editor: currentEditor }) => {
        onReady?.(currentEditor.getJSON())
      },
      onBlur: () => {
        onBlur?.()
      },
    },
    [noteId],
  )

  // `editorRef` alone can't drive reactive consumers (e.g. the outline's
  // scroll-spy) — mutating a ref never triggers a re-render of whoever
  // reads it, so a parent that reads `editorRef.current` during its own
  // render permanently sees the pre-mount `null` unless something unrelated
  // happens to re-render it later. `onEditorChange` gives those consumers a
  // real state update instead.
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor
    }
    onEditorChange?.(editor)
    return () => {
      if (editorRef) {
        editorRef.current = null
      }
      onEditorChange?.(null)
    }
  }, [editor, editorRef, onEditorChange])

  useEffect(() => {
    if (editor === null || onHistoryChange === undefined) {
      return
    }

    const prev = { canUndo: false, canRedo: false }
    const notify = () => {
      const canUndo = editor.can().undo()
      const canRedo = editor.can().redo()
      if (canUndo !== prev.canUndo || canRedo !== prev.canRedo) {
        prev.canUndo = canUndo
        prev.canRedo = canRedo
        onHistoryChange(canUndo, canRedo)
      }
    }

    notify()
    editor.on('transaction', notify)
    return () => {
      editor.off('transaction', notify)
    }
  }, [editor, onHistoryChange])

  useEffect(() => {
    if (editor === null) {
      return
    }

    editor.setEditable(!isReadOnly)
  }, [editor, isReadOnly])

  if (editor === null) {
    return null
  }

  return (
    <div ref={containerRef} className="relative">
      {!isReadOnly ? (
        <>
          <EditorBubbleMenu editor={editor} />
          <TableBubbleMenu editor={editor} />
          <TableContextMenu editor={editor} containerRef={containerRef} />
        </>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
