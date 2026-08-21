import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotesFilters } from '../../-utils/use-notes-filters'
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

interface MutateOptions {
  onSuccess?: () => void
  onError?: () => void
}

let contentMutate: ReturnType<typeof vi.fn>
let metaMutate: ReturnType<typeof vi.fn>
let archiveMutate: ReturnType<typeof vi.fn>
let restoreMutate: ReturnType<typeof vi.fn>
let contentMutateCalls: Array<{ input: unknown; options?: MutateOptions }>

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

function lastSaveOptions() {
  return contentMutateCalls[contentMutateCalls.length - 1]?.options
}

function bylineMetaText(): string {
  return screen.getByText(/^Edited /).textContent
}

function bylineStatusText(): string | null {
  return screen.queryByTestId('note-byline-status')?.textContent ?? null
}

function openOverflowMenu() {
  fireEvent.click(screen.getByLabelText('More actions'))
}

function openArchiveConfirm() {
  openOverflowMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Archive' }))
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
  contentMutateCalls = []

  contentMutate = vi.fn((input: unknown, options?: MutateOptions) => {
    contentMutateCalls.push({ input, options })
  })
  metaMutate = vi.fn()
  archiveMutate = vi.fn()
  restoreMutate = vi.fn()

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
    mutate: contentMutate,
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

    expect(contentMutate).not.toHaveBeenCalled()
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

    expect(contentMutate).not.toHaveBeenCalled()
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

    expect(contentMutate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('NoteEditor — save triggers', () => {
  it('clicking outside the pane with no edits issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    blurTitleTo(screen.getByTestId('outside-target'))

    expect(contentMutate).not.toHaveBeenCalled()
  })

  it('blurring the pane to an outside element issues exactly one save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    blurTitleTo(screen.getByTestId('outside-target'))

    expect(contentMutate).toHaveBeenCalledTimes(1)
    expect(contentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Hello' }),
      expect.anything(),
    )
  })

  it('moving focus from the title to the body issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    blurTitleTo(screen.getByTestId('tiptap-editor-stub'))

    expect(contentMutate).not.toHaveBeenCalled()
  })

  it('blurring into an editor-owned portal (slash menu / link menu / table menu) issues no save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    const portalNode = document.createElement('div')
    portalNode.setAttribute('data-note-editor-portal', '')
    document.body.appendChild(portalNode)

    typeTitle('Hello')
    blurTitleTo(portalNode)

    expect(contentMutate).not.toHaveBeenCalled()

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

    expect(contentMutate).not.toHaveBeenCalled()
  })

  it('Ctrl+S saves once and prevents the browser save dialog', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    // `dispatchEvent` returns `false` when a handler called `preventDefault`.
    const notCancelled = pressSaveShortcut('ctrlKey')

    expect(contentMutate).toHaveBeenCalledTimes(1)
    expect(notCancelled).toBe(false)
  })

  it('Cmd+S saves once and prevents the browser save dialog', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    const notCancelled = pressSaveShortcut('metaKey')

    expect(contentMutate).toHaveBeenCalledTimes(1)
    expect(notCancelled).toBe(false)
  })

  it('flushes a pending save when the note id changes', () => {
    const note = makeNote()
    const { rerender } = renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Unsaved edit')
    rerender(<NoteEditor note={makeNote({ id: 'note-2' })} />)

    expect(contentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Unsaved edit' }),
      expect.anything(),
    )
  })

  it('flushes a pending save on unmount', () => {
    const note = makeNote()
    const { unmount } = renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Unsaved edit')
    unmount()

    expect(contentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Unsaved edit' }),
      expect.anything(),
    )
  })

  it('unmounting with no unsaved edits does not save', () => {
    const note = makeNote()
    const { unmount } = renderNoteEditor(<NoteEditor note={note} />)

    unmount()

    expect(contentMutate).not.toHaveBeenCalled()
  })

  it('toggling favorite calls the meta mutation, not the content mutation', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    fireEvent.click(screen.getByLabelText('Add to favorites'))

    expect(metaMutate).toHaveBeenCalledWith({
      id: 'note-1',
      patch: { isFavorite: true },
    })
    expect(contentMutate).not.toHaveBeenCalled()
  })

  it('a rejected save leaves the note dirty and re-saves on the next trigger', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    pressSaveShortcut()
    expect(contentMutate).toHaveBeenCalledTimes(1)

    act(() => {
      lastSaveOptions()?.onError?.()
    })

    pressSaveShortcut()
    expect(contentMutate).toHaveBeenCalledTimes(2)
    expect(contentMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Hello' }),
      expect.anything(),
    )
  })

  it('a read-only note issues no save on any trigger', () => {
    const note = makeNote({ isReadOnly: true })
    renderNoteEditor(<NoteEditor note={note} />)

    blurTitleTo(screen.getByTestId('outside-target'))
    pressSaveShortcut()

    expect(contentMutate).not.toHaveBeenCalled()
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
  it('follows idle → Unsaved changes → Saving… → Saved', () => {
    vi.useFakeTimers()
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    expect(bylineStatusText()).toBeNull()

    typeTitle('Hello')
    expect(bylineStatusText()).toBe('Unsaved changes')

    pressSaveShortcut()
    expect(bylineStatusText()).toBe('Saving…')

    act(() => {
      lastSaveOptions()?.onSuccess?.()
    })
    expect(bylineStatusText()).toBe('Saved')

    act(() => {
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

  it('the save bar is absent on mount, appears after typing, and unmounts after a successful save', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    expect(screen.queryByRole('status')).toBeNull()

    typeTitle('Hello')
    expect(screen.getByRole('status')).toBeTruthy()

    pressSaveShortcut()
    act(() => {
      lastSaveOptions()?.onSuccess?.()
    })

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

    expect(contentMutate).toHaveBeenCalledTimes(1)
  })

  it('disables the bar button while a save is in flight', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    pressSaveShortcut()

    const saveButton = screen.getByRole('button', {
      name: 'Save',
    })
    expect(saveButton.disabled).toBe(true)

    fireEvent.click(saveButton)
    expect(contentMutate).toHaveBeenCalledTimes(1)
  })

  it('a rejected save leaves the bar in the dirty state with Save re-enabled', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    typeTitle('Hello')
    pressSaveShortcut()

    act(() => {
      lastSaveOptions()?.onError?.()
    })

    const bar = screen.getByRole('status')
    expect(within(bar).getByText('Unsaved changes')).toBeTruthy()
    const saveButton = within(bar).getByRole('button', {
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
    expect(contentMutate).not.toHaveBeenCalled()
  })
})
