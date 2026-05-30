import { Lock, Tag, Trash2, Unlock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { cn } from '#/libs/utils'
import { formatRelativeTime } from '../-utils/notes-utils'
import { TiptapEditor } from '#/routes/notes/-components/tiptap-editor'
import type { Note } from '#/stores/notes-store'
import { useNotesStore } from '#/stores/notes-store'

interface NoteEditorProps {
  note: Note
}

export function NoteEditor({ note }: NoteEditorProps) {
  const updateNote = useNotesStore((s) => s.updateNote)
  const deleteNote = useNotesStore((s) => s.deleteNote)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const primaryTag = note.tags.length > 0 ? note.tags[0] : 'Untagged'

  const handleDelete = () => {
    deleteNote(note.id)
    setConfirmOpen(false)
    toast.success('Note deleted')
  }

  const handleToggleReadOnly = () => {
    const nextReadOnly = !note.isReadOnly
    updateNote(note.id, { isReadOnly: nextReadOnly })
    toast.success(nextReadOnly ? 'Note locked' : 'Note unlocked')
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Tag className="size-4" />
          <span>{primaryTag}</span>
          {note.isReadOnly ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Read-only
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={note.isReadOnly ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={handleToggleReadOnly}
            aria-label={note.isReadOnly ? 'Unlock note' : 'Lock note'}
            className="text-muted-foreground"
          >
            {note.isReadOnly ? (
              <Lock className="size-4" />
            ) : (
              <Unlock className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmOpen(true)}
            aria-label="Delete note"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
        <input
          type="text"
          value={note.title}
          readOnly={note.isReadOnly}
          onChange={(event) =>
            updateNote(note.id, { title: event.target.value })
          }
          placeholder="Untitled"
          className={cn(
            'w-full border-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground',
            note.isReadOnly && 'cursor-default',
          )}
          aria-label="Note title"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Last edited {formatRelativeTime(note.updatedAt)} ago
        </p>

        <div className="mt-6 flex-1">
          <TiptapEditor
            key={note.id}
            noteId={note.id}
            content={note.content}
            isReadOnly={note.isReadOnly}
            onChange={(content) => updateNote(note.id, { content })}
          />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              &ldquo;{note.title || 'Untitled'}&rdquo; will be permanently
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
