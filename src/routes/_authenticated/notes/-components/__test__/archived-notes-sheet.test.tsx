import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ArchivedNotesSheet } from '../archived-notes-sheet'
import { useArchivedNotesQuery } from '../../-utils/notes-queries'

import type { ArchivedNote } from '../../-types/notes-query'
import type { Mock } from 'vitest'

vi.mock('#/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('../../-utils/notes-queries', () => ({
  useArchivedNotesQuery: vi.fn(),
  useRestoreNoteMutation: vi.fn(() => ({ mutate: vi.fn() })),
  usePurgeNoteMutation: vi.fn(() => ({ mutate: vi.fn() })),
}))

const useArchivedNotesQueryMock = useArchivedNotesQuery as unknown as Mock

const archivedNote: ArchivedNote = {
  id: 'note-1',
  title: 'Old draft',
  excerpt: 'A draft',
  tags: [],
  isFavorite: false,
  isReadOnly: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
}

beforeEach(() => {
  useArchivedNotesQueryMock.mockReturnValue({
    data: { data: [archivedNote], count: 1 },
    isFetching: false,
    isLoading: false,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ArchivedNotesSheet', () => {
  it('renders nothing when closed', () => {
    render(<ArchivedNotesSheet open={false} onOpenChange={() => {}} />)

    expect(screen.queryByText('Archived notes')).toBeNull()
  })

  it('renders the title, description, and archived notes table when open', () => {
    render(<ArchivedNotesSheet open onOpenChange={() => {}} />)

    expect(screen.getByText('Archived notes')).toBeTruthy()
    expect(
      screen.getByText('Kept for 30 days, then permanently removed.'),
    ).toBeTruthy()
    expect(screen.getByText('Old draft')).toBeTruthy()
  })
})
