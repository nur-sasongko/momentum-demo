import type { Editor } from '@tiptap/core'
import type { ReactNode } from 'react'
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  Strikethrough,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/libs/utils'
import { BubbleMenu } from '@tiptap/react/menus'

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', color: '#fef08a' },
  { label: 'Green', color: '#bbf7d0' },
  { label: 'Blue', color: '#bfdbfe' },
  { label: 'Pink', color: '#fbcfe8' },
]

interface EditorBubbleMenuProps {
  editor: Editor
}

function BubbleMenuButton({
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
      className={cn(
        'size-8 text-foreground',
        active && 'bg-accent text-accent-foreground',
      )}
      onMouseDown={(event) => {
        event.preventDefault()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Enter link URL', previousUrl ?? 'https://')

    if (url === null) {
      return
    }

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

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: currentEditor }) =>
        !currentEditor.state.selection.empty &&
        !currentEditor.isActive('codeBlock') &&
        !currentEditor.isActive('table')
      }
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      <BubbleMenuButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </BubbleMenuButton>
      <BubbleMenuButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </BubbleMenuButton>
      <BubbleMenuButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </BubbleMenuButton>
      <BubbleMenuButton
        label="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="size-4" />
      </BubbleMenuButton>
      <BubbleMenuButton
        label="Link"
        active={editor.isActive('link')}
        onClick={setLink}
      >
        <Link2 className="size-4" />
      </BubbleMenuButton>

      <div className="mx-1 h-6 w-px bg-border" />

      {HIGHLIGHT_COLORS.map(({ label, color }) => (
        <Button
          key={color}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Highlight ${label}`}
          className="size-8"
          onMouseDown={(event) => {
            event.preventDefault()
            editor.chain().focus().toggleHighlight({ color }).run()
          }}
        >
          <span
            className="flex size-4 items-center justify-center rounded-sm border border-border"
            style={{ backgroundColor: color }}
          >
            <Highlighter className="size-3 text-foreground/70" />
          </span>
        </Button>
      ))}
    </BubbleMenu>
  )
}
