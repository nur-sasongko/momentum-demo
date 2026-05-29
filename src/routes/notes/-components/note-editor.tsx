import { Eye, EyeOff, Tag, Trash2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { formatRelativeTime } from '#/lib/notes-utils'
import { MarkdownPreview } from '#/routes/notes/-components/markdown-preview'
import type { Note } from '#/stores/notes-store'
import { useNotesStore } from '#/stores/notes-store'

interface NoteEditorProps {
  note: Note
}

export function NoteEditor({ note }: NoteEditorProps) {
  const isPreview = useNotesStore((s) => s.isPreview)
  const updateNote = useNotesStore((s) => s.updateNote)
  const deleteNote = useNotesStore((s) => s.deleteNote)
  const togglePreview = useNotesStore((s) => s.togglePreview)

  const primaryTag = note.tags.length > 0 ? note.tags[0] : 'Untagged'

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Tag className="size-4" />
          <span>{primaryTag}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={isPreview ? 'secondary' : 'ghost'}
            size="sm"
            onClick={togglePreview}
            className="gap-1.5"
          >
            {isPreview ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            Preview
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => deleteNote(note.id)}
            aria-label="Delete note"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
        <input
          type="text"
          value={note.title}
          onChange={(event) =>
            updateNote(note.id, { title: event.target.value })
          }
          placeholder="Untitled"
          className="w-full border-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Note title"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Last edited {formatRelativeTime(note.updatedAt)} ago
        </p>

        <div className="mt-6 flex-1">
          {isPreview ? (
            <MarkdownPreview content={note.body} />
          ) : (
            <Textarea
              value={note.body}
              onChange={(event) =>
                updateNote(note.id, { body: event.target.value })
              }
              placeholder="Write in Markdown..."
              className="min-h-[calc(100dvh-16rem)] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              aria-label="Note body"
            />
          )}
        </div>
      </div>
    </section>
  )
}
