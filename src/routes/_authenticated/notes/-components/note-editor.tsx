import type { Editor, JSONContent } from '@tiptap/core'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  Lock,
  Redo2,
  Star,
  Tag,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { UnsavedChangesBar } from '#/components/unsaved-changes-bar'
import { useBeforeUnloadGuard } from '#/hooks/use-beforeunload-guard'
import { cn } from '#/libs/utils'
import { formatTimeSince } from '#/utils/date'
import { noteContentToPlainText } from '../-utils/notes-utils'
import { TagInput } from '#/routes/_authenticated/notes/-components/tag-input'
import { TiptapEditor } from '#/routes/_authenticated/notes/-components/tiptap-editor'
import type { NotesListPage } from '#/routes/_authenticated/notes/-types/notes-query'
import {
  NOTES_KEYS,
  useDeleteNoteMutation,
  useNoteTagsQuery,
  useNotesListParams,
  useUpdateNoteContentMutation,
  useUpdateNoteMetaMutation,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'
import type { Note } from '#/stores/notes-store'

interface NoteEditorProps {
  note: Note
  onBack?: () => void
}

interface Draft {
  title: string
  content: JSONContent
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    JSON.stringify(a.content) === JSON.stringify(b.content)
  )
}

// Portals owned by the editor (slash menu, `[[` link menu, table context
// menu) render outside the pane's DOM subtree, and the delete dialog is a
// Radix portal too — blurring into any of them must not read as "left the
// pane".
const EDITOR_PORTAL_SELECTOR =
  '[data-note-editor-portal], [data-slot="dialog-content"]'

function isWithinEditorSurface(pane: HTMLElement, target: Node): boolean {
  if (pane.contains(target)) return true
  return target instanceof HTMLElement
    ? target.closest(EDITOR_PORTAL_SELECTOR) !== null
    : false
}

export function NoteEditor({ note, onBack }: NoteEditorProps) {
  const { selectNote } = useNotesFilters()
  const tagsQuery = useNoteTagsQuery()
  const tagSuggestions = (tagsQuery.data ?? []).map((t) => t.tag)

  const queryClient = useQueryClient()
  const listParams = useNotesListParams()

  const updateContent = useUpdateNoteContentMutation()
  const updateMeta = useUpdateNoteMetaMutation()
  const deleteNote = useDeleteNoteMutation()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const paneRef = useRef<HTMLElement>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )

  const [draft, setDraft] = useState<Draft>({
    title: note.title,
    content: note.content,
  })
  const draftRef = useRef(draft)
  draftRef.current = draft

  const [savedSnapshot, setSavedSnapshot] = useState<Draft>({
    title: note.title,
    content: note.content,
  })
  const savedSnapshotRef = useRef(savedSnapshot)
  savedSnapshotRef.current = savedSnapshot

  const inFlightRef = useRef<Draft | null>(null)
  const deletedRef = useRef(false)

  const isDirty = !note.isReadOnly && !draftsEqual(draft, savedSnapshot)

  // Baseline both the draft and the saved snapshot against the editor's own
  // post-init JSON, so ProseMirror's parse-time attribute defaults are never
  // mistaken for an edit.
  const handleEditorReady = useCallback((content: JSONContent) => {
    setDraft((d) => ({ ...d, content }))
    setSavedSnapshot((s) => ({ ...s, content }))
  }, [])

  const flush = useCallback(
    (current: Draft) => {
      if (deletedRef.current) return
      if (draftsEqual(current, savedSnapshotRef.current)) return
      if (inFlightRef.current && draftsEqual(current, inFlightRef.current)) {
        return
      }

      inFlightRef.current = current
      setSaveState('saving')
      const plainText = noteContentToPlainText(current.content)
        .replace(/\s+/g, ' ')
        .trim()

      updateContent.mutate(
        {
          id: note.id,
          title: current.title,
          content: current.content,
          plainText,
        },
        {
          onSuccess: () => {
            inFlightRef.current = null
            setSavedSnapshot(current)
            setSaveState('saved')
            window.setTimeout(() => {
              setSaveState((s) => (s === 'saved' ? 'idle' : s))
            }, 2000)
            if (!draftsEqual(draftRef.current, current)) {
              flush(draftRef.current)
            }
          },
          onError: () => {
            inFlightRef.current = null
            setSaveState('idle')
          },
        },
      )
    },
    [note.id, updateContent],
  )

  const handleSaveClick = () => {
    flush(draftRef.current)
    editorRef.current?.commands.focus()
  }

  const handlePaneBlur = (event: FocusEvent<HTMLElement>) => {
    const pane = paneRef.current
    if (!pane) return
    const relatedTarget = event.relatedTarget

    if (relatedTarget !== null) {
      if (
        !(relatedTarget instanceof Node) ||
        !isWithinEditorSurface(pane, relatedTarget)
      ) {
        flush(draftRef.current)
      }
      return
    }

    // `relatedTarget` is null for a click on a non-focusable region or the
    // window itself losing focus — defer and check `document.activeElement`
    // instead of assuming the pane was left.
    window.setTimeout(() => {
      const active = document.activeElement
      if (active && isWithinEditorSurface(pane, active)) return
      flush(draftRef.current)
    }, 0)
  }

  const handlePaneKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const isSaveShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
    if (!isSaveShortcut) return
    event.preventDefault()
    flush(draftRef.current)
  }

  useBeforeUnloadGuard(isDirty)

  // Flush a pending save when switching notes, unmounting, or the tab is
  // closing — never lose the last few keystrokes.
  useEffect(() => {
    const handlePageHide = () => flush(draftRef.current)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      flush(draftRef.current)
      window.removeEventListener('pagehide', handlePageHide)
    }
    // Keyed only to `note.id` — cleanup must fire exactly on note switch or
    // unmount, using the `flush` closure captured for that note.
  }, [note.id])

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo)
    setCanRedo(redo)
  }, [])

  const undoDisabled = note.isReadOnly || !canUndo
  const redoDisabled = note.isReadOnly || !canRedo

  const handleDelete = () => {
    const cached = queryClient.getQueryData<{ pages: NotesListPage[] }>(
      NOTES_KEYS.list(listParams),
    )
    const notes = cached?.pages.flatMap((page) => page.data) ?? []
    const remaining = notes.filter((n) => n.id !== note.id)
    const deletedIndex = notes.findIndex((n) => n.id === note.id)
    const nextId =
      remaining.length > 0
        ? (remaining[Math.min(deletedIndex, remaining.length - 1)]?.id ?? null)
        : null

    deletedRef.current = true
    deleteNote.mutate(note.id)
    selectNote(nextId)
    setConfirmOpen(false)
    toast.success('Note deleted')
  }

  const handleToggleReadOnly = () => {
    const nextReadOnly = !note.isReadOnly
    updateMeta.mutate({ id: note.id, patch: { isReadOnly: nextReadOnly } })
    toast.success(nextReadOnly ? 'Note locked' : 'Note unlocked')
  }

  const handleToggleFavorite = () => {
    updateMeta.mutate({ id: note.id, patch: { isFavorite: !note.isFavorite } })
  }

  const handleTagsChange = (tags: string[]) => {
    updateMeta.mutate({ id: note.id, patch: { tags } })
  }

  const saveIndicator =
    saveState === 'saving'
      ? ' · Saving…'
      : saveState === 'saved'
        ? ' · Saved'
        : isDirty
          ? ' · Unsaved changes'
          : ''

  const showSaveBar = !note.isReadOnly && (isDirty || saveState === 'saving')

  return (
    <section
      ref={paneRef}
      onBlur={handlePaneBlur}
      onKeyDown={handlePaneKeyDown}
      className="relative flex min-w-0 flex-1 flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
          {onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label="Back to notes"
              className="text-muted-foreground"
            >
              <ChevronLeft className="size-4" />
            </Button>
          ) : null}
          <Tag className="size-4 shrink-0" />
          <TagInput
            value={note.tags}
            onChange={handleTagsChange}
            suggestions={tagSuggestions}
            disabled={note.isReadOnly}
          />
          {note.isReadOnly ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Read-only
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={undoDisabled}
            onClick={() => editorRef.current?.chain().focus().undo().run()}
            aria-label="Undo"
            className="text-muted-foreground"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={redoDisabled}
            onClick={() => editorRef.current?.chain().focus().redo().run()}
            aria-label="Redo"
            className="text-muted-foreground"
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleToggleFavorite}
            aria-label={
              note.isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={note.isFavorite}
            className={cn(
              'text-muted-foreground',
              note.isFavorite && 'text-amber-500 hover:text-amber-500',
            )}
          >
            <Star className={cn('size-4', note.isFavorite && 'fill-current')} />
          </Button>
          <Button
            variant={note.isReadOnly ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={handleToggleReadOnly}
            aria-label={note.isReadOnly ? 'Unlock note' : 'Lock note'}
            className="text-muted-foreground"
          >
            {note.isReadOnly ? (
              <Lock className="size-4" />
            ) : (
              <Unlock className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmOpen(true)}
            aria-label="Delete note"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col overflow-y-auto px-6 py-5',
          showSaveBar && 'pb-20',
        )}
      >
        <input
          type="text"
          value={draft.title}
          readOnly={note.isReadOnly}
          onChange={(event) =>
            setDraft((d) => ({ ...d, title: event.target.value }))
          }
          placeholder="Untitled"
          className={cn(
            'w-full border-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground',
            note.isReadOnly && 'cursor-default',
          )}
          aria-label="Note title"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Last edited {formatTimeSince(note.updatedAt)} ago
          {saveIndicator}
        </p>

        <div className="mt-6 flex-1">
          <TiptapEditor
            key={note.id}
            noteId={note.id}
            content={draft.content}
            isReadOnly={note.isReadOnly}
            editorRef={editorRef}
            onHistoryChange={handleHistoryChange}
            onChange={(content) => setDraft((d) => ({ ...d, content }))}
            onReady={handleEditorReady}
          />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              &ldquo;{note.title || 'Untitled'}&rdquo; will be permanently
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showSaveBar ? (
        <UnsavedChangesBar
          state={saveState === 'saving' ? 'saving' : 'dirty'}
          onSave={handleSaveClick}
        />
      ) : null}
    </section>
  )
}
