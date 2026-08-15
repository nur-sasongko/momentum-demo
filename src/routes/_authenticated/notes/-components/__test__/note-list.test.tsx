import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotesFilters } from '../../-utils/use-notes-filters'
import { NoteList } from '../note-list'
import {
  useArchivedNotesCountQuery,
  useArchivedNotesQuery,
  useCreateNoteMutation,
  useDeleteTagMutation,
  useNotesListParams,
  useNotesListQuery,
  useNoteTagsQuery,
  usePurgeNoteMutation,
  useRenameTagMutation,
  useRestoreNoteMutation,
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
  useArchivedNotesCountQuery: vi.fn(),
  useArchivedNotesQuery: vi.fn(),
  useCreateNoteMutation: vi.fn(),
  useNotesListParams: vi.fn(),
  useNotesListQuery: vi.fn(),
  useNoteTagsQuery: vi.fn(),
  usePurgeNoteMutation: vi.fn(),
  useRenameTagMutation: vi.fn(),
  useRestoreNoteMutation: vi.fn(),
  useDeleteTagMutation: vi.fn(),
}))

vi.mock('../../-utils/use-notes-filters', () => ({
  useNotesFilters: vi.fn(),
}))

// jsdom has no `matchMedia`; `ArchivedNotesSheet` (mounted here, even while
// closed) reads it via `useIsMobile`, so stub the hook rather than jsdom.
vi.mock('#/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

function mockNotesFilters(overrides: Record<string, unknown> = {}) {
  vi.mocked(useNotesFilters).mockReturnValue({
    selectedId: null,
    searchQuery: '',
    activeTags: [],
    tagFilterMode: 'OR',
    untaggedOnly: false,
    favoritesOnly: false,
    sortBy: 'updated-desc',
    selectNote: vi.fn(),
    setSearch: vi.fn(),
    setActiveTags: vi.fn(),
    toggleActiveTag: vi.fn(),
    setTagFilterMode: vi.fn(),
    setUntaggedOnly: vi.fn(),
    setFavoritesOnly: vi.fn(),
    setSortBy: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useNotesFilters>)
}

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  mockNotesFilters()

  vi.mocked(useNotesListParams).mockReturnValue(
    {} as unknown as ReturnType<typeof useNotesListParams>,
  )
  vi.mocked(useNoteTagsQuery).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useNoteTagsQuery>)
  vi.mocked(useArchivedNotesCountQuery).mockReturnValue({
    data: 0,
  } as unknown as ReturnType<typeof useArchivedNotesCountQuery>)
  vi.mocked(useArchivedNotesQuery).mockReturnValue({
    data: { data: [], count: 0 },
    isFetching: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useArchivedNotesQuery>)
  vi.mocked(useRestoreNoteMutation).mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useRestoreNoteMutation>)
  vi.mocked(usePurgeNoteMutation).mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof usePurgeNoteMutation>)
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

  it('shows no count on the Archive button when nothing is archived', () => {
    vi.mocked(useNotesListQuery).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useNotesListQuery>)

    renderNoteList()

    const button = screen.getByRole('button', { name: 'Archived notes' })
    expect(button.textContent).toBe('')
  })

  it('shows the archived count on the Archive button', () => {
    vi.mocked(useNotesListQuery).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useNotesListQuery>)
    vi.mocked(useArchivedNotesCountQuery).mockReturnValue({
      data: 3,
    } as unknown as ReturnType<typeof useArchivedNotesCountQuery>)

    renderNoteList()

    expect(
      screen.getByRole('button', { name: 'Archived notes' }).textContent,
    ).toBe('3')
  })

  it('opens the archived notes sheet when the Archive button is clicked', () => {
    vi.mocked(useNotesListQuery).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useNotesListQuery>)

    renderNoteList()

    expect(screen.queryByText('Archived notes')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Archived notes' }))
    expect(screen.getByText('Archived notes')).toBeTruthy()
  })
})
