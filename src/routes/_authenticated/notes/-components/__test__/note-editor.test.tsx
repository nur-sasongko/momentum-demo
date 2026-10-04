import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotesFilters } from '../../-utils/use-notes-filters'
import { exportNoteToPdf } from '../../-utils/export-note-pdf'
import { NoteEditor } from '../note-editor'
import {
  useArchiveNoteMutation,
  useNotesListParams,
  useNoteTagsQuery,
  useRestoreNoteMutation,
  useUpdateNoteContentMutation,
  useUpdateNoteMetaMutation,
} from '../../-utils/notes-queries'

import type { JSONContent } from '@tiptap/core'
import type { ReactElement } from 'react'
import type { Note } from '#/stores/notes-store'

let latestOnChange: ((content: JSONContent) => void) | null = null
let latestOnBlur: (() => void) | null = null

vi.mock('../tiptap-editor', () => ({
  TiptapEditor: ({
    content,
    onChange,
    onReady,
    onBlur,
  }: {
    content: JSONContent
    onChange: (content: JSONContent) => void
    onReady?: (content: JSONContent) => void
    onBlur?: () => void
  }) => {
    useEffect(() => {
      onReady?.(content)
      // Mirrors `onCreate` firing exactly once per real editor instance.
    }, [])
    latestOnChange = onChange
    latestOnBlur = onBlur ?? null
    return <div data-testid="tiptap-editor-stub" />
  },
}))

// jsdom has no `matchMedia`; `NoteOutline` / `NoteOutlineMobileMenu` read it
// via `useIsMobile` / `useIsWide` even when they render nothing, so stub the
// hooks rather than jsdom.
vi.mock('#/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('#/hooks/use-is-wide', () => ({
  useIsWide: () => true,
}))

vi.mock('../../-utils/notes-queries', () => ({
  NOTES_KEYS: { list: (params: unknown) => ['notes', 'list', params] },
  useNoteTagsQuery: vi.fn(),
  useNotesListParams: vi.fn(),
  useUpdateNoteContentMutation: vi.fn(),
  useUpdateNoteMetaMutation: vi.fn(),
  useArchiveNoteMutation: vi.fn(),
  useRestoreNoteMutation: vi.fn(),
}))

vi.mock('../../-utils/use-notes-filters', () => ({
  useNotesFilters: vi.fn(),
}))

vi.mock('../../-utils/export-note-pdf', () => ({
  exportNoteToPdf: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function renderNoteEditor(
  ui: ReactElement,
  seed?: (queryClient: QueryClient) => void,
) {
  const queryClient = new QueryClient()
  seed?.(queryClient)
  const result = render(
    <QueryClientProvider client={queryClient}>
      {ui}
      <button type="button" data-testid="outside-target">
        outside
      </button>
    </QueryClientProvider>,
  )
  return {
    ...result,
    queryClient,
    rerender: (nextUi: ReactElement) =>
      result.rerender(
        <QueryClientProvider client={queryClient}>
          {nextUi}
          <button type="button" data-testid="outside-target">
            outside
          </button>
        </QueryClientProvider>,
      ),
  }
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    excerpt: '',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    isReadOnly: false,
    ...overrides,
  }
}

const BODY_EDIT: JSONContent = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Body edit' }] },
  ],
}

const HEADING_ONLY: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Intro' }],
    },
  ],
}

const HEADING_WITH_NEW_SECTION: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Intro' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Setup' }],
    },
  ],
}

interface PendingSave {
  input: { id: string; title: string; content: JSONContent }
  resolve: (row: { updated_at: string }) => void
  reject: (error: Error) => void
}

let contentMutateAsync: ReturnType<typeof vi.fn>
let metaMutate: ReturnType<typeof vi.fn>
let archiveMutate: ReturnType<typeof vi.fn>
let restoreMutate: ReturnType<typeof vi.fn>
let pendingSaves: PendingSave[]

function typeTitle(value: string) {
  fireEvent.change(screen.getByLabelText('Note title'), {
    target: { value },
  })
}

function blurTitleTo(relatedTarget: Element | null) {
  fireEvent.blur(screen.getByLabelText('Note title'), { relatedTarget })
}

function pressSaveShortcut(key: 'ctrlKey' | 'metaKey' = 'ctrlKey') {
  return fireEvent.keyDown(screen.getByLabelText('Note title'), {
    key: 's',
    [key]: true,
  })
}

function lastPendingSave(): PendingSave | undefined {
  return pendingSaves[pendingSaves.length - 1]
}

/** Resolves the most recent in-flight save and flushes the `.then` chain. */
async function resolveLastSave(updatedAt = '2026-01-02T00:00:00.000Z') {
  const pending = lastPendingSave()
  await act(async () => {
    pending?.resolve({ updated_at: updatedAt })
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Rejects the most recent in-flight save and flushes the `.catch` chain. */
async function rejectLastSave() {
  const pending = lastPendingSave()
  await act(async () => {
    pending?.reject(new Error('save failed'))
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function bylineMetaText(): string {
  return screen.getByText(/^Edited /).textContent
}

function bylineStatusText(): string | null {
  return screen.queryByTestId('note-byline-status')?.textContent ?? null
}

// Radix's `DropdownMenuTrigger` opens on `pointerdown`, not `click` (see
// `@radix-ui/react-dropdown-menu`'s `onPointerDown` handler) — a bare
// `fireEvent.click` never opens it in jsdom, which has no full pointer/mouse
// event sequence like a real browser or `userEvent.click` would produce.
function openOverflowMenu() {
  fireEvent.pointerDown(screen.getByLabelText('More actions'), {
    button: 0,
    ctrlKey: false,
  })
}

function openArchiveConfirm() {
  openOverflowMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Archive' }))
}

function clickExportMenuItem() {
  openOverflowMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Export as PDF' }))
}

// Radix's dismissable-layer primitives (`DropdownMenuContent`,
// `AlertDialogContent`) listen for `Escape` on `document` to close — closing
// any left open before the test ends lets `Presence`'s internal state
// machine settle synchronously within this test's own act scope, rather
// than via RTL's auto-`cleanup()` unmount, which can otherwise leave an
// async transition to fire during a later, unrelated test.
function closeAnyOpenOverlay() {
  fireEvent.keyDown(document, { key: 'Escape' })
}

beforeEach(() => {
  // jsdom has neither. `showHeaderTitle`'s effect constructs an
  // `IntersectionObserver`; `TruncatedText` (the outline rail's labels, and
  // the header title once it renders) constructs a `ResizeObserver`.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )

  latestOnChange = null
  latestOnBlur = null
  pendingSaves = []

  contentMutateAsync = vi.fn((input: PendingSave['input']) => {
    return new Promise<{ updated_at: string }>((resolve, reject) => {
      pendingSaves.push({ input, resolve, reject })
    })
  })
  metaMutate = vi.fn()
  archiveMutate = vi.fn()
  restoreMutate = vi.fn()

  vi.mocked(exportNoteToPdf).mockResolvedValue({
    filename: 'note.pdf',
    skipped: [],
    usedFallbackFonts: false,
  })

  vi.mocked(useNotesFilters).mockReturnValue({
    selectedId: null,
    selectNote: vi.fn(),
  } as unknown as ReturnType<typeof useNotesFilters>)
  vi.mocked(useNoteTagsQuery).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useNoteTagsQuery>)
  vi.mocked(useNotesListParams).mockReturnValue(
    {} as unknown as ReturnType<typeof useNotesListParams>,
  )
  vi.mocked(useUpdateNoteContentMutation).mockReturnValue({
    mutateAsync: contentMutateAsync,
  } as unknown as ReturnType<typeof useUpdateNoteContentMutation>)
  vi.mocked(useUpdateNoteMetaMutation).mockReturnValue({
    mutate: metaMutate,
  } as unknown as ReturnType<typeof useUpdateNoteMetaMutation>)
  vi.mocked(useArchiveNoteMutation).mockReturnValue({
    mutate: archiveMutate,
  } as unknown as ReturnType<typeof useArchiveNoteMutation>)
  vi.mocked(useRestoreNoteMutation).mockReturnValue({
    mutate: restoreMutate,
  } as unknown as ReturnType<typeof useRestoreNoteMutation>)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('NoteEditor — no phantom writes on open', () => {
  it('issues no save at mount, even after the old 800ms debounce window elapses', () => {
    vi.useFakeTimers()
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    act(() => {
      vi.advanceTimersByTime(800)
    })

    expect(contentMutateAsync).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('NoteEditor — no autosave', () => {
  it('typing in the title and waiting issues no save', () => {
    vi.useFakeTimers()
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(contentMutateAsync).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('typing in the body and waiting issues no save', () => {
    vi.useFakeTimers()
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    act(() => {
      latestOnChange?.(BODY_EDIT)
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(contentMutateAsync).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('NoteEditor — save triggers', () => {
  it('clicking outside the pane with no edits issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    blurTitleTo(screen.getByTestId('outside-target'))

    expect(contentMutateAsync).not.toHaveBeenCalled()
  })

  it('blurring the pane to an outside element issues exactly one save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    blurTitleTo(screen.getByTestId('outside-target'))

    expect(contentMutateAsync).toHaveBeenCalledTimes(1)
    expect(contentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Hello' }),
    )
  })

  it('moving focus from the title to the body issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    blurTitleTo(screen.getByTestId('tiptap-editor-stub'))

    expect(contentMutateAsync).not.toHaveBeenCalled()
  })

  it('blurring into an editor-owned portal (slash menu / link menu / table menu) issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    const portalNode = document.createElement('div')
    portalNode.setAttribute('data-note-editor-portal', '')
    document.body.appendChild(portalNode)

    typeTitle('Hello')
    blurTitleTo(portalNode)

    expect(contentMutateAsync).not.toHaveBeenCalled()

    portalNode.remove()
  })

  it('blurring into the archive confirmation dialog issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    openArchiveConfirm()

    const dialogContent = document.querySelector(
      '[data-slot="alert-dialog-content"]',
    )
    expect(dialogContent).not.toBeNull()

    blurTitleTo(dialogContent)

    expect(contentMutateAsync).not.toHaveBeenCalled()
    closeAnyOpenOverlay()
  })

  it('Ctrl+S saves once and prevents the browser save dialog', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    // `dispatchEvent` returns `false` when a handler called `preventDefault`.
    const notCancelled = pressSaveShortcut('ctrlKey')

    expect(contentMutateAsync).toHaveBeenCalledTimes(1)
    expect(notCancelled).toBe(false)
  })

  it('Cmd+S saves once and prevents the browser save dialog', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    const notCancelled = pressSaveShortcut('metaKey')

    expect(contentMutateAsync).toHaveBeenCalledTimes(1)
    expect(notCancelled).toBe(false)
  })

  it('flushes a pending save when the note id changes', () => {
    const note = makeNote()
    const { rerender } = renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Unsaved edit')
    rerender(<NoteEditor note={makeNote({ id: 'note-2' })} />)

    expect(contentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Unsaved edit' }),
    )
  })

  it('flushes a pending save on unmount', () => {
    const note = makeNote()
    const { unmount } = renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Unsaved edit')
    unmount()

    expect(contentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Unsaved edit' }),
    )
  })

  it('unmounting with no unsaved edits does not save', () => {
    const note = makeNote()
    const { unmount } = renderNoteEditor(<NoteEditor note={note} />)

    unmount()

    expect(contentMutateAsync).not.toHaveBeenCalled()
  })

  it('toggling favorite calls the meta mutation, not the content mutation', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    fireEvent.click(screen.getByLabelText('Add to favorites'))

    expect(metaMutate).toHaveBeenCalledWith({
      id: 'note-1',
      patch: { isFavorite: true },
    })
    expect(contentMutateAsync).not.toHaveBeenCalled()
  })

  it('a rejected save leaves the note dirty and re-saves on the next trigger', async () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    pressSaveShortcut()
    expect(contentMutateAsync).toHaveBeenCalledTimes(1)

    await rejectLastSave()

    pressSaveShortcut()
    expect(contentMutateAsync).toHaveBeenCalledTimes(2)
    expect(contentMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Hello' }),
    )
  })

  it('a read-only note issues no save on any trigger', () => {
    const note = makeNote({ isReadOnly: true })
    renderNoteEditor(<NoteEditor note={note} />)

    blurTitleTo(screen.getByTestId('outside-target'))
    pressSaveShortcut()

    expect(contentMutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('NoteEditor — archive', () => {
  it('does not archive when the trash icon is clicked without confirming', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    openArchiveConfirm()

    expect(archiveMutate).not.toHaveBeenCalled()
    expect(screen.getByText('Move to Archive?')).toBeTruthy()
    closeAnyOpenOverlay()
  })

  it('does not archive when the dialog is cancelled', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    openArchiveConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(archiveMutate).not.toHaveBeenCalled()
    expect(screen.queryByText('Move to Archive?')).toBeNull()
  })

  it('archives the note and advances selection to the next note on confirm', () => {
    const selectNote = vi.fn()
    vi.mocked(useNotesFilters).mockReturnValue({
      selectedId: 'note-2',
      selectNote,
    } as unknown as ReturnType<typeof useNotesFilters>)

    const note = makeNote({ id: 'note-2' })
    renderNoteEditor(<NoteEditor note={note} />, (queryClient) => {
      queryClient.setQueryData(['notes', 'list', {}], {
        pages: [
          {
            data: [
              makeNote({ id: 'note-1' }),
              makeNote({ id: 'note-2' }),
              makeNote({ id: 'note-3' }),
            ],
          },
        ],
      })
    })

    openArchiveConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'Move to Archive' }))

    expect(archiveMutate).toHaveBeenCalledWith('note-2')
    expect(selectNote).toHaveBeenCalledWith('note-3')
  })
})

describe('NoteEditor — save state UI', () => {
  it('follows idle → Unsaved changes → Saving… → Saved', async () => {
    vi.useFakeTimers()
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    expect(bylineStatusText()).toBeNull()

    typeTitle('Hello')
    expect(bylineStatusText()).toBe('Unsaved changes')

    pressSaveShortcut()
    expect(bylineStatusText()).toBe('Saving…')

    await resolveLastSave()
    expect(bylineStatusText()).toBe('Saved')

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(bylineStatusText()).toBeNull()

    vi.useRealTimers()
  })

  it('the byline metadata text never changes as the save status changes next to it', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    const before = bylineMetaText()
    typeTitle('Hello')

    expect(bylineMetaText()).toBe(before)
  })

  it('the save bar is absent on mount, appears after typing, and unmounts after a successful save', async () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    expect(screen.queryByRole('status')).toBeNull()

    typeTitle('Hello')
    expect(screen.getByRole('status')).toBeTruthy()

    pressSaveShortcut()
    await resolveLastSave()

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('clicking Save on the bar issues exactly one save (no double save from the blur it causes)', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    const saveButton = screen.getByRole('button', { name: 'Save' })

    fireEvent.blur(screen.getByLabelText('Note title'), {
      relatedTarget: saveButton,
    })
    fireEvent.click(saveButton)

    expect(contentMutateAsync).toHaveBeenCalledTimes(1)
  })

  it('disables the bar button while a save is in flight', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    pressSaveShortcut()

    const saveButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Save',
    })
    expect(saveButton.disabled).toBe(true)

    fireEvent.click(saveButton)
    expect(contentMutateAsync).toHaveBeenCalledTimes(1)
  })

  it('a rejected save leaves the bar in the dirty state with Save re-enabled', async () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    pressSaveShortcut()

    await rejectLastSave()

    const bar = screen.getByRole('status')
    expect(within(bar).getByText('Unsaved changes')).toBeTruthy()
    const saveButton = within(bar).getByRole<HTMLButtonElement>('button', {
      name: 'Save',
    })
    expect(saveButton.disabled).toBe(false)
  })
})

describe('NoteEditor — outline recompute timing', () => {
  it('does not update the rendered outline while typing, only on blur', () => {
    const note = makeNote({ content: HEADING_ONLY })
    renderNoteEditor(<NoteEditor note={note} />)

    expect(screen.getByText('Intro')).toBeTruthy()
    expect(screen.queryByText('Setup')).toBeNull()

    act(() => {
      latestOnChange?.(HEADING_WITH_NEW_SECTION)
    })
    expect(screen.queryByText('Setup')).toBeNull()

    act(() => {
      latestOnBlur?.()
    })
    expect(screen.getByText('Setup')).toBeTruthy()
  })

  it('recomputes the outline on blur without triggering a save', () => {
    const note = makeNote({ content: HEADING_ONLY })
    renderNoteEditor(<NoteEditor note={note} />)

    act(() => {
      latestOnChange?.(HEADING_WITH_NEW_SECTION)
    })
    act(() => {
      latestOnBlur?.()
    })

    expect(screen.getByText('Setup')).toBeTruthy()
    expect(contentMutateAsync).not.toHaveBeenCalled()
  })
})

describe('NoteEditor — PDF export', () => {
  it('shows Export as PDF in the overflow menu', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    openOverflowMenu()

    expect(screen.getByRole('menuitem', { name: 'Export as PDF' })).toBeTruthy()
    closeAnyOpenOverlay()
  })

  it('clean note: exporting calls the export shell directly, never the update mutation, with no confirm dialog', async () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    clickExportMenuItem()
    await flushMicrotasks()

    expect(exportNoteToPdf).toHaveBeenCalledTimes(1)
    expect(contentMutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByText('Save before exporting?')).toBeNull()
  })

  it('dirty note: exporting renders the confirm dialog and calls neither the mutation nor the export shell until confirmed', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    clickExportMenuItem()

    expect(screen.getByText('Save before exporting?')).toBeTruthy()
    expect(contentMutateAsync).not.toHaveBeenCalled()
    expect(exportNoteToPdf).not.toHaveBeenCalled()
    closeAnyOpenOverlay()
  })

  it('dirty note, confirmed: awaits the save, then exports with the saved content', async () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    clickExportMenuItem()
    fireEvent.click(screen.getByRole('button', { name: 'Save & export' }))

    expect(contentMutateAsync).toHaveBeenCalledTimes(1)
    expect(exportNoteToPdf).not.toHaveBeenCalled()

    await resolveLastSave('2026-03-01T00:00:00.000Z')

    expect(exportNoteToPdf).toHaveBeenCalledTimes(1)
    expect(exportNoteToPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello',
        updatedAt: '2026-03-01T00:00:00.000Z',
      }),
    )
  })

  it('dirty note, cancelled: no mutation, no export, note stays dirty', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    clickExportMenuItem()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(contentMutateAsync).not.toHaveBeenCalled()
    expect(exportNoteToPdf).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('dirty note, save rejects: an error toast fires and the export shell is never called', async () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    clickExportMenuItem()
    fireEvent.click(screen.getByRole('button', { name: 'Save & export' }))

    await rejectLastSave()

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't save the note — nothing was exported",
    )
    expect(exportNoteToPdf).not.toHaveBeenCalled()
  })

  it('read-only note: exporting shows no confirm dialog', async () => {
    const note = makeNote({ isReadOnly: true })
    renderNoteEditor(<NoteEditor note={note} />)

    clickExportMenuItem()
    await flushMicrotasks()

    expect(screen.queryByText('Save before exporting?')).toBeNull()
    expect(exportNoteToPdf).toHaveBeenCalledTimes(1)
  })

  it('disables the export menu item while an export is pending', async () => {
    let resolveExport:
      | ((value: Awaited<ReturnType<typeof exportNoteToPdf>>) => void)
      | undefined
    vi.mocked(exportNoteToPdf).mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve
      }),
    )

    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    clickExportMenuItem()

    openOverflowMenu()
    expect(
      screen
        .getByRole('menuitem', { name: 'Export as PDF' })
        .getAttribute('data-disabled'),
    ).not.toBeNull()

    await act(async () => {
      resolveExport?.({
        filename: 'note.pdf',
        skipped: [],
        usedFallbackFonts: false,
      })
      await Promise.resolve()
      await Promise.resolve()
    })
    closeAnyOpenOverlay()
  })
})
