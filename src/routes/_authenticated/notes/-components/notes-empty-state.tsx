import { useQueryClient } from '@tanstack/react-query'
import { Brain, Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  buildEmptyNote,
  seedOptimisticNote,
  useCreateNoteMutation,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'

export function NotesEmptyState() {
  const queryClient = useQueryClient()
  const { selectNote } = useNotesFilters()
  const createNote = useCreateNoteMutation()

  const handleCreate = () => {
    const note = buildEmptyNote()
    seedOptimisticNote(queryClient, note)
    selectNote(note.id)
    createNote.mutate(note)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
        <Brain className="size-10 text-primary" />
      </div>
      <div className="max-w-sm space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Your second brain is empty
        </h2>
        <p className="text-sm text-muted-foreground">
          Capture ideas, reading notes, and plans in one place. Everything saves
          automatically.
        </p>
      </div>
      <Button onClick={handleCreate} className="gap-2">
        <Plus className="size-4" />
        Create your first note
      </Button>
    </div>
  )
}
