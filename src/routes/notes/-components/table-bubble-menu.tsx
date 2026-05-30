import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Columns2,
  Merge,
  Rows2,
  Split,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { TableAlign } from '#/routes/notes/-utils/table-utils'
import { setColumnAlignment } from '#/routes/notes/-utils/table-utils'
import { BubbleMenu } from '@tiptap/react/menus'

interface TableBubbleMenuProps {
  editor: Editor
}

function TableMenuButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          className="size-8 text-foreground"
          onMouseDown={(event) => {
            event.preventDefault()
            if (!disabled) {
              onClick()
            }
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-border" />
}

export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  const [alignOpen, setAlignOpen] = useState(false)

  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()

  const alignColumn = (align: TableAlign) => {
    setColumnAlignment(editor, align)
    setAlignOpen(false)
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: currentEditor }) =>
        currentEditor.isActive('table')
      }
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      <TooltipProvider delayDuration={200}>
        <TableMenuButton
          label="Insert row above"
          onClick={() => editor.chain().focus().addRowBefore().run()}
        >
          <ArrowUpToLine className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Insert row below"
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          <ArrowDownToLine className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Delete row"
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          <Rows2 className="size-4" />
        </TableMenuButton>

        <Divider />

        <TableMenuButton
          label="Insert column left"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
        >
          <Columns2 className="size-4 rotate-180" />
        </TableMenuButton>
        <TableMenuButton
          label="Insert column right"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <Columns2 className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Delete column"
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          <Columns2 className="size-4 opacity-50" />
        </TableMenuButton>

        <Divider />

        <TableMenuButton
          label="Merge cells"
          disabled={!canMerge}
          onClick={() => editor.chain().focus().mergeCells().run()}
        >
          <Merge className="size-4" />
        </TableMenuButton>
        <TableMenuButton
          label="Split cell"
          disabled={!canSplit}
          onClick={() => editor.chain().focus().splitCell().run()}
        >
          <Split className="size-4" />
        </TableMenuButton>

        <DropdownMenu open={alignOpen} onOpenChange={setAlignOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Align column"
              className="size-8 text-foreground"
              onMouseDown={(event) => event.preventDefault()}
            >
              <AlignLeft className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => alignColumn('left')}>
              <AlignLeft className="size-4" />
              Align left
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => alignColumn('center')}>
              <AlignCenter className="size-4" />
              Align center
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => alignColumn('right')}>
              <AlignRight className="size-4" />
              Align right
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TableMenuButton
          label="Delete table"
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          <Trash2 className="size-4 text-destructive" />
        </TableMenuButton>
      </TooltipProvider>
    </BubbleMenu>
  )
}
