import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NoteListItem } from '../note-list-item'

import type { NoteSummary } from '#/stores/notes-store'

vi.mock('../../-utils/use-notes-filters', () => ({
  useNotesFilters: () => ({ selectNote: vi.fn() }),
}))

// jsdom has no `ResizeObserver`; `TruncatedText` (title, tag run) needs one.
beforeEach(() => {
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

function makeSummary(overrides: Partial<NoteSummary> = {}): NoteSummary {
  return {
    id: 'note-1',
    title: 'Q3 Planning',
    excerpt: 'Goals: ship habits, second brain MVP',
    tags: ['Work', 'Ideas'],
    isFavorite: false,
    isReadOnly: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('NoteListItem', () => {
  it('renders the title and excerpt', () => {
    render(<NoteListItem note={makeSummary()} isActive={false} />)

    expect(screen.getByText('Q3 Planning')).toBeTruthy()
    expect(
      screen.getByText('Goals: ship habits, second brain MVP'),
    ).toBeTruthy()
  })

  it('renders tags from the summary as one line of #tag text', () => {
    render(<NoteListItem note={makeSummary()} isActive={false} />)

    expect(screen.getByText('#Work #Ideas')).toBeTruthy()
  })

  it('shows the lock icon for a read-only note', () => {
    render(
      <NoteListItem
        note={makeSummary({ isReadOnly: true })}
        isActive={false}
      />,
    )

    expect(screen.getByLabelText('Read-only')).toBeTruthy()
  })

  it('shows the star icon for a favorited note', () => {
    render(
      <NoteListItem
        note={makeSummary({ isFavorite: true })}
        isActive={false}
      />,
    )

    expect(screen.getByLabelText('Favorited')).toBeTruthy()
  })
})
