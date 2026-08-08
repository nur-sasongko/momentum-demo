import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotesStore } from '#/stores/notes-store'
import { NoteEditor } from '../note-editor'
import {
  useDeleteNoteMutation,
  useNotesListParams,
  useNoteTagsQuery,
  useUpdateNoteContentMutation,
  useUpdateNoteMetaMutation,
} from '../../-utils/notes-queries'

import type { ReactElement } from 'react'
import type { Note } from '#/stores/notes-store'

vi.mock('../tiptap-editor', () => ({
  TiptapEditor: () => <div data-testid="tiptap-editor-stub" />,
}))

vi.mock('../../-utils/notes-queries', () => ({
  NOTES_KEYS: { list: (params: unknown) => ['notes', 'list', params] },
  useNoteTagsQuery: vi.fn(),
  useNotesListParams: vi.fn(),
  useUpdateNoteContentMutation: vi.fn(),
  useUpdateNoteMetaMutation: vi.fn(),
  useDeleteNoteMutation: vi.fn(),
}))

function renderNoteEditor(ui: ReactElement) {
  const queryClient = new QueryClient()
  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
  return {
    ...result,
    rerender: (nextUi: ReactElement) =>
      result.rerender(
        <QueryClientProvider client={queryClient}>
          {nextUi}
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

let contentMutate: ReturnType<typeof vi.fn>
let metaMutate: ReturnType<typeof vi.fn>
let deleteMutate: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  useNotesStore.setState({ selectedId: null })

  contentMutate = vi.fn()
  metaMutate = vi.fn()
  deleteMutate = vi.fn()

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
  vi.mocked(useDeleteNoteMutation).mockReturnValue({
    mutate: deleteMutate,
  } as unknown as ReturnType<typeof useDeleteNoteMutation>)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('NoteEditor autosave', () => {
  it('coalesces rapid title keystrokes into a single content mutation', () => {
    const note = makeNote()
    renderNoteEditor(<NoteEditor note={note} />)

    const titleInput = screen.getByLabelText('Note title')
    fireEvent.change(titleInput, { target: { value: 'H' } })
    fireEvent.change(titleInput, { target: { value: 'He' } })
    fireEvent.change(titleInput, { target: { value: 'Hello' } })

    act(() => {
      vi.advanceTimersByTime(800)
    })

    expect(contentMutate).toHaveBeenCalledTimes(1)
    expect(contentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Hello' }),
      expect.anything(),
    )
  })

  it('flushes a pending save when the note id changes', () => {
    const note = makeNote()
    const { rerender } = renderNoteEditor(<NoteEditor note={note} />)

    fireEvent.change(screen.getByLabelText('Note title'), {
      target: { value: 'Unsaved edit' },
    })

    rerender(<NoteEditor note={makeNote({ id: 'note-2' })} />)

    expect(contentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Unsaved edit' }),
      expect.anything(),
    )
  })

  it('flushes a pending save on unmount', () => {
    const note = makeNote()
    const { unmount } = renderNoteEditor(<NoteEditor note={note} />)

    fireEvent.change(screen.getByLabelText('Note title'), {
      target: { value: 'Unsaved edit' },
    })

    unmount()

    expect(contentMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', title: 'Unsaved edit' }),
      expect.anything(),
    )
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
})
