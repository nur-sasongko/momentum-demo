import { useQueryClient } from '@tanstack/react-query'
import { Archive, Plus, Search, Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useIsClipped } from '#/components/truncated-text'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { ArchivedNotesSheet } from '#/routes/_authenticated/notes/-components/archived-notes-sheet'
import { NoteListItem } from '#/routes/_authenticated/notes/-components/note-list-item'
import { NotesFilterPopover } from '#/routes/_authenticated/notes/-components/notes-filter-popover'
import { TagManagerDialog } from '#/routes/_authenticated/notes/-components/tag-manager-dialog'
import {
  buildEmptyNote,
  seedOptimisticNote,
  useArchivedNotesCountQuery,
  useCreateNoteMutation,
  useNotesListParams,
  useNotesListQuery,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'

const VISIBLE_ACTIVE_FILTERS = 3

function NoteListItemSkeleton() {
  return (
    <div className="mx-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-10 shrink-0" />
      </div>
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-4/5" />
    </div>
  )
}

/**
 * The token itself is the tooltip's trigger (not just the truncated label
 * inside it), so a keyboard user tabbing onto it — not just a mouse hovering
 * it — sees the peek. Armed only when the label is actually clipped, per
 * `025`'s "Truncated text peeks with a tooltip, not a `title`" amendment.
 */
function ActiveFilterTokenButton({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  const labelRef = useRef<HTMLSpanElement>(null)
  const isClipped = useIsClipped(labelRef)

  const button = (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex min-w-0 max-w-32 shrink items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:text-foreground"
    >
      <span ref={labelRef} className="truncate">
        {label}
      </span>
      <X className="size-3 shrink-0" />
    </button>
  )

  if (!isClipped) return button

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent aria-hidden="true">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ActiveFilterToken {
  key: string
  label: string
  onRemove: () => void
}

interface NoteListProps {
  onNoteSelect?: () => void
}

export function NoteList({ onNoteSelect }: NoteListProps) {
  const {
    selectedId,
    selectNote,
    searchQuery,
    activeTags,
    untaggedOnly,
    favoritesOnly,
    setSearch,
    toggleActiveTag,
    setUntaggedOnly,
    setFavoritesOnly,
    clearAllFilters,
  } = useNotesFilters()

  const [inputValue, setInputValue] = useState(searchQuery)
  const [managerOpen, setManagerOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const debouncedInput = useDebouncedValue(inputValue, 300)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const createNote = useCreateNoteMutation()
  const params = useNotesListParams()
  const listQuery = useNotesListQuery(params)
  const archivedCountQuery = useArchivedNotesCountQuery()

  useEffect(() => {
    // Skip the no-op write on mount (and after the URL already caught up) —
    // navigating to an unchanged URL makes the router re-run the loader.
    if (debouncedInput === searchQuery) return
    setSearch(debouncedInput)
  }, [debouncedInput, searchQuery, setSearch])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQuery
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const notes = listQuery.data?.pages.flatMap((page) => page.data) ?? []
  const selectedNote = notes.find((n) => n.id === selectedId)
  const isNewNoteActive =
    selectedNote?.title === 'Untitled' && selectedNote.excerpt === ''
  const isInitialLoading = listQuery.isPending

  const handleCreate = () => {
    const note = buildEmptyNote()
    seedOptimisticNote(queryClient, note)
    selectNote(note.id)
    createNote.mutate(note)
    onNoteSelect?.()
  }

  const tokens: ActiveFilterToken[] = [
    ...activeTags.map((tag) => ({
      key: `tag:${tag}`,
      label: `#${tag}`,
      onRemove: () => toggleActiveTag(tag),
    })),
    ...(untaggedOnly
      ? [
          {
            key: 'untagged',
            label: 'Untagged',
            onRemove: () => setUntaggedOnly(false),
          },
        ]
      : []),
    ...(favoritesOnly
      ? [
          {
            key: 'favorites',
            label: 'Favourites',
            onRemove: () => setFavoritesOnly(false),
          },
        ]
      : []),
  ]
  const visibleTokens = tokens.slice(0, VISIBLE_ACTIVE_FILTERS)
  const overflowCount = tokens.length - visibleTokens.length

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-sidebar md:w-80">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 max-h-12">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Search notes…"
            className="pl-9"
            aria-label="Search notes"
          />
        </div>
        <NotesFilterPopover />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCreate}
          aria-label="New note"
          disabled={isNewNoteActive}
          className="shrink-0 text-muted-foreground"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {tokens.length > 0 ? (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {visibleTokens.map((token) => (
              <ActiveFilterTokenButton
                key={token.key}
                label={token.label}
                onRemove={token.onRemove}
              />
            ))}
            {overflowCount > 0 ? (
              <span className="shrink-0 text-muted-foreground">
                +{overflowCount}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={clearAllFilters}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto py-1">
        {isInitialLoading ? (
          Array.from({ length: 5 }, (_, i) => <NoteListItemSkeleton key={i} />)
        ) : notes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notes match your filters.
          </p>
        ) : (
          <>
            {notes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={note.id === selectedId}
                onSelect={onNoteSelect}
              />
            ))}
            <div ref={sentinelRef} />
            {isFetchingNextPage
              ? Array.from({ length: 3 }, (_, i) => (
                  <NoteListItemSkeleton key={`next-${i}`} />
                ))
              : null}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t border-border px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setArchiveOpen(true)}
          className="gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Archive className="size-3.5" />
          <span>
            Archive
            {archivedCountQuery.data ? (
              <span className="tabular"> ({archivedCountQuery.data})</span>
            ) : null}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setManagerOpen(true)}
          className="ml-auto gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          Tags
        </Button>
      </div>

      <TagManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
      <ArchivedNotesSheet open={archiveOpen} onOpenChange={setArchiveOpen} />
    </aside>
  )
}
