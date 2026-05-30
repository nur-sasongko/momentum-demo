import { Lock } from 'lucide-react'

import { formatRelativeTime, getExcerpt } from '../-utils/notes-utils'
import { cn } from '#/libs/utils'
import type { Note } from '#/stores/notes-store'
import { useNotesStore } from '#/stores/notes-store'

interface NoteListItemProps {
  note: Note
  isActive: boolean
}

export function NoteListItem({ note, isActive }: NoteListItemProps) {
  const selectNote = useNotesStore((s) => s.selectNote)

  return (
    <button
      type="button"
      onClick={() => selectNote(note.id)}
      className={cn(
        'w-full border-b border-border px-4 py-3 text-left transition-colors',
        isActive ? 'bg-primary/10' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {note.isReadOnly ? (
            <Lock
              className="size-3 shrink-0 text-muted-foreground"
              aria-label="Read-only"
            />
          ) : null}
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
            {note.title || 'Untitled'}
          </h3>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {getExcerpt(note.content) || 'No content yet'}
      </p>
      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
          {note.tags.map((tag) => (
            <span key={tag} className="text-xs text-primary">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
