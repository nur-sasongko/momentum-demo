import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { NoteEditor } from '#/routes/_authenticated/notes/-components/note-editor'
import { NoteList } from '#/routes/_authenticated/notes/-components/note-list'
import { NotesEmptyState } from '#/routes/_authenticated/notes/-components/notes-empty-state'
import { useIsMobile } from '#/hooks/use-mobile'
import { useNotesStore } from '#/stores/notes-store'

export const Route = createFileRoute('/_authenticated/notes/')({
  head: () => ({
    meta: [{ title: 'Second Brain — Momentum' }],
  }),
  component: NotesPage,
})

function NotesPage() {
  const notes = useNotesStore((s) => s.notes)
  const selectedId = useNotesStore((s) => s.selectedId)
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

  const selectedNote = notes.find((note) => note.id === selectedId) ?? notes[0]

  const handleNoteSelect = () => {
    if (isMobile) setMobileView('editor')
  }

  if (notes.length === 0) {
    return (
      <div className="route-fade-in flex h-[calc(100dvh-3.5rem)] overflow-hidden">
        <NotesEmptyState />
      </div>
    )
  }

  return (
    <div className="route-fade-in flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {(!isMobile || mobileView === 'list') && (
        <NoteList onNoteSelect={handleNoteSelect} />
      )}
      {(!isMobile || mobileView === 'editor') && (
        <NoteEditor
          note={selectedNote}
          onBack={isMobile ? () => setMobileView('list') : undefined}
        />
      )}
    </div>
  )
}
