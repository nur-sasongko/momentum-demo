import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TagManagerDialog } from '../tag-manager-dialog'
import {
  useDeleteTagMutation,
  useNoteTagsQuery,
  useRenameTagMutation,
} from '../../-utils/notes-queries'

vi.mock('../../-utils/notes-queries', () => ({
  useNoteTagsQuery: vi.fn(),
  useRenameTagMutation: vi.fn(),
  useDeleteTagMutation: vi.fn(),
}))

let renameMutate: ReturnType<typeof vi.fn>
let deleteMutate: ReturnType<typeof vi.fn>

beforeEach(() => {
  renameMutate = vi.fn()
  deleteMutate = vi.fn()

  vi.mocked(useNoteTagsQuery).mockReturnValue({
    data: [
      { tag: 'Work', noteCount: 3 },
      { tag: 'Ideas', noteCount: 1 },
    ],
  } as unknown as ReturnType<typeof useNoteTagsQuery>)
  vi.mocked(useRenameTagMutation).mockReturnValue({
    mutate: renameMutate,
  } as unknown as ReturnType<typeof useRenameTagMutation>)
  vi.mocked(useDeleteTagMutation).mockReturnValue({
    mutate: deleteMutate,
  } as unknown as ReturnType<typeof useDeleteTagMutation>)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TagManagerDialog', () => {
  it('renders tag names and counts from the tags query', () => {
    render(<TagManagerDialog open onOpenChange={() => {}} />)

    expect(screen.getByText('Work')).toBeTruthy()
    expect(
      screen.getByText((_, node) => node?.textContent === '3 notes'),
    ).toBeTruthy()
    expect(screen.getByText('Ideas')).toBeTruthy()
    expect(
      screen.getByText((_, node) => node?.textContent === '1 note'),
    ).toBeTruthy()
  })

  it('calls the rename mutation when a rename is committed', () => {
    render(<TagManagerDialog open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByLabelText('Rename Work'))
    fireEvent.change(screen.getByLabelText('Rename tag Work'), {
      target: { value: 'Projects' },
    })
    fireEvent.click(screen.getByLabelText('Save'))

    expect(renameMutate).toHaveBeenCalledWith(
      { oldTag: 'Work', newTag: 'Projects' },
      expect.anything(),
    )
  })

  it('calls the delete mutation after confirming', () => {
    render(<TagManagerDialog open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByLabelText('Delete Ideas'))
    fireEvent.click(screen.getByLabelText('Confirm delete Ideas'))

    expect(deleteMutate).toHaveBeenCalledWith('Ideas', expect.anything())
  })
})
