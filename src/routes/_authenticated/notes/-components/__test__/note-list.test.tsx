import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotesStore } from '#/stores/notes-store'
import { NoteList } from '../note-list'
import {
  useCreateNoteMutation,
  useDeleteTagMutation,
  useNotesListParams,
  useNotesListQuery,
  useNoteTagsQuery,
  useRenameTagMutation,
} from '../../-utils/notes-queries'

function renderNoteList() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <NoteList />
    </QueryClientProvider>,
  )
}

vi.mock('../../-utils/notes-queries', () => ({
  useCreateNoteMutation: vi.fn(),
  useNotesListParams: vi.fn(),
  useNotesListQuery: vi.fn(),
  useNoteTagsQuery: vi.fn(),
  useRenameTagMutation: vi.fn(),
  useDeleteTagMutation: vi.fn(),
}))

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  useNotesStore.setState({
    selectedId: null,
    searchQuery: '',
    activeTags: [],
    tagFilterMode: 'OR',
    untaggedOnly: false,
    favoritesOnly: false,
    sortBy: 'updated-desc',
  })

  vi.mocked(useNotesListParams).mockReturnValue(
    {} as unknown as ReturnType<typeof useNotesListParams>,
  )
  vi.mocked(useNoteTagsQuery).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useNoteTagsQuery>)
  vi.mocked(useCreateNoteMutation).mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useCreateNoteMutation>)
  vi.mocked(useRenameTagMutation).mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useRenameTagMutation>)
  vi.mocked(useDeleteTagMutation).mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useDeleteTagMutation>)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('NoteList', () => {
  it('shows skeleton rows while the list is fetching', () => {
    vi.mocked(useNotesListQuery).mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useNotesListQuery>)

    const { container } = renderNoteList()

    expect(screen.queryByText('No notes match your filters.')).toBeNull()
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
  })

  it('shows the empty-filter message on an empty settled result', () => {
    vi.mocked(useNotesListQuery).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useNotesListQuery>)

    renderNoteList()

    expect(screen.getByText('No notes match your filters.')).toBeTruthy()
  })
})
