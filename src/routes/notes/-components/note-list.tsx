import { Plus, Search, Settings2, Star } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { filterNotes, getAllTags, isEmptyDoc } from '../-utils/notes-utils'
import { cn } from '#/libs/utils'
import { NoteListItem } from '#/routes/notes/-components/note-list-item'
import { TagManagerDialog } from '#/routes/notes/-components/tag-manager-dialog'
import type { NotesSortBy, TagFilterMode } from '#/stores/notes-store'
import { useNotesStore } from '#/stores/notes-store'

function NoteListItemSkeleton() {
  return (
    <div className="w-full border-b border-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-10 shrink-0" />
      </div>
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-4/5" />
    </div>
  )
}

const SORT_LABELS: Record<NotesSortBy, string> = {
  'updated-desc': 'Last updated',
  'created-desc': 'Recently created',
  'title-asc': 'Title A–Z',
  'title-desc': 'Title Z–A',
}

interface NoteListProps {
  onNoteSelect?: () => void
}

export function NoteList({ onNoteSelect }: NoteListProps) {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const searchQuery = useNotesStore((s) => s.searchQuery)
  const activeTags = useNotesStore((s) => s.activeTags)
  const tagFilterMode = useNotesStore((s) => s.tagFilterMode)
  const untaggedOnly = useNotesStore((s) => s.untaggedOnly)
  const favoritesOnly = useNotesStore((s) => s.favoritesOnly)
  const sortBy = useNotesStore((s) => s.sortBy)
  const addNote = useNotesStore((s) => s.addNote)
  const setSearch = useNotesStore((s) => s.setSearch)
  const setActiveTags = useNotesStore((s) => s.setActiveTags)
  const toggleActiveTag = useNotesStore((s) => s.toggleActiveTag)
  const setTagFilterMode = useNotesStore((s) => s.setTagFilterMode)
  const setUntaggedOnly = useNotesStore((s) => s.setUntaggedOnly)
  const setFavoritesOnly = useNotesStore((s) => s.setFavoritesOnly)
  const setSortBy = useNotesStore((s) => s.setSortBy)

  const [inputValue, setInputValue] = useState(searchQuery)
  const [managerOpen, setManagerOpen] = useState(false)

  const selectedNote = notes.find((n) => n.id === selectedId)
  const isNewNoteActive =
    selectedNote?.title === 'Untitled' && isEmptyDoc(selectedNote.content)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue), 300)
    return () => clearTimeout(timer)
  }, [inputValue, setSearch])

  const isSearching = inputValue !== searchQuery

  const tags = getAllTags(notes)
  const filteredNotes = filterNotes(notes, {
    query: searchQuery,
    activeTags,
    tagFilterMode,
    untaggedOnly,
    favoritesOnly,
    sortBy,
  })

  const handleClearAll = () => {
    setActiveTags([])
    setUntaggedOnly(false)
  }

  const chipClass = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'border border-border text-muted-foreground hover:text-foreground',
    )

  const allActive = activeTags.length === 0 && !untaggedOnly
  const showAndOr = activeTags.length >= 2

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-card/30 md:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Second Brain</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            addNote()
            onNoteSelect?.()
          }}
          aria-label="New note"
          disabled={isNewNoteActive}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Search notes..."
            className="pl-9"
            aria-label="Search notes"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleClearAll}
            className={chipClass(allActive)}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setUntaggedOnly(!untaggedOnly)}
            className={chipClass(untaggedOnly)}
          >
            Untagged
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleActiveTag(tag)}
              className={chipClass(
                activeTags.some((t) => t.toLowerCase() === tag.toLowerCase()),
              )}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showAndOr ? (
            <div
              role="group"
              aria-label="Tag filter mode"
              className="inline-flex overflow-hidden rounded-md border border-border text-xs"
            >
              {(['OR', 'AND'] as TagFilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTagFilterMode(mode)}
                  aria-pressed={tagFilterMode === mode}
                  className={cn(
                    'px-2 py-1 transition-colors',
                    tagFilterMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          ) : null}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            aria-label={
              favoritesOnly ? 'Show all notes' : 'Show favorites only'
            }
            aria-pressed={favoritesOnly}
            className={cn(
              'text-muted-foreground',
              favoritesOnly && 'text-amber-500 hover:text-amber-500',
            )}
          >
            <Star className={cn('size-4', favoritesOnly && 'fill-current')} />
          </Button>

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as NotesSortBy)}
          >
            <SelectTrigger
              size="sm"
              className="ml-auto h-8 text-xs"
              aria-label="Sort notes"
            >
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as NotesSortBy[]).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setManagerOpen(true)}
            aria-label="Manage tags"
            className="text-muted-foreground"
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          Array.from({ length: 5 }, (_, i) => <NoteListItemSkeleton key={i} />)
        ) : filteredNotes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notes match your filters.
          </p>
        ) : (
          filteredNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={note.id === selectedId}
              onSelect={onNoteSelect}
            />
          ))
        )}
      </div>

      <TagManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </aside>
  )
}
