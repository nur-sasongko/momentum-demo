import { Lock, Star } from 'lucide-react'

import { formatRelativeTime } from '../-utils/notes-utils'
import { cn } from '#/libs/utils'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'
import type { NoteSummary } from '#/stores/notes-store'

interface NoteListItemProps {
  note: NoteSummary
  isActive: boolean
  onSelect?: () => void
}

export function NoteListItem({ note, isActive, onSelect }: NoteListItemProps) {
  const { selectNote } = useNotesFilters()

  return (
    <button
      type="button"
      onClick={() => {
        selectNote(note.id)
        onSelect?.()
      }}
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
          {note.isFavorite ? (
            <Star
              className="size-3 shrink-0 fill-current text-amber-500"
              aria-label="Favorited"
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
        {note.excerpt || 'No content yet'}
      </p>
      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
          {[...new Set(note.tags)].map((tag) => (
            <span key={tag} className="text-xs text-primary">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
