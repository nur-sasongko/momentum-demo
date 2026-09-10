import type { Editor, JSONContent } from '@tiptap/core'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  Download,
  EllipsisVertical,
  Loader2,
  Lock,
  Redo2,
  Star,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '#/components/confirm-dialog'
import { TruncatedText } from '#/components/truncated-text'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { UnsavedChangesBar } from '#/components/unsaved-changes-bar'
import { useBeforeUnloadGuard } from '#/hooks/use-beforeunload-guard'
import { cn } from '#/libs/utils'
import { getRedoShortcutLabel, getUndoShortcutLabel } from '#/utils/platform'
import { countWords, noteContentToPlainText } from '../-utils/notes-utils'
import { NoteByline } from '#/routes/_authenticated/notes/-components/note-byline'
import {
  NoteOutline,
  NoteOutlineMobileMenu,
} from '#/routes/_authenticated/notes/-components/note-outline'
import { TiptapEditor } from '#/routes/_authenticated/notes/-components/tiptap-editor'
import type { NotesListPage } from '#/routes/_authenticated/notes/-types/notes-query'
import { exportNoteToPdf } from '#/routes/_authenticated/notes/-utils/export-note-pdf'
import { extractOutline } from '#/routes/_authenticated/notes/-utils/note-outline'
import {
  NOTES_KEYS,
  useArchiveNoteMutation,
  useNotesListParams,
  useRestoreNoteMutation,
  useUpdateNoteContentMutation,
  useUpdateNoteMetaMutation,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNoteOutline } from '#/routes/_authenticated/notes/-utils/use-note-outline'
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

function computeWordCount(content: JSONContent): number {
  return countWords(noteContentToPlainText(content))
}

// Portals owned by the editor (slash menu, `[[` link menu, table context
// menu, the tag picker, the overflow menu, the mobile outline FAB) render
// outside the pane's DOM subtree, and the archive confirm dialog is a Radix
// portal too — blurring into any of them must not read as "left the pane".
const EDITOR_PORTAL_SELECTOR =
  '[data-note-editor-portal], [data-slot="alert-dialog-content"]'

function isWithinEditorSurface(pane: HTMLElement, target: Node): boolean {
  if (pane.contains(target)) return true
  return target instanceof HTMLElement
    ? target.closest(EDITOR_PORTAL_SELECTOR) !== null
    : false
}

export function NoteEditor({ note, onBack }: NoteEditorProps) {
  const { selectNote } = useNotesFilters()

  const queryClient = useQueryClient()
  const listParams = useNotesListParams()

  const updateContent = useUpdateNoteContentMutation()
  const updateMeta = useUpdateNoteMetaMutation()
  const archiveNote = useArchiveNoteMutation()
  const restoreNote = useRestoreNoteMutation()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false)
  const [exportPending, setExportPending] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  // The outline's scroll-spy needs the editor as reactive state, not a ref
  // read during render — see the comment on `onEditorChange` in
  // `tiptap-editor.tsx`.
  const [liveEditor, setLiveEditor] = useState<Editor | null>(null)
  const paneRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [entries, setEntries] = useState(() => extractOutline(note.content))
  const [wordCount, setWordCount] = useState(() =>
    computeWordCount(note.content),
  )
  const [showHeaderTitle, setShowHeaderTitle] = useState(false)

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
  const inFlightPromiseRef = useRef<Promise<boolean> | null>(null)
  const deletedRef = useRef(false)
  // The freshest known `updated_at`, updated synchronously from the save
  // mutation's own response — the `note` prop lags behind by a render, so it
  // cannot be trusted for a timestamp read immediately after `await flush()`.
  const lastSavedAtRef = useRef(note.updatedAt)

  const isDirty = !note.isReadOnly && !draftsEqual(draft, savedSnapshot)

  const outline = useNoteOutline(entries, scrollRef, liveEditor)

  // Baseline both the draft and the saved snapshot against the editor's own
  // post-init JSON, so ProseMirror's parse-time attribute defaults are never
  // mistaken for an edit.
  const handleEditorReady = useCallback((content: JSONContent) => {
    setDraft((d) => ({ ...d, content }))
    setSavedSnapshot((s) => ({ ...s, content }))
    setEntries(extractOutline(content))
    setWordCount(computeWordCount(content))
  }, [])

  // The outline and word count recompute on blur and on save, never per
  // keystroke — typing `## ` would otherwise make the rail grow and the
  // byline reflow on every character.
  const handleEditorBlur = useCallback(() => {
    setEntries(extractOutline(draftRef.current.content))
    setWordCount(computeWordCount(draftRef.current.content))
  }, [])

  // The header shows the note title once its own `<h1>`-equivalent (the
  // title field) scrolls out of the pane's scroll root, so the reader keeps
  // their bearings deep in a long note without a data-dependent header.
  useEffect(() => {
    const root = scrollRef.current
    const target = titleRef.current
    if (!root || !target) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowHeaderTitle(!entry.isIntersecting),
      { root, threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  // Resolves to `true` once `current` is confirmed saved (including "was
  // already saved"), or `false` on a real failure — never rejects, so callers
  // that need to know whether it's safe to proceed (export's save gate) can
  // `await` it directly instead of racing `onSuccess`/`onError`.
  const flush = useCallback(
    (current: Draft): Promise<boolean> => {
      if (deletedRef.current) return Promise.resolve(false)
      if (draftsEqual(current, savedSnapshotRef.current)) {
        return Promise.resolve(true)
      }
      if (inFlightRef.current && draftsEqual(current, inFlightRef.current)) {
        return inFlightPromiseRef.current ?? Promise.resolve(true)
      }

      inFlightRef.current = current
      setSaveState('saving')
      const plainText = noteContentToPlainText(current.content)
        .replace(/\s+/g, ' ')
        .trim()

      const promise = updateContent
        .mutateAsync({
          id: note.id,
          title: current.title,
          content: current.content,
          plainText,
        })
        .then((row) => {
          inFlightRef.current = null
          lastSavedAtRef.current = row.updated_at
          setSavedSnapshot(current)
          setSaveState('saved')
          setEntries(extractOutline(current.content))
          setWordCount(computeWordCount(current.content))
          window.setTimeout(() => {
            setSaveState((s) => (s === 'saved' ? 'idle' : s))
          }, 2000)
          if (!draftsEqual(draftRef.current, current)) {
            void flush(draftRef.current)
          }
          return true
        })
        .catch(() => {
          inFlightRef.current = null
          setSaveState('idle')
          return false
        })

      inFlightPromiseRef.current = promise
      return promise
    },
    [note.id, updateContent],
  )

  const handleSaveClick = () => {
    void flush(draftRef.current)
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
        void flush(draftRef.current)
      }
      return
    }

    // `relatedTarget` is null for a click on a non-focusable region or the
    // window itself losing focus — defer and check `document.activeElement`
    // instead of assuming the pane was left.
    window.setTimeout(() => {
      const active = document.activeElement
      if (active && isWithinEditorSurface(pane, active)) return
      void flush(draftRef.current)
    }, 0)
  }

  const handlePaneKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const isSaveShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
    if (!isSaveShortcut) return
    event.preventDefault()
    void flush(draftRef.current)
  }

  useBeforeUnloadGuard(isDirty)

  // Flush a pending save when switching notes, unmounting, or the tab is
  // closing — never lose the last few keystrokes.
  useEffect(() => {
    const handlePageHide = () => void flush(draftRef.current)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      void flush(draftRef.current)
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

  const handleArchive = () => {
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
    archiveNote.mutate(note.id)
    selectNote(nextId)
    setConfirmOpen(false)
    toast.success('Note archived', {
      action: {
        label: 'Undo',
        // Waits for the restore to land before re-selecting — selecting
        // immediately would refetch the note while it's still archived
        // server-side and surface a spurious "not found".
        onClick: () => {
          restoreNote.mutate(note.id, {
            onSuccess: () => selectNote(note.id),
          })
        },
      },
    })
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

  const runExport = useCallback(
    async (exported: Draft) => {
      setExportPending(true)
      const toastId = toast.loading('Building PDF…')
      try {
        const result = await exportNoteToPdf({
          title: exported.title,
          tags: note.tags,
          content: exported.content,
          updatedAt: lastSavedAtRef.current,
        })
        const suffix =
          result.skipped.length > 0
            ? ` · ${result.skipped.length} item${result.skipped.length === 1 ? '' : 's'} could not be embedded`
            : result.usedFallbackFonts
              ? ' · used fallback fonts'
              : ''
        toast.success(`Exported ${result.filename}${suffix}`, { id: toastId })
      } catch (error) {
        toast.error("Couldn't build the PDF", {
          id: toastId,
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setExportPending(false)
      }
    },
    [note.tags],
  )

  const handleExportClick = () => {
    if (exportPending) return
    if (!isDirty) {
      void runExport(draftRef.current)
      return
    }
    setExportConfirmOpen(true)
  }

  const handleConfirmSaveAndExport = async () => {
    setExportConfirmOpen(false)
    const draftToExport = draftRef.current
    const saved = await flush(draftToExport)
    if (!saved) {
      toast.error("Couldn't save the note — nothing was exported")
      return
    }
    void runExport(draftToExport)
  }

  const showSaveBar = !note.isReadOnly && (isDirty || saveState === 'saving')

  return (
    <section
      ref={paneRef}
      onBlur={handlePaneBlur}
      onKeyDown={handlePaneKeyDown}
      className="relative flex min-w-0 flex-1 flex-col"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label="Back to notes"
              className="shrink-0 text-muted-foreground"
            >
              <ChevronLeft className="size-4" />
            </Button>
          ) : null}
          {showHeaderTitle ? (
            <TruncatedText className="truncate text-sm font-medium text-foreground">
              {draft.title || 'Untitled'}
            </TruncatedText>
          ) : null}
          {note.isReadOnly ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Read-only
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
              note.isFavorite && 'text-favorite hover:text-favorite',
            )}
          >
            <Star className={cn('size-4', note.isFavorite && 'fill-current')} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="More actions"
                className="text-muted-foreground"
              >
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-note-editor-portal="">
              <DropdownMenuItem
                disabled={undoDisabled}
                onClick={() => editorRef.current?.chain().focus().undo().run()}
              >
                <Undo2 />
                Undo
                <DropdownMenuShortcut>
                  {getUndoShortcutLabel()}
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={redoDisabled}
                onClick={() => editorRef.current?.chain().focus().redo().run()}
              >
                <Redo2 />
                Redo
                <DropdownMenuShortcut>
                  {getRedoShortcutLabel()}
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={exportPending}
                onClick={handleExportClick}
              >
                {exportPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleReadOnly}>
                {note.isReadOnly ? <Lock /> : <Unlock />}
                {note.isReadOnly ? 'Unlock note' : 'Lock note'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 />
                Move to Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5',
            showSaveBar && 'pb-20',
          )}
        >
          <div className="mx-auto w-full max-w-[44rem]">
            {/* `pl-8` matches `.note-tiptap`'s own left padding (styles.css)
                so the title and byline stay aligned with the body text,
                which is itself indented to make room for the block drag
                handle's gutter. */}
            <div className="pl-8">
              <input
                ref={titleRef}
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

              <NoteByline
                note={note}
                wordCount={wordCount}
                saveState={saveState}
                isDirty={isDirty}
                onTagsChange={handleTagsChange}
              />
            </div>

            <div className="mt-6">
              <TiptapEditor
                key={note.id}
                noteId={note.id}
                content={draft.content}
                isReadOnly={note.isReadOnly}
                editorRef={editorRef}
                onEditorChange={setLiveEditor}
                onHistoryChange={handleHistoryChange}
                onChange={(content) => setDraft((d) => ({ ...d, content }))}
                onReady={handleEditorReady}
                onBlur={handleEditorBlur}
              />
            </div>
          </div>
        </div>

        <NoteOutline
          entries={entries}
          activeIndex={outline.activeIndex}
          progress={outline.progress}
          isReadOnly={note.isReadOnly}
          onSelect={outline.scrollTo}
        />
        <NoteOutlineMobileMenu
          entries={entries}
          activeIndex={outline.activeIndex}
          progress={outline.progress}
          isReadOnly={note.isReadOnly}
          isRaised={showSaveBar}
          onSelect={outline.scrollTo}
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleArchive}
        title="Move to Archive?"
        description={`"${note.title || 'Untitled'}" will be moved to the Archive and permanently deleted after 30 days.`}
        confirmLabel="Move to Archive"
      />

      <ConfirmDialog
        open={exportConfirmOpen}
        onOpenChange={setExportConfirmOpen}
        onConfirm={() => void handleConfirmSaveAndExport()}
        title="Save before exporting?"
        description="This note has unsaved changes. They'll be saved first so the PDF matches your note."
        confirmLabel="Save & export"
      />

      {showSaveBar ? (
        <UnsavedChangesBar
          state={saveState === 'saving' ? 'saving' : 'dirty'}
          onSave={handleSaveClick}
        />
      ) : null}
    </section>
  )
}
