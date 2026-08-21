import { Lock, Star } from 'lucide-react'

import { TruncatedText } from '#/components/truncated-text'
import { cn } from '#/libs/utils'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'
import { formatTimeSince } from '#/utils/date'
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
      data-active={isActive}
      onClick={() => {
        selectNote(note.id)
        onSelect?.()
      }}
      className={cn(
        'mx-2 flex w-[calc(100%-1rem)] flex-col rounded-md px-3 py-2.5 text-left transition-colors',
        'not-data-[active=true]:hover:bg-sidebar-accent',
        'data-[active=true]:bg-sidebar-active data-[active=true]:shadow-xs data-[active=true]:ring-1 data-[active=true]:ring-sidebar-border dark:data-[active=true]:shadow-none dark:data-[active=true]:ring-0',
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
              className="size-3 shrink-0 fill-current text-favorite"
              aria-label="Favorited"
            />
          ) : null}
          <TruncatedText
            as="h3"
            className={cn(
              'line-clamp-1 text-sm font-semibold',
              isActive ? 'text-sidebar-active-foreground' : 'text-foreground',
            )}
          >
            {note.title || 'Untitled'}
          </TruncatedText>
        </div>
        <span className="tabular shrink-0 text-xs text-muted-foreground">
          {formatTimeSince(note.updatedAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {note.excerpt || 'No content yet'}
      </p>
      {note.tags.length > 0 && (
        <TruncatedText
          as="p"
          className="mt-2 line-clamp-1 text-xs text-primary"
        >
          {[...new Set(note.tags)].map((tag) => `#${tag}`).join(' ')}
        </TruncatedText>
      )}
    </button>
  )
}
