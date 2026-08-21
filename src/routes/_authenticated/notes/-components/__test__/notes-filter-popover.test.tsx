import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NotesFilterPopover } from '../notes-filter-popover'
import { useNoteTagsQuery } from '../../-utils/notes-queries'
import { useNotesFilters } from '../../-utils/use-notes-filters'

vi.mock('../../-utils/notes-queries', () => ({
  useNoteTagsQuery: vi.fn(),
}))

vi.mock('../../-utils/use-notes-filters', () => ({
  useNotesFilters: vi.fn(),
}))

let toggleActiveTag: ReturnType<typeof vi.fn>
let setTagFilterMode: ReturnType<typeof vi.fn>
let setUntaggedOnly: ReturnType<typeof vi.fn>
let setFavoritesOnly: ReturnType<typeof vi.fn>
let clearAllFilters: ReturnType<typeof vi.fn>
let setSortBy: ReturnType<typeof vi.fn>

function mockFilters(overrides: Record<string, unknown> = {}) {
  vi.mocked(useNotesFilters).mockReturnValue({
    activeTags: [],
    tagFilterMode: 'OR',
    untaggedOnly: false,
    favoritesOnly: false,
    sortBy: 'updated-desc',
    toggleActiveTag,
    setTagFilterMode,
    setUntaggedOnly,
    setFavoritesOnly,
    clearAllFilters,
    setSortBy,
    ...overrides,
  } as unknown as ReturnType<typeof useNotesFilters>)
}

beforeEach(() => {
  toggleActiveTag = vi.fn()
  setTagFilterMode = vi.fn()
  setUntaggedOnly = vi.fn()
  setFavoritesOnly = vi.fn()
  clearAllFilters = vi.fn()
  setSortBy = vi.fn()

  mockFilters()
  vi.mocked(useNoteTagsQuery).mockReturnValue({
    data: [
      { tag: 'spec', noteCount: 12 },
      { tag: 'q3', noteCount: 8 },
    ],
  } as unknown as ReturnType<typeof useNoteTagsQuery>)

  // jsdom has no `ResizeObserver`; `TagPicker`'s rows use `TruncatedText`.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /Filter notes/ }))
}

describe('NotesFilterPopover', () => {
  it('shows no badge when no filters are active', () => {
    render(<NotesFilterPopover />)

    expect(screen.getByRole('button', { name: 'Filter notes' })).toBeTruthy()
  })

  it('badges the trigger with tags + favourites + untagged, excluding sort', () => {
    mockFilters({ activeTags: ['spec', 'q3'], favoritesOnly: true })
    render(<NotesFilterPopover />)

    expect(
      screen.getByRole('button', { name: 'Filter notes (3 active)' }),
    ).toBeTruthy()
  })

  it('shows the match control only when 2 or more tags are selected', () => {
    mockFilters({ activeTags: ['spec'] })
    render(<NotesFilterPopover />)
    openPopover()

    expect(screen.queryByText('Match')).toBeNull()
  })

  it('shows the match control at 2+ selected tags and toggles Any/All', () => {
    mockFilters({ activeTags: ['spec', 'q3'], tagFilterMode: 'OR' })
    render(<NotesFilterPopover />)
    openPopover()

    expect(screen.getByText('Match')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(setTagFilterMode).toHaveBeenCalledWith('AND')
  })

  it('checking Untagged only calls setUntaggedOnly', () => {
    render(<NotesFilterPopover />)
    openPopover()

    const label = screen.getByText('Untagged only')
    fireEvent.click(label.querySelector('[role="checkbox"]') as Element)

    expect(setUntaggedOnly).toHaveBeenCalledWith(true)
  })

  it('checking Favourites only calls setFavoritesOnly', () => {
    render(<NotesFilterPopover />)
    openPopover()

    const label = screen.getByText('Favourites only')
    fireEvent.click(label.querySelector('[role="checkbox"]') as Element)

    expect(setFavoritesOnly).toHaveBeenCalledWith(true)
  })

  it('Clear all calls clearAllFilters', () => {
    mockFilters({ activeTags: ['spec'], favoritesOnly: true })
    render(<NotesFilterPopover />)
    openPopover()

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(clearAllFilters).toHaveBeenCalledOnce()
  })

  it('Clear all is disabled when nothing is active', () => {
    render(<NotesFilterPopover />)
    openPopover()

    expect(
      screen
        .getByRole('button', { name: 'Clear all' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})
