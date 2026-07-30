import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Link2, List, ListOrdered } from 'lucide-react'
import { useEffect } from 'react'
import { Markdown } from 'tiptap-markdown'

import { Button } from '#/components/ui/button'
import { cn } from '#/libs/utils'

import type { Editor } from '@tiptap/core'
import type { ReactNode } from 'react'
import type { MarkdownStorage } from 'tiptap-markdown'

// tiptap-markdown ships no ambient `Storage` augmentation for `editor.storage.markdown`.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage
  }
}

interface MarkdownEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function ToolbarButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      className={cn('size-7', active && 'bg-accent text-accent-foreground')}
      onMouseDown={(event) => {
        event.preventDefault()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}

function setLink(editor: Editor) {
  const previousUrl = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('Enter link URL', previousUrl ?? 'https://')

  if (url === null) return

  if (url.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: url.trim() })
    .run()
}

/**
 * A small standalone markdown editor: live WYSIWYG editing (bold, italic,
 * lists, links) backed by TipTap, round-tripping plain markdown text via
 * `tiptap-markdown` rather than storing ProseMirror JSON or HTML.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
}: MarkdownEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Add a note…' }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        linkify: false,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class:
          'prose prose-sm dark:prose-invert min-h-[8.5rem] max-w-none rounded-b-md border border-t-0 px-3 py-2 focus:outline-none',
        'aria-label': placeholder ?? 'Note',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.storage.markdown.getMarkdown())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.storage.markdown.getMarkdown()
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-0.5 rounded-t-md border-b bg-muted/40 px-1 py-1">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor.isActive('link')}
          onClick={() => setLink(editor)}
        >
          <Link2 className="size-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
