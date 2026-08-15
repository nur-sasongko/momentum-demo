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

vi.mock('../tiptap-editor', () => ({
  TiptapEditor: ({
    content,
    onChange,
    onReady,
  }: {
    content: JSONContent
    onChange: (content: JSONContent) => void
    onReady?: (content: JSONContent) => void
  }) => {
    useEffect(() => {
      onReady?.(content)
      // Mirrors `onCreate` firing exactly once per real editor instance.
    }, [])
    latestOnChange = onChange
    return <div data-testid="tiptap-editor-stub" />
  },
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

function headerText(): string {
  return screen.getByText(/Last edited/).textContent
}

beforeEach(() => {
  latestOnChange = null
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
    fireEvent.click(screen.getByLabelText('Archive note'))

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

    fireEvent.click(screen.getByLabelText('Archive note'))

    expect(archiveMutate).not.toHaveBeenCalled()
    expect(screen.getByText('Move to Archive?')).toBeTruthy()
  })

  it('does not archive when the dialog is cancelled', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    fireEvent.click(screen.getByLabelText('Archive note'))
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

    fireEvent.click(screen.getByLabelText('Archive note'))
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

    expect(headerText()).not.toContain('Unsaved changes')

    typeTitle('Hello')
    expect(headerText()).toContain('Unsaved changes')

    pressSaveShortcut()
    expect(headerText()).toContain('Saving…')

    act(() => {
      lastSaveOptions()?.onSuccess?.()
    })
    expect(headerText()).toContain('Saved')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(headerText()).not.toContain('Saved')
    expect(headerText()).not.toContain('Unsaved changes')

    vi.useRealTimers()
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
