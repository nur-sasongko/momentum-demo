import type { Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import type { RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'

import { EditorBubbleMenu } from '#/routes/notes/-components/bubble-menu'
import { TableBubbleMenu } from '#/routes/notes/-components/table-bubble-menu'
import { TableContextMenu } from '#/routes/notes/-components/table-context-menu'
import { createEditorExtensions } from '#/routes/notes/-utils/tiptap-extensions'
import { cn } from '#/libs/utils'
import { useNotesStore } from '#/stores/notes-store'

interface TiptapEditorProps {
  noteId: string
  content: JSONContent
  onChange: (content: JSONContent) => void
  editorRef?: RefObject<Editor | null>
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  isReadOnly?: boolean
  className?: string
}

export function TiptapEditor({
  noteId,
  content,
  onChange,
  editorRef,
  onHistoryChange,
  isReadOnly = false,
  className,
}: TiptapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const extensions = useMemo(
    () =>
      createEditorExtensions({
        currentNoteId: noteId,
        getNotes: () => useNotesStore.getState().notes,
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
    },
    [noteId],
  )

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor
    }
    return () => {
      if (editorRef) {
        editorRef.current = null
      }
    }
  }, [editor, editorRef])

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

  useEffect(() => {
    if (editor === null) {
      return
    }

    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(content)

    if (current !== next) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor, noteId])

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
