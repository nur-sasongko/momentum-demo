import { Plus, Search } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { filterNotes, getAllTags } from '../-utils/notes-utils'
import { cn } from '#/libs/utils'
import { NoteListItem } from '#/routes/notes/-components/note-list-item'
import { useNotesStore } from '#/stores/notes-store'

export function NoteList() {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const searchQuery = useNotesStore((s) => s.searchQuery)
  const activeTag = useNotesStore((s) => s.activeTag)
  const addNote = useNotesStore((s) => s.addNote)
  const setSearch = useNotesStore((s) => s.setSearch)
  const setActiveTag = useNotesStore((s) => s.setActiveTag)

  const tags = getAllTags(notes)
  const filteredNotes = filterNotes(notes, searchQuery, activeTag)

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card/30">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Second Brain</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={addNote}
          aria-label="New note"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes..."
            className="pl-9"
            aria-label="Search notes"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeTag === null
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeTag === tag
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notes match your search.
          </p>
        ) : (
          filteredNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={note.id === selectedId}
            />
          ))
        )}
      </div>
    </aside>
  )
}
