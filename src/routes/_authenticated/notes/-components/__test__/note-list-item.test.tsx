import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NoteListItem } from '../note-list-item'

import type { NoteSummary } from '#/stores/notes-store'

vi.mock('../../-utils/use-notes-filters', () => ({
  useNotesFilters: () => ({ selectNote: vi.fn() }),
}))

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

  it('renders tag chips from the summary', () => {
    render(<NoteListItem note={makeSummary()} isActive={false} />)

    expect(screen.getByText('#Work')).toBeTruthy()
    expect(screen.getByText('#Ideas')).toBeTruthy()
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
