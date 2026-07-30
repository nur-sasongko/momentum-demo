import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { MarkdownEditor } from './markdown-editor'

interface MarkdownEditorCellProps {
  value: string
  onSave: (next: string) => void
  placeholder?: string
}

/**
 * A table-cell trigger that opens a popover with the shared `MarkdownEditor`
 * for editing, showing a compact rendered preview when closed. Follows the
 * same "click to open a popover with a richer editor" idiom as
 * `DateTimePicker` and `LocationCell` rather than `EditableCell`'s inline
 * overlay-input model, since a toolbar + editor is too tall for that.
 */
export function MarkdownEditorCell({
  value,
  onSave,
  placeholder = 'Add a note…',
}: MarkdownEditorCellProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value)
    } else if (draft !== value) {
      onSave(draft)
    }
    setOpen(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full max-w-64 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
        >
          {value ? (
            <div className="prose prose-sm dark:prose-invert line-clamp-2 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-2 p-2" align="start">
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
