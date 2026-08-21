import { useState } from 'react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { cn } from '#/libs/utils'
import { TagPicker } from '#/routes/_authenticated/notes/-components/tag-picker'
import {
  addTagsCaseInsensitive,
  canonicalizeTag,
} from '#/routes/_authenticated/notes/-utils/notes-utils'
import { useNoteTagsQuery } from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'
import {
  formatExactTimestamp,
  formatShortDate,
  formatTimeAgo,
} from '#/utils/date'
import type { Note } from '#/stores/notes-store'

interface NoteBylineProps {
  note: Note
  wordCount: number
  saveState: 'idle' | 'saving' | 'saved'
  isDirty: boolean
  onTagsChange: (tags: string[]) => void
}

export function NoteByline({
  note,
  wordCount,
  saveState,
  isDirty,
  onTagsChange,
}: NoteBylineProps) {
  const { toggleActiveTag } = useNotesFilters()
  const tagsQuery = useNoteTagsQuery()
  const counts = tagsQuery.data ?? []
  const [pickerOpen, setPickerOpen] = useState(false)

  const statusLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : isDirty
          ? 'Unsaved changes'
          : null

  const handleToggle = (tag: string) => {
    const isSelected = note.tags.some(
      (t) => t.toLowerCase() === tag.toLowerCase(),
    )
    const next = isSelected
      ? note.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : addTagsCaseInsensitive(note.tags, tag)
    onTagsChange(next)
  }

  const handleCreate = (raw: string) => {
    const canonical = canonicalizeTag(
      raw,
      counts.map((c) => c.tag),
    )
    if (!canonical) return
    onTagsChange(addTagsCaseInsensitive(note.tags, canonical))
    setPickerOpen(false)
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="min-w-0 truncate">
                Edited{' '}
                <span className="tabular">{formatTimeAgo(note.updatedAt)}</span>
                {' · '}
                Created{' '}
                <span className="tabular">
                  {formatShortDate(note.createdAt)}
                </span>
                {' · '}
                <span className="tabular">{wordCount}</span>{' '}
                {wordCount === 1 ? 'word' : 'words'}
              </p>
            </TooltipTrigger>
            <TooltipContent aria-hidden="true">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <span>Created</span>
                <span className="tabular text-right">
                  {formatExactTimestamp(note.createdAt)}
                </span>
                <span>Edited</span>
                <span className="tabular text-right">
                  {formatExactTimestamp(note.updatedAt)}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {statusLabel ? (
          // Not a live region — `UnsavedChangesBar` already owns the
          // `role="status"` announcement for dirty/saving; a second one here
          // would double-announce the same state to screen reader users.
          // Hidden below `sm` — see `025`'s "byline gains a creation date"
          // amendment: below that width the metadata run needs the space
          // `Unsaved changes` would take, and `UnsavedChangesBar` already
          // reports save state on the same screen.
          <span
            data-testid="note-byline-status"
            className="hidden shrink-0 sm:inline"
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {note.tags.length === 0 && note.isReadOnly ? (
          <span className="text-muted-foreground italic">No tags</span>
        ) : (
          [...new Set(note.tags)].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleActiveTag(tag)}
              className="text-primary hover:underline"
            >
              #{tag}
            </button>
          ))
        )}
        {!note.isReadOnly ? (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Add tag"
                className={cn(
                  'text-muted-foreground hover:text-foreground',
                  note.tags.length === 0 && 'italic',
                )}
              >
                {note.tags.length === 0 ? '＋ Add tag' : '＋'}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-3"
              data-note-editor-portal=""
            >
              <TagPicker
                selected={note.tags}
                counts={counts}
                onToggle={handleToggle}
                allowCreate
                onCreate={handleCreate}
              />
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  )
}
