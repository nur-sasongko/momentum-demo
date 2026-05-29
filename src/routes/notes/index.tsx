import { createFileRoute } from '@tanstack/react-router'

import { NoteEditor } from '#/routes/notes/-components/note-editor'
import { NoteList } from '#/routes/notes/-components/note-list'
import { NotesEmptyState } from '#/routes/notes/-components/notes-empty-state'
import { useNotesStore } from '#/stores/notes-store'

export const Route = createFileRoute('/notes/')({
  head: () => ({
    meta: [{ title: 'Second Brain — MySpace' }],
  }),
  component: NotesPage,
})

function NotesPage() {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)

  const selectedNote =
    notes.find((note) => note.id === selectedId) ?? notes[0]

  if (notes.length === 0) {
    return (
      <div className="route-fade-in flex h-[calc(100dvh-3.5rem)] overflow-hidden">
        <NotesEmptyState />
      </div>
    )
  }

  return (
    <div className="route-fade-in flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      <NoteList />
      <NoteEditor note={selectedNote} />
    </div>
  )
}
