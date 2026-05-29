import { Brain, Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { useNotesStore } from '#/stores/notes-store'

export function NotesEmptyState() {
  const addNote = useNotesStore((s) => s.addNote)

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
      <Button onClick={addNote} className="gap-2">
        <Plus className="size-4" />
        Create your first note
      </Button>
    </div>
  )
}
