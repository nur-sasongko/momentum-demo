import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  useDeleteTagMutation,
  useNoteTagsQuery,
  useRenameTagMutation,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import { normalizeTag } from '../-utils/notes-utils'

interface TagManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagManagerDialog({
  open,
  onOpenChange,
}: TagManagerDialogProps) {
  const tagsQuery = useNoteTagsQuery()
  const renameTag = useRenameTagMutation()
  const deleteTag = useDeleteTagMutation()

  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const tagsWithCounts = tagsQuery.data ?? []

  const resetEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const startEdit = (tag: string) => {
    setEditing(tag)
    setEditValue(tag)
    setConfirmDelete(null)
  }

  const commitEdit = () => {
    if (!editing) return
    const next = normalizeTag(editValue)
    if (!next) {
      toast.error('Tag name cannot be empty')
      return
    }
    if (next.toLowerCase() === editing.toLowerCase()) {
      resetEdit()
      return
    }
    renameTag.mutate(
      { oldTag: editing, newTag: next },
      {
        onSuccess: () => toast.success(`Renamed “${editing}” to “${next}”`),
      },
    )
    resetEdit()
  }

  const handleDelete = (tag: string) => {
    if (confirmDelete === tag) {
      deleteTag.mutate(tag, {
        onSuccess: () => toast.success(`Deleted tag “${tag}”`),
      })
      setConfirmDelete(null)
    } else {
      setConfirmDelete(tag)
      setEditing(null)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetEdit()
      setConfirmDelete(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
          <DialogDescription>
            Rename or delete tags across all your notes.
          </DialogDescription>
        </DialogHeader>

        {tagsWithCounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tags yet. Add tags to a note to see them here.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {tagsWithCounts.map(({ tag, noteCount }) => (
              <li
                key={tag}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0"
              >
                {editing === tag ? (
                  <>
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitEdit()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          resetEdit()
                        }
                      }}
                      className="h-8 flex-1"
                      aria-label={`Rename tag ${tag}`}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={commitEdit}
                      aria-label="Save"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={resetEdit}
                      aria-label="Cancel rename"
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {tag}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        <span className="tabular">{noteCount}</span>{' '}
                        {noteCount === 1 ? 'note' : 'notes'}
                      </span>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => startEdit(tag)}
                      aria-label={`Rename ${tag}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size={confirmDelete === tag ? 'sm' : 'icon-sm'}
                      variant={confirmDelete === tag ? 'destructive' : 'ghost'}
                      onClick={() => handleDelete(tag)}
                      aria-label={
                        confirmDelete === tag
                          ? `Confirm delete ${tag}`
                          : `Delete ${tag}`
                      }
                      className={
                        confirmDelete === tag ? '' : 'text-muted-foreground'
                      }
                    >
                      {confirmDelete === tag ? (
                        'Delete?'
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
