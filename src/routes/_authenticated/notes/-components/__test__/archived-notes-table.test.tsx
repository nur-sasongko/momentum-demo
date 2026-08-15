import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useArchivedNotesQuery,
  usePurgeNoteMutation,
  useRestoreNoteMutation,
} from '../../-utils/notes-queries'
import { ArchivedNotesTable } from '../archived-notes-table'

import type { ArchivedNote } from '../../-types/notes-query'
import type { Mock } from 'vitest'

vi.mock('../../-utils/notes-queries', () => ({
  useArchivedNotesQuery: vi.fn(),
  useRestoreNoteMutation: vi.fn(),
  usePurgeNoteMutation: vi.fn(),
}))

const useArchivedNotesQueryMock = useArchivedNotesQuery as unknown as Mock
const useRestoreNoteMutationMock = useRestoreNoteMutation as unknown as Mock
const usePurgeNoteMutationMock = usePurgeNoteMutation as unknown as Mock

const archivedNote: ArchivedNote = {
  id: 'note-1',
  title: 'Q3 planning',
  excerpt: 'Notes about Q3',
  tags: ['work'],
  isFavorite: false,
  isReadOnly: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
}

let restoreMutate: Mock
let purgeMutate: Mock

beforeEach(() => {
  useArchivedNotesQueryMock.mockReturnValue({
    data: { data: [archivedNote], count: 1 },
    isFetching: false,
    isLoading: false,
  })
  restoreMutate = vi.fn()
  useRestoreNoteMutationMock.mockReturnValue({ mutate: restoreMutate })
  purgeMutate = vi.fn()
  usePurgeNoteMutationMock.mockReturnValue({ mutate: purgeMutate })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ArchivedNotesTable', () => {
  it('renders the title, tags, and an expiry label', () => {
    render(<ArchivedNotesTable />)

    expect(screen.getByText('Q3 planning')).toBeTruthy()
    expect(screen.getByText('#work')).toBeTruthy()
    expect(screen.getByText('in 28 days')).toBeTruthy()
  })

  it('restores immediately, with no confirmation dialog', () => {
    render(<ArchivedNotesTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect(restoreMutate).toHaveBeenCalledWith('note-1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('does not purge until the confirmation dialog is confirmed', () => {
    render(<ArchivedNotesTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(purgeMutate).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Delete permanently?')).toBeTruthy()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete permanently' }),
    )
    expect(purgeMutate).toHaveBeenCalledWith('note-1')
  })

  it('does not purge when the confirmation dialog is cancelled', () => {
    render(<ArchivedNotesTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(purgeMutate).not.toHaveBeenCalled()
  })

  it('renders the empty state instead of a blank table', () => {
    useArchivedNotesQueryMock.mockReturnValue({
      data: { data: [], count: 0 },
      isFetching: false,
      isLoading: false,
    })

    render(<ArchivedNotesTable />)

    expect(screen.getByText('Nothing in the archive.')).toBeTruthy()
  })
})
